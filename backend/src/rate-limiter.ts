/**
 * RateLimiter
 *
 * Implements a simple fixed-window rate limiter for connection tracking.
 * This helps prevent Denial of Service (DoS) attacks by limiting the number
 * of connections from a single IP address within a specific time window.
 */
export class RateLimiter {
  private ipMap: Map<string, { count: number; lastReset: number }>;
  private limit: number;
  private windowMs: number;
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(limit = 20, windowMs = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.ipMap = new Map();
    // Cleanup periodically to remove old entries and prevent memory leaks
    const cleanupMs = Math.max(windowMs, 60000);
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupMs);
  }

  /**
   * Checks if the IP is allowed to connect.
   * Returns true if allowed, false if limit exceeded.
   */
  check(ip: string): boolean {
    const now = Date.now();
    let entry = this.ipMap.get(ip);

    // If no entry exists or the window has expired, start a new window
    if (!entry || now - entry.lastReset > this.windowMs) {
      entry = { count: 0, lastReset: now };
      this.ipMap.set(ip, entry);
    }

    if (entry.count >= this.limit) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Removes expired entries from the map to free up memory.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.ipMap.entries()) {
      if (now - entry.lastReset > this.windowMs) {
        this.ipMap.delete(ip);
      }
    }
  }

  /**
   * Stops the cleanup interval. Must be called when the server shuts down.
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
