/**
 * Unit tests for action extraction prompt helpers and parser logic.
 * Tests the formatting and parsing functions without Claude API calls.
 */

import { formatLogsForActionExtraction } from '../prompts/action-extraction';

describe('formatLogsForActionExtraction', () => {
  it('formats a single log with date and summary', () => {
    const result = formatLogsForActionExtraction([
      { date: '2026-03-20', summary: 'Fixed auth bug' },
    ]);
    expect(result).toContain('[2026-03-20]');
    expect(result).toContain('Fixed auth bug');
  });

  it('includes manual notes when present', () => {
    const result = formatLogsForActionExtraction([
      { date: '2026-03-20', summary: 'Refactored DB layer', manualNotes: 'TODO: add indexes' },
    ]);
    expect(result).toContain('Notes: TODO: add indexes');
  });

  it('separates multiple logs with a divider', () => {
    const result = formatLogsForActionExtraction([
      { date: '2026-03-19', summary: 'First log' },
      { date: '2026-03-20', summary: 'Second log' },
    ]);
    expect(result).toContain('---');
    expect(result).toContain('[2026-03-19]');
    expect(result).toContain('[2026-03-20]');
  });

  it('returns empty string for empty input', () => {
    const result = formatLogsForActionExtraction([]);
    expect(result).toBe('');
  });
});
