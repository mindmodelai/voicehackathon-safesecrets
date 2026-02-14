import { describe, it, expect, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { SafeSecretsWSServer } from './ws-server.js';

/** Wait for a WebSocket to reach OPEN state. */
function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    ws.on('open', () => resolve());
    ws.on('error', (err) => reject(err));
  });
}

/** Collect the next N JSON messages from a WebSocket. */
function collectMessages(ws: WebSocket, count: number, timeoutMs = 3000): Promise<unknown[]> {
  return new Promise((resolve) => {
    const messages: unknown[] = [];
    const timer = setTimeout(() => resolve(messages), timeoutMs);
    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        try {
          messages.push(JSON.parse(data.toString()));
        } catch {
          messages.push(data.toString());
        }
      }
      if (messages.length >= count) {
        clearTimeout(timer);
        resolve(messages);
      }
    });
  });
}

describe('Backend entry point (HTTP + WS server)', () => {
  let httpServer: ReturnType<typeof createServer>;
  let wsServer: SafeSecretsWSServer;
  let client: WebSocket | null = null;
  const port = 9300;

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
      await new Promise((r) => setTimeout(r, 50));
    }
    client = null;
    if (wsServer) {
      await wsServer.close();
    }
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it('should create an HTTP server with a health endpoint', async () => {
    httpServer = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', sessions: wsServer.getSessionCount() }));
        return;
      }
      res.writeHead(404);
      res.end('Not Found');
    });

    wsServer = new SafeSecretsWSServer({ server: httpServer });

    await new Promise<void>((resolve) => httpServer.listen(port, resolve));

    // Test health endpoint
    const response = await fetch(`http://localhost:${port}/health`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.sessions).toBe(0);
  });

  it('should accept WebSocket connections on /ws when attached to HTTP server', async () => {
    httpServer = createServer();
    wsServer = new SafeSecretsWSServer({ server: httpServer });

    await new Promise<void>((resolve) => httpServer.listen(port, resolve));

    client = new WebSocket(`ws://localhost:${port}/ws`);
    const messages = collectMessages(client, 1);
    await waitForOpen(client);

    const received = await messages;
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: 'event', event: 'session_ready' });
    expect(wsServer.getSessionCount()).toBe(1);
  });

  it('should return 404 for non-health HTTP requests', async () => {
    httpServer = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200);
        res.end('ok');
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    wsServer = new SafeSecretsWSServer({ server: httpServer });

    await new Promise<void>((resolve) => httpServer.listen(port, resolve));

    const response = await fetch(`http://localhost:${port}/some-random-path`);
    expect(response.status).toBe(404);
  });

  it('should report session count in health endpoint after WS connection', async () => {
    httpServer = createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', sessions: wsServer.getSessionCount() }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    wsServer = new SafeSecretsWSServer({ server: httpServer });

    await new Promise<void>((resolve) => httpServer.listen(port, resolve));

    // Connect a WS client
    client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    // Health should now report 1 session
    const response = await fetch(`http://localhost:${port}/health`);
    const body = await response.json();
    expect(body.sessions).toBe(1);
  });
});
