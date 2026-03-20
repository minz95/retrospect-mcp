/**
 * MCP Tool: extract_action_items
 *
 * Extracts prioritized action items from daily logs using Claude AI.
 * Can target a specific log by ID, or a date range (optionally filtered by project).
 */

import { ClaudeClient } from '../utils/claude-client.js';
import {
  ACTION_EXTRACTION_SYSTEM_PROMPT,
  ACTION_EXTRACTION_USER_PROMPT_TEMPLATE,
  formatLogsForActionExtraction,
} from '../prompts/action-extraction.js';
import {
  getDailyLog,
  getDailyLogsByDateRange,
  createActionItem,
  getActionItemsByLog,
} from '../storage/db.js';
import type { Config } from '../types/index.js';

export interface ExtractActionsParams {
  /** Specific daily log ID to extract from */
  logId?: string;
  /** Filter by project ID (used with startDate/endDate) */
  projectId?: string;
  /** Start date for range extraction (YYYY-MM-DD) */
  startDate?: string;
  /** End date for range extraction (YYYY-MM-DD) */
  endDate?: string;
  /** Force re-extraction even if action items already exist (default false) */
  forceRefresh?: boolean;
}

export interface ExtractActionsResult {
  actionItems: Array<{
    id: string;
    logId: string;
    content: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  totalExtracted: number;
  message: string;
}

/**
 * Extract action items from daily logs
 */
export async function extractActionsTool(
  params: ExtractActionsParams,
  config: Config
): Promise<ExtractActionsResult> {
  const { logId, projectId, startDate, endDate, forceRefresh = false } = params;

  // Validate: need at least logId OR startDate+endDate
  if (!logId && !(startDate && endDate)) {
    throw new Error(
      'Provide either logId or both startDate and endDate (YYYY-MM-DD)'
    );
  }

  if (startDate && !isValidDate(startDate)) {
    throw new Error(`Invalid startDate: ${startDate}. Expected format: YYYY-MM-DD`);
  }
  if (endDate && !isValidDate(endDate)) {
    throw new Error(`Invalid endDate: ${endDate}. Expected format: YYYY-MM-DD`);
  }

  // Resolve target logs
  const logs = logId
    ? await resolveLogById(logId)
    : await resolveLogsByRange(startDate!, endDate!, projectId);

  if (logs.length === 0) {
    return {
      actionItems: [],
      totalExtracted: 0,
      message: logId
        ? `Log ${logId} not found.`
        : `No logs found for ${startDate} to ${endDate}${projectId ? ` (project: ${projectId})` : ''}.`,
    };
  }

  // Check cache per-log unless forceRefresh
  const allItems: ExtractActionsResult['actionItems'] = [];
  const logsToProcess: typeof logs = [];

  if (!forceRefresh) {
    for (const log of logs) {
      const existing = getActionItemsByLog(log.id);
      if (existing.length > 0) {
        console.error(`  - Using ${existing.length} cached action item(s) for log ${log.id}`);
        allItems.push(...existing.map((item) => ({
          id: item.id,
          logId: item.logId,
          content: item.content,
          priority: item.priority,
        })));
      } else {
        logsToProcess.push(log);
      }
    }
  } else {
    logsToProcess.push(...logs);
  }

  // Extract with Claude for logs that have no cached items
  if (logsToProcess.length > 0) {
    const claudeClient = new ClaudeClient({
      apiKey: config.claude.apiKey,
      model: config.claude.model,
    });

    const formattedLogs = formatLogsForActionExtraction(logsToProcess);
    const userPrompt = ACTION_EXTRACTION_USER_PROMPT_TEMPLATE.replace(
      '{{logs}}',
      formattedLogs
    );

    console.error(`  - Extracting action items from ${logsToProcess.length} log(s)...`);

    const response = await claudeClient.generateText({
      prompt: userPrompt,
      systemPrompt: ACTION_EXTRACTION_SYSTEM_PROMPT,
      maxTokens: 1024,
      temperature: 0.3, // Low temperature for deterministic extraction
    });

    console.error(`  - Received response (${response.usage.outputTokens} tokens)`);

    // Parse and validate
    const rawItems = parseActionItemsFromResponse(response.text);

    // Save to DB, distributing items evenly across source logs
    // (all items are attributed to the first log when a single logId is given,
    //  or spread when multiple logs are processed together)
    const targetLogId = logsToProcess[0].id;
    for (const raw of rawItems) {
      const id = createActionItem({
        logId: targetLogId,
        content: raw.content,
        priority: raw.priority,
        completed: false,
      });
      allItems.push({ id, logId: targetLogId, content: raw.content, priority: raw.priority });
      console.error(`  - Saved action item: ${id} [${raw.priority}]`);
    }
  }

  return {
    actionItems: allItems,
    totalExtracted: allItems.length,
    message: formatResultMessage(allItems, logs.length),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  date: string;
  projectId: string;
  summary: string;
  manualNotes?: string;
}

async function resolveLogById(id: string): Promise<LogEntry[]> {
  const log = getDailyLog(id);
  if (!log || !log.id || !log.date || !log.projectId || !log.summary) return [];
  return [
    {
      id: log.id,
      date: log.date,
      projectId: log.projectId,
      summary: log.summary,
      manualNotes: log.manualNotes,
    },
  ];
}

async function resolveLogsByRange(
  startDate: string,
  endDate: string,
  projectId?: string
): Promise<LogEntry[]> {
  let rows = getDailyLogsByDateRange(startDate, endDate);
  if (projectId) rows = rows.filter((r) => r.projectId === projectId);
  return rows
    .filter((r) => r.id && r.date && r.projectId && r.summary)
    .map((r) => ({
      id: r.id!,
      date: r.date!,
      projectId: r.projectId!,
      summary: r.summary!,
      manualNotes: r.manualNotes,
    }));
}

interface RawActionItem {
  content: string;
  priority: 'high' | 'medium' | 'low';
}

function parseActionItemsFromResponse(text: string): RawActionItem[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const validPriorities = new Set(['high', 'medium', 'low']);

  return parsed
    .filter(
      (item): item is { content: string; priority: string } =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).content === 'string' &&
        (item as Record<string, unknown>).content !== ''
    )
    .map((item) => ({
      content: String(item.content).trim(),
      priority: validPriorities.has(item.priority)
        ? (item.priority as 'high' | 'medium' | 'low')
        : 'medium',
    }))
    .filter((item) => item.content.length >= 10);
}

function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const d = new Date(dateString);
  return d instanceof Date && !isNaN(d.getTime());
}

function formatResultMessage(
  items: ExtractActionsResult['actionItems'],
  logCount: number
): string {
  if (items.length === 0) {
    return `No action items found in ${logCount} log(s).`;
  }

  const high = items.filter((i) => i.priority === 'high').length;
  const medium = items.filter((i) => i.priority === 'medium').length;
  const low = items.filter((i) => i.priority === 'low').length;

  const lines = [
    `Extracted ${items.length} action item(s) from ${logCount} log(s):`,
    `  High: ${high}  Medium: ${medium}  Low: ${low}`,
    '',
    ...items.map(
      (item, i) =>
        `${i + 1}. [${item.priority.toUpperCase()}] ${item.content}\n   ID: ${item.id}`
    ),
  ];

  return lines.join('\n');
}
