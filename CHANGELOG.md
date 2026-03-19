# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-19

### Added

#### Phase 1: MCP Server Foundation (Issues #1-4)
- Project initialization with TypeScript and MCP SDK
- Configuration system with Zod validation and environment variable substitution
- SQLite database with 5 tables (projects, daily_logs, insights, pending_posts, action_items)
- `create_project` tool for initializing new projects

#### Phase 2: Git Analysis & Obsidian Integration (Issues #5-8)
- Git commit analyzer with 30-minute cache
- Obsidian file manager with Mustache templates
- `log_daily_work` tool for daily logging with git commits + manual input
- `analyze_git_commits` tool for standalone git analysis
- Automatic action item extraction (TODO, [ ], Action: patterns)

#### Phase 3: Claude Integration (Issues #9-12)
- Claude API client with retry logic and exponential backoff
- Insight extractor with validation (confidence, specificity checks)
- `extract_insights` tool for analyzing logs and extracting actionable insights
- `insights://` resource for querying extracted insights

#### Phase 4: SNS Content Generation (Issues #13-16)
- Platform-specific content formatters (Thread, LinkedIn, Medium)
- Content generator with parsing and validation
- `generate_sns_post` tool for creating platform-optimized content
- `pending-posts://` resource for reviewing pending posts

#### Phase 5: SNS Publishing & Approval (Issues #17-20)
- Thread (Twitter/X) API integration with tweet chaining and rollback
- LinkedIn UGC API integration
- Medium REST API integration (draft mode by default)
- `approve_and_publish` tool with approve/revise/reject actions

#### Phase 6: Notion Integration (Issues #21-24)
- Notion client wrapper around @notionhq/client
- Page builder for converting logs to Notion format (markdown → blocks)
- Dual-write support in `log_daily_work` (Obsidian + Notion)
- Dual-write support in `create_project` (creates Notion databases)

#### Phase 7: Polish & Documentation (Issues #25-30)
- `daily-standup` prompt for generating standup summaries
- `project-ideation` prompt for interactive brainstorming
- `daily-logs://` resource (query by date, ID, or range)
- `projects://` resource (list all, get by ID)
- Comprehensive README with installation and usage guide
- API-KEYS-SETUP.md with detailed instructions for all integrations

### Security
- SQL injection prevention with prepared statements
- Path traversal prevention with `sanitizeName()` function
- Command injection prevention with repository validation
- API token management via environment variables

### Features
- 7 MCP Tools
- 4 MCP Resources
- 2 MCP Prompts
- Rate limiting for Claude API
- Exponential backoff retry logic
- Git commit caching (30-minute TTL)
- Insight caching in SQLite
- Thread rollback on failure
- Platform-specific content validation

---

[1.0.0]: https://github.com/minz95/retrospect-mcp/releases/tag/v1.0.0
