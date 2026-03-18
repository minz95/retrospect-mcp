/**
 * MCP Tool: generate_sns_post
 *
 * Generates SNS content from insights for specified platforms
 */

import { generateContent } from '../core/content-generator.js';
import { ClaudeClient } from '../utils/claude-client.js';
import { getInsight, createSNSPost } from '../storage/db.js';
import type { Config } from '../types/index.js';

export interface GenerateSNSParams {
  insightId: string;
  platform: 'thread' | 'linkedin' | 'medium';
  includeHashtags?: boolean;
}

export interface GenerateSNSResult {
  postId: string;
  platform: 'thread' | 'linkedin' | 'medium';
  content: string | string[];
  hashtags: string[];
  status: string;
  message: string;
}

/**
 * Generate SNS post from insight
 */
export async function generateSNSTool(
  params: GenerateSNSParams,
  config: Config
): Promise<GenerateSNSResult> {
  const { insightId, platform, includeHashtags = true } = params;

  // Get insight from database
  const insight = getInsight(insightId);
  if (!insight) {
    throw new Error(`Insight not found: ${insightId}`);
  }

  console.error(`  - Generating ${platform} post for insight: ${insightId}`);

  // Create Claude client
  const claudeClient = new ClaudeClient({
    apiKey: config.claude.apiKey,
    model: config.claude.model,
  });

  // Generate content
  const generated = await generateContent(
    {
      insight: {
        id: insight.id,
        content: insight.content,
        category: insight.category,
        confidence: insight.confidence,
      },
      platform,
      includeHashtags,
    },
    claudeClient
  );

  // Save to pending_posts
  const postId = createSNSPost({
    insightId: insight.id,
    platform,
    content: generated.content,
    status: 'pending',
    version: 1,
    metadata: {
      hashtags: generated.hashtags,
      ...generated.metadata,
    },
  });

  console.error(`  - Created pending post: ${postId} (status: pending)`);

  // Format message
  const message = formatSNSPostMessage(postId, platform, generated);

  return {
    postId,
    platform,
    content: generated.content,
    hashtags: generated.hashtags,
    status: 'pending',
    message,
  };
}

/**
 * Format SNS post message
 */
function formatSNSPostMessage(
  postId: string,
  platform: 'thread' | 'linkedin' | 'medium',
  generated: {
    content: string | string[];
    hashtags: string[];
    metadata: {
      characterCount?: number;
      wordCount?: number;
      tweetCount?: number;
    };
  }
): string {
  const lines: string[] = [];

  lines.push(`Generated ${platform} post!`);
  lines.push(`Post ID: ${postId}`);
  lines.push(`Status: pending (awaiting approval)`);
  lines.push('');

  // Platform-specific metadata
  if (platform === 'thread') {
    lines.push(`Tweet count: ${generated.metadata.tweetCount}`);
    lines.push('');
    lines.push('Preview:');
    (generated.content as string[]).forEach((tweet, index) => {
      lines.push(`${index + 1}. ${tweet.substring(0, 100)}${tweet.length > 100 ? '...' : ''}`);
    });
  } else if (platform === 'linkedin') {
    lines.push(`Character count: ${generated.metadata.characterCount}`);
    lines.push('');
    lines.push('Preview:');
    const preview = (generated.content as string).substring(0, 200);
    lines.push(preview + (preview.length < (generated.content as string).length ? '...' : ''));
  } else if (platform === 'medium') {
    lines.push(`Word count: ${generated.metadata.wordCount}`);
    lines.push('');
    lines.push('Preview:');
    const preview = (generated.content as string).substring(0, 200);
    lines.push(preview + (preview.length < (generated.content as string).length ? '...' : ''));
  }

  // Hashtags
  if (generated.hashtags.length > 0) {
    lines.push('');
    lines.push(`Hashtags: ${generated.hashtags.join(' ')}`);
  }

  lines.push('');
  lines.push('Use the pending-posts resource to view full content.');
  lines.push('Use approve_and_publish tool to approve and publish.');

  return lines.join('\n');
}
