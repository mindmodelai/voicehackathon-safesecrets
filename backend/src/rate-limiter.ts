export class RateLimiter {
  private hits: Map<string, number> = new Map();
  private windowMs: number;
  private maxHits: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(windowMs: number, maxHits: number) {
    this.windowMs = windowMs;
    this.maxHits = maxHits;
    // Periodic cleanup to prevent memory leaks
    this.cleanupInterval = setInterval(() => {
      this.hits.clear();
    }, this.windowMs);
  }

  check(key: string): boolean {
    const hits = this.hits.get(key) || 0;
    if (hits >= this.maxHits) {
      return false;
    }
    this.hits.set(key, hits + 1);
    return true;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  dispose(): void {
    clearInterval(this.cleanupInterval);
  }
}
