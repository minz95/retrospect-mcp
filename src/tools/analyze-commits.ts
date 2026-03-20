/**
 * MCP Tool: analyze_git_commits
 *
 * Analyzes git commits for a specific date range
 */

import { analyzeGitCommits } from '../core/git-analyzer.js';
import { createLogger } from '../utils/logger.js';
import { ValidationError } from '../utils/errors.js';
import type { GitCommit } from '../types/index.js';

const log = createLogger('analyze-commits');

export interface AnalyzeCommitsParams {
  repoPath: string;
  startDate: string; // ISO date (YYYY-MM-DD)
  endDate: string; // ISO date (YYYY-MM-DD)
  includeChanges?: boolean; // Include diff analysis
}

export interface AnalyzeCommitsResult {
  commits: GitCommit[];
  totalCommits: number;
  totalAdditions: number;
  totalDeletions: number;
  filesChanged: string[];
  message: string;
}

/**
 * Analyze git commits
 */
export async function analyzeCommitsTool(
  params: AnalyzeCommitsParams
): Promise<AnalyzeCommitsResult> {
  const { repoPath, startDate, endDate, includeChanges = false } = params;

  // Validate dates
  if (!isValidDate(startDate)) {
    throw new ValidationError(`Invalid start date: ${startDate}. Expected format: YYYY-MM-DD`);
  }

  if (!isValidDate(endDate)) {
    throw new ValidationError(`Invalid end date: ${endDate}. Expected format: YYYY-MM-DD`);
  }

  log.info(`Analyzing commits in ${repoPath} from ${startDate} to ${endDate}`);

  // Analyze commits
  const commits = await analyzeGitCommits({
    repoPath,
    startDate,
    endDate,
    includeDiff: includeChanges,
  });

  // Calculate statistics
  const totalAdditions = commits.reduce((sum, c) => sum + c.additions, 0);
  const totalDeletions = commits.reduce((sum, c) => sum + c.deletions, 0);

  // Get unique files changed
  const filesChangedSet = new Set<string>();
  commits.forEach(c => c.filesChanged.forEach(f => filesChangedSet.add(f)));
  const filesChanged = Array.from(filesChangedSet);

  // Format message
  const message = formatCommitsMessage(commits, totalAdditions, totalDeletions, filesChanged);

  return {
    commits,
    totalCommits: commits.length,
    totalAdditions,
    totalDeletions,
    filesChanged,
    message,
  };
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
 * Format commits into a readable message
 */
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

  // List commits
  lines.push('Commits:');
  commits.forEach((commit, index) => {
    lines.push(
      `${index + 1}. ${commit.sha.substring(0, 7)} - ${commit.message} (${commit.author})`
    );
    lines.push(`   Files: ${commit.filesChanged.length}, +${commit.additions} / -${commit.deletions}`);
  });

  // List top changed files
  if (filesChanged.length > 0) {
    lines.push('');
    lines.push('Files changed:');
    const topFiles = filesChanged.slice(0, 10);
    topFiles.forEach(file => lines.push(`  - ${file}`));

    if (filesChanged.length > 10) {
      lines.push(`  ... and ${filesChanged.length - 10} more`);
    }
  }

  return lines.join('\n');
}
