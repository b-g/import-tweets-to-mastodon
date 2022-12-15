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

### #7 Example configuration
- `export MASTODON_API_BASEPATH=https://mastodon.social`
	- → If you are on https://mastodon.social
- `export MASTODON_API_KEY=y8LptTshBDs4LmL3WTZxINgl4gHFPB0-mOzspqeIinM`
	- → The API key
- `export TWITTER_TWEETJS_FILEPATH=../twitter-data/data/tweets.js`
	- → Location of the tweets.js file
- `export TWITTER_LIMITNUMBEROFTWEETS=100`
	- → Only post the last 100 Tweets
- `export TWITTER_EXCLUDERETWEETS=true`
	- → Don't post Retweets
- `export MASTODON_ADDDATEFROMTWEET=true`
	- → Add a date for context, e.g. "(14/9/2017) This is a tweet"
- `export MASTODON_CHANGEDATELOCALETO=DE`
	- → Choose locale (DE = Germany) which affects the date format, e.g. "14/9/2017" in France or "14.9.2017" in Germany
- `export TWITTER_LIMITTWEETSTOSETYEAR=false`
	- → Post from all years
- `export MASTODON_POSTMEDIA=true`
	- → Attach media (photos and videos) from original Tweets
-  `export TWITTER_MEDIAPATH=../twitter-data/data/tweets_media/`
	- → Where are is the media folder located
-  `export MASTODON_TIMEOUTBETWEENPOSTS=120`
	- → Time between posts, necessary due to [rate limit](https://docs.joinmastodon.org/api/rate-limits/#uploading-media) (= less than 1 post/minute when media-heavy)

#### Need help?

- This project is open-sourced. Feel free to contribute;
- If you really want support please consider [sponsoring me](https://github.com/sponsors/FGRibreau) :+1:
