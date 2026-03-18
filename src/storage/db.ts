/**
 * SQLite database setup and migrations
 */

import Database from 'better-sqlite3';
import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Project, DailyLog, Insight, SNSPost, ActionItem } from '../types/index.js';

let db: Database.Database | null = null;

/**
 * Initialize database connection and run migrations
 */
export function initializeDatabase(dbPath: string): Database.Database {
  // Ensure data directory exists
  const dataDir = resolve(dbPath, '..');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Create database connection
  db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  console.error('✓ Database initialized:', dbPath);
  return db;
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Run database migrations
 */
function runMigrations(database: Database.Database): void {
  // Create projects table
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_date TEXT NOT NULL,
      obsidian_path TEXT NOT NULL,
      notion_page_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create daily_logs table
  database.exec(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      project_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      manual_notes TEXT,
      obsidian_path TEXT NOT NULL,
      notion_page_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(date, project_id)
    )
  `);

  // Create insights table
  database.exec(`
    CREATE TABLE IF NOT EXISTS insights (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      confidence REAL NOT NULL,
      source_log_ids TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create pending_posts table
  database.exec(`
    CREATE TABLE IF NOT EXISTS pending_posts (
      id TEXT PRIMARY KEY,
      insight_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('thread', 'linkedin', 'medium')),
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'published', 'rejected')),
      version INTEGER NOT NULL DEFAULT 1,
      parent_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      published_at DATETIME,
      published_url TEXT,
      metadata TEXT,
      FOREIGN KEY (insight_id) REFERENCES insights(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES pending_posts(id) ON DELETE SET NULL
    )
  `);

  // Create action_items table
  database.exec(`
    CREATE TABLE IF NOT EXISTS action_items (
      id TEXT PRIMARY KEY,
      log_id TEXT NOT NULL,
      content TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
      completed BOOLEAN NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (log_id) REFERENCES daily_logs(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better query performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
    CREATE INDEX IF NOT EXISTS idx_daily_logs_project ON daily_logs(project_id);
    CREATE INDEX IF NOT EXISTS idx_insights_date ON insights(date);
    CREATE INDEX IF NOT EXISTS idx_pending_posts_status ON pending_posts(status);
    CREATE INDEX IF NOT EXISTS idx_pending_posts_insight ON pending_posts(insight_id);
    CREATE INDEX IF NOT EXISTS idx_action_items_log ON action_items(log_id);
    CREATE INDEX IF NOT EXISTS idx_action_items_completed ON action_items(completed);
  `);

  console.error('✓ Database migrations completed');
}

// ==================== Project CRUD ====================

export function createProject(project: Omit<Project, 'id'>): string {
  const database = getDatabase();
  const id = generateId('prj');

  const stmt = database.prepare(`
    INSERT INTO projects (id, name, description, created_date, obsidian_path, notion_page_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    project.name,
    project.description || null,
    project.createdDate,
    project.obsidianPath,
    project.notionPageId || null
  );

  return id;
}

export function getProject(id: string): Project | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM projects WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdDate: row.created_date,
    obsidianPath: row.obsidian_path,
    notionPageId: row.notion_page_id,
  };
}

export function getAllProjects(): Project[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM projects ORDER BY created_at DESC');
  const rows = stmt.all() as any[];

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdDate: row.created_date,
    obsidianPath: row.obsidian_path,
    notionPageId: row.notion_page_id,
  }));
}

// ==================== Daily Log CRUD ====================

export function createDailyLog(log: Omit<DailyLog, 'id' | 'commits'>): string {
  const database = getDatabase();
  const id = generateId('log');

  const stmt = database.prepare(`
    INSERT INTO daily_logs (id, date, project_id, summary, manual_notes, obsidian_path, notion_page_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    log.date,
    log.projectId,
    log.summary,
    log.manualNotes || null,
    log.obsidianPath,
    log.notionPageId || null
  );

  return id;
}

export function getDailyLog(id: string): Partial<DailyLog> | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM daily_logs WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    date: row.date,
    projectId: row.project_id,
    summary: row.summary,
    manualNotes: row.manual_notes,
    obsidianPath: row.obsidian_path,
    notionPageId: row.notion_page_id,
  };
}

export function getDailyLogsByDateRange(startDate: string, endDate: string): Partial<DailyLog>[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM daily_logs WHERE date >= ? AND date <= ? ORDER BY date DESC');
  const rows = stmt.all(startDate, endDate) as any[];

  return rows.map(row => ({
    id: row.id,
    date: row.date,
    projectId: row.project_id,
    summary: row.summary,
    manualNotes: row.manual_notes,
    obsidianPath: row.obsidian_path,
    notionPageId: row.notion_page_id,
  }));
}

// ==================== Insight CRUD ====================

export function createInsight(insight: Omit<Insight, 'id'>): string {
  const database = getDatabase();
  const id = generateId('ins');

  const stmt = database.prepare(`
    INSERT INTO insights (id, date, content, category, confidence, source_log_ids)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    insight.date,
    insight.content,
    insight.category,
    insight.confidence,
    JSON.stringify(insight.sourceLogIds)
  );

  return id;
}

export function getInsight(id: string): Insight | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM insights WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    date: row.date,
    content: row.content,
    category: row.category,
    confidence: row.confidence,
    sourceLogIds: JSON.parse(row.source_log_ids),
  };
}

export function getInsightsByDate(date: string): Insight[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM insights WHERE date = ? ORDER BY confidence DESC');
  const rows = stmt.all(date) as any[];

  return rows.map(row => ({
    id: row.id,
    date: row.date,
    content: row.content,
    category: row.category,
    confidence: row.confidence,
    sourceLogIds: JSON.parse(row.source_log_ids),
  }));
}

// ==================== SNS Post CRUD ====================

export function createSNSPost(post: Omit<SNSPost, 'id' | 'createdAt'>): string {
  const database = getDatabase();
  const id = generateId('post');

  const stmt = database.prepare(`
    INSERT INTO pending_posts (id, insight_id, platform, content, status, version, parent_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    post.insightId,
    post.platform,
    typeof post.content === 'string' ? post.content : JSON.stringify(post.content),
    post.status,
    post.version,
    post.parentId || null,
    post.metadata ? JSON.stringify(post.metadata) : null
  );

  return id;
}

export function getSNSPost(id: string): SNSPost | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM pending_posts WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;

  let content: string | string[];
  try {
    content = JSON.parse(row.content);
  } catch {
    content = row.content;
  }

  return {
    id: row.id,
    insightId: row.insight_id,
    platform: row.platform,
    content,
    status: row.status,
    version: row.version,
    parentId: row.parent_id,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    publishedUrl: row.published_url,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

export function getPendingPosts(): SNSPost[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM pending_posts WHERE status = ? ORDER BY created_at DESC');
  const rows = stmt.all('pending') as any[];

  return rows.map(row => {
    let content: string | string[];
    try {
      content = JSON.parse(row.content);
    } catch {
      content = row.content;
    }

    return {
      id: row.id,
      insightId: row.insight_id,
      platform: row.platform,
      content,
      status: row.status,
      version: row.version,
      parentId: row.parent_id,
      createdAt: row.created_at,
      publishedAt: row.published_at,
      publishedUrl: row.published_url,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  });
}

export function updateSNSPostStatus(
  id: string,
  status: 'approved' | 'published' | 'rejected',
  publishedUrl?: string
): void {
  const database = getDatabase();

  if (status === 'published') {
    const stmt = database.prepare(`
      UPDATE pending_posts
      SET status = ?, published_at = CURRENT_TIMESTAMP, published_url = ?
      WHERE id = ?
    `);
    stmt.run(status, publishedUrl || null, id);
  } else if (status === 'approved') {
    const stmt = database.prepare(`
      UPDATE pending_posts
      SET status = ?, approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(status, id);
  } else {
    const stmt = database.prepare('UPDATE pending_posts SET status = ? WHERE id = ?');
    stmt.run(status, id);
  }
}

// ==================== Action Item CRUD ====================

export function createActionItem(item: Omit<ActionItem, 'id' | 'createdAt'>): string {
  const database = getDatabase();
  const id = generateId('act');

  const stmt = database.prepare(`
    INSERT INTO action_items (id, log_id, content, priority, completed)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, item.logId, item.content, item.priority, item.completed ? 1 : 0);

  return id;
}

export function getActionItemsByLog(logId: string): ActionItem[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM action_items WHERE log_id = ? ORDER BY priority DESC, created_at ASC');
  const rows = stmt.all(logId) as any[];

  return rows.map(row => ({
    id: row.id,
    logId: row.log_id,
    content: row.content,
    priority: row.priority,
    completed: row.completed === 1,
    createdAt: row.created_at,
  }));
}

export function updateActionItemCompleted(id: string, completed: boolean): void {
  const database = getDatabase();
  const stmt = database.prepare(`
    UPDATE action_items
    SET completed = ?, completed_at = ?
    WHERE id = ?
  `);
  stmt.run(completed ? 1 : 0, completed ? new Date().toISOString() : null, id);
}

// ==================== Utility Functions ====================

/**
 * Generate a unique ID with prefix
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}
