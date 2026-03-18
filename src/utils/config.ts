/**
 * Configuration loader with environment variable substitution and Zod validation
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';
import dotenv from 'dotenv';
import type { Config } from '../types/index.js';

// Load environment variables
dotenv.config();

// Zod schema for configuration validation
const ConfigSchema = z.object({
  obsidian: z.object({
    vaultPath: z.string().min(1, 'Obsidian vault path is required'),
  }),
  notion: z.object({
    token: z.string().min(1, 'Notion token is required'),
    parentPageId: z.string().min(1, 'Notion parent page ID is required'),
  }),
  claude: z.object({
    apiKey: z.string().min(1, 'Claude API key is required'),
    model: z.string().default('claude-sonnet-4-5-20250929'),
  }),
  sns: z.object({
    thread: z.object({
      bearerToken: z.string().min(1, 'Twitter bearer token is required'),
      apiKey: z.string().optional(),
      apiSecret: z.string().optional(),
      accessToken: z.string().optional(),
      accessSecret: z.string().optional(),
    }),
    linkedin: z.object({
      accessToken: z.string().min(1, 'LinkedIn access token is required'),
      userId: z.string().min(1, 'LinkedIn user ID is required'),
    }),
    medium: z.object({
      token: z.string().min(1, 'Medium token is required'),
    }),
  }),
  git: z.object({
    defaultRepoPath: z.string().min(1, 'Default git repo path is required'),
  }),
  database: z.object({
    path: z.string().default('./data/retrospect.db'),
  }),
});

/**
 * Substitute environment variables in config values
 * Replaces ${ENV_VAR} with the value from process.env
 */
function substituteEnvVars(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
      const envValue = process.env[envVar];
      if (envValue === undefined) {
        throw new Error(`Environment variable ${envVar} is not defined`);
      }
      return envValue;
    });
  }

  if (Array.isArray(value)) {
    return value.map(substituteEnvVars);
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = substituteEnvVars(val);
    }
    return result;
  }

  return value;
}

/**
 * Load and validate configuration
 */
export function loadConfig(configPath?: string): Config {
  // Default config path
  const defaultConfigPath = resolve(process.cwd(), 'config/default.json');
  const finalConfigPath = configPath || defaultConfigPath;

  try {
    // Read config file
    const configFile = readFileSync(finalConfigPath, 'utf-8');
    const rawConfig = JSON.parse(configFile);

    // Substitute environment variables
    const configWithEnv = substituteEnvVars(rawConfig);

    // Validate with Zod
    const validatedConfig = ConfigSchema.parse(configWithEnv);

    return validatedConfig as Config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Invalid configuration');
    }

    if (error instanceof Error) {
      throw new Error(`Failed to load config: ${error.message}`);
    }

    throw error;
  }
}

/**
 * Get a specific config value by path
 */
export function getConfigValue<T>(config: Config, path: string): T {
  const keys = path.split('.');
  let value: unknown = config;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      throw new Error(`Config path ${path} not found`);
    }
  }

  return value as T;
}
