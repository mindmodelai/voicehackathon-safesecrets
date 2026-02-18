import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    // Limit: 5 requests per 1000ms (1 second)
    rateLimiter = new RateLimiter(5, 1000);
  });

  afterEach(() => {
    rateLimiter.dispose();
    vi.useRealTimers();
  });

  it('should allow requests within limit', () => {
    const ip = '127.0.0.1';
    for (let i = 0; i < 5; i++) {
      expect(rateLimiter.check(ip)).toBe(true);
    }
  });

  it('should block requests over limit', () => {
    const ip = '127.0.0.1';
    for (let i = 0; i < 5; i++) {
      rateLimiter.check(ip);
    }
    expect(rateLimiter.check(ip)).toBe(false);
  });

  it('should reset limit after window expiration', () => {
    const ip = '127.0.0.1';
    for (let i = 0; i < 5; i++) {
      rateLimiter.check(ip);
    }
    expect(rateLimiter.check(ip)).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(1001);

    // Should be allowed again
    expect(rateLimiter.check(ip)).toBe(true);
  });

  it('should track IPs independently', () => {
    const ip1 = '127.0.0.1';
    const ip2 = '192.168.1.1';

    for (let i = 0; i < 5; i++) {
      rateLimiter.check(ip1);
    }
    expect(rateLimiter.check(ip1)).toBe(false);

    // ip2 should still be allowed
    expect(rateLimiter.check(ip2)).toBe(true);
  });

  it('should cleanup expired entries', () => {
    const ip = '127.0.0.1';
    rateLimiter.check(ip);

    // Verify entry exists
    const map = (rateLimiter as any).ipMap as Map<string, any>;
    expect(map.size).toBe(1);

    // Advance time past window
    vi.advanceTimersByTime(2000);

    // Manually trigger cleanup
    rateLimiter.cleanup();

    // After cleanup, the entry should be removed
    expect(map.size).toBe(0);
  });
});
