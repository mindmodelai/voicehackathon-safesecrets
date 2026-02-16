import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  const windowMs = 1000; // 1 second
  const max = 3;

  beforeEach(() => {
    vi.useFakeTimers();
    rateLimiter = new RateLimiter({ windowMs, max });
  });

  afterEach(() => {
    rateLimiter.dispose();
    vi.useRealTimers();
  });

  it('allows requests within the limit', () => {
    expect(rateLimiter.check('ip1')).toBe(true);
    expect(rateLimiter.check('ip1')).toBe(true);
    expect(rateLimiter.check('ip1')).toBe(true);
    expect(rateLimiter.getCount('ip1')).toBe(3);
  });

  it('blocks requests exceeding the limit', () => {
    rateLimiter.check('ip1');
    rateLimiter.check('ip1');
    rateLimiter.check('ip1');
    expect(rateLimiter.check('ip1')).toBe(false);
  });

  it('resets the limit after the window expires', () => {
    rateLimiter.check('ip1');
    rateLimiter.check('ip1');
    rateLimiter.check('ip1');
    expect(rateLimiter.check('ip1')).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1);

    expect(rateLimiter.check('ip1')).toBe(true);
    expect(rateLimiter.getCount('ip1')).toBe(1);
  });

  it('handles multiple keys independently', () => {
    expect(rateLimiter.check('ip1')).toBe(true);
    expect(rateLimiter.check('ip1')).toBe(true);
    expect(rateLimiter.check('ip1')).toBe(true);
    expect(rateLimiter.check('ip1')).toBe(false);

    expect(rateLimiter.check('ip2')).toBe(true);
    expect(rateLimiter.getCount('ip2')).toBe(1);
  });

  it('cleans up expired entries periodically', () => {
    rateLimiter.check('ip1');

    // Advance time past the window to trigger interval
    vi.advanceTimersByTime(windowMs + 1);

    // Verify count is reset
    expect(rateLimiter.getCount('ip1')).toBe(0);
  });
});
