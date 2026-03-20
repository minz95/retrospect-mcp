import {
  ConfigError,
  NotConfiguredError,
  ValidationError,
  NotFoundError,
  ExternalApiError,
} from '../utils/errors';

describe('Custom Error Types', () => {
  it('ConfigError has correct name and message', () => {
    const err = new ConfigError('missing key');
    expect(err.name).toBe('ConfigError');
    expect(err.message).toBe('missing key');
    expect(err).toBeInstanceOf(Error);
  });

  it('NotConfiguredError includes setup hint', () => {
    const err = new NotConfiguredError('Notion');
    expect(err.name).toBe('NotConfiguredError');
    expect(err.message).toContain('Notion');
    expect(err.message).toContain('npm run setup');
  });

  it('ValidationError has correct name', () => {
    const err = new ValidationError('invalid date format');
    expect(err.name).toBe('ValidationError');
    expect(err.message).toBe('invalid date format');
  });

  it('NotFoundError formats entity and id', () => {
    const err = new NotFoundError('Project', 'prj_abc123');
    expect(err.name).toBe('NotFoundError');
    expect(err.message).toBe('Project not found: prj_abc123');
  });

  it('ExternalApiError includes service name', () => {
    const err = new ExternalApiError('Claude', 'rate limit exceeded', 429);
    expect(err.name).toBe('ExternalApiError');
    expect(err.message).toContain('Claude');
    expect(err.message).toContain('rate limit exceeded');
    expect(err.statusCode).toBe(429);
  });
});
