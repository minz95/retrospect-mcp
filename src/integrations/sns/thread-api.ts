/**
 * Thread (Twitter/X) API Integration
 *
 * Publishes threads using twitter-api-v2 package
 */

import { TwitterApi } from 'twitter-api-v2';

export interface ThreadConfig {
  bearerToken: string;
}

export interface PublishThreadInput {
  tweets: string[];
}

export interface PublishThreadResult {
  threadId: string; // ID of first tweet
  tweetIds: string[];
  url: string;
}

/**
 * Publish a thread to Twitter/X
 */
export async function publishThread(
  input: PublishThreadInput,
  config: ThreadConfig
): Promise<PublishThreadResult> {
  const { tweets } = input;

  if (tweets.length === 0) {
    throw new Error('Thread must have at least one tweet');
  }

  if (tweets.length > 25) {
    throw new Error('Thread cannot have more than 25 tweets');
  }

  // Validate tweet lengths
  tweets.forEach((tweet, index) => {
    if (tweet.length > 280) {
      throw new Error(
        `Tweet ${index + 1} exceeds 280 characters (${tweet.length} chars)`
      );
    }
  });

  console.error(`  - Publishing thread with ${tweets.length} tweet(s)...`);

  // Initialize Twitter API client
  const client = new TwitterApi(config.bearerToken);

  // Post tweets sequentially, chaining them together
  const tweetIds: string[] = [];
  let replyToId: string | undefined;

  for (let i = 0; i < tweets.length; i++) {
    const tweet = tweets[i];

    try {
      console.error(`  - Posting tweet ${i + 1}/${tweets.length}...`);

      const response = await client.v2.tweet(tweet, {
        reply: replyToId ? { in_reply_to_tweet_id: replyToId } : undefined,
      });

      const tweetId = response.data.id;
      tweetIds.push(tweetId);

      // Set this tweet as the reply target for the next one
      replyToId = tweetId;

      console.error(`  - Tweet ${i + 1} posted: ${tweetId}`);

      // Rate limiting: wait 1 second between tweets to avoid hitting rate limits
      if (i < tweets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`  - Failed to post tweet ${i + 1}:`, error);

      // If we've posted some tweets, clean up by deleting them
      if (tweetIds.length > 0) {
        console.error(`  - Cleaning up ${tweetIds.length} posted tweet(s)...`);
        await cleanupTweets(client, tweetIds);
      }

      throw new Error(
        `Failed to publish thread at tweet ${i + 1}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const firstTweetId = tweetIds[0];
  const url = `https://twitter.com/i/web/status/${firstTweetId}`;

  console.error(`  - Thread published successfully: ${url}`);

  return {
    threadId: firstTweetId,
    tweetIds,
    url,
  };
}

/**
 * Clean up tweets by deleting them
 */
async function cleanupTweets(client: TwitterApi, tweetIds: string[]): Promise<void> {
  for (const tweetId of tweetIds) {
    try {
      await client.v2.deleteTweet(tweetId);
      console.error(`  - Deleted tweet: ${tweetId}`);
    } catch (error) {
      console.error(`  - Failed to delete tweet ${tweetId}:`, error);
      // Continue trying to delete other tweets
    }
  }
}

/**
 * Verify Twitter API credentials
 */
export async function verifyThreadCredentials(config: ThreadConfig): Promise<boolean> {
  try {
    const client = new TwitterApi(config.bearerToken);
    await client.v2.me();
    return true;
  } catch (error) {
    console.error('  - Thread API credentials invalid:', error);
    return false;
  }
}
