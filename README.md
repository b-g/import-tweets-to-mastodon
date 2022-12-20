# Importing tweets for a Mastodon instance :bird::arrow_right::elephant:
Thats a simples script to import yours tweets from any Twitter account to a Mastodon account, in any instance.

## Steps
For this tutorial, you'll need to install **Node.js** and **Git**.
 - Node.js: [Download | Node.js (nodejs.org)](https://nodejs.org/en/download/)
 - Git: [Git - Downloads (git-scm.com)](https://git-scm.com/downloads)
 
### #1 - Request your Twitter data in link below;
Go [here](https://twitter.com/settings/your_twitter_data) for request your Twitter data. You'll recive a link to download a zip file. There will be tweets, images, information etc. It'll be in this configuration:
 - twitter
    - assets (folder)
    - data (folder) 
    - Your archive (html file)

### #2 - Extract archive and look for `tweets.js`
Extract the file in your Desktop folder. Will be more easy for manipulate. Find the **tweets.js** file. It'll be, probably inside "data" folder and move it to Desktop.

### #3 - Clone this repo
Clone this repo in your Desktop folder with the command: 
```
git clone https://github.com/FGRibreau/import-tweets-to-mastodon.git
```
Or download the zip and extract in Desktop.
### #4 - Set an API key from Mastodon
To request an API key from Mastodon, click [here](https://mastodon.cloud/settings/applications) if you are on mastodon.social, otherwise go to `https://{your-mastodon.instance}/settings/applications`. Create an new application in "New Application". Set an Application Name (e. g.: api-mastodon-twitter) and, at the end of page, click in "Submit". 
### #5 - Set the environment variables
#### Windows
1. Copy your "Your access token" from developer's page in Mastodon;
2. Press "WIN + R" and write "cmd". Click ENTER;
3. Go to your Desktop folder;
4. Write 
```
MASTODON_API_BASEPATH=https://[YOUR-MASTODON-INSTANCE] 
```
```
MASTODON_API_KEY=YOUR_ACCESS_TOKEN_FROM_MASTODON
```
```
TWITTER_TWEETJS_FILEPATH=tweets.js
```

#### Linux and MacOS
1. Same thing as Windows;
2. Open Terminal;
3. Got to your Desktop folder;
4. Write
```
export MASTODON_API_BASEPATH=https://[YOUR-MASTODON-INSTANCE] 
```
```
export MASTODON_API_KEY=YOUR_ACCESS_TOKEN_FROM_MASTODON
```
```
export TWITTER_TWEETJS_FILEPATH=../tweets.js
```

### #6 - Setting the script
In the terminal (or CMD), enter in "import-tweets-mastodon" folder, located in Desktop. Write 
```
npm install

```
After this 
```
node import.js

```

### #7 - All options explained
| Command                      | Default                                        | Explanation                                                                                                                                                     |
|------------------------------|------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| TWITTER_TWEETJS_FILEPATH     |                                                | Path to tweet.js file, e.g. `../twitter-data/data/tweets.js`                                                                                                    |
| MASTODON_API_KEY             |                                                | The API key, looks like ` y8LptTshBDs4LmL3WTZxINgl4gHFPB0-mOzspqeIinM`                                                                                          |
| MASTODON_API_BASEPATH        |                                                | The url of your Mastodon instance, e.g. https://mastodon.social                                                                                                 |
|                              |                                                |                                                                                                                                                                 |
| TWITTER_LIMITTWEETSTOSETYEAR | true                                           | If only Tweets from the specified year should be considered                                                                                                     |
| TWITTER_YEAR                 | current year                                   |                                                                                                                                                                 |
| TWITTER_EXCLUDEREPLIES       | true                                           | Whether replies should be posted                                                                                                                                |
| TWITTER_EXCLUDERETWEETS      | false                                          | Whether retweets should be posted                                                                                                                               |
| MASTODON_POSTMEDIA           | false                                          | Whether media (images and video) should be posted                                                                                                               |
| TWITTER_MEDIAPATH            |                                                | Path to media folder, e.g. ` ../twitter-data/data/tweets_media/`                                                                                                |
|                              |                                                |                                                                                                                                                                 |
| MASTODON_TIMEOUTBETWEENPOSTS | 0                                              | Time in seconds between posts, necessary due to  [rate limit](https://docs.joinmastodon.org/api/rate-limits/#uploading-media) (= less than 1 post/minute when media-heavy) |
| MASTODON_ADDDATEFROMTWEET    | false                                          |                                                                                                                                                                 |
| MASTODON_DATETEXT            | `Originally on Twitter ({date}): \n\n`         | If a date should be added, which text should be added (`{date}` will be replaced by the date)                                                                   |
| MASTODON_CHANGEDATELOCALETO  | (if not specified uses your computer's locale) | The set locale (DE = Germany) which affects the date format, e.g. "14/9/2017" in France or "14.9.2017" in Germany                                               |
| MASTODON_RUNWITHOUTPOSTING   | false                                          | (For testing) You can use to check if all files and data was correct                                                                                            |
| TWITTER_LIMITNUMBEROFTWEETS  | -1 (= no limit)                                | Only post the last (=newest) x number of Tweets                                                                                                                 |

### Need help?

- This project is open-sourced. Feel free to contribute;
- If you really want support please consider [sponsoring me](https://github.com/sponsors/FGRibreau) :+1:
