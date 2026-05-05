import { execSync } from 'child_process';
import type { GitCommit } from '../types/index.js';

export interface GitHubCommit extends GitCommit {
  repoName: string;
  repoFullName: string;
}

export async function analyzeGitHubCommits(options: {
  startDate: string;
  endDate: string;
  username?: string;
}): Promise<GitHubCommit[]> {
  const { startDate, endDate } = options;

  let username = options.username;
  if (!username) {
    username = execSync('gh api /user --jq .login', { encoding: 'utf-8' }).trim();
  }

  const eventsJson = execSync(
    `gh api "/users/${username}/events?per_page=100"`,
    { encoding: 'utf-8' }
  );
  const events: any[] = JSON.parse(eventsJson);

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T23:59:59Z`);
  const seen = new Set<string>();
  const commits: GitHubCommit[] = [];

  for (const event of events) {
    if (event.type !== 'PushEvent') continue;

    const eventDate = new Date(event.created_at);
    if (eventDate < start || eventDate > end) continue;

    const repoFullName: string = event.repo.name;
    const repoName = repoFullName.split('/')[1];

    // Private repo PushEvents come back with an empty payload.commits array;
    // fall back to the compare API to recover the actual commit list.
    let payloadCommits: any[] = event.payload.commits ?? [];
    if (payloadCommits.length === 0 && event.payload.before && event.payload.head) {
      payloadCommits = fetchCommitsViaCompare(repoFullName, event.payload.before, event.payload.head);
    }

    for (const commit of payloadCommits) {
      if (seen.has(commit.sha)) continue;
      seen.add(commit.sha);

      commits.push({
        sha: commit.sha,
        message: commit.message,
        author: commit.author?.name ?? 'unknown',
        date: event.created_at,
        filesChanged: [],
        additions: 0,
        deletions: 0,
        repoName,
        repoFullName,
      });
    }
  }

  return commits;
}

function fetchCommitsViaCompare(repoFullName: string, before: string, head: string): any[] {
  try {
    const json = execSync(
      `gh api "/repos/${repoFullName}/compare/${before}...${head}"`,
      { encoding: 'utf-8' }
    );
    const compare = JSON.parse(json);
    return (compare.commits ?? []).map((c: any) => ({
      sha: c.sha,
      message: c.commit.message,
      author: { name: c.commit.author?.name ?? 'unknown' },
    }));
  } catch {
    return [];
  }
}
