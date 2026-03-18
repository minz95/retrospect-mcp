/**
 * Git commit analyzer
 *
 * Analyzes Git commits for daily logs using gitlog package
 */

import gitlog from 'gitlog';
import type { GitlogOptions } from 'gitlog';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import type { GitCommit } from '../types/index.js';

// Cache for git analysis results
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

interface CacheEntry {
  data: GitCommit[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export interface AnalyzeCommitsOptions {
  repoPath: string;
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string; // ISO date string (YYYY-MM-DD)
  includeDiff?: boolean;
}

/**
 * Analyze git commits for a specific date range
 */
export async function analyzeGitCommits(options: AnalyzeCommitsOptions): Promise<GitCommit[]> {
  const { repoPath, startDate, endDate, includeDiff = false } = options;

  // Validate repository path
  if (!existsSync(repoPath)) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }

  if (!existsSync(`${repoPath}/.git`)) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }

  // Check cache
  const cacheKey = `${repoPath}:${startDate}:${endDate}:${includeDiff}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.error(`  - Using cached git analysis for ${startDate} to ${endDate}`);
    return cached.data;
  }

  // Configure gitlog options
  const gitlogOptions: GitlogOptions = {
    repo: repoPath,
    after: `${startDate} 00:00:00`,
    before: `${endDate} 23:59:59`,
    fields: ['hash', 'subject', 'authorName', 'authorDate'] as const,
    number: 1000, // Max commits to retrieve
  };

  try {
    // Get commits using gitlog
    const gitlogFunc = (gitlog as any).default || gitlog;
    const commits = await gitlogFunc(gitlogOptions);

    // Process commits
    const gitCommits: GitCommit[] = [];

    for (const commit of commits) {
      const gitCommit: GitCommit = {
        sha: commit.hash,
        message: commit.subject,
        author: commit.authorName,
        date: commit.authorDate,
        filesChanged: [],
        additions: 0,
        deletions: 0,
      };

      // Get file stats for this commit
      try {
        const stats = getCommitStats(repoPath, commit.hash);
        gitCommit.filesChanged = stats.filesChanged;
        gitCommit.additions = stats.additions;
        gitCommit.deletions = stats.deletions;

        // Optionally include diff
        if (includeDiff) {
          gitCommit.diff = getCommitDiff(repoPath, commit.hash);
        }
      } catch (error) {
        console.error(`  - Warning: Failed to get stats for commit ${commit.hash}:`, error);
      }

      gitCommits.push(gitCommit);
    }

    // Cache the results
    cache.set(cacheKey, {
      data: gitCommits,
      timestamp: Date.now(),
    });

    console.error(`  - Analyzed ${gitCommits.length} commits from ${startDate} to ${endDate}`);

    return gitCommits;
  } catch (error) {
    throw new Error(`Failed to analyze git commits: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get commit statistics (files changed, additions, deletions)
 */
function getCommitStats(repoPath: string, commitSha: string): {
  filesChanged: string[];
  additions: number;
  deletions: number;
} {
  try {
    // Get numstat for the commit
    const numstat = execSync(`git -C "${repoPath}" show --numstat --format="" ${commitSha}`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    const lines = numstat.trim().split('\n').filter(line => line);
    const filesChanged: string[] = [];
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const added = parseInt(parts[0], 10);
        const deleted = parseInt(parts[1], 10);
        const filename = parts.slice(2).join(' ');

        if (!isNaN(added)) additions += added;
        if (!isNaN(deleted)) deletions += deleted;
        filesChanged.push(filename);
      }
    }

    return { filesChanged, additions, deletions };
  } catch (error) {
    // Return empty stats if error
    return { filesChanged: [], additions: 0, deletions: 0 };
  }
}

/**
 * Get commit diff
 */
function getCommitDiff(repoPath: string, commitSha: string): string {
  try {
    const diff = execSync(`git -C "${repoPath}" show ${commitSha}`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    return diff;
  } catch (error) {
    return '';
  }
}

/**
 * Clear analysis cache
 */
export function clearAnalysisCache(): void {
  cache.clear();
  console.error('  - Git analysis cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  keys: string[];
} {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
