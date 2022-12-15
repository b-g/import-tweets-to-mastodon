const debug = require('debug')('import');
const axios = require('axios');
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
    addDateFromTweet: false, // Adds '(15/9/2022) ' before the post (format depending on OS or below settings)
    changeDateLocaleTo: "", // Will default to OS settings
  },
  twitter: {
    limitNumberOfTweets: -1, // -1 means publish all tweets
    excludeReplies: true,
    excludeRetweets: false,
    limitTweetsToSetYear: true,
    year: new Date().getFullYear(),
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

    if (!config.twitter.excludeReplies) {
      return true;
    }

    if (config.twitter.excludeRetweets && tweet.full_text.indexOf('RT @') == 0) {
      // Apparently retweets Tweets start with "RT @"
      // Weirdly the property "retweeted" is false
      return false;
    }

    return !tweet.full_text.startsWith('@');
  }

  return tweets;
}
function importTweets(tweets) {
  const progress = require('progressbar').create().step('Importing tweets');
  const max = tweets.length;

  progress.setTotal(max);

  next(); // Starts the process

  function next() {
    const tweet = tweets.pop();
    let current = 0;
    if (!tweet) {
      debug('Tweets import completed');
      return;
    }

    let postText = tweet.full_text
    if(config.mastodon.addDateFromTweet){
      // Example from tweets.js "Mon Nov 02 23:45:58 +0000 2015"
  
      const tweetDate = moment(tweet.created_at, 'ddd MMM DD HH:mm:ss +-HHmm YYYY', 'en')
      if(config.mastodon.changeDateLocaleTo !== ""){
        tweetDate.locale(config.mastodon.changeDateLocaleTo)
      }
      postText = `(${tweetDate.format('l')}) ${postText}`
    }

    createMastodonPost({
      apiToken: config.mastodon.api.key,
      baseURL: config.mastodon.api.basePath
    },{
      status: replaceTwitterUrls(postText,tweet.entities.urls),
      language: tweet.lang
    }).then((mastodonPost) => {
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
function createMastodonPost({
  apiToken,
  baseURL
}, {
  status,
  language
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
      visibility: "public"
    }
  }).then(function(response) {
    return response.data
  });
}
importTweets(getTweets());
