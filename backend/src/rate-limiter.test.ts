import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(1000, 5); // 5 requests per 1000ms
    vi.useFakeTimers();
  });

  it('should allow requests within the limit', () => {
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.getHitCount('ip1')).toBe(3);
  });

  it('should block requests exceeding the limit', () => {
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);

    // 6th request should fail
    expect(limiter.check('ip1')).toBe(false);

    // Check hit count is still 5
    expect(limiter.getHitCount('ip1')).toBe(5);
  });

  it('should allow requests after window expires', () => {
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip1')).toBe(false);

    // Advance time by 1001ms
    vi.advanceTimersByTime(1001);

    // Should be allowed again
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.getHitCount('ip1')).toBe(1);
  });

  it('should handle multiple keys independently', () => {
    expect(limiter.check('ip1')).toBe(true);
    expect(limiter.check('ip2')).toBe(true);

    // Exhaust ip1 limit
    for (let i = 0; i < 4; i++) {
      expect(limiter.check('ip1')).toBe(true);
    }
    expect(limiter.check('ip1')).toBe(false);

    // ip2 should still be allowed
    expect(limiter.check('ip2')).toBe(true);
  });

  it('should cleanup expired entries', () => {
    limiter.check('ip1');
    limiter.check('ip2');

    expect(limiter.getHitCount('ip1')).toBe(1);
    expect(limiter.getHitCount('ip2')).toBe(1);

    // Advance time past window
    vi.advanceTimersByTime(1001);

    limiter.cleanup();

    // Internal map should be empty or filtered
    expect(limiter.getHitCount('ip1')).toBe(0);
    expect(limiter.getHitCount('ip2')).toBe(0);
  });
});
