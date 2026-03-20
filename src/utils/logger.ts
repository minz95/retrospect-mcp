/**
 * Structured logger for Retrospect MCP
 *
 * All output goes to stderr so it doesn't interfere with the MCP stdio transport.
 * Log level is controlled via the LOG_LEVEL environment variable (debug/info/warn/error).
 * Default level is 'info'.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getConfiguredLevel(): number {
  const env = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as LogLevel;
  return LEVEL_PRIORITY[env] ?? LEVEL_PRIORITY['info'];
}

export class Logger {
  constructor(private readonly name: string) {}

  private write(level: LogLevel, msg: string, extra?: unknown): void {
    if (LEVEL_PRIORITY[level] < getConfiguredLevel()) return;

    const tag = `[${level.toUpperCase()}] [${this.name}]`;

    if (extra instanceof Error) {
      console.error(`${tag} ${msg}: ${extra.message}`);
      if (extra.stack && process.env.LOG_LEVEL === 'debug') {
        console.error(extra.stack);
      }
    } else if (extra !== undefined && extra !== null) {
      console.error(`${tag} ${msg}`, extra);
    } else {
      console.error(`${tag} ${msg}`);
    }
  }

  debug(msg: string, extra?: unknown): void {
    this.write('debug', msg, extra);
  }

  info(msg: string, extra?: unknown): void {
    this.write('info', msg, extra);
  }

  warn(msg: string, extra?: unknown): void {
    this.write('warn', msg, extra);
  }

  error(msg: string, extra?: unknown): void {
    this.write('error', msg, extra);
  }
}

/**
 * Create a named logger instance
 */
export function createLogger(name: string): Logger {
  return new Logger(name);
}

/** Default server-level logger */
export const logger = createLogger('retrospect-mcp');
