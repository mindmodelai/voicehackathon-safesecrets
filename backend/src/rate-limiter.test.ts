import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (limiter) {
      limiter.dispose();
    }
    vi.useRealTimers();
  });

  it('should allow requests under the limit', () => {
    limiter = new RateLimiter(60000, 2);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);
  });

  it('should block requests over the limit', () => {
    limiter = new RateLimiter(60000, 2);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(false);
  });

  it('should track different keys independently', () => {
    limiter = new RateLimiter(60000, 1);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(false);
    expect(limiter.check('ip2')).toBe(true);
  });

  it('should reset counts after windowMs', () => {
    limiter = new RateLimiter(1000, 1);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(false);

    vi.advanceTimersByTime(1000);
    // After 1000ms, the map should be cleared by setInterval
    expect(limiter.check('ip1')).toBe(true);
  });
});
