/**
 * MCP Tool: log_daily_work
 *
 * Logs daily development work by:
 * - Analyzing git commits
 * - Collecting manual notes
 * - Creating Obsidian markdown file
 * - Extracting action items
 * - Saving to SQLite
 */

import { analyzeGitCommits } from '../core/git-analyzer.js';
import { ObsidianFileManager } from '../integrations/obsidian/file-manager.js';
import { NotionClient } from '../integrations/notion/client.js';
import { buildDailyLogPage } from '../integrations/notion/page-builder.js';
import { createDailyLog, getProject, createActionItem, updateDailyLog } from '../storage/db.js';
import type { Config } from '../types/index.js';
import type { GitCommit } from '../types/index.js';

export interface LogDailyWorkParams {
  date?: string; // ISO date (YYYY-MM-DD), defaults to today
  projectId: string;
  gitRepoPath?: string;
  manualInput?: string;
  includeCommits?: boolean; // Default true
}

export interface LogDailyWorkResult {
  logId: string;
  obsidianPath: string;
  notionPageId?: string;
  commitCount: number;
  actionItems: string[];
  message: string;
}

/**
 * Log daily work
 */
export async function logDailyWorkTool(
  params: LogDailyWorkParams,
  config: Config
): Promise<LogDailyWorkResult> {
  const {
    date = new Date().toISOString().split('T')[0],
    projectId,
    gitRepoPath,
    manualInput,
    includeCommits = true,
  } = params;

  // Get project from database
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // Analyze git commits if requested
  let commits: GitCommit[] = [];
  if (includeCommits && gitRepoPath) {
    try {
      commits = await analyzeGitCommits({
        repoPath: gitRepoPath,
        startDate: date,
        endDate: date,
        includeDiff: false,
      });
      console.error(`  - Found ${commits.length} commits for ${date}`);
    } catch (error) {
      console.error(`  - Warning: Failed to analyze git commits:`, error);
      // Continue without commits
    }
  } else if (includeCommits && !gitRepoPath) {
    // Use default git repo path from config
    try {
      commits = await analyzeGitCommits({
        repoPath: config.git.defaultRepoPath,
        startDate: date,
        endDate: date,
        includeDiff: false,
      });
      console.error(`  - Found ${commits.length} commits for ${date}`);
    } catch (error) {
      console.error(`  - Warning: Failed to analyze git commits:`, error);
    }
  }

  // Generate summary
  const summary = generateSummary(commits, manualInput);

  // Extract action items
  const actionItems = extractActionItems(manualInput || '');

  // Create Obsidian file
  const fileManager = new ObsidianFileManager({
    vaultPath: config.obsidian.vaultPath,
  });

  const obsidianPath = fileManager.createDailyLog(project.name, {
    date,
    projectName: project.name,
    summary,
    commits,
    manualNotes: manualInput,
    actionItems,
  });

  // Save to database
  const logId = createDailyLog({
    date,
    projectId,
    summary,
    obsidianPath,
    manualNotes: manualInput,
    actionItems,
  });

  // Save action items to database
  for (const item of actionItems) {
    createActionItem({
      logId,
      content: item,
      priority: 'medium', // Default priority
      completed: false,
    });
  }

  // Create Notion page (dual write)
  let notionPageId: string | undefined;
  try {
    if (project.notionPageId) {
      const notionClient = new NotionClient({
        token: config.notion.token,
        parentPageId: config.notion.parentPageId,
      });

      // Build Notion page data
      const pageData = buildDailyLogPage({
        date,
        projectName: project.name,
        summary,
        commits,
        manualNotes: manualInput,
        actionItems,
      });

      // Create page in project's Notion database
      const notionResult = await notionClient.createPage({
        databaseId: project.notionPageId,
        properties: pageData.properties,
        content: pageData.content,
      });

      notionPageId = notionResult.pageId;
      console.error(`  - Notion page created: ${notionResult.url}`);

      // Update database with Notion page ID
      updateDailyLog(logId, { notionPageId });
    } else {
      console.error('  - Skipping Notion (project has no Notion database)');
    }
  } catch (error) {
    console.error('  - Warning: Failed to create Notion page:', error);
    // Continue without Notion page (don't fail the entire operation)
  }

  return {
    logId,
    obsidianPath,
    notionPageId,
    commitCount: commits.length,
    actionItems,
    message: `Daily log created for ${date}!\n- Log ID: ${logId}\n- Commits: ${commits.length}\n- Action items: ${actionItems.length}\n- Obsidian: ${obsidianPath}${notionPageId ? `\n- Notion: Created (${notionPageId})` : ''}`,
  };
}

/**
 * Generate summary from commits and manual input
 */
function generateSummary(commits: GitCommit[], manualInput?: string): string {
  const parts: string[] = [];

  if (commits.length > 0) {
    const commitMessages = commits.map(c => c.message).join('; ');
    parts.push(`Worked on: ${commitMessages}`);
  }

  if (manualInput && manualInput.trim().length > 0) {
    parts.push(manualInput.trim());
  }

  if (parts.length === 0) {
    return 'No activity recorded';
  }

  return parts.join('. ');
}

/**
 * Extract action items from manual input
 * Looks for patterns like:
 * - TODO: something
 * - [ ] something
 * - Action: something
 */
function extractActionItems(text: string): string[] {
  const actionItems: string[] = [];

  // Pattern 1: TODO: or TODO -
  const todoPattern = /(?:TODO|Todo|todo)[\s:]*[-]?\s*(.+)/gi;
  let match;

  while ((match = todoPattern.exec(text)) !== null) {
    const item = match[1].trim();
    if (item && !actionItems.includes(item)) {
      actionItems.push(item);
    }
  }

  // Pattern 2: - [ ] checkbox
  const checkboxPattern = /-\s*\[\s*\]\s*(.+)/g;
  while ((match = checkboxPattern.exec(text)) !== null) {
    const item = match[1].trim();
    if (item && !actionItems.includes(item)) {
      actionItems.push(item);
    }
  }

  // Pattern 3: Action: or Next:
  const actionPattern = /(?:Action|action|Next|next)[\s:]*[-]?\s*(.+)/gi;
  while ((match = actionPattern.exec(text)) !== null) {
    const item = match[1].trim();
    if (item && !actionItems.includes(item)) {
      actionItems.push(item);
    }
  }

  return actionItems;
}
