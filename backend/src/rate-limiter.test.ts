import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    rateLimiter = new RateLimiter(3, 1000); // 3 connections per 1000ms
  });

  afterEach(() => {
    rateLimiter.dispose();
    vi.useRealTimers();
  });

  it('allows connections under the limit', () => {
    expect(rateLimiter.check('1.2.3.4')).toBe(true);
    expect(rateLimiter.check('1.2.3.4')).toBe(true);
    expect(rateLimiter.check('1.2.3.4')).toBe(true);
  });

  it('blocks connections over the limit', () => {
    rateLimiter.check('1.2.3.4');
    rateLimiter.check('1.2.3.4');
    rateLimiter.check('1.2.3.4');
    expect(rateLimiter.check('1.2.3.4')).toBe(false);
  });

  it('resets the limit after the window expires', () => {
    rateLimiter.check('1.2.3.4');
    rateLimiter.check('1.2.3.4');
    rateLimiter.check('1.2.3.4');
    expect(rateLimiter.check('1.2.3.4')).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(rateLimiter.check('1.2.3.4')).toBe(true);
  });

  it('tracks different IPs separately', () => {
    rateLimiter.check('1.2.3.4');
    rateLimiter.check('1.2.3.4');
    rateLimiter.check('1.2.3.4');
    expect(rateLimiter.check('1.2.3.4')).toBe(false);

    expect(rateLimiter.check('5.6.7.8')).toBe(true);
  });

  it('cleans up expired entries', () => {
    // Access private map for testing (using any cast)
    const map = (rateLimiter as any).connections;

    rateLimiter.check('1.2.3.4');
    expect(map.has('1.2.3.4')).toBe(true);

    // Advance time past the cleanup interval (60000ms)
    vi.advanceTimersByTime(61000);

    expect(map.has('1.2.3.4')).toBe(false);
  });
});
