/**
 * Claude API Client
 *
 * Wrapper around Anthropic SDK with retry logic and rate limiting
 */

import Anthropic from '@anthropic-ai/sdk';

export interface ClaudeClientOptions {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface GenerateTextOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateTextResult {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class ClaudeClient {
  private client: Anthropic;
  private model: string;
  private maxRetries: number;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

  constructor(options: ClaudeClientOptions) {
    this.client = new Anthropic({
      apiKey: options.apiKey,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 60000, // 60 seconds
    });
    this.model = options.model || 'claude-sonnet-4-5-20250929';
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Generate text completion
   */
  async generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
    const { prompt, systemPrompt, maxTokens = 4096, temperature = 1.0 } = options;

    // Rate limiting: ensure minimum interval between requests
    await this.rateLimit();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.error(`  - Claude API request (attempt ${attempt + 1}/${this.maxRetries})...`);

        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        // Extract text from response
        const text = response.content
          .filter(block => block.type === 'text')
          .map(block => (block as any).text)
          .join('\n');

        console.error(`  - Claude API response received (${response.usage.output_tokens} tokens)`);

        this.requestCount++;
        this.lastRequestTime = Date.now();

        return {
          text,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (this.isRetryableError(error)) {
          console.error(`  - Retryable error, waiting before retry:`, lastError.message);
          await this.exponentialBackoff(attempt);
          continue;
        }

        // Non-retryable error, throw immediately
        throw lastError;
      }
    }

    // All retries failed
    throw new Error(`Claude API failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Rate limiting: ensure minimum interval between requests
   */
  private async rateLimit(): Promise<void> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;

    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.error(`  - Rate limiting: waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Exponential backoff for retries
   */
  private async exponentialBackoff(attempt: number): Promise<void> {
    const baseDelay = 1000; // 1 second
    const maxDelay = 32000; // 32 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

    console.error(`  - Waiting ${delay}ms before retry...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Anthropic.APIError) {
      // Retry on rate limit, server errors, timeout
      if (error.status === 429) return true; // Rate limit
      if (error.status === 500) return true; // Server error
      if (error.status === 503) return true; // Service unavailable
      if (error.status === 504) return true; // Gateway timeout
    }

    // Check for network errors
    if (error instanceof Error) {
      if (error.message.includes('ECONNRESET')) return true;
      if (error.message.includes('ETIMEDOUT')) return true;
      if (error.message.includes('ENOTFOUND')) return true;
    }

    return false;
  }

  /**
   * Get request count
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset request count
   */
  resetRequestCount(): void {
    this.requestCount = 0;
  }
}
