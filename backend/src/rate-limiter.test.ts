import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  const limit = 5;
  const windowMs = 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    rateLimiter = new RateLimiter(limit, windowMs);
  });

  afterEach(() => {
    rateLimiter.dispose();
    vi.useRealTimers();
  });

  it('allows requests under the limit', () => {
    for (let i = 0; i < limit; i++) {
      expect(rateLimiter.check('127.0.0.1')).toBe(true);
    }
  });

  it('blocks requests over the limit', () => {
    for (let i = 0; i < limit; i++) {
      rateLimiter.check('127.0.0.1');
    }
    expect(rateLimiter.check('127.0.0.1')).toBe(false);
  });

  it('tracks different IPs independently', () => {
    for (let i = 0; i < limit; i++) {
      rateLimiter.check('127.0.0.1');
    }
    expect(rateLimiter.check('127.0.0.1')).toBe(false);
    expect(rateLimiter.check('192.168.1.1')).toBe(true);
  });

  it('resets counts after the window expires', () => {
    for (let i = 0; i < limit; i++) {
      rateLimiter.check('127.0.0.1');
    }
    expect(rateLimiter.check('127.0.0.1')).toBe(false);

    vi.advanceTimersByTime(windowMs + 10); // Advance time past the window

    expect(rateLimiter.check('127.0.0.1')).toBe(true);
  });

  it('cleans up the interval on dispose', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    rateLimiter.dispose();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
