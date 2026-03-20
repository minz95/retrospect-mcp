/**
 * MCP Tool: approve_and_publish
 *
 * Approval workflow for SNS posts: approve, revise, or reject
 */

import { getSNSPost, updateSNSPostStatus, createSNSPost, getInsight } from '../storage/db.js';
import { publishThread } from '../integrations/sns/thread-api.js';
import { publishLinkedInPost } from '../integrations/sns/linkedin-api.js';
import { publishMediumPost, extractTitleFromMarkdown } from '../integrations/sns/medium-api.js';
import { generateContent } from '../core/content-generator.js';
import { ClaudeClient } from '../utils/claude-client.js';
import type { Config } from '../types/index.js';

export interface ApproveAndPublishParams {
  postId: string;
  action: 'approve' | 'revise' | 'reject';
  revisionPrompt?: string; // Required for 'revise' action
}

export interface ApproveAndPublishResult {
  postId: string;
  action: string;
  status: string;
  url?: string;
  newVersion?: {
    postId: string;
    version: number;
  };
  message: string;
}

/**
 * Approve, revise, or reject a pending SNS post
 */
export async function approveAndPublishTool(
  params: ApproveAndPublishParams,
  config: Config
): Promise<ApproveAndPublishResult> {
  const { postId, action, revisionPrompt } = params;

  // Get post from database
  const post = getSNSPost(postId);
  if (!post) {
    throw new Error(`Post not found: ${postId}`);
  }

  console.error(`  - Processing ${action} for post: ${postId} (${post.platform})`);

  // Handle different actions
  switch (action) {
    case 'approve':
      return await approveAndPublish(post, config);

    case 'revise':
      if (!revisionPrompt || revisionPrompt.trim().length === 0) {
        throw new Error('revisionPrompt is required for revise action');
      }
      return await revisePost(post, revisionPrompt, config);

    case 'reject':
      return rejectPost(post);

    default:
      throw new Error(`Unknown action: ${action}. Expected: approve, revise, or reject`);
  }
}

/**
 * Approve and publish post to SNS
 */
async function approveAndPublish(
  post: any,
  config: Config
): Promise<ApproveAndPublishResult> {
  console.error(`  - Publishing to ${post.platform}...`);

  let url: string;

  try {
    switch (post.platform) {
      case 'thread':
        url = await publishToThread(post, config);
        break;

      case 'linkedin':
        url = await publishToLinkedIn(post, config);
        break;

      case 'medium':
        url = await publishToMedium(post, config);
        break;

      default:
        throw new Error(`Unknown platform: ${post.platform}`);
    }

    // Update post status in database
    updateSNSPostStatus(post.id, 'published', url);

    console.error(`  - Published successfully: ${url}`);

    return {
      postId: post.id,
      action: 'approve',
      status: 'published',
      url,
      message: `Post published successfully to ${post.platform}!\n\nURL: ${url}\n\nPost ID: ${post.id}`,
    };
  } catch (error) {
    console.error(`  - Failed to publish to ${post.platform}:`, error);
    throw new Error(
      `Failed to publish to ${post.platform}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Publish to Thread (Twitter/X)
 */
async function publishToThread(post: any, config: Config): Promise<string> {
  const tweets = Array.isArray(post.content)
    ? post.content
    : JSON.parse(post.content);

  if (!config.sns?.thread?.bearerToken) throw new Error('Twitter/X not configured');
  const result = await publishThread(
    { tweets },
    { bearerToken: config.sns.thread.bearerToken }
  );

  return result.url;
}

/**
 * Publish to LinkedIn
 */
async function publishToLinkedIn(post: any, config: Config): Promise<string> {
  const content = typeof post.content === 'string'
    ? post.content
    : JSON.stringify(post.content);

  if (!config.sns?.linkedin?.accessToken) throw new Error('LinkedIn not configured');
  const result = await publishLinkedInPost(
    { content },
    {
      accessToken: config.sns.linkedin.accessToken,
      userId: config.sns.linkedin.userId,
    }
  );

  return result.url;
}

/**
 * Publish to Medium
 */
async function publishToMedium(post: any, config: Config): Promise<string> {
  const content = typeof post.content === 'string'
    ? post.content
    : JSON.stringify(post.content);

  // Extract title from content
  const title = extractTitleFromMarkdown(content);

  // Get publish status from metadata or default to draft
  const publishStatus = post.metadata?.publishStatus || 'draft';

  // Get tags from metadata
  const tags = post.metadata?.hashtags
    ? post.metadata.hashtags.map((tag: string) => tag.replace('#', ''))
    : [];

  if (!config.sns?.medium?.token) throw new Error('Medium not configured');
  const result = await publishMediumPost(
    {
      title,
      content,
      contentFormat: 'markdown',
      publishStatus,
      tags,
    },
    { accessToken: config.sns.medium.token }
  );

  return result.url;
}

/**
 * Revise post with new instructions
 */
async function revisePost(
  post: any,
  revisionPrompt: string,
  config: Config
): Promise<ApproveAndPublishResult> {
  console.error(`  - Revising post with prompt: "${revisionPrompt}"`);

  // Get original insight
  const insight = getInsight(post.insightId);
  if (!insight) {
    throw new Error(`Original insight not found: ${post.insightId}`);
  }

  // Create Claude client
  const claudeClient = new ClaudeClient({
    apiKey: config.claude.apiKey,
    model: config.claude.model,
  });

  // Add revision context to insight
  const revisedInsight = {
    ...insight,
    context: `${insight.content}\n\nRevision request: ${revisionPrompt}`,
  };

  // Generate new content
  const generated = await generateContent(
    {
      insight: revisedInsight,
      platform: post.platform,
      includeHashtags: true,
    },
    claudeClient
  );

  // Create new version of post
  const newPostId = createSNSPost({
    insightId: post.insightId,
    platform: post.platform,
    content: generated.content,
    status: 'pending',
    version: post.version + 1,
    parentId: post.id, // Link to original post
    metadata: {
      hashtags: generated.hashtags,
      ...generated.metadata,
    },
  });

  console.error(`  - Created revised version: ${newPostId} (version ${post.version + 1})`);

  return {
    postId: post.id,
    action: 'revise',
    status: 'revised',
    newVersion: {
      postId: newPostId,
      version: post.version + 1,
    },
    message: `Post revised successfully!\n\nNew version created: ${newPostId} (version ${post.version + 1})\nOriginal post: ${post.id}\n\nRevision prompt: ${revisionPrompt}\n\nUse pending-posts resource to view the new version.`,
  };
}

/**
 * Reject post
 */
function rejectPost(post: any): ApproveAndPublishResult {
  updateSNSPostStatus(post.id, 'rejected');

  console.error(`  - Post rejected: ${post.id}`);

  return {
    postId: post.id,
    action: 'reject',
    status: 'rejected',
    message: `Post rejected.\n\nPost ID: ${post.id}\nPlatform: ${post.platform}\n\nThe post will not be published.`,
  };
}
