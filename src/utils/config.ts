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
  notion: z
    .object({
      token: z.string(),
      parentPageId: z.string(),
    })
    .optional(),
  claude: z.object({
    apiKey: z.string().min(1, 'Claude API key is required'),
    model: z.string().default('claude-sonnet-4-6'),
  }),
  sns: z
    .object({
      thread: z
        .object({
          bearerToken: z.string(),
          apiKey: z.string().optional(),
          apiSecret: z.string().optional(),
          accessToken: z.string().optional(),
          accessSecret: z.string().optional(),
        })
        .optional(),
      linkedin: z
        .object({
          accessToken: z.string(),
          userId: z.string(),
        })
        .optional(),
      medium: z
        .object({
          token: z.string(),
        })
        .optional(),
    })
    .optional(),
  git: z.object({
    defaultRepoPath: z.string().default(''),
  }),
  database: z.object({
    path: z.string().default('./data/retrospect.db'),
  }),
});

/**
 * Substitute environment variables in config values.
 * Returns empty string for undefined optional env vars instead of throwing.
 */
function substituteEnvVars(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
      return process.env[envVar] ?? '';
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
 * Strip genuinely optional config sections (notion, sns) when they have no values.
 * Required sections (obsidian, claude, git, database) are always preserved.
 */
const OPTIONAL_SECTIONS = new Set(['notion', 'sns']);

function stripEmpty(raw: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(raw)) {
    if (val === null || val === undefined) continue;

    if (OPTIONAL_SECTIONS.has(key) && typeof val === 'object' && !Array.isArray(val)) {
      // Recursively check if all leaf values are empty
      if (isDeepEmpty(val as Record<string, unknown>)) continue;
    }

    result[key] = val;
  }

  return result;
}

function isDeepEmpty(obj: Record<string, unknown>): boolean {
  return Object.values(obj).every((v) => {
    if (v === null || v === undefined || v === '') return true;
    if (typeof v === 'object' && !Array.isArray(v)) {
      return isDeepEmpty(v as Record<string, unknown>);
    }
    return false;
  });
}

/**
 * Load and validate configuration
 */
export function loadConfig(configPath?: string): Config {
  const defaultConfigPath = resolve(process.cwd(), 'config/default.json');
  const finalConfigPath = configPath || defaultConfigPath;

  try {
    const configFile = readFileSync(finalConfigPath, 'utf-8');
    const rawConfig = JSON.parse(configFile);

    const configWithEnv = substituteEnvVars(rawConfig) as Record<string, unknown>;
    const cleaned = stripEmpty(configWithEnv);

    const validatedConfig = ConfigSchema.parse(cleaned);
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
