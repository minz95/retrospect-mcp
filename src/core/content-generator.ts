/**
 * Content Generator
 *
 * Generates platform-optimized SNS content from insights using Claude AI
 */

import { ClaudeClient } from '../utils/claude-client.js';
import { formatInsightForSNS } from '../prompts/sns-formatters.js';

export interface GenerateContentInput {
  insight: {
    id: string;
    content: string;
    category: string;
    confidence: number;
    context?: string;
  };
  platform: 'thread' | 'linkedin' | 'medium';
  includeHashtags?: boolean;
}

export interface GeneratedContent {
  platform: 'thread' | 'linkedin' | 'medium';
  content: string | string[]; // Array for threads, string for others
  hashtags: string[];
  metadata: {
    characterCount?: number; // For LinkedIn
    wordCount?: number; // For Medium
    tweetCount?: number; // For Thread
  };
}

/**
 * Generate SNS content from insight
 */
export async function generateContent(
  input: GenerateContentInput,
  claudeClient: ClaudeClient
): Promise<GeneratedContent> {
  const { insight, platform, includeHashtags = true } = input;

  console.error(`  - Generating ${platform} content for insight: ${insight.id}`);

  // Get platform-specific prompts
  const { systemPrompt, userPrompt } = formatInsightForSNS(insight, platform);

  // Call Claude API
  const response = await claudeClient.generateText({
    prompt: userPrompt,
    systemPrompt,
    maxTokens: platform === 'medium' ? 4096 : 2048,
    temperature: 0.8, // Slightly higher for creative writing
  });

  console.error(`  - Received ${platform} content (${response.usage.outputTokens} tokens)`);

  // Parse and validate content
  let content: string | string[];
  let metadata: GeneratedContent['metadata'] = {};

  switch (platform) {
    case 'thread':
      content = parseThreadContent(response.text);
      validateThreadContent(content as string[]);
      metadata.tweetCount = (content as string[]).length;
      break;

    case 'linkedin':
      content = parseLinkedInContent(response.text);
      validateLinkedInContent(content as string);
      metadata.characterCount = (content as string).length;
      break;

    case 'medium':
      content = parseMediumContent(response.text);
      validateMediumContent(content as string);
      metadata.wordCount = countWords(content as string);
      break;

    default:
      throw new Error(`Unknown platform: ${platform}`);
  }

  // Generate hashtags
  const hashtags = includeHashtags ? generateHashtags(insight.category, platform) : [];

  console.error(`  - Content validated successfully`);
  if (hashtags.length > 0) {
    console.error(`  - Generated ${hashtags.length} hashtag(s): ${hashtags.join(', ')}`);
  }

  return {
    platform,
    content,
    hashtags,
    metadata,
  };
}

/**
 * Parse thread content from Claude response
 */
function parseThreadContent(text: string): string[] {
  // Try to find JSON array
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map(tweet => String(tweet).trim());
      }
    } catch (error) {
      console.error(`  - Failed to parse thread JSON, falling back to text splitting`);
    }
  }

  // Fallback: split by numbered tweets or newlines
  const tweets: string[] = [];
  const lines = text.split('\n');
  let currentTweet = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if it's a numbered tweet (1., 2., etc.)
    if (/^\d+\.\s/.test(trimmed)) {
      if (currentTweet) {
        tweets.push(currentTweet.trim());
      }
      currentTweet = trimmed.replace(/^\d+\.\s+/, '');
    } else {
      currentTweet += (currentTweet ? ' ' : '') + trimmed;
    }
  }

  if (currentTweet) {
    tweets.push(currentTweet.trim());
  }

  return tweets.length > 0 ? tweets : [text.trim()];
}

/**
 * Parse LinkedIn content from Claude response
 */
function parseLinkedInContent(text: string): string {
  // Remove any JSON markers or formatting artifacts
  return text
    .replace(/^```\w*\n?/gm, '')
    .replace(/```$/gm, '')
    .trim();
}

/**
 * Parse Medium content from Claude response
 */
function parseMediumContent(text: string): string {
  // Remove any JSON markers or formatting artifacts
  return text
    .replace(/^```markdown\n?/gm, '')
    .replace(/^```\n?/gm, '')
    .replace(/```$/gm, '')
    .trim();
}

/**
 * Validate thread content
 */
function validateThreadContent(tweets: string[]): void {
  if (tweets.length === 0) {
    throw new Error('Thread must have at least one tweet');
  }

  if (tweets.length > 5) {
    throw new Error(`Thread has too many tweets (${tweets.length}). Maximum is 5.`);
  }

  tweets.forEach((tweet, index) => {
    if (tweet.length > 280) {
      throw new Error(
        `Tweet ${index + 1} is too long (${tweet.length} characters). Maximum is 280.`
      );
    }

    if (tweet.length === 0) {
      throw new Error(`Tweet ${index + 1} is empty`);
    }
  });
}

/**
 * Validate LinkedIn content
 */
function validateLinkedInContent(content: string): void {
  if (content.length < 100) {
    throw new Error(`LinkedIn post is too short (${content.length} characters). Minimum is 100.`);
  }

  if (content.length > 3000) {
    throw new Error(`LinkedIn post is too long (${content.length} characters). Maximum is 3000.`);
  }

  // Warn if not in optimal range (1300-1500)
  if (content.length < 1300 || content.length > 1500) {
    console.error(
      `  - Warning: LinkedIn post length (${content.length}) is outside optimal range (1300-1500)`
    );
  }
}

/**
 * Validate Medium content
 */
function validateMediumContent(content: string): void {
  const wordCount = countWords(content);

  if (wordCount < 300) {
    throw new Error(`Medium article is too short (${wordCount} words). Minimum is 300.`);
  }

  if (wordCount > 3000) {
    throw new Error(`Medium article is too long (${wordCount} words). Maximum is 3000.`);
  }

  // Warn if not in optimal range (800-1500)
  if (wordCount < 800 || wordCount > 1500) {
    console.error(
      `  - Warning: Medium article length (${wordCount} words) is outside optimal range (800-1500)`
    );
  }

  // Check for proper markdown
  if (!content.includes('#')) {
    console.error('  - Warning: Medium article has no headings');
  }
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0).length;
}

/**
 * Generate hashtags based on category and platform
 */
function generateHashtags(category: string, platform: 'thread' | 'linkedin' | 'medium'): string[] {
  const categoryHashtags: Record<string, string[]> = {
    debugging: ['debugging', 'coding', 'programming', 'softwareengineering'],
    performance: ['performance', 'optimization', 'webdev', 'programming'],
    tooling: ['devtools', 'productivity', 'coding', 'programming'],
    architecture: ['softwarearchitecture', 'systemdesign', 'coding', 'engineering'],
    api: ['api', 'webdev', 'backend', 'programming'],
    integration: ['integration', 'webdev', 'coding', 'programming'],
    other: ['coding', 'programming', 'softwareengineering', 'tech'],
  };

  const baseHashtags = categoryHashtags[category] || categoryHashtags.other;

  // Platform-specific hashtag count
  const maxHashtags = platform === 'thread' ? 2 : platform === 'linkedin' ? 3 : 5;

  return baseHashtags.slice(0, maxHashtags).map(tag => `#${tag}`);
}
