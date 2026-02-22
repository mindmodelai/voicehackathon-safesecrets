import { describe, it, expect, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { SafeSecretsWSServer } from './ws-server.js';
import { RateLimiter } from './rate-limiter.js';

const TEST_PORT_BASE = 9400;
let portCounter = 0;
function getTestPort(): number {
  return TEST_PORT_BASE + portCounter++;
}

describe('RateLimiter Class', () => {
  it('should allow up to max connections', () => {
    const limiter = new RateLimiter(1000, 5);
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('1.2.3.4')).toBe(true);
    }
    expect(limiter.check('1.2.3.4')).toBe(false);
    limiter.dispose();
  });

  it('should reset after window', async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(1000, 2);
    expect(limiter.check('1.2.3.4')).toBe(true);
    expect(limiter.check('1.2.3.4')).toBe(true);
    expect(limiter.check('1.2.3.4')).toBe(false);

    vi.advanceTimersByTime(1100);

    expect(limiter.check('1.2.3.4')).toBe(true);
    limiter.dispose();
    vi.useRealTimers();
  });
});

describe('SafeSecretsWSServer Rate Limiting', () => {
  let server: SafeSecretsWSServer;
  let clients: WebSocket[] = [];

  afterEach(async () => {
    clients.forEach(c => {
      try {
        c.close();
      } catch {}
    });
    clients = [];
    if (server) {
      try {
        await server.close();
      } catch {}
    }
  });

  it('should enforce connection limits', async () => {
    const port = getTestPort();
    server = new SafeSecretsWSServer({ port });
    await new Promise(r => setTimeout(r, 100));

    // The default is 20.
    const LIMIT = 20;

    // Open 20 connections
    const promises = [];
    for (let i = 0; i < LIMIT; i++) {
        const ws = new WebSocket(`ws://localhost:${port}/ws`);
        clients.push(ws);
        promises.push(new Promise<void>((resolve) => {
            if (ws.readyState === WebSocket.OPEN) resolve();
            ws.on('open', () => resolve());
            ws.on('error', (e) => console.error('WS Error:', e));
        }));
    }
    await Promise.all(promises);

    // 21st should fail
    const blockedWs = new WebSocket(`ws://localhost:${port}/ws`);
    clients.push(blockedWs);

    const closedPromise = new Promise<number>((resolve) => {
        blockedWs.on('close', (code) => resolve(code));
        blockedWs.on('error', (err) => {
            // Depending on how fast it closes, client might emit error or close
            // console.log('Blocked client error:', err);
        });
    });

    // It should close with 1008
    const code = await closedPromise;
    expect(code).toBe(1008);
  }, 10000); // Increase timeout for this test as opening 20 connections might take a moment
});
