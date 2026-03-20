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
import { logger } from './utils/logger.js';
import { createProjectTool, type CreateProjectParams } from './tools/create-project.js';
import { logDailyWorkTool, type LogDailyWorkParams } from './tools/log-daily-work.js';
import { analyzeCommitsTool, type AnalyzeCommitsParams } from './tools/analyze-commits.js';
import { extractInsightsTool, type ExtractInsightsParams } from './tools/extract-insights.js';
import { generateSNSTool, type GenerateSNSParams } from './tools/generate-sns.js';
import { approveAndPublishTool, type ApproveAndPublishParams } from './tools/approve-publish.js';
import { extractActionsTool, type ExtractActionsParams } from './tools/extract-actions.js';
import { listInsightsResources, readInsightsResource } from './resources/insights.js';
import { listPendingPostsResources, readPendingPostsResource } from './resources/pending-posts.js';
import { listDailyLogsResources, readDailyLogsResource } from './resources/daily-logs.js';
import { listProjectsResources, readProjectsResource } from './resources/projects.js';
import { getDailyStandupPrompt } from './prompts/daily-standup.js';
import { getProjectIdeationPrompt } from './prompts/project-ideation.js';
import type { Config } from './types/index.js';

/**
 * Initialize and start the MCP server
 */
async function main() {
  // Load configuration
  let config: Config;
  try {
    config = loadConfig();
    logger.info(`Configuration loaded (vault: ${config.obsidian.vaultPath})`);
  } catch (error) {
    logger.error('Failed to load configuration', error instanceof Error ? error : undefined);
    process.exit(1);
  }

  // Initialize database
  try {
    initializeDatabase(config.database.path);
  } catch (error) {
    logger.error('Failed to initialize database', error instanceof Error ? error : undefined);
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
        {
          name: 'generate_sns_post',
          description: 'Generate SNS content from insights for specified platforms',
          inputSchema: {
            type: 'object',
            properties: {
              insightId: {
                type: 'string',
                description: 'Insight ID to generate content from',
              },
              platform: {
                type: 'string',
                enum: ['thread', 'linkedin', 'medium'],
                description: 'Target SNS platform',
              },
              includeHashtags: {
                type: 'boolean',
                description: 'Include auto-generated hashtags (default true)',
                default: true,
              },
            },
            required: ['insightId', 'platform'],
          },
        },
        {
          name: 'approve_and_publish',
          description: 'Approve, revise, or reject pending SNS posts',
          inputSchema: {
            type: 'object',
            properties: {
              postId: {
                type: 'string',
                description: 'Pending post ID',
              },
              action: {
                type: 'string',
                enum: ['approve', 'revise', 'reject'],
                description: 'Action to take: approve (publish), revise (regenerate), or reject',
              },
              revisionPrompt: {
                type: 'string',
                description: 'Revision instructions (required for revise action)',
              },
            },
            required: ['postId', 'action'],
          },
        },
        {
          name: 'extract_action_items',
          description: 'Extract prioritized action items from daily logs using Claude AI',
          inputSchema: {
            type: 'object',
            properties: {
              logId: {
                type: 'string',
                description: 'Specific daily log ID to extract from',
              },
              projectId: {
                type: 'string',
                description: 'Filter by project ID (used with startDate/endDate)',
              },
              startDate: {
                type: 'string',
                description: 'Start date for range extraction (YYYY-MM-DD)',
              },
              endDate: {
                type: 'string',
                description: 'End date for range extraction (YYYY-MM-DD)',
              },
              forceRefresh: {
                type: 'boolean',
                description: 'Force re-extraction even if items already exist (default false)',
                default: false,
              },
            },
          },
        },
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

      if (name === 'generate_sns_post') {
        const params = (args || {}) as unknown as GenerateSNSParams;
        const result = await generateSNSTool(params, config);

        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
        };
      }

      if (name === 'approve_and_publish') {
        const params = (args || {}) as unknown as ApproveAndPublishParams;
        const result = await approveAndPublishTool(params, config);

        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
        };
      }

      if (name === 'extract_action_items') {
        const params = (args || {}) as unknown as ExtractActionsParams;
        const result = await extractActionsTool(params, config);

        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
        };
      }

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

    // Add pending posts resources
    resources.push(...listPendingPostsResources());

    // Add daily logs resources
    resources.push(...listDailyLogsResources());

    // Add projects resources
    resources.push(...listProjectsResources());

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

      // Handle pending posts resources
      if (uri.startsWith('pending-posts://')) {
        const content = readPendingPostsResource(uri);
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

      // Handle daily logs resources
      if (uri.startsWith('daily-logs://')) {
        const content = readDailyLogsResource(uri);
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

      // Handle projects resources
      if (uri.startsWith('projects://')) {
        const content = readProjectsResource(uri);
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
        {
          name: 'daily-standup',
          description: 'Generate daily standup summary from recent logs',
          arguments: [
            {
              name: 'date',
              description: 'End date for standup (YYYY-MM-DD, defaults to today)',
              required: false,
            },
            {
              name: 'projectId',
              description: 'Filter by specific project ID',
              required: false,
            },
            {
              name: 'daysBack',
              description: 'Number of days to look back (default: 1)',
              required: false,
            },
          ],
        },
        {
          name: 'project-ideation',
          description: 'Interactive brainstorming session for new projects',
          arguments: [
            {
              name: 'topic',
              description: 'Project topic or area (e.g., "web app", "CLI tool")',
              required: false,
            },
            {
              name: 'constraints',
              description: 'List of constraints or requirements',
              required: false,
            },
            {
              name: 'goals',
              description: 'List of project goals',
              required: false,
            },
          ],
        },
      ],
    };
  });

  // Register prompt get handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'daily-standup') {
        return await getDailyStandupPrompt(args as any);
      }

      if (name === 'project-ideation') {
        return await getProjectIdeationPrompt(args as any);
      }

      throw new Error(`Unknown prompt: ${name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get prompt: ${errorMessage}`);
    }
  });

  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Retrospect MCP Server v1.0.0 started on stdio');
}

// Handle errors
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
