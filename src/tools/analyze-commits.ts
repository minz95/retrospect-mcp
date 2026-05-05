/**
 * MCP Tool: analyze_git_commits
 *
 * Analyzes git commits for a specific date range.
 * Uses GitHub API (via gh CLI) when repoPath is omitted.
 */

import { analyzeGitCommits } from '../core/git-analyzer.js';
import { analyzeGitHubCommits } from '../core/github-analyzer.js';
import { createLogger } from '../utils/logger.js';
import { ValidationError } from '../utils/errors.js';
import type { GitCommit } from '../types/index.js';

const log = createLogger('analyze-commits');

export interface AnalyzeCommitsParams {
  repoPath?: string;
  startDate: string; // ISO date (YYYY-MM-DD)
  endDate: string; // ISO date (YYYY-MM-DD)
  includeChanges?: boolean; // Include diff analysis (local only)
}

export interface AnalyzeCommitsResult {
  commits: GitCommit[];
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  filesChanged: string[];
  message: string;
}

export async function analyzeCommitsTool(
  params: AnalyzeCommitsParams
): Promise<AnalyzeCommitsResult> {
  const { repoPath, startDate, endDate, includeChanges = false } = params;

  if (!isValidDate(startDate)) {
    throw new ValidationError(`Invalid start date: ${startDate}. Expected format: YYYY-MM-DD`);
  }
  if (!isValidDate(endDate)) {
    throw new ValidationError(`Invalid end date: ${endDate}. Expected format: YYYY-MM-DD`);
  }

  let commits: GitCommit[];

  if (repoPath) {
    log.info(`Analyzing local commits in ${repoPath} from ${startDate} to ${endDate}`);
    commits = await analyzeGitCommits({ repoPath, startDate, endDate, includeDiff: includeChanges });
  } else {
    log.info(`Analyzing GitHub commits via gh CLI from ${startDate} to ${endDate}`);
    commits = await analyzeGitHubCommits({ startDate, endDate });
  }

  const totalAdditions = commits.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = commits.reduce((sum, c) => sum + c.deletions, 0);

  const filesChangedSet = new Set<string>();
  commits.forEach(c => c.filesChanged.forEach(f => filesChangedSet.add(f)));
  const filesChanged = Array.from(filesChangedSet);

  const message = formatCommitsMessage(commits, totalAdditions, totalDeletions, filesChanged);

  return { commits, totalCommits: commits.length, totalAdditions, totalDeletions, filesChanged, message };
}

function isValidDate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

function formatCommitsMessage(
  commits: GitCommit[],
  totalAdditions: number,
  totalDeletions: number,
  filesChanged: string[]
): string {
  if (commits.length === 0) {
    return 'No commits found for the specified date range.';
  }

  const lines: string[] = [];
  lines.push(`Found ${commits.length} commit(s)`);
  lines.push(`Total changes: +${totalAdditions} / -${totalDeletions}`);
  lines.push(`Files affected: ${filesChanged.length}`);
  lines.push('');
  lines.push('Commits:');

  commits.forEach((commit, index) => {
    const repo = commit.repoName ? `[${commit.repoName}] ` : '';
    lines.push(`${index + 1}. ${repo}${commit.sha.substring(0, 7)} - ${commit.message} (${commit.author})`);
    if (commit.filesChanged.length > 0 || commit.additions > 0) {
      lines.push(`   Files: ${commit.filesChanged.length}, +${commit.additions} / -${commit.deletions}`);
    }
  });

  if (filesChanged.length > 0) {
    lines.push('');
    lines.push('Files changed:');
    filesChanged.slice(0, 10).forEach(file => lines.push(`  - ${file}`));
    if (filesChanged.length > 10) {
      lines.push(`  ... and ${filesChanged.length - 10} more`);
    }
  }

  return lines.join('\n');
}
