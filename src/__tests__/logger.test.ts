import { Logger, createLogger } from '../utils/logger';

describe('Logger', () => {
  let consoleSpy: jest.SpyInstance;
  const originalLogLevel = process.env.LOG_LEVEL;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    process.env.LOG_LEVEL = originalLogLevel;
  });

  it('creates a logger with a name', () => {
    const log = createLogger('test');
    expect(log).toBeInstanceOf(Logger);
  });

  it('writes info messages to stderr', () => {
    process.env.LOG_LEVEL = 'info';
    const log = createLogger('test');
    log.info('hello world');
    expect(consoleSpy).toHaveBeenCalledWith('[INFO] [test] hello world');
  });

  it('writes warn messages to stderr', () => {
    process.env.LOG_LEVEL = 'info';
    const log = createLogger('test');
    log.warn('something wrong');
    expect(consoleSpy).toHaveBeenCalledWith('[WARN] [test] something wrong');
  });

  it('writes error messages with Error object', () => {
    const log = createLogger('test');
    const err = new Error('boom');
    log.error('failed', err);
    expect(consoleSpy).toHaveBeenCalledWith('[ERROR] [test] failed: boom');
  });

  it('suppresses debug messages when LOG_LEVEL is info', () => {
    process.env.LOG_LEVEL = 'info';
    const log = createLogger('test');
    log.debug('verbose detail');
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('shows debug messages when LOG_LEVEL is debug', () => {
    process.env.LOG_LEVEL = 'debug';
    const log = createLogger('test');
    log.debug('verbose detail');
    expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] [test] verbose detail');
  });

  it('suppresses info when LOG_LEVEL is error', () => {
    process.env.LOG_LEVEL = 'error';
    const log = createLogger('test');
    log.info('should be hidden');
    log.warn('should be hidden');
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
