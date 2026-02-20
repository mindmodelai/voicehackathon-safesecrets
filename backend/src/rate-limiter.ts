export class RateLimiter {
  private counts = new Map<string, number>();
  private interval: NodeJS.Timeout | null = null;
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.startCleanup();
  }

  /**
   * Checks if a request from the given IP is allowed.
   * Increments the count for the IP if allowed.
   * @param ip The IP address of the client.
   * @returns true if allowed, false if rate limited.
   */
  check(ip: string): boolean {
    const currentCount = this.counts.get(ip) || 0;
    if (currentCount >= this.limit) {
      return false;
    }
    this.counts.set(ip, currentCount + 1);
    return true;
  }

  /**
   * Resets the counts periodically.
   */
  private startCleanup() {
    this.interval = setInterval(() => {
      this.counts.clear();
    }, this.windowMs);
  }

  /**
   * Stops the cleanup interval.
   */
  dispose() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
