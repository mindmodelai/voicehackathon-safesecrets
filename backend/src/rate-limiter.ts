export interface RateLimiterOptions {
  /** Time window in milliseconds. */
  windowMs: number;
  /** Maximum number of hits per window. */
  max: number;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private windowMs: number;
  private max: number;
  private hits: Map<string, RateLimitRecord>;
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.hits = new Map();

    // Clean up expired entries periodically
    this.cleanupInterval = setInterval(() => this.cleanup(), this.windowMs);
    // Unref so it doesn't prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Checks if the key has exceeded the rate limit.
   * If not, increments the counter.
   * @param key Unique identifier (e.g., IP address)
   * @returns true if allowed, false if limit exceeded
   */
  check(key: string): boolean {
    const now = Date.now();
    const record = this.hits.get(key);

    // If no record exists or the window has expired, reset
    if (!record || now > record.resetTime) {
      this.hits.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    // Check limit
    if (record.count >= this.max) {
      return false;
    }

    // Increment count
    record.count++;
    return true;
  }

  /**
   * Removes expired entries from the map to prevent memory leaks.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.hits.entries()) {
      if (now > record.resetTime) {
        this.hits.delete(key);
      }
    }
  }

  /**
   * Returns the current count for a key (for testing/monitoring).
   */
  getCount(key: string): number {
    const record = this.hits.get(key);
    if (!record || Date.now() > record.resetTime) return 0;
    return record.count;
  }

  /**
   * Stops the cleanup interval.
   */
  dispose(): void {
    clearInterval(this.cleanupInterval);
  }
}
