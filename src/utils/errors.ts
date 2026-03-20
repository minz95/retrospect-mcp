/**
 * Custom error types for Retrospect MCP
 *
 * These provide user-friendly messages that surface through the MCP tool response.
 */

/**
 * Thrown when required configuration is missing or invalid
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Thrown when an optional integration (Notion, SNS) is used but not configured.
 * The message includes actionable guidance.
 */
export class NotConfiguredError extends Error {
  constructor(service: string) {
    super(
      `${service} is not configured. Run 'npm run setup' to add credentials, ` +
        `or set the required environment variables in .env.`
    );
    this.name = 'NotConfiguredError';
  }
}

/**
 * Thrown when user-supplied input fails validation
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Thrown when a referenced entity (project, log, insight) is not found
 */
export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when an external API (Claude, Notion, SNS) returns an error
 */
export class ExternalApiError extends Error {
  constructor(
    service: string,
    message: string,
    public readonly statusCode?: number
  ) {
    super(`${service} API error: ${message}`);
    this.name = 'ExternalApiError';
  }
}
