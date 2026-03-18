/**
 * MCP Resource: insights
 *
 * Provides access to extracted insights by date
 */

import { getInsightsByDate, getInsight } from '../storage/db.js';

/**
 * List all insights resources
 */
export function listInsightsResources(): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  return [
    {
      uri: 'insights://list',
      name: 'All Insights',
      description: 'List all insights (use read with insights://{date} to get specific date)',
      mimeType: 'application/json',
    },
  ];
}

/**
 * Read insights resource
 */
export function readInsightsResource(uri: string): string {
  // Parse URI: insights://{date} or insights://{id}
  const match = uri.match(/^insights:\/\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid insights URI: ${uri}. Expected format: insights://{date} or insights://{id}`);
  }

  const param = match[1];

  // Check if it's a date (YYYY-MM-DD format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(param)) {
    return readInsightsByDate(param);
  }

  // Check if it's an ID (starts with 'ins')
  if (param.startsWith('ins')) {
    return readInsightById(param);
  }

  throw new Error(
    `Invalid insights parameter: ${param}. Expected date (YYYY-MM-DD) or insight ID (ins...)`
  );
}

/**
 * Read insights by date
 */
function readInsightsByDate(date: string): string {
  const insights = getInsightsByDate(date);

  if (insights.length === 0) {
    return JSON.stringify(
      {
        date,
        insights: [],
        message: `No insights found for date: ${date}`,
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      date,
      insights: insights.map(insight => ({
        id: insight.id,
        content: insight.content,
        category: insight.category,
        confidence: insight.confidence,
        sourceLogIds: insight.sourceLogIds,
      })),
      total: insights.length,
    },
    null,
    2
  );
}

/**
 * Read specific insight by ID
 */
function readInsightById(id: string): string {
  const insight = getInsight(id);

  if (!insight) {
    return JSON.stringify(
      {
        error: `Insight not found: ${id}`,
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      id: insight.id,
      date: insight.date,
      content: insight.content,
      category: insight.category,
      confidence: insight.confidence,
      sourceLogIds: insight.sourceLogIds,
    },
    null,
    2
  );
}
