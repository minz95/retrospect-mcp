/**
 * MCP Tool: extract_insights
 *
 * Extracts actionable insights from daily logs using Claude AI
 */

import { extractInsights } from '../core/insight-extractor.js';
import { ClaudeClient } from '../utils/claude-client.js';
import { getDailyLogsByDateRange, createInsight, getInsightsByDate } from '../storage/db.js';
import type { Config } from '../types/index.js';

export interface ExtractInsightsParams {
  startDate: string; // ISO date (YYYY-MM-DD)
  endDate: string; // ISO date (YYYY-MM-DD)
  projectId?: string; // Optional: filter by project
  forceRefresh?: boolean; // Force re-extraction even if cached
}

export interface ExtractInsightsResult {
  insights: Array<{
    id: string;
    content: string;
    category: string;
    confidence: number;
    date: string;
  }>;
  totalLogs: number;
  message: string;
}

/**
 * Extract insights from daily logs
 */
export async function extractInsightsTool(
  params: ExtractInsightsParams,
  config: Config
): Promise<ExtractInsightsResult> {
  const { startDate, endDate, projectId, forceRefresh = false } = params;

  // Validate dates
  if (!isValidDate(startDate)) {
    throw new Error(`Invalid start date: ${startDate}. Expected format: YYYY-MM-DD`);
  }

  if (!isValidDate(endDate)) {
    throw new Error(`Invalid end date: ${endDate}. Expected format: YYYY-MM-DD`);
  }

  // Check if insights already exist for this date range (caching)
  if (!forceRefresh) {
    const existingInsights = getInsightsByDateRange(startDate, endDate);
    if (existingInsights.length > 0) {
      console.error(`  - Found ${existingInsights.length} cached insight(s) for ${startDate} to ${endDate}`);
      return {
        insights: existingInsights.map(insight => ({
          id: insight.id,
          content: insight.content,
          category: insight.category,
          confidence: insight.confidence,
          date: insight.date,
        })),
        totalLogs: 0,
        message: `Found ${existingInsights.length} cached insight(s) for date range ${startDate} to ${endDate}. Use forceRefresh=true to re-extract.`,
      };
    }
  }

  // Query daily logs
  let logs = getDailyLogsByDateRange(startDate, endDate);

  // Filter by project if specified
  if (projectId) {
    logs = logs.filter(log => log.projectId === projectId);
  }

  if (logs.length === 0) {
    return {
      insights: [],
      totalLogs: 0,
      message: `No daily logs found for date range ${startDate} to ${endDate}${projectId ? ` (project: ${projectId})` : ''}.`,
    };
  }

  console.error(`  - Analyzing ${logs.length} log(s) from ${startDate} to ${endDate}...`);

  // Create Claude client
  const claudeClient = new ClaudeClient({
    apiKey: config.claude.apiKey,
    model: config.claude.model,
  });

  // Extract insights
  const result = await extractInsights(
    {
      logs: logs.map(log => ({
        date: log.date!,
        projectId: log.projectId!,
        summary: log.summary!,
        manualNotes: log.manualNotes,
      })),
    },
    claudeClient
  );

  // Save insights to database
  const savedInsights = [];
  for (const insight of result.insights) {
    const insightId = createInsight({
      date: endDate, // Use end date as the insight date
      content: insight.content,
      category: insight.category,
      confidence: insight.confidence,
      sourceLogIds: logs.map(log => log.id!),
    });

    savedInsights.push({
      id: insightId,
      content: insight.content,
      category: insight.category,
      confidence: insight.confidence,
      date: endDate,
    });

    console.error(`  - Saved insight: ${insightId} (${insight.category}, confidence: ${insight.confidence})`);
  }

  // Format message
  const message = formatInsightsMessage(savedInsights, logs.length, startDate, endDate);

  return {
    insights: savedInsights,
    totalLogs: logs.length,
    message,
  };
}

/**
 * Get insights by date range
 */
function getInsightsByDateRange(startDate: string, endDate: string): Array<{
  id: string;
  content: string;
  category: string;
  confidence: number;
  date: string;
}> {
  // Simple implementation: check each date in the range
  const insights: Array<any> = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);

  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dailyInsights = getInsightsByDate(dateStr);
    insights.push(...dailyInsights);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return insights;
}

/**
 * Validate ISO date format (YYYY-MM-DD)
 */
function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) {
    return false;
  }

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Format insights into a readable message
 */
function formatInsightsMessage(
  insights: Array<{
    id: string;
    content: string;
    category: string;
    confidence: number;
  }>,
  totalLogs: number,
  startDate: string,
  endDate: string
): string {
  if (insights.length === 0) {
    return `No insights extracted from ${totalLogs} log(s) for date range ${startDate} to ${endDate}.`;
  }

  const lines: string[] = [];

  lines.push(`Extracted ${insights.length} insight(s) from ${totalLogs} log(s) for date range ${startDate} to ${endDate}:`);
  lines.push('');

  insights.forEach((insight, index) => {
    lines.push(`${index + 1}. [${insight.category}] (confidence: ${insight.confidence.toFixed(2)})`);
    lines.push(`   ${insight.content}`);
    lines.push(`   ID: ${insight.id}`);
    lines.push('');
  });

  return lines.join('\n');
}
