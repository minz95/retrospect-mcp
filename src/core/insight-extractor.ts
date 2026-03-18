/**
 * Insight Extractor
 *
 * Analyzes daily logs and extracts actionable insights using Claude API
 */

import { ClaudeClient } from '../utils/claude-client.js';
import {
  INSIGHT_EXTRACTION_SYSTEM_PROMPT,
  INSIGHT_EXTRACTION_USER_PROMPT_TEMPLATE,
  formatLogsForExtraction,
} from '../prompts/insight-extraction.js';

export interface ExtractInsightsInput {
  logs: Array<{
    date: string;
    projectId: string;
    summary: string;
    manualNotes?: string;
  }>;
}

export interface ExtractedInsight {
  content: string;
  category: 'debugging' | 'performance' | 'tooling' | 'architecture' | 'api' | 'integration' | 'other';
  confidence: number;
  context: string;
}

export interface ExtractInsightsResult {
  insights: ExtractedInsight[];
  totalAnalyzed: number;
}

/**
 * Extract insights from daily logs
 */
export async function extractInsights(
  input: ExtractInsightsInput,
  claudeClient: ClaudeClient
): Promise<ExtractInsightsResult> {
  const { logs } = input;

  if (logs.length === 0) {
    return {
      insights: [],
      totalAnalyzed: 0,
    };
  }

  // Format logs for Claude
  const formattedLogs = formatLogsForExtraction(logs);

  // Generate user prompt
  const userPrompt = INSIGHT_EXTRACTION_USER_PROMPT_TEMPLATE.replace(
    '{{logs}}',
    formattedLogs
  );

  console.error(`  - Analyzing ${logs.length} log(s) for insights...`);

  // Call Claude API
  const response = await claudeClient.generateText({
    prompt: userPrompt,
    systemPrompt: INSIGHT_EXTRACTION_SYSTEM_PROMPT,
    maxTokens: 2048,
    temperature: 0.7,
  });

  console.error(`  - Received response from Claude (${response.usage.outputTokens} tokens)`);

  // Parse JSON response
  let rawInsights: ExtractedInsight[];
  try {
    rawInsights = parseInsightsFromResponse(response.text);
  } catch (error) {
    console.error(`  - Failed to parse insights JSON:`, error);
    throw new Error(`Failed to parse insights from Claude response: ${error}`);
  }

  // Validate insights
  const validatedInsights = rawInsights
    .filter(insight => validateInsight(insight))
    .slice(0, 5); // Maximum 5 insights

  console.error(`  - Extracted ${validatedInsights.length} valid insight(s)`);

  return {
    insights: validatedInsights,
    totalAnalyzed: logs.length,
  };
}

/**
 * Parse insights from Claude's JSON response
 */
function parseInsightsFromResponse(text: string): ExtractedInsight[] {
  // Try to find JSON array in the response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!Array.isArray(parsed)) {
    throw new Error('Response is not a JSON array');
  }

  return parsed.map((item: any) => ({
    content: String(item.content || ''),
    category: String(item.category || 'other'),
    confidence: Number(item.confidence || 0),
    context: String(item.context || ''),
  }));
}

/**
 * Validate an insight
 */
function validateInsight(insight: ExtractedInsight): boolean {
  // Check confidence threshold
  if (insight.confidence < 0.6) {
    console.error(`  - Rejected insight (low confidence: ${insight.confidence})`);
    return false;
  }

  // Check content is not empty
  if (!insight.content || insight.content.trim().length === 0) {
    console.error(`  - Rejected insight (empty content)`);
    return false;
  }

  // Check content is not too short (should be at least a sentence)
  if (insight.content.trim().length < 20) {
    console.error(`  - Rejected insight (too short: ${insight.content.length} chars)`);
    return false;
  }

  // Check content is not too long (should be concise)
  if (insight.content.trim().length > 500) {
    console.error(`  - Rejected insight (too long: ${insight.content.length} chars)`);
    return false;
  }

  // Check for generic phrases that indicate low specificity
  const genericPhrases = [
    'always write tests',
    'use git',
    'write clean code',
    'follow best practices',
    'read the documentation',
    'google it',
    'ask for help',
  ];

  const lowerContent = insight.content.toLowerCase();
  for (const phrase of genericPhrases) {
    if (lowerContent.includes(phrase)) {
      console.error(`  - Rejected insight (generic phrase detected: "${phrase}")`);
      return false;
    }
  }

  // Check category is valid
  const validCategories = ['debugging', 'performance', 'tooling', 'architecture', 'api', 'integration', 'other'];
  if (!validCategories.includes(insight.category)) {
    console.error(`  - Rejected insight (invalid category: ${insight.category})`);
    return false;
  }

  return true;
}
