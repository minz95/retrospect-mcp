import { initializeDatabase, createProject, getProject, updateProject, getAllProjects,
  createDailyLog, getDailyLog, getDailyLogsByDateRange,
  createInsight, getInsight, getInsightsByDate,
  createSNSPost, getSNSPost, getPendingPosts, updateSNSPostStatus,
  createActionItem, getActionItemsByLog, updateActionItemCompleted,
} from '../storage/db';

// Use a shared in-memory DB for the test suite
const TEST_DB_PATH = ':memory:';

beforeAll(() => {
  initializeDatabase(TEST_DB_PATH);
});

// ─── Projects ────────────────────────────────────────────────────────────────
describe('Project CRUD', () => {
  let projectId: string;

  it('creates a project and returns an id', () => {
    projectId = createProject({
      name: 'Test Project',
      description: 'A test project',
      createdDate: '2026-03-20',
      obsidianPath: '/vault/test',
    });
    expect(projectId).toMatch(/^prj_/);
  });

  it('retrieves the created project', () => {
    const project = getProject(projectId);
    expect(project).not.toBeNull();
    expect(project!.name).toBe('Test Project');
    expect(project!.description).toBe('A test project');
  });

  it('updates a project field', () => {
    updateProject(projectId, { notionPageId: 'notion-db-abc' });
    const project = getProject(projectId);
    expect(project!.notionPageId).toBe('notion-db-abc');
  });

  it('returns null for non-existent project', () => {
    expect(getProject('prj_doesnotexist')).toBeNull();
  });

  it('lists all projects', () => {
    const projects = getAllProjects();
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.some((p) => p.id === projectId)).toBe(true);
  });
});

// ─── Daily Logs ──────────────────────────────────────────────────────────────
describe('Daily Log CRUD', () => {
  let logId: string;
  let projectId: string;

  beforeAll(() => {
    projectId = createProject({
      name: 'Log Test Project',
      createdDate: '2026-03-20',
      obsidianPath: '/vault/log-test',
    });
  });

  it('creates a daily log', () => {
    logId = createDailyLog({
      date: '2026-03-20',
      projectId,
      summary: 'Fixed bug in auth middleware',
      obsidianPath: '/vault/log-test/2026-03-20.md',
      actionItems: ['Write tests', 'Update docs'],
    });
    expect(logId).toMatch(/^log_/);
  });

  it('retrieves the daily log', () => {
    const log = getDailyLog(logId);
    expect(log).not.toBeNull();
    expect(log!.summary).toBe('Fixed bug in auth middleware');
    expect(log!.date).toBe('2026-03-20');
  });

  it('queries logs by date range', () => {
    const logs = getDailyLogsByDateRange('2026-03-19', '2026-03-21');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.id === logId)).toBe(true);
  });

  it('returns empty array for out-of-range date', () => {
    const logs = getDailyLogsByDateRange('2020-01-01', '2020-01-02');
    expect(logs).toHaveLength(0);
  });
});

// ─── Insights ─────────────────────────────────────────────────────────────────
describe('Insight CRUD', () => {
  let insightId: string;

  it('creates an insight', () => {
    insightId = createInsight({
      date: '2026-03-20',
      content: 'Using prepared statements prevents SQL injection',
      category: 'tooling',
      confidence: 0.9,
      sourceLogIds: ['log_abc'],
    });
    expect(insightId).toMatch(/^ins_/);
  });

  it('retrieves the insight', () => {
    const insight = getInsight(insightId);
    expect(insight).not.toBeNull();
    expect(insight!.content).toBe('Using prepared statements prevents SQL injection');
    expect(insight!.confidence).toBe(0.9);
  });

  it('queries insights by date', () => {
    const insights = getInsightsByDate('2026-03-20');
    expect(insights.some((i) => i.id === insightId)).toBe(true);
  });
});

// ─── SNS Posts ────────────────────────────────────────────────────────────────
describe('SNS Post CRUD', () => {
  let insightId: string;
  let postId: string;

  beforeAll(() => {
    insightId = createInsight({
      date: '2026-03-20',
      content: 'SNS test insight',
      category: 'other',
      confidence: 0.8,
      sourceLogIds: [],
    });
  });

  it('creates a pending post', () => {
    postId = createSNSPost({
      insightId,
      platform: 'linkedin',
      content: 'My LinkedIn post content',
      status: 'pending',
      version: 1,
    });
    expect(postId).toMatch(/^post_/);
  });

  it('retrieves the post', () => {
    const post = getSNSPost(postId);
    expect(post).not.toBeNull();
    expect(post!.platform).toBe('linkedin');
    expect(post!.status).toBe('pending');
  });

  it('lists pending posts', () => {
    const pending = getPendingPosts();
    expect(pending.some((p) => p.id === postId)).toBe(true);
  });

  it('updates post status to published', () => {
    updateSNSPostStatus(postId, 'published', 'https://linkedin.com/post/123');
    const post = getSNSPost(postId);
    expect(post!.status).toBe('published');
    expect(post!.publishedUrl).toBe('https://linkedin.com/post/123');
  });
});

// ─── Action Items ─────────────────────────────────────────────────────────────
describe('Action Item CRUD', () => {
  let logId: string;
  let projectId: string;

  beforeAll(() => {
    projectId = createProject({
      name: 'Action Test Project',
      createdDate: '2026-03-20',
      obsidianPath: '/vault/action-test',
    });
    logId = createDailyLog({
      date: '2026-03-20',
      projectId,
      summary: 'Test log for action items',
      obsidianPath: '/vault/action-test/2026-03-20.md',
      actionItems: [],
    });
  });

  it('creates action items', () => {
    const id = createActionItem({ logId, content: 'Fix auth bug', priority: 'high', completed: false });
    expect(id).toMatch(/^act_/);
    createActionItem({ logId, content: 'Add unit tests', priority: 'medium', completed: false });
  });

  it('lists action items by log', () => {
    const items = getActionItemsByLog(logId);
    expect(items).toHaveLength(2);
    const priorities = items.map((i) => i.priority);
    expect(priorities).toContain('high');
    expect(priorities).toContain('medium');
  });

  it('marks an item as completed', () => {
    const items = getActionItemsByLog(logId);
    updateActionItemCompleted(items[0].id, true);
    const updated = getActionItemsByLog(logId);
    const completedItem = updated.find((i) => i.id === items[0].id);
    expect(completedItem!.completed).toBe(true);
  });
});
