/**
 * Simple Fixed-Window Rate Limiter
 *
 * Used to limit the number of WebSocket connections per IP address
 * to prevent DoS attacks and resource exhaustion.
 */
export class RateLimiter {
  private hits = new Map<string, number>();
  private readonly windowMs: number;
  private readonly limit: number;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(windowMs = 60000, limit = 20) {
    this.windowMs = windowMs;
    this.limit = limit;
    // Reset counts every window duration
    this.cleanupTimer = setInterval(() => this.reset(), this.windowMs);
  }

  /**
   * Checks if the IP has exceeded the rate limit.
   * Increments the counter for the IP.
   * @returns true if allowed, false if limit exceeded.
   */
  check(ip: string): boolean {
    const count = (this.hits.get(ip) || 0) + 1;
    this.hits.set(ip, count);
    return count <= this.limit;
  }

  private reset() {
    this.hits.clear();
  }

  /**
   * Cleans up the interval timer.
   * Must be called when the server is shutting down.
   */
  dispose() {
    clearInterval(this.cleanupTimer);
  }
}
