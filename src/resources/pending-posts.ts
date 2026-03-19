/**
 * MCP Resource: pending-posts
 *
 * Provides access to pending SNS posts awaiting approval
 */

import { getPendingPosts, getSNSPost } from '../storage/db.js';

/**
 * List all pending posts resources
 */
export function listPendingPostsResources(): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  return [
    {
      uri: 'pending-posts://list',
      name: 'Pending Posts',
      description: 'List all pending SNS posts awaiting approval',
      mimeType: 'application/json',
    },
  ];
}

/**
 * Read pending posts resource
 */
export function readPendingPostsResource(uri: string): string {
  // Parse URI: pending-posts://list or pending-posts://{id}
  const match = uri.match(/^pending-posts:\/\/(.+)$/);
  if (!match) {
    throw new Error(
      `Invalid pending-posts URI: ${uri}. Expected format: pending-posts://list or pending-posts://{id}`
    );
  }

  const param = match[1];

  // List all pending posts
  if (param === 'list') {
    return readAllPendingPosts();
  }

  // Read specific post by ID
  if (param.startsWith('post')) {
    return readPostById(param);
  }

  throw new Error(
    `Invalid pending-posts parameter: ${param}. Expected 'list' or post ID (post...)`
  );
}

/**
 * Read all pending posts
 */
function readAllPendingPosts(): string {
  const posts = getPendingPosts();

  if (posts.length === 0) {
    return JSON.stringify(
      {
        posts: [],
        total: 0,
        message: 'No pending posts found',
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      posts: posts.map(post => ({
        id: post.id,
        insightId: post.insightId,
        platform: post.platform,
        status: post.status,
        version: post.version,
        createdAt: post.createdAt,
        contentPreview: getContentPreview(post.content),
        metadata: post.metadata,
      })),
      total: posts.length,
    },
    null,
    2
  );
}

/**
 * Read specific post by ID
 */
function readPostById(id: string): string {
  const post = getSNSPost(id);

  if (!post) {
    return JSON.stringify(
      {
        error: `Post not found: ${id}`,
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      id: post.id,
      insightId: post.insightId,
      platform: post.platform,
      content: post.content,
      status: post.status,
      version: post.version,
      parentId: post.parentId,
      createdAt: post.createdAt,
      publishedAt: post.publishedAt,
      publishedUrl: post.publishedUrl,
      metadata: post.metadata,
    },
    null,
    2
  );
}

/**
 * Get content preview
 */
function getContentPreview(
  content: string | string[]
): string {
  if (Array.isArray(content)) {
    // Thread: show first tweet
    const firstTweet = content[0] || '';
    return firstTweet.substring(0, 100) + (firstTweet.length > 100 ? '...' : '');
  }

  // LinkedIn/Medium: show first 200 chars
  const text = String(content);
  return text.substring(0, 200) + (text.length > 200 ? '...' : '');
}
