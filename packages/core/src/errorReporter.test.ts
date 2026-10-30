import { describe, expect, it, vi } from 'vitest';
import { createErrorReporter } from './errorReporter';

describe('createErrorReporter', () => {
  it('does nothing, and loads nothing, when error tracking is off', async () => {
    const reporter = createErrorReporter(null);
    expect(() => reporter.report(new Error('x'))).not.toThrow();
    await reporter.ready;
  });

  it('sends errors from before the tracker loaded, then reports directly', async () => {
    const sink = { captureException: vi.fn() };
    let resolve!: (s: typeof sink) => void;
    const reporter = createErrorReporter(() => new Promise((r) => (resolve = r)));
    const early = new Error('early');
    reporter.report(early);
    expect(sink.captureException).not.toHaveBeenCalled();
    resolve(sink);
    await reporter.ready;
    expect(sink.captureException).toHaveBeenCalledWith(early);
    const later = new Error('later');
    reporter.report(later);
    expect(sink.captureException).toHaveBeenLastCalledWith(later);
  });

  it('keeps at most 20 early errors, and forgets them if the tracker fails to load', async () => {
    const reporter = createErrorReporter(() => Promise.reject(new Error('blocked')));
    for (let i = 0; i < 30; i++) reporter.report(new Error(String(i)));
    await expect(reporter.ready).resolves.toBeUndefined();
  });

  it('caps the waiting list at 20', async () => {
    const sink = { captureException: vi.fn() };
    let resolve!: (s: typeof sink) => void;
    const reporter = createErrorReporter(() => new Promise((r) => (resolve = r)));
    for (let i = 0; i < 30; i++) reporter.report(new Error(String(i)));
    resolve(sink);
    await reporter.ready;
    expect(sink.captureException).toHaveBeenCalledTimes(20);
  });
});
