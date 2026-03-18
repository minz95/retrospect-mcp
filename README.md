# Retrospect MCP

> MCP server for daily dev logs, insights extraction, and SNS publishing

## Overview

Retrospect MCP is a Model Context Protocol (MCP) server that helps staff engineers manage their daily development work, extract insights, and share them on social media platforms.

### Features

- **Daily Work Logs**: Automatically collect and organize daily development activities from Git commits and conversational input
- **Dual Write**: Store logs in both Obsidian (local markdown) and Notion (cloud collaboration)
- **AI-Powered Insights**: Extract actionable tips and insights from work logs using Claude AI
- **SNS Publishing**: Generate platform-specific content for Thread (Twitter/X), LinkedIn, and Medium
- **Approval Workflow**: Review and approve AI-generated content before publishing
- **Project Management**: Organize logs by project with automatic action item extraction

## Architecture

```
MCP Server (retrospect-mcp)
├── Tools (7)
│   ├── log_daily_work
│   ├── analyze_git_commits
│   ├── extract_insights
│   ├── generate_sns_post
│   ├── approve_and_publish
│   ├── create_project
│   └── extract_action_items
├── Resources (4)
│   ├── daily-logs://
│   ├── projects://
│   ├── insights://
│   └── pending-posts://
└── Prompts (4)
    ├── daily-standup
    ├── project-ideation
    ├── insight-extraction
    └── sns-formatters
```

## Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your API keys and configuration
```

## Configuration

Required environment variables:

- `CLAUDE_API_KEY`: Anthropic Claude API key
- `NOTION_TOKEN`: Notion integration token
- `TWITTER_BEARER_TOKEN`: Twitter/X API credentials
- `LINKEDIN_ACCESS_TOKEN`: LinkedIn API credentials
- `MEDIUM_TOKEN`: Medium integration token
- `OBSIDIAN_VAULT_PATH`: Path to your Obsidian vault

## Development

```bash
# Run in development mode
npm run dev

# Build
npm run build

# Run tests
npm test
```

## Usage

This MCP server is designed to be used with Claude Desktop or other MCP clients.

### Example Workflow

1. **Create a project**
   ```
   Use create_project tool to initialize a new project
   ```

2. **Log daily work**
   ```
   Use log_daily_work tool to collect commits and notes
   ```

3. **Extract insights**
   ```
   Use extract_insights tool to analyze logs
   ```

4. **Generate SNS posts**
   ```
   Use generate_sns_post tool to create platform-specific content
   ```

5. **Review and publish**
   ```
   Use approve_and_publish tool to review and publish
   ```

## Project Status

🚧 **Work in Progress**

This project is under active development. See [Issues](https://github.com/minz95/retrospect-mcp/issues) for current tasks.

### Implementation Phases

- [ ] Phase 1: MCP Server Foundation (Issues #1-4)
- [ ] Phase 2: Git Analysis & Obsidian Integration (Issues #5-8)
- [ ] Phase 3: Claude Integration & Insight Extraction (Issues #9-12)
- [ ] Phase 4: SNS Content Generation (Issues #13-16)
- [ ] Phase 5: SNS Publishing & Approval Workflow (Issues #17-20)
- [ ] Phase 6: Notion Integration (Issues #21-24)
- [ ] Phase 7: Polish & Production Ready (Issues #25-30)

## License

MIT

## Author

minz95
