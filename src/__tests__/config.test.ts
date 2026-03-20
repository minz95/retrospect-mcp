/**
 * Unit tests for configuration loading and validation.
 * Uses temp files to avoid touching the real config.
 */

import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig } from '../utils/config';

function writeTempConfig(content: object): string {
  const path = join(tmpdir(), `retrospect-test-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(content), 'utf-8');
  return path;
}

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env vars after each test
    process.env = { ...originalEnv };
  });

  it('loads minimal required config (Claude + Obsidian)', () => {
    process.env.CLAUDE_API_KEY = 'sk-test-key';
    process.env.OBSIDIAN_VAULT_PATH = '/tmp/vault';
    process.env.DATABASE_PATH = '/tmp/test.db';
    process.env.DEFAULT_GIT_REPO_PATH = '';
    // Clear all optional vars so they are not picked up from .env
    delete process.env.NOTION_TOKEN;
    delete process.env.NOTION_PARENT_PAGE_ID;
    delete process.env.TWITTER_BEARER_TOKEN;
    delete process.env.TWITTER_API_KEY;
    delete process.env.TWITTER_API_SECRET;
    delete process.env.TWITTER_ACCESS_TOKEN;
    delete process.env.TWITTER_ACCESS_SECRET;
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    delete process.env.LINKEDIN_USER_ID;
    delete process.env.MEDIUM_TOKEN;

    const configPath = writeTempConfig({
      obsidian: { vaultPath: '${OBSIDIAN_VAULT_PATH}' },
      notion: { token: '${NOTION_TOKEN}', parentPageId: '${NOTION_PARENT_PAGE_ID}' },
      claude: { apiKey: '${CLAUDE_API_KEY}', model: 'claude-sonnet-4-6' },
      sns: {
        thread: { bearerToken: '${TWITTER_BEARER_TOKEN}' },
        linkedin: { accessToken: '${LINKEDIN_ACCESS_TOKEN}', userId: '${LINKEDIN_USER_ID}' },
        medium: { token: '${MEDIUM_TOKEN}' },
      },
      git: { defaultRepoPath: '${DEFAULT_GIT_REPO_PATH}' },
      database: { path: '${DATABASE_PATH}' },
    });

    try {
      const config = loadConfig(configPath);
      expect(config.claude.apiKey).toBe('sk-test-key');
      expect(config.obsidian.vaultPath).toBe('/tmp/vault');
      // Optional sections should be stripped
      expect(config.notion).toBeUndefined();
      expect(config.sns).toBeUndefined();
    } finally {
      unlinkSync(configPath);
    }
  });

  it('includes notion config when token is set', () => {
    process.env.CLAUDE_API_KEY = 'sk-test-key';
    process.env.OBSIDIAN_VAULT_PATH = '/tmp/vault';
    process.env.DATABASE_PATH = '/tmp/test.db';
    process.env.DEFAULT_GIT_REPO_PATH = '';
    process.env.NOTION_TOKEN = 'secret_abc';
    process.env.NOTION_PARENT_PAGE_ID = 'page-123';

    const configPath = writeTempConfig({
      obsidian: { vaultPath: '${OBSIDIAN_VAULT_PATH}' },
      notion: { token: '${NOTION_TOKEN}', parentPageId: '${NOTION_PARENT_PAGE_ID}' },
      claude: { apiKey: '${CLAUDE_API_KEY}', model: 'claude-sonnet-4-6' },
      git: { defaultRepoPath: '${DEFAULT_GIT_REPO_PATH}' },
      database: { path: '${DATABASE_PATH}' },
    });

    try {
      const config = loadConfig(configPath);
      expect(config.notion).toBeDefined();
      expect(config.notion!.token).toBe('secret_abc');
      expect(config.notion!.parentPageId).toBe('page-123');
    } finally {
      unlinkSync(configPath);
    }
  });

  it('throws when Claude API key is missing', () => {
    delete process.env.CLAUDE_API_KEY;
    process.env.OBSIDIAN_VAULT_PATH = '/tmp/vault';

    const configPath = writeTempConfig({
      obsidian: { vaultPath: '${OBSIDIAN_VAULT_PATH}' },
      claude: { apiKey: '${CLAUDE_API_KEY}', model: 'claude-sonnet-4-6' },
      git: { defaultRepoPath: '' },
      database: { path: '/tmp/test.db' },
    });

    try {
      expect(() => loadConfig(configPath)).toThrow('Invalid configuration');
    } finally {
      unlinkSync(configPath);
    }
  });

  it('throws when Obsidian vault path is missing', () => {
    process.env.CLAUDE_API_KEY = 'sk-test-key';
    delete process.env.OBSIDIAN_VAULT_PATH;

    const configPath = writeTempConfig({
      obsidian: { vaultPath: '${OBSIDIAN_VAULT_PATH}' },
      claude: { apiKey: '${CLAUDE_API_KEY}', model: 'claude-sonnet-4-6' },
      git: { defaultRepoPath: '' },
      database: { path: '/tmp/test.db' },
    });

    try {
      expect(() => loadConfig(configPath)).toThrow('Invalid configuration');
    } finally {
      unlinkSync(configPath);
    }
  });
});
