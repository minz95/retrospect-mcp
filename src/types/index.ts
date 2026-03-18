/**
 * Type definitions for Retrospect MCP
 */

export interface Config {
  obsidian: {
    vaultPath: string;
  };
  notion: {
    token: string;
    parentPageId: string;
  };
  claude: {
    apiKey: string;
    model: string;
  };
  sns: {
    thread: {
      bearerToken: string;
      apiKey?: string;
      apiSecret?: string;
      accessToken?: string;
      accessSecret?: string;
    };
    linkedin: {
      accessToken: string;
      userId: string;
    };
    medium: {
      token: string;
    };
  };
  git: {
    defaultRepoPath: string;
  };
  database: {
    path: string;
  };
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdDate: string;
  obsidianPath: string;
  notionPageId?: string;
}

export interface DailyLog {
  id: string;
  date: string;
  projectId: string;
  summary: string;
  commits: GitCommit[];
  manualNotes?: string;
  obsidianPath: string;
  notionPageId?: string;
  actionItems: string[];
}

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  filesChanged: string[];
  additions: number;
  deletions: number;
  diff?: string;
}

export interface Insight {
  id: string;
  date: string;
  content: string;
  category: string;
  confidence: number;
  sourceLogIds: string[];
}

export interface SNSPost {
  id: string;
  insightId: string;
  platform: 'thread' | 'linkedin' | 'medium';
  content: string | string[]; // Array for threads
  status: 'pending' | 'approved' | 'published' | 'rejected';
  version: number;
  parentId?: string;
  createdAt: string;
  publishedAt?: string;
  publishedUrl?: string;
  metadata?: {
    hashtags?: string[];
    characterCount?: number;
    estimatedReadTime?: number;
  };
}

export interface ActionItem {
  id: string;
  logId: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  createdAt: string;
}
