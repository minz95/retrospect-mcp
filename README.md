# Retrospect MCP

> MCP server for daily dev logs, insights extraction, and SNS publishing

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-18+-green.svg)](https://nodejs.org/)

## Overview

Retrospect MCP is a Model Context Protocol (MCP) server that helps staff engineers:

-  **Track daily development work** from Git commits and manual notes
- **Extract actionable insights** using Claude AI
- **Generate platform-optimized SNS content** for Thread, LinkedIn, and Medium
- **Manage approval workflow** before publishing to social media
- **Organize by projects** with automatic action item extraction
- **Dual write** to Obsidian (local) and Notion (cloud)

## Features

### 📝 Daily Work Logging
- Automatic Git commit analysis
- Manual notes and context
- Dual write to Obsidian and Notion
- Action item extraction
- Project-based organization

### 🧠 AI-Powered Insights
- Extract "small but helpful tips" from daily logs
- Claude-powered analysis with validation
- Confidence scoring and quality checks
- Caching to prevent duplicate extraction

### 📱 SNS Content Generation
- **Thread (Twitter/X)**: 280-char tweets with threading
- **LinkedIn**: Professional 1300-1500 char posts
- **Medium**: 800-1500 word technical articles
- Platform-specific tone and formatting
- Auto-generated hashtags

### ✅ Approval Workflow
- Review generated content before publishing
- Revise with additional instructions
- Reject or approve for publication
- Version control for revisions

## Architecture

```
MCP Server (retrospect-mcp)
├── Tools (7)
│   ├── create_project          - Initialize new project
│   ├── log_daily_work          - Log daily development work
│   ├── analyze_git_commits     - Analyze Git history
│   ├── extract_insights        - Extract insights from logs
│   ├── generate_sns_post       - Generate SNS content
│   └── approve_and_publish     - Review and publish posts
│
├── Resources (4)
│   ├── daily-logs://          - Query daily logs
│   ├── projects://            - List/get projects
│   ├── insights://            - Access insights
│   └── pending-posts://       - View pending posts
│
└── Prompts (2)
    ├── daily-standup          - Generate standup summaries
    └── project-ideation       - Interactive brainstorming
```

## Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **Claude Desktop** (for using the MCP server)
- **Obsidian** (optional, for local markdown storage)
- **Git** (for commit analysis)

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/minz95/retrospect-mcp.git
cd retrospect-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

**Required Variables:**

```bash
# Claude API (Required for insight extraction)
CLAUDE_API_KEY=sk-ant-api03-...

# Obsidian (Required for local storage)
OBSIDIAN_VAULT_PATH=/Users/your-username/ObsidianVault

# Git (Optional, for commit analysis)
GIT_DEFAULT_REPO_PATH=/Users/your-username/projects/my-project
```

**Optional SNS Integration:**

```bash
# Notion (Optional, for cloud backup)
NOTION_TOKEN=secret_...
NOTION_PARENT_PAGE_ID=...

# Twitter/X (Optional, for thread posting)
TWITTER_BEARER_TOKEN=...

# LinkedIn (Optional, for professional posts)
LINKEDIN_ACCESS_TOKEN=...
LINKEDIN_USER_ID=urn:li:person:...

# Medium (Optional, for article publishing)
MEDIUM_TOKEN=...
```

See [docs/API-KEYS-SETUP.md](docs/API-KEYS-SETUP.md) for detailed API key setup instructions.

### Step 3: Configure Claude Desktop

Add the server to your Claude Desktop configuration:

**macOS/Linux:** `~/.config/claude/claude_desktop_config.json`

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "retrospect-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/retrospect-mcp/dist/index.js"],
      "env": {
        "CLAUDE_API_KEY": "your-key-here",
        "OBSIDIAN_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

**Important**: Use absolute paths, not relative paths.

### Step 4: Restart Claude Desktop

After configuration, restart Claude Desktop to load the MCP server.

## Usage

### Quick Start

1. **Create a new project**

```
Use the create_project tool:
- projectName: "my-awesome-app"
- description: "A new web application project"
```

This creates:
- Obsidian directory: `Projects/my-awesome-app/`
- Notion database (if configured)
- SQLite entry

2. **Log your daily work**

```
Use the log_daily_work tool:
- projectId: "prj_..." (from step 1)
- gitRepoPath: "/path/to/repo" (optional)
- manualInput: "Worked on authentication system. Fixed login bug."
```

This creates:
- Obsidian file: `Projects/my-awesome-app/Daily Logs/2026-03-19.md`
- Notion page (if configured)
- Extracts action items automatically

3. **Extract insights**

```
Use the extract_insights tool:
- startDate: "2026-03-12"
- endDate: "2026-03-19"
```

Claude analyzes your logs and extracts actionable insights.

4. **Generate SNS content**

```
Use the generate_sns_post tool:
- insightId: "ins_..." (from step 3)
- platform: "thread" | "linkedin" | "medium"
```

Generates platform-optimized content and saves to pending posts.

5. **Review and publish**

```
Use the approve_and_publish tool:
- postId: "post_..." (from step 4)
- action: "approve" | "revise" | "reject"
- revisionPrompt: "Make it more technical" (if revising)
```

Actions:
- **approve**: Publishes to SNS immediately
- **revise**: Regenerates with new instructions
- **reject**: Marks as rejected

### Resources

Query data using MCP resources:

```
# View all projects
projects://list

# Get specific project
projects://prj_...

# Query logs by date
daily-logs://2026-03-19

# Query logs by date range
daily-logs://list?start=2026-03-12&end=2026-03-19

# View insights for date
insights://2026-03-19

# View pending posts
pending-posts://list
```

### Prompts

Use MCP prompts for common tasks:

```
# Generate daily standup summary
daily-standup
  - date: "2026-03-19"
  - daysBack: 1

# Start project ideation session
project-ideation
  - topic: "CLI tool for developers"
  - goals: ["easy to use", "cross-platform"]
```

## Development

### Run in Development Mode

```bash
npm run dev
```

This starts the server with auto-reload on file changes.

### Build for Production

```bash
npm run build
```

Compiles TypeScript to `dist/` directory.

### Project Structure

```
retrospect-mcp/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── core/                    # Core business logic
│   │   ├── git-analyzer.ts
│   │   ├── insight-extractor.ts
│   │   └── content-generator.ts
│   ├── integrations/            # External integrations
│   │   ├── obsidian/
│   │   ├── notion/
│   │   └── sns/
│   ├── storage/                 # SQLite database
│   │   └── db.ts
│   ├── tools/                   # MCP tools (7)
│   ├── resources/               # MCP resources (4)
│   ├── prompts/                 # MCP prompts (2)
│   ├── types/                   # TypeScript types
│   └── utils/                   # Utilities
├── templates/                   # Mustache templates
│   ├── obsidian/
│   └── notion/
├── data/                        # SQLite database file
├── docs/                        # Documentation
└── tests/                       # Test files
```

## Configuration

### Database

Default database location: `data/retrospect.db`

Change via environment variable:

```bash
DATABASE_PATH=path/to/custom.db
```

### Claude Model

Default: `claude-sonnet-4-5-20250929`

Change in `config/default.json`:

```json
{
  "claude": {
    "model": "claude-opus-4-5-20251101"
  }
}
```

Available models:
- `claude-sonnet-4-5-20250929` (recommended)
- `claude-opus-4-5-20251101` (most capable)
- `claude-haiku-3-5-20241022` (fastest, cheapest)

## Troubleshooting

### Server not appearing in Claude Desktop

1. Check configuration file path is correct
2. Verify absolute paths in config
3. Check Claude Desktop logs: `~/Library/Logs/Claude/` (macOS)
4. Restart Claude Desktop after config changes

### API Errors

- **401 Unauthorized**: Check API keys in `.env`
- **429 Rate Limit**: Wait and retry, check usage limits
- **500 Server Error**: Check error logs, retry with backoff

### Notion Integration

- **401**: Integration not shared with page
- **404**: Invalid parent page ID
- **Validation Error**: Check page permissions

See [docs/API-KEYS-SETUP.md](docs/API-KEYS-SETUP.md) for detailed troubleshooting.

## Limitations

- **Twitter/X**: Free tier limited to 50 tweets/24h
- **LinkedIn**: Tokens expire in 60 days, manual refresh needed
- **Medium**: Posts created as drafts by default
- **Claude API**: Rate limits apply based on tier

## Security

- Never commit `.env` file (already in `.gitignore`)
- Rotate API tokens regularly
- Use environment-specific configs for dev/prod
- Restrict API permissions to minimum required

## Contributing

This is a personal project, but suggestions and bug reports are welcome via [Issues](https://github.com/minz95/retrospect-mcp/issues).

## License

MIT © minz95

## Acknowledgments

- Built on [Model Context Protocol](https://modelcontextprotocol.io/)
- Powered by [Claude API](https://www.anthropic.com/api)
- Inspired by daily standup retrospectives

---

**Status**: ✅ All 7 phases complete (Issues #1-30)

For detailed implementation plan, see: [ARCHITECTURE.md](docs/ARCHITECTURE.md)
