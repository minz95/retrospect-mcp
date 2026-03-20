/**
 * Unit tests for the insight extractor core module.
 * Claude API is mocked — no network calls.
 */

import { extractInsights } from '../core/insight-extractor';
import type { ClaudeClient } from '../utils/claude-client';

function makeClient(responseText: string): ClaudeClient {
  return {
    generateText: jest.fn().mockResolvedValue({
      text: responseText,
      usage: { inputTokens: 100, outputTokens: 50 },
    }),
  } as unknown as ClaudeClient;
}

const sampleLogs = [
  {
    date: '2026-03-20',
    projectId: 'prj_abc',
    summary: 'Fixed a race condition in the connection pool by using mutex locks',
    manualNotes: 'Learned that async/await hides race conditions in shared state',
  },
];

describe('extractInsights', () => {
  it('returns empty result when no logs provided', async () => {
    const client = makeClient('[]');
    const result = await extractInsights({ logs: [] }, client);
    expect(result.insights).toHaveLength(0);
    expect(result.totalAnalyzed).toBe(0);
  });

  it('parses valid JSON array from Claude response', async () => {
    const mockResponse = JSON.stringify([
      {
        content: 'Use mutex locks to prevent race conditions in async connection pools',
        category: 'debugging',
        confidence: 0.92,
        context: 'connection pool race condition fix',
      },
    ]);
    const client = makeClient(mockResponse);
    const result = await extractInsights({ logs: sampleLogs }, client);
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].category).toBe('debugging');
    expect(result.insights[0].confidence).toBe(0.92);
  });

  it('filters insights below confidence threshold (0.6)', async () => {
    const mockResponse = JSON.stringify([
      { content: 'Low confidence insight that is long enough', category: 'other', confidence: 0.4, context: '' },
      { content: 'High confidence insight that meets the minimum length', category: 'tooling', confidence: 0.85, context: '' },
    ]);
    const client = makeClient(mockResponse);
    const result = await extractInsights({ logs: sampleLogs }, client);
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].confidence).toBe(0.85);
  });

  it('filters insights that are too short (< 20 chars)', async () => {
    const mockResponse = JSON.stringify([
      { content: 'Too short', category: 'other', confidence: 0.9, context: '' },
      { content: 'This one is long enough to pass the minimum length check', category: 'tooling', confidence: 0.9, context: '' },
    ]);
    const client = makeClient(mockResponse);
    const result = await extractInsights({ logs: sampleLogs }, client);
    expect(result.insights).toHaveLength(1);
  });

  it('filters generic phrases', async () => {
    const mockResponse = JSON.stringify([
      { content: 'You should always write tests before shipping code to production', category: 'tooling', confidence: 0.9, context: '' },
      { content: 'Instrument DB queries with EXPLAIN ANALYZE to find slow indexes', category: 'performance', confidence: 0.9, context: '' },
    ]);
    const client = makeClient(mockResponse);
    const result = await extractInsights({ logs: sampleLogs }, client);
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0].category).toBe('performance');
  });

  it('caps result at 5 insights', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      content: `Specific actionable insight number ${i + 1} with enough characters`,
      category: 'other',
      confidence: 0.9,
      context: '',
    }));
    const client = makeClient(JSON.stringify(many));
    const result = await extractInsights({ logs: sampleLogs }, client);
    expect(result.insights.length).toBeLessThanOrEqual(5);
  });

  it('handles malformed JSON gracefully by throwing', async () => {
    const client = makeClient('not json at all');
    await expect(extractInsights({ logs: sampleLogs }, client)).rejects.toThrow();
  });

  it('normalises unknown category to "other"', async () => {
    const mockResponse = JSON.stringify([
      { content: 'Long enough insight text that should be categorised as other', category: 'unknown_category', confidence: 0.9, context: '' },
    ]);
    const client = makeClient(mockResponse);
    const result = await extractInsights({ logs: sampleLogs }, client);
    expect(result.insights[0].category).toBe('other');
  });
});
