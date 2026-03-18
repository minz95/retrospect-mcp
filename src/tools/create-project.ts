/**
 * MCP Tool: create_project
 *
 * Creates a new project with:
 * - Obsidian directory and README
 * - SQLite metadata entry
 * - Optional conversational ideation
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import Mustache from 'mustache';
import { readFileSync } from 'fs';
import { createProject, updateProject } from '../storage/db.js';
import { NotionClient } from '../integrations/notion/client.js';
import { buildProjectDatabaseProperties } from '../integrations/notion/page-builder.js';
import type { Config } from '../types/index.js';

export interface CreateProjectParams {
  projectName: string;
  description?: string;
  conversationMode?: boolean;
}

export interface CreateProjectResult {
  projectId: string;
  obsidianPath: string;
  notionPageId?: string;
  message: string;
}

/**
 * Create a new project
 */
export async function createProjectTool(
  params: CreateProjectParams,
  config: Config
): Promise<CreateProjectResult> {
  const { projectName, description, conversationMode } = params;

  // Validate project name
  if (!projectName || projectName.trim().length === 0) {
    throw new Error('Project name is required');
  }

  const sanitizedName = sanitizeName(projectName);
  const createdDate = new Date().toISOString();

  // Create Obsidian directory
  const obsidianPath = createObsidianProject(
    config.obsidian.vaultPath,
    sanitizedName,
    projectName,
    description || '',
    createdDate
  );

  // Create database entry
  const projectId = createProject({
    name: projectName,
    description,
    createdDate,
    obsidianPath,
  });

  // Create Notion database
  let notionPageId: string | undefined;
  let notionUrl: string | undefined;
  try {
    const notionClient = new NotionClient({
      token: config.notion.token,
      parentPageId: config.notion.parentPageId,
    });

    // Create database for daily logs
    const notionResult = await notionClient.createDatabase({
      title: projectName,
      properties: buildProjectDatabaseProperties(),
    });

    notionPageId = notionResult.databaseId;
    notionUrl = notionResult.url;
    console.error(`  - Created Notion database: ${notionUrl}`);

    // Update project with Notion database ID
    updateProject(projectId, { notionPageId });
  } catch (error) {
    console.error('  - Warning: Failed to create Notion database:', error);
    // Continue without Notion database (don't fail the entire operation)
  }

  // TODO: Implement conversation mode in Issue #25
  if (conversationMode) {
    console.error('Note: Conversation mode will be implemented in Issue #25');
  }

  return {
    projectId,
    obsidianPath,
    notionPageId,
    message: `Project "${projectName}" created successfully!\n- ID: ${projectId}\n- Obsidian: ${obsidianPath}${notionPageId ? `\n- Notion: ${notionUrl}` : ''}`,
  };
}

/**
 * Create Obsidian project directory and README
 */
function createObsidianProject(
  vaultPath: string,
  sanitizedName: string,
  displayName: string,
  description: string,
  createdDate: string
): string {
  // Create project directory
  const projectPath = resolve(vaultPath, 'Projects', sanitizedName);

  if (existsSync(projectPath)) {
    throw new Error(`Project directory already exists: ${projectPath}`);
  }

  mkdirSync(projectPath, { recursive: true });

  // Create Daily Logs subdirectory
  const dailyLogsPath = join(projectPath, 'Daily Logs');
  mkdirSync(dailyLogsPath, { recursive: true });

  // Load and render template
  const templatePath = resolve(process.cwd(), 'templates/obsidian/project.md');
  const template = readFileSync(templatePath, 'utf-8');

  const rendered = Mustache.render(template, {
    name: displayName,
    description: description || 'No description provided',
    createdDate,
    notionUrl: 'TBD (will be added in Issue #24)',
  });

  // Write README
  const readmePath = join(projectPath, 'README.md');
  writeFileSync(readmePath, rendered, 'utf-8');

  console.error(`  - Created Obsidian project at: ${projectPath}`);

  return projectPath;
}

/**
 * Sanitize project name for use as directory name
 */
function sanitizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
