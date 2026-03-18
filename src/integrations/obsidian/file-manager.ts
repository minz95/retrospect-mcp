/**
 * Obsidian File Manager
 *
 * Manages markdown file creation and reading for Obsidian vault
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import Mustache from 'mustache';
import type { GitCommit } from '../../types/index.js';

export interface DailyLogData {
  date: string;
  projectName: string;
  summary: string;
  commits: GitCommit[];
  manualNotes?: string;
  actionItems?: string[];
}

export interface ObsidianFileManagerOptions {
  vaultPath: string;
}

export class ObsidianFileManager {
  private vaultPath: string;

  constructor(options: ObsidianFileManagerOptions) {
    this.vaultPath = options.vaultPath;

    // Ensure vault path exists
    if (!existsSync(this.vaultPath)) {
      mkdirSync(this.vaultPath, { recursive: true });
      console.error(`  - Created Obsidian vault at: ${this.vaultPath}`);
    }
  }

  /**
   * Create a daily log file
   */
  createDailyLog(projectName: string, data: DailyLogData): string {
    // Sanitize project name for directory
    const sanitizedProject = this.sanitizeName(projectName);
    const projectPath = join(this.vaultPath, 'Projects', sanitizedProject);
    const dailyLogsPath = join(projectPath, 'Daily Logs');

    // Ensure directory exists
    if (!existsSync(dailyLogsPath)) {
      mkdirSync(dailyLogsPath, { recursive: true });
    }

    // Generate filename
    const filename = `${data.date}.md`;
    const filePath = join(dailyLogsPath, filename);

    // Check if file already exists
    if (existsSync(filePath)) {
      throw new Error(`Daily log already exists for ${data.date}: ${filePath}`);
    }

    // Load template
    const templatePath = resolve(process.cwd(), 'templates/obsidian/daily-log.md');
    const template = readFileSync(templatePath, 'utf-8');

    // Prepare template data
    const templateData = {
      date: data.date,
      projectName: data.projectName,
      projectTag: this.sanitizeName(data.projectName),
      commitCount: data.commits.length,
      summary: data.summary || 'No summary provided',
      commits: data.commits.map(commit => ({
        sha: commit.sha.substring(0, 7),
        author: commit.author,
        message: commit.message,
        filesChangedCount: commit.filesChanged.length,
        additions: commit.additions,
        deletions: commit.deletions,
      })),
      manualNotes: data.manualNotes || 'No additional notes',
      actionItems: data.actionItems || [],
    };

    // Render template
    const content = Mustache.render(template, templateData);

    // Write file
    writeFileSync(filePath, content, 'utf-8');

    console.error(`  - Created daily log at: ${filePath}`);

    return filePath;
  }

  /**
   * Read a daily log file
   */
  readDailyLog(projectName: string, date: string): string {
    const sanitizedProject = this.sanitizeName(projectName);
    const filePath = join(
      this.vaultPath,
      'Projects',
      sanitizedProject,
      'Daily Logs',
      `${date}.md`
    );

    if (!existsSync(filePath)) {
      throw new Error(`Daily log not found for ${date}: ${filePath}`);
    }

    return readFileSync(filePath, 'utf-8');
  }

  /**
   * Update a daily log file
   */
  updateDailyLog(projectName: string, date: string, content: string): void {
    const sanitizedProject = this.sanitizeName(projectName);
    const filePath = join(
      this.vaultPath,
      'Projects',
      sanitizedProject,
      'Daily Logs',
      `${date}.md`
    );

    if (!existsSync(filePath)) {
      throw new Error(`Daily log not found for ${date}: ${filePath}`);
    }

    writeFileSync(filePath, content, 'utf-8');
    console.error(`  - Updated daily log at: ${filePath}`);
  }

  /**
   * Check if a daily log exists
   */
  dailyLogExists(projectName: string, date: string): boolean {
    const sanitizedProject = this.sanitizeName(projectName);
    const filePath = join(
      this.vaultPath,
      'Projects',
      sanitizedProject,
      'Daily Logs',
      `${date}.md`
    );

    return existsSync(filePath);
  }

  /**
   * Create a project directory
   */
  createProjectDirectory(projectName: string): string {
    const sanitizedProject = this.sanitizeName(projectName);
    const projectPath = join(this.vaultPath, 'Projects', sanitizedProject);

    if (existsSync(projectPath)) {
      throw new Error(`Project directory already exists: ${projectPath}`);
    }

    // Create project and daily logs directories
    mkdirSync(projectPath, { recursive: true });
    mkdirSync(join(projectPath, 'Daily Logs'), { recursive: true });

    console.error(`  - Created project directory at: ${projectPath}`);

    return projectPath;
  }

  /**
   * Write a generic markdown file
   */
  writeMarkdownFile(relativePath: string, content: string): string {
    const filePath = join(this.vaultPath, relativePath);
    const dir = dirname(filePath);

    // Ensure directory exists
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, content, 'utf-8');
    console.error(`  - Wrote markdown file: ${filePath}`);

    return filePath;
  }

  /**
   * Read a generic markdown file
   */
  readMarkdownFile(relativePath: string): string {
    const filePath = join(this.vaultPath, relativePath);

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return readFileSync(filePath, 'utf-8');
  }

  /**
   * Sanitize name for use as directory/file name
   */
  private sanitizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Get vault path
   */
  getVaultPath(): string {
    return this.vaultPath;
  }
}
