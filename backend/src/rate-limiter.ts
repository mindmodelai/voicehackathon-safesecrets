interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private hits: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private limit: number,
    private windowMs: number
  ) {
    // Periodically clean up expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Checks if the given key (e.g. IP address) is within the rate limit.
   * If within limit, increments the counter and returns true.
   * If limit exceeded, returns false.
   */
  check(key: string): boolean {
    const now = Date.now();
    let entry = this.hits.get(key);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + this.windowMs };
      this.hits.set(key, entry);
    }

    if (entry.count >= this.limit) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Removes expired entries from the map.
   */
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.hits.entries()) {
      if (now > entry.resetTime) {
        this.hits.delete(key);
      }
    }
  }

  /**
   * stops the cleanup interval.
   */
  dispose() {
    clearInterval(this.cleanupInterval);
  }
}
