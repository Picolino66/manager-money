import { CrashReporter, logger, sanitizeFields } from './logger';

describe('logger (SPEC-008 / BR-ACC-006)', () => {
  it('descarta qualquer campo fora da lista permitida', () => {
    expect(
      sanitizeFields({ ok: true, durationMs: 12, amount: 1500, description: 'Almoço', email: 'a@b.c', code: 'x', nested: { a: 1 } }),
    ).toEqual({ ok: true, durationMs: 12, code: 'x' });
  });

  it('dados financeiros nunca chegam ao reporter', () => {
    const reporter: CrashReporter = { captureEvent: jest.fn(), captureException: jest.fn() };
    logger.setReporter(reporter);
    logger.event('sync.run', { ok: false, amount: 999, count: 2 });
    logger.error(new Error('falha'), { description: 'segredo' });
    expect(reporter.captureEvent).toHaveBeenCalledWith('sync.run', { ok: false, count: 2 });
    expect(reporter.captureException).toHaveBeenCalledWith(expect.any(Error), {});
  });
});
