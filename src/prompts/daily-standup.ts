/**
 * Daily Standup Prompt
 *
 * MCP prompt for generating daily standup summaries from logs
 */

import { getDailyLogsByDateRange } from '../storage/db.js';

export const DAILY_STANDUP_PROMPT_NAME = 'daily-standup';

export const DAILY_STANDUP_PROMPT_DESCRIPTION =
  'Generate a daily standup summary from recent logs';

/**
 * Get daily standup prompt
 */
export async function getDailyStandupPrompt(args?: {
  date?: string;
  projectId?: string;
  daysBack?: number;
}): Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }> {
  const date = args?.date || new Date().toISOString().split('T')[0];
  const daysBack = args?.daysBack || 1;
  const projectId = args?.projectId;

  // Calculate date range
  const endDate = new Date(date);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - daysBack);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get logs
  let logs = getDailyLogsByDateRange(startDateStr, endDateStr);

  // Filter by project if specified
  if (projectId) {
    logs = logs.filter(log => log.projectId === projectId);
  }

  // Build context
  const logsContext = logs.length > 0
    ? logs.map(log => `**${log.date}** (${log.projectId}):\n${log.summary}`).join('\n\n')
    : 'No logs found for this period.';

  const promptText = `Based on the following dev logs, create a concise daily standup summary.

**Logs from ${startDateStr} to ${endDateStr}:**

${logsContext}

**Please provide:**
1. **What was done**: Key accomplishments (2-3 bullet points)
2. **Challenges**: Any blockers or issues encountered
3. **Next steps**: What's planned next (1-2 items)

Keep it brief and focused on the most important points.`;

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: promptText,
        },
      },
    ],
  };
}
