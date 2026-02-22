export class RateLimiter {
  private counts: Map<string, number> = new Map();
  private timer: NodeJS.Timeout;

  constructor(private windowMs: number = 60000, private max: number = 20) {
    this.timer = setInterval(() => this.reset(), this.windowMs);
  }

  /**
   * Checks if an IP address has exceeded the rate limit.
   * Returns true if allowed, false if blocked.
   */
  check(ip: string): boolean {
    const current = this.counts.get(ip) || 0;
    if (current >= this.max) {
      return false;
    }
    this.counts.set(ip, current + 1);
    return true;
  }

  /**
   * Resets the rate limit counts.
   */
  reset(): void {
    this.counts.clear();
  }

  /**
   * Disposes the rate limiter and clears the interval timer.
   */
  dispose(): void {
    clearInterval(this.timer);
  }
}
