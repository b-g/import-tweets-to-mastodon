const debug = require('debug')('import');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const env = require('common-env/withLogger')(console);
const twitterDateFormat = 'ddd MMM DD HH:mm:ss +-HHmm YYYY';
let twitterPostIdMastodonLookupTable = {}
const config = env.getOrElseAll({
  mastodon: {
    api: {
      key: {
        $type: env.types.String,
      },
      basePath: {
        $type: env.types.String,
      }
    },
    preserveThreads: false,
    timeoutBetweenPosts: 0, // in seconds
    timeoutBetweenMediaUploads: 10, // in seconds
    runWithoutPosting: false, // For testing if all files are present
    postMedia: false,
    addDateFromTweet: false, // Adds '15/9/2022' before the post (format depending on OS or below settings)
    dateText: 'Originally on Twitter ({date}):\n\n',
    changeDateLocaleTo: "", // Will default to OS settings
    visibility: "public" // public, unlisted, private, direct
  },
  twitter: {
    limitNumberOfTweets: -1, // -1 means publish all tweets
    excludeReplies: true,
    excludeRetweets: false,
    limitTweetsToSetYear: true,
    year: new Date().getFullYear(),
    mediaPath: "",
    tweetjs: {
      filepath: {
        $type: env.types.String
      },
    }
  }
});
function getTweets() {
  const vm = require('vm');
  const fs = require('fs');
  const _global = {
    window: {
      YTD: {
        tweets: {
          part0: {}
        }
      }
    }
  };
  debug('Loading tweets...')
  const script = new vm.Script(fs.readFileSync(config.twitter.tweetjs.filepath, 'utf-8'));
  const context = vm.createContext(_global);
  script.runInContext(context);

  let tweets = Object.keys(_global.window.YTD.tweets.part0).reduce((m, key, i, obj) => {
    return m.concat(_global.window.YTD.tweets.part0[key].tweet);
  }, []).filter(_keepTweet)

  // Sort by date (tweet.js-data is not in order)
  tweets = tweets.sort((a, b) => {
    const dateA = moment(a.created_at, twitterDateFormat, 'en').unix()
    const dateB = moment(b.created_at, twitterDateFormat, 'en').unix()
    if (dateA > dateB) {
      return -1;
    }
    if (dateA < dateB) {
      return 1;
    }
    return 0;
  });

  if(config.twitter.limitNumberOfTweets !== -1){
    tweets = tweets.slice(0, config.twitter.limitNumberOfTweets)
  }

  // tweets.forEach((tweet, index) => {
  //   console.log(index + 1, tweets.length - index, tweet.created_at)
  // })

  debug('Loading %s tweets...', tweets.length);

  function _keepTweet(tweet) {
    if (config.twitter.limitTweetsToSetYear && !tweet.created_at.endsWith(config.twitter.year)) {
      return false;
    }

    if (config.twitter.excludeRetweets && tweet.full_text.startsWith('RT @')) {
      // Apparently retweets Tweets start with "RT @"
      // Weirdly the property "retweeted" is false
      return false;
    }

    if (config.twitter.excludeReplies && tweet.full_text.startsWith('@')) {
      return false;
    }

    return true
  }

  return tweets;
}
async function importTweets(tweets) {
  const progress = require('progressbar').create().step('Importing tweets');
  const max = tweets.length;

  progress.setTotal(max);

  await next(); // Starts the process

  async function next() {
    const tweet = tweets.pop();
    let current = 0;
    if (!tweet) {
      debug('Tweets import completed');
      return;
    }

    // 1. Prepare post text
    let postText = tweet.full_text
    if(config.mastodon.addDateFromTweet){
      const tweetDate = moment(tweet.created_at, twitterDateFormat, 'en') // Date format example from tweets.js: "Mon Nov 02 23:45:58 +0000 2015"
      if(config.mastodon.changeDateLocaleTo !== ""){
        tweetDate.locale(config.mastodon.changeDateLocaleTo)
      }
      let addedDateText = config.mastodon.dateText.replace('{date}', tweetDate.format('l'))
      addedDateText = addedDateText.replace(/\\n/g, '\n') // respect linebreaks in dateText env args
      postText = `${addedDateText}${postText}`
    }

    // 2. Load and upload media files as attachments
    let mediaIds = []
    if(config.mastodon.postMedia && tweet.extended_entities?.media){
      if(config.twitter.mediaPath == ""){
        console.error('Please specify the path to the Twitter media folder')
      }
      const mediaToUpload = tweet.extended_entities.media

      for(let i=0; i<mediaToUpload.length; i++){
        const fileNames = getPotentialFilesNames(tweet.id, mediaToUpload[i])

        let foundFilePath = ""
        let foundFileName = ""
        fileNames.forEach((fileName) => {
          const filePath = path.join(config.twitter.mediaPath, fileName)
          if(fs.existsSync(filePath)){
            foundFilePath = filePath
            foundFileName = fileName
          }
        })

        if(foundFilePath === ""){
          console.error("Couldn't find a file for tweet", tweet)
          process.exit()
        }

        if(config.mastodon.runWithoutPosting == true){
          // Don't upload media
        }else{
          const response = await uploadMediaAsAttachment(
            {
              apiToken: config.mastodon.api.key,
              baseURL: config.mastodon.api.basePath
            },
            {
              fileData: fs.readFileSync(foundFilePath),
              fileName: foundFileName
            }
          )

          await timeout(config.mastodon.timeoutBetweenMediaUploads * 1000);

          if(response.id){
            mediaIds.push(response.id)
          }else{
            console.error("Response:", response)
            console.error("Uploading of", foundFileName, "failed (probably due to rate limit)")
            console.error("-> Quitting")
            process.exit()
          }
        }
      }
    }

    // 3. Do the actual post
    postText = replaceTwitterUrls(postText,tweet.entities.urls)
    postText = expandTwitterHandles(postText)
    let inReplyToId = ""
    const tweetIdRepliedTo = tweet.in_reply_to_status_id
    if(config.mastodon.preserveThreads && twitterPostIdMastodonLookupTable[tweetIdRepliedTo]){
      inReplyToId = twitterPostIdMastodonLookupTable[tweetIdRepliedTo]
    }

    if(config.mastodon.runWithoutPosting == true){
      debug('%s/%i Tested post %s', current, max, '-');
      console.log("")
      console.log("—————————", current, "of", max,"—————————")
      if(inReplyToId !== ""){
        console.log("Is reply to ID:", inReplyToId)
      }
      console.log(postText)
      var simulatedMastodonPostId = Math.round(Math.random()*100000)
      twitterPostIdMastodonLookupTable[tweet.id] = simulatedMastodonPostId // Simulate receiving an id from Mastodon to test replies
      //console.log(twitterPostIdMastodonLookupTable)
      console.log("-> ID", simulatedMastodonPostId)
      progress.addTick();
      next()
    }else{
      createMastodonPost({
          apiToken: config.mastodon.api.key,
          baseURL: config.mastodon.api.basePath
        }, {
          status: postText,
          language: tweet.lang,
          inReplyToId: inReplyToId,
          mediaIds: mediaIds,
          visibility: config.mastodon.visibility
        })
      .then(async (mastodonPost) => {

        twitterPostIdMastodonLookupTable[tweet.id] = mastodonPost.id

        debug('%s/%i Created post %s', current, max, mastodonPost.url);
        progress.addTick();

        if(config.mastodon.timeoutBetweenPosts > 0 && tweets.length > 0){
          await timeout(config.mastodon.timeoutBetweenPosts * 1000);
        }

        next();
      }).catch(err => {
        console.error(err);
        console.error("Posting failed (see error above) for following tweet:", postText)
        console.error("-> Quitting")
        process.exit()
      });
    }
  }
}

function getPotentialFilesNames(tweetId, mediaInfo){
  // Note: There is no ID stated in the data so we have to search for it in the linked URLs
  let fileNames = []

  // For images:
  if(mediaInfo.media_url_https.indexOf('/tweet_video_thumb/') === -1 && mediaInfo.media_url_https.indexOf('ext_tw_video_thumb') === -1){
    // Skip if it's just a video preview image
    fileNames.push(tweetId + '-' + mediaInfo.media_url_https.replace('https://pbs.twimg.com/media/', ''))
  }

  // For videos:
  // - type 1: https://video.twimg.com/tweet_video/CAi7qu9WsAAzIFN.mp4
  // - type 2: https://video.twimg.com/ext_tw_video/1447583706231754753/pu/vid/1400x720/4jlDG9ltqjK9xJS4.mp4?tag=12
  // - type 3: https://video.twimg.com/ext_tw_video/936751020130041856/pu/vid/318x180/btpl6IDgJPkZWH3u.mp4

  mediaInfo.video_info?.variants.forEach((variant) => {
    // For type 1
    if(variant.url.indexOf('video.twimg.com/tweet_video/') !== -1){
      const fileId1 = tweetId + '-' + variant.url.replace('https://', '').replace('http://', '').replace('video.twimg.com/tweet_video/', '')
      fileNames.push(fileId1)
    }

    // For type 2 and 3
    const urlPartWithId = variant.url.match(/(\/vid\/).*?((?=\?)|$)/)?.[0]
    if(urlPartWithId){
      let fileId2 = urlPartWithId.replace('/vid/', '')
      let parts = fileId2.split('/')
      parts.shift()
      fileId2 = parts.join('/')
      fileId2 = tweetId + '-' + fileId2
      fileNames.push(fileId2)
    }
  })


  return fileNames
}

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function replaceTwitterUrls(full_text, urls) {
  urls.forEach(url => {
    full_text=full_text.replace(url.url,url.expanded_url);
  });
  return full_text;
}

function expandTwitterHandles(full_text) {
  return full_text.replace(/@\w+/g, handle => {
    return `${handle}@twitter.com`;
  });
}

function uploadMediaAsAttachment({
  apiToken,
  baseURL
}, {
  fileData,
  fileName
}) {
  const formData = new FormData()
  formData.append('file', fileData, fileName)
  return axios({
    url: '/api/v2/media',
    baseURL: baseURL,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiToken,
      ...formData.getHeaders()
    },
    data: formData.getBuffer()
  }).then(function(response) {
    return response.data
  });
}

function createMastodonPost({
  apiToken,
  baseURL
}, {
  status,
  language,
  inReplyToId,
  mediaIds,
  visibility
}) {
  return axios({
    url: '/api/v1/statuses',
    baseURL: baseURL,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiToken
    },
    data: {
      status,
      language,
      in_reply_to_id: inReplyToId,
      media_ids: mediaIds,
      visibility: visibility
    }
  }).then(function(response) {
    return response.data
  });
}
importTweets(getTweets());
