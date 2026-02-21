export class RateLimiter {
  private connections = new Map<string, { count: number; resetTime: number }>();
  private readonly limit: number;
  private readonly windowMs: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(limit: number = 20, windowMs: number = 60000) {
    this.limit = limit;
    this.windowMs = windowMs;

    // Cleanup expired entries every minute to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Checks if the IP address is allowed to connect.
   * Returns true if allowed, false if rate limited.
   */
  check(ip: string): boolean {
    const now = Date.now();
    const record = this.connections.get(ip);

    // If no record exists or the window has expired, start a new window
    if (!record || now > record.resetTime) {
      this.connections.set(ip, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    // If limit exceeded, deny
    if (record.count >= this.limit) {
      return false;
    }

    // Increment count and allow
    record.count++;
    return true;
  }

  /**
   * Removes expired entries from the map.
   */
  private cleanup() {
    const now = Date.now();
    for (const [ip, record] of this.connections.entries()) {
      if (now > record.resetTime) {
        this.connections.delete(ip);
      }
    }
  }

  /**
   * Stops the cleanup interval.
   */
  dispose() {
    clearInterval(this.cleanupInterval);
  }
}
