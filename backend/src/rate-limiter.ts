export class RateLimiter {
  private requests = new Map<string, number>();
  private interval: NodeJS.Timeout;

  constructor(
    private limit: number,
    private windowMs: number
  ) {
    this.interval = setInterval(() => {
      this.requests.clear();
    }, this.windowMs);
  }

  check(key: string): boolean {
    const current = this.requests.get(key) || 0;
    if (current >= this.limit) {
      return false;
    }
    this.requests.set(key, current + 1);
    return true;
  }

  dispose(): void {
    clearInterval(this.interval);
  }
}
