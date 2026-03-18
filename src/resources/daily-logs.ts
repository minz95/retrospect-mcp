/**
 * MCP Resource: daily-logs
 *
 * Provides access to daily development logs
 */

import { getDailyLog, getDailyLogsByDateRange } from '../storage/db.js';

/**
 * List daily logs resources
 */
export function listDailyLogsResources(): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  return [
    {
      uri: 'daily-logs://list',
      name: 'Daily Logs',
      description: 'Query daily logs by date range (use daily-logs://{date} or daily-logs://{id})',
      mimeType: 'application/json',
    },
  ];
}

/**
 * Read daily logs resource
 */
export function readDailyLogsResource(uri: string): string {
  // Parse URI: daily-logs://{date}, daily-logs://{id}, or daily-logs://list?start={date}&end={date}
  const match = uri.match(/^daily-logs:\/\/(.+)$/);
  if (!match) {
    throw new Error(
      `Invalid daily-logs URI: ${uri}. Expected format: daily-logs://{date}, daily-logs://{id}, or daily-logs://list?start=...&end=...`
    );
  }

  const param = match[1];

  // Check if it's a date range query (list?start=...&end=...)
  if (param.startsWith('list')) {
    const urlParams = new URLSearchParams(param.substring(4)); // Remove 'list'
    const startDate = urlParams.get('start');
    const endDate = urlParams.get('end');

    if (!startDate || !endDate) {
      throw new Error('Date range query requires start and end parameters');
    }

    return readLogsByDateRange(startDate, endDate);
  }

  // Check if it's a date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(param)) {
    return readLogsByDate(param);
  }

  // Check if it's an ID (starts with 'log')
  if (param.startsWith('log')) {
    return readLogById(param);
  }

  throw new Error(
    `Invalid daily-logs parameter: ${param}. Expected date (YYYY-MM-DD), log ID (log...), or list?start=...&end=...`
  );
}

/**
 * Read logs by specific date
 */
function readLogsByDate(date: string): string {
  const logs = getDailyLogsByDateRange(date, date);

  if (logs.length === 0) {
    return JSON.stringify(
      {
        date,
        logs: [],
        message: `No logs found for date: ${date}`,
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      date,
      logs: logs.map(log => ({
        id: log.id,
        projectId: log.projectId,
        summary: log.summary,
        obsidianPath: log.obsidianPath,
        notionPageId: log.notionPageId,
        manualNotes: log.manualNotes,
      })),
      total: logs.length,
    },
    null,
    2
  );
}

/**
 * Read logs by date range
 */
function readLogsByDateRange(startDate: string, endDate: string): string {
  const logs = getDailyLogsByDateRange(startDate, endDate);

  if (logs.length === 0) {
    return JSON.stringify(
      {
        startDate,
        endDate,
        logs: [],
        message: `No logs found for date range: ${startDate} to ${endDate}`,
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      startDate,
      endDate,
      logs: logs.map(log => ({
        id: log.id,
        date: log.date,
        projectId: log.projectId,
        summary: log.summary,
        obsidianPath: log.obsidianPath,
        notionPageId: log.notionPageId,
      })),
      total: logs.length,
    },
    null,
    2
  );
}

/**
 * Read specific log by ID
 */
function readLogById(id: string): string {
  const log = getDailyLog(id);

  if (!log) {
    return JSON.stringify(
      {
        error: `Log not found: ${id}`,
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      id: log.id,
      date: log.date,
      projectId: log.projectId,
      summary: log.summary,
      manualNotes: log.manualNotes,
      obsidianPath: log.obsidianPath,
      notionPageId: log.notionPageId,
    },
    null,
    2
  );
}
