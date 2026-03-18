#!/usr/bin/env node

/**
 * Retrospect MCP Server
 *
 * Entry point for the MCP server that manages daily dev logs,
 * extracts insights, and publishes to SNS platforms.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from './utils/config.js';
import { initializeDatabase } from './storage/db.js';
import { createProjectTool, type CreateProjectParams } from './tools/create-project.js';
import { logDailyWorkTool, type LogDailyWorkParams } from './tools/log-daily-work.js';
import { analyzeCommitsTool, type AnalyzeCommitsParams } from './tools/analyze-commits.js';
import { extractInsightsTool, type ExtractInsightsParams } from './tools/extract-insights.js';
import { listInsightsResources, readInsightsResource } from './resources/insights.js';
import type { Config } from './types/index.js';

/**
 * Initialize and start the MCP server
 */
async function main() {
  // Load configuration
  let config: Config;
  try {
    config = loadConfig();
    console.error('✓ Configuration loaded successfully');
    console.error(`  - Obsidian vault: ${config.obsidian.vaultPath}`);
    console.error(`  - Database: ${config.database.path}`);
  } catch (error) {
    console.error('✗ Failed to load configuration:', error);
    process.exit(1);
  }

  // Initialize database
  try {
    initializeDatabase(config.database.path);
  } catch (error) {
    console.error('✗ Failed to initialize database:', error);
    process.exit(1);
  }

  // Create MCP server
  const server = new Server(
    {
      name: 'retrospect-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'create_project',
          description: 'Create a new project with Obsidian directory and database entry',
          inputSchema: {
            type: 'object',
            properties: {
              projectName: {
                type: 'string',
                description: 'Name of the project',
              },
              description: {
                type: 'string',
                description: 'Project description (optional)',
              },
              conversationMode: {
                type: 'boolean',
                description: 'Enable conversational ideation (optional, will be implemented in Issue #25)',
                default: false,
              },
            },
            required: ['projectName'],
          },
        },
        {
          name: 'log_daily_work',
          description: 'Log daily development work by analyzing git commits and manual input',
          inputSchema: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                description: 'ISO date (YYYY-MM-DD), defaults to today',
              },
              projectId: {
                type: 'string',
                description: 'Project ID from database',
              },
              gitRepoPath: {
                type: 'string',
                description: 'Path to git repository (optional, uses default from config)',
              },
              manualInput: {
                type: 'string',
                description: 'Additional notes and manual input',
              },
              includeCommits: {
                type: 'boolean',
                description: 'Include git commits analysis (default true)',
                default: true,
              },
            },
            required: ['projectId'],
          },
        },
        {
          name: 'analyze_git_commits',
          description: 'Analyze git commits for a specific date range',
          inputSchema: {
            type: 'object',
            properties: {
              repoPath: {
                type: 'string',
                description: 'Path to git repository',
              },
              startDate: {
                type: 'string',
                description: 'Start date (YYYY-MM-DD)',
              },
              endDate: {
                type: 'string',
                description: 'End date (YYYY-MM-DD)',
              },
              includeChanges: {
                type: 'boolean',
                description: 'Include diff analysis (default false)',
                default: false,
              },
            },
            required: ['repoPath', 'startDate', 'endDate'],
          },
        },
        {
          name: 'extract_insights',
          description: 'Extract actionable insights from daily logs using Claude AI',
          inputSchema: {
            type: 'object',
            properties: {
              startDate: {
                type: 'string',
                description: 'Start date (YYYY-MM-DD)',
              },
              endDate: {
                type: 'string',
                description: 'End date (YYYY-MM-DD)',
              },
              projectId: {
                type: 'string',
                description: 'Optional: filter by project ID',
              },
              forceRefresh: {
                type: 'boolean',
                description: 'Force re-extraction even if cached (default false)',
                default: false,
              },
            },
            required: ['startDate', 'endDate'],
          },
        },
        // TODO: Add more tools in subsequent issues
        // - generate_sns_post (Issue #15)
        // - approve_and_publish (Issue #20)
        // - extract_action_items (Issue #26)
      ],
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'create_project') {
        const params = (args || {}) as unknown as CreateProjectParams;
        const result = await createProjectTool(params, config);

        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
        };
      }

      if (name === 'log_daily_work') {
        const params = (args || {}) as unknown as LogDailyWorkParams;
        const result = await logDailyWorkTool(params, config);

        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
        };
      }

      if (name === 'analyze_git_commits') {
        const params = (args || {}) as unknown as AnalyzeCommitsParams;
        const result = await analyzeCommitsTool(params);

        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
        };
      }

      if (name === 'extract_insights') {
        const params = (args || {}) as unknown as ExtractInsightsParams;
        const result = await extractInsightsTool(params, config);

        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
        };
      }

      // TODO: Implement more tool handlers in subsequent issues
      throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Register resource list handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = [];

    // Add insights resources
    resources.push(...listInsightsResources());

    // TODO: Add more resources in subsequent issues
    // - daily-logs:// (Issue #27)
    // - projects:// (Issue #27)
    // - pending-posts:// (Issue #16)

    return { resources };
  });

  // Register resource read handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      // Handle insights resources
      if (uri.startsWith('insights://')) {
        const content = readInsightsResource(uri);
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: content,
            },
          ],
        };
      }

      // TODO: Implement more resource handlers in subsequent issues
      throw new Error(`Unknown resource: ${uri}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read resource: ${errorMessage}`);
    }
  });

  // Register prompt list handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        // TODO: Add prompts in subsequent issues
        // - daily-standup (Issue #25)
        // - project-ideation (Issue #25)
        // - insight-extraction (Issue #10)
        // - sns-formatters (Issue #13)
      ],
    };
  });

  // Register prompt get handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;

    // TODO: Implement prompt handlers in subsequent issues
    throw new Error(`Unknown prompt: ${name}`);
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Retrospect MCP Server started');
  console.error('Version: 1.0.0');
  console.error('Listening on stdio...');
}

// Handle errors
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
