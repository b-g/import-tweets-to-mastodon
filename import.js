const debug = require('debug')('import');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const env = require('common-env/withLogger')(console);
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
    postMedia: false,
    addDateFromTweet: false, // Adds '(15/9/2022) ' before the post (format depending on OS or below settings)
    changeDateLocaleTo: "", // Will default to OS settings
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

  if(config.twitter.limitNumberOfTweets !== -1){
    tweets = tweets.slice(0, config.twitter.limitNumberOfTweets)
  }

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
      const tweetDate = moment(tweet.created_at, 'ddd MMM DD HH:mm:ss +-HHmm YYYY', 'en') // Date format example from tweets.js: "Mon Nov 02 23:45:58 +0000 2015"
      if(config.mastodon.changeDateLocaleTo !== ""){
        tweetDate.locale(config.mastodon.changeDateLocaleTo)
      }
      postText = `(${tweetDate.format('l')}) ${postText}`
    }

    // 2. Load and upload media files as attachments
    let mediaIds = []
    if(config.mastodon.postMedia && tweet.extended_entities?.media){
      if(config.twitter.mediaPath == ""){
        console.error('Please specify the path to the Twitter media folder')
      }
      const mediaToUpload = tweet.extended_entities.media

      for(let i=0; i<mediaToUpload.length; i++){
        const fileName = tweet.id + '-' + mediaToUpload[i].media_url_https.replace('https://pbs.twimg.com/media/', '')
        const filePath = path.join(config.twitter.mediaPath, fileName)
        if(!fs.existsSync(filePath)){
          console.error("File doesn't exist at", filePath)
          console.error("-> Quitting")
          process.exit()
        }
        
        const response = await uploadMediaAsAttachment(
          {
            apiToken: config.mastodon.api.key,
            baseURL: config.mastodon.api.basePath
          },
          {
            fileData: fs.readFileSync(filePath),
            fileName: fileName
          }
        )
        if(response.id){
          mediaIds.push(response.id)
        }else{
          console.error("Uploading of", fileName, "failed")
          console.error("-> Quitting")
          process.exit()
        }
      }
    }

    // 3. Do the actual post
    createMastodonPost({
        apiToken: config.mastodon.api.key,
        baseURL: config.mastodon.api.basePath
      },{
        status: replaceTwitterUrls(postText,tweet.entities.urls),
        language: tweet.lang,
        mediaIds: mediaIds
    })
    .then((mastodonPost) => {
      debug('%s/%i Created post %s', current, max, mastodonPost.url);
      progress.addTick();
      next();
    }).catch(err => {
      console.log(err);
    });
  }
}
function replaceTwitterUrls(full_text, urls) {
  urls.forEach(url => {
    full_text=full_text.replace(url.url,url.expanded_url);
  });
  return full_text;
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
  mediaIds
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
      media_ids: mediaIds,
      visibility: "public"
    }
  }).then(function(response) {
    return response.data
  });
}
importTweets(getTweets());
