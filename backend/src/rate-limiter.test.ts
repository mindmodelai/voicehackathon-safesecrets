import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (rateLimiter) {
      rateLimiter.dispose();
    }
    vi.useRealTimers();
  });

  it('should allow requests within the limit', () => {
    rateLimiter = new RateLimiter(5, 60000); // 5 requests per minute

    for (let i = 0; i < 5; i++) {
      expect(rateLimiter.check('127.0.0.1')).toBe(true);
    }
  });

  it('should block requests exceeding the limit', () => {
    rateLimiter = new RateLimiter(5, 60000);

    for (let i = 0; i < 5; i++) {
      rateLimiter.check('127.0.0.1');
    }

    expect(rateLimiter.check('127.0.0.1')).toBe(false);
  });

  it('should track separate counts for different keys', () => {
    rateLimiter = new RateLimiter(2, 60000);

    expect(rateLimiter.check('user1')).toBe(true);
    expect(rateLimiter.check('user1')).toBe(true);
    expect(rateLimiter.check('user1')).toBe(false);

    expect(rateLimiter.check('user2')).toBe(true);
  });

  it('should reset count after the window expires', () => {
    rateLimiter = new RateLimiter(2, 1000); // 1 second window

    expect(rateLimiter.check('127.0.0.1')).toBe(true);
    expect(rateLimiter.check('127.0.0.1')).toBe(true);
    expect(rateLimiter.check('127.0.0.1')).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(1100);

    // Should be allowed again
    expect(rateLimiter.check('127.0.0.1')).toBe(true);
  });

  it('should cleanup expired entries periodically', () => {
    rateLimiter = new RateLimiter(5, 1000);

    // Create an entry
    rateLimiter.check('127.0.0.1');

    // Advance time past the window + cleanup interval
    vi.advanceTimersByTime(60000 + 1000);

    // We can't easily check private state, but we can verify it still works correctly
    // The cleanup interval runs every 60s.
    // If we call check again, it should start fresh
    expect(rateLimiter.check('127.0.0.1')).toBe(true);
  });
});
