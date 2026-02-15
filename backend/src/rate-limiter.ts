
/**
 * RateLimiter - A simple sliding window rate limiter.
 * Tracks timestamps of requests and limits them within a time window.
 */
export class RateLimiter {
  private hits: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxHits: number;

  constructor(windowMs: number, maxHits: number) {
    this.windowMs = windowMs;
    this.maxHits = maxHits;
  }

  /**
   * Checks if a request from the given key is allowed.
   * If allowed, records the hit and returns true.
   * If not allowed, returns false.
   */
  check(key: string): boolean {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];

    // Filter out timestamps older than the window
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs);

    if (validTimestamps.length >= this.maxHits) {
      // Update the map with cleaned timestamps even if blocked
      this.hits.set(key, validTimestamps);
      return false;
    }

    validTimestamps.push(now);
    this.hits.set(key, validTimestamps);
    return true;
  }

  /**
   * Cleans up expired entries to prevent memory leaks.
   * Should be called periodically.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter(t => now - t < this.windowMs);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  /**
   * Returns the current number of active hits for a key (for testing/monitoring).
   */
  getHitCount(key: string): number {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];
    const valid = timestamps.filter(t => now - t < this.windowMs);
    // Update cache while we're at it
    if (valid.length !== timestamps.length) {
      this.hits.set(key, valid);
    }
    return valid.length;
  }
}
