import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { SafeSecretsWSServer } from './ws-server.js';
import { TranscribeAdapter } from './transcribe-adapter.js';
import { PollyAdapter } from './polly-adapter.js';
import { MastraWorkflowEngine } from './mastra-workflow.js';
import { SafeSecretsVoiceProvider } from './custom-voice-provider.js';

// ── Test helpers ──

const TEST_PORT_BASE = 9200;
let portCounter = 0;
function getTestPort(): number {
  return TEST_PORT_BASE + portCounter++;
}

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
  return new Promise((resolve, reject) => {
    const messages: unknown[] = [];
    const timer = setTimeout(() => {
      resolve(messages); // resolve with what we have
    }, timeoutMs);

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

/** Wait for a specific event type from the WebSocket. */
function waitForEvent(ws: WebSocket, eventName: string, timeoutMs = 3000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${eventName}`)), timeoutMs);
    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'event' && msg.event === eventName) {
            clearTimeout(timer);
            resolve(msg);
          }
        } catch { /* ignore */ }
      }
    });
  });
}

// ── Mock adapters ──

function createMockTranscribeAdapter(): TranscribeAdapter {
  const adapter = new TranscribeAdapter({
    send: vi.fn().mockResolvedValue({
      TranscriptResultStream: (async function* () { /* empty */ })(),
    }),
    config: {},
    destroy: vi.fn(),
    middlewareStack: { add: vi.fn(), clone: vi.fn(), use: vi.fn() },
  } as any);
  return adapter;
}

function createMockPollyAdapter(): PollyAdapter {
  return new PollyAdapter({
    send: vi.fn().mockResolvedValue({
      AudioStream: (async function* () { /* empty */ })(),
    }),
    config: {},
    destroy: vi.fn(),
    middlewareStack: { add: vi.fn(), clone: vi.fn(), use: vi.fn() },
  } as any);
}

// ── Tests ──

describe('SafeSecretsWSServer', () => {
  let server: SafeSecretsWSServer;
  let client: WebSocket;
  let port: number;

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
      await new Promise((r) => setTimeout(r, 50));
    }
    if (server) {
      try {
        await server.close();
      } catch {
        // Server may already be closed
      }
      server = undefined as any;
    }
  });

  describe('connection lifecycle', () => {
    it('should send session_ready on new connection', async () => {
      port = getTestPort();
      server = new SafeSecretsWSServer({ port });
      await new Promise((r) => setTimeout(r, 100)); // let server start

      client = new WebSocket(`ws://localhost:${port}/ws`);
      const messages = collectMessages(client, 1);
      await waitForOpen(client);

      const received = await messages;
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ type: 'event', event: 'session_ready' });
    });

    it('should track sessions on connection', async () => {
      port = getTestPort();
      server = new SafeSecretsWSServer({ port });
      await new Promise((r) => setTimeout(r, 100));

      expect(server.getSessionCount()).toBe(0);

      client = new WebSocket(`ws://localhost:${port}/ws`);
      await waitForOpen(client);
      await new Promise((r) => setTimeout(r, 50));

      expect(server.getSessionCount()).toBe(1);
    });

    it('should clean up session on client disconnect', async () => {
      port = getTestPort();
      server = new SafeSecretsWSServer({ port });
      await new Promise((r) => setTimeout(r, 100));

      client = new WebSocket(`ws://localhost:${port}/ws`);
      await waitForOpen(client);
      await new Promise((r) => setTimeout(r, 50));

      expect(server.getSessionCount()).toBe(1);

      client.close();
      await new Promise((r) => setTimeout(r, 100));

      expect(server.getSessionCount()).toBe(0);
    });

    it('should handle multiple concurrent connections', async () => {
      port = getTestPort();
      server = new SafeSecretsWSServer({ port });
      await new Promise((r) => setTimeout(r, 100));

      const client1 = new WebSocket(`ws://localhost:${port}/ws`);
      const client2 = new WebSocket(`ws://localhost:${port}/ws`);
      await Promise.all([waitForOpen(client1), waitForOpen(client2)]);
      await new Promise((r) => setTimeout(r, 50));

      expect(server.getSessionCount()).toBe(2);
      expect(server.getSessionIds()).toHaveLength(2);

      client1.close();
      client2.close();
      await new Promise((r) => setTimeout(r, 100));

      expect(server.getSessionCount()).toBe(0);
    });
  });

  describe('message handling', () => {
    it('should send error for invalid JSON messages', async () => {
      port = getTestPort();
      server = new SafeSecretsWSServer({ port });
      await new Promise((r) => setTimeout(r, 100));

      client = new WebSocket(`ws://localhost:${port}/ws`);
      const messages = collectMessages(client, 2);
      await waitForOpen(client);

      client.send('not valid json {{{');

      const received = await messages;
      expect(received.length).toBeGreaterThanOrEqual(1);
      // First message is session_ready, second should be error
      const errorMsg = received.find(
        (m: any) => m.type === 'event' && m.event === 'error',
      ) as any;
      expect(errorMsg).toBeDefined();
      expect(errorMsg.data.message).toBe('Invalid message format');
    });

    it('should send error for unknown control actions', async () => {
      port = getTestPort();
      server = new SafeSecretsWSServer({ port });
      await new Promise((r) => setTimeout(r, 100));

      client = new WebSocket(`ws://localhost:${port}/ws`);
      const messages = collectMessages(client, 2);
      await waitForOpen(client);

      client.send(JSON.stringify({ type: 'control', payload: { action: 'unknown_action' } }));

      const received = await messages;
      const errorMsg = received.find(
        (m: any) => m.type === 'event' && m.event === 'error',
      ) as any;
      expect(errorMsg).toBeDefined();
      expect(errorMsg.data.message).toContain('Unknown control action');
    });
  });

  describe('start_conversation', () => {
    it('should create a Mastra session on start_conversation', async () => {
      port = getTestPort();
      const mockTranscribe = createMockTranscribeAdapter();
      const mockPolly = createMockPollyAdapter();
      const mockVoice = new SafeSecretsVoiceProvider(mockTranscribe, mockPolly);
      const mockWorkflow = new MastraWorkflowEngine(mockVoice, {}, {
        id: 'test-agent',
        name: 'test',
        model: {} as any,
        instructions: 'test',
        generate: vi.fn().mockResolvedValue({ text: '', object: null }),
      } as any);

      server = new SafeSecretsWSServer({
        port,
        transcribeAdapter: mockTranscribe,
        pollyAdapter: mockPolly,
        mastraWorkflow: mockWorkflow,
        voiceProvider: mockVoice,
      });
      await new Promise((r) => setTimeout(r, 100));

      client = new WebSocket(`ws://localhost:${port}/ws`);
      await waitForOpen(client);
      await new Promise((r) => setTimeout(r, 50));

      // Get the session ID
      const sessionIds = server.getSessionIds();
      expect(sessionIds).toHaveLength(1);
      const sessionId = sessionIds[0];

      // Send start_conversation
      client.send(JSON.stringify({ type: 'control', payload: { action: 'start_conversation' } }));
      await new Promise((r) => setTimeout(r, 200));

      // Verify Mastra session was created
      const session = server.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.context).not.toBeNull();
      expect(session!.context!.stage).toBe('collect');
    });
  });

  describe('end_conversation', () => {
    it('should clear context on end_conversation', async () => {
      port = getTestPort();
      const mockTranscribe = createMockTranscribeAdapter();
      const mockPolly = createMockPollyAdapter();
      const mockVoice = new SafeSecretsVoiceProvider(mockTranscribe, mockPolly);
      const mockWorkflow = new MastraWorkflowEngine(mockVoice, {}, {
        id: 'test-agent',
        name: 'test',
        model: {} as any,
        instructions: 'test',
        generate: vi.fn().mockResolvedValue({ text: '', object: null }),
      } as any);

      server = new SafeSecretsWSServer({
        port,
        transcribeAdapter: mockTranscribe,
        pollyAdapter: mockPolly,
        mastraWorkflow: mockWorkflow,
        voiceProvider: mockVoice,
      });
      await new Promise((r) => setTimeout(r, 100));

      client = new WebSocket(`ws://localhost:${port}/ws`);
      await waitForOpen(client);
      await new Promise((r) => setTimeout(r, 50));

      const sessionId = server.getSessionIds()[0];

      // Start then end conversation
      client.send(JSON.stringify({ type: 'control', payload: { action: 'start_conversation' } }));
      await new Promise((r) => setTimeout(r, 200));

      client.send(JSON.stringify({ type: 'control', payload: { action: 'end_conversation' } }));
      await new Promise((r) => setTimeout(r, 200));

      const session = server.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.context).toBeNull();
    });
  });

  describe('refinement without conversation', () => {
    it('should send error when refinement is sent without active conversation', async () => {
      port = getTestPort();
      server = new SafeSecretsWSServer({ port });
      await new Promise((r) => setTimeout(r, 100));

      client = new WebSocket(`ws://localhost:${port}/ws`);
      const messages = collectMessages(client, 2);
      await waitForOpen(client);

      client.send(JSON.stringify({
        type: 'control',
        payload: { action: 'refinement', data: { type: 'shorter' } },
      }));

      const received = await messages;
      const errorMsg = received.find(
        (m: any) => m.type === 'event' && m.event === 'error',
      ) as any;
      expect(errorMsg).toBeDefined();
      expect(errorMsg.data.message).toContain('No active conversation');
    });
  });

  describe('server shutdown', () => {
    it('should clean up all sessions on close', async () => {
      port = getTestPort();
      const localServer = new SafeSecretsWSServer({ port });
      await new Promise((r) => setTimeout(r, 100));

      const client1 = new WebSocket(`ws://localhost:${port}/ws`);
      const client2 = new WebSocket(`ws://localhost:${port}/ws`);
      await Promise.all([waitForOpen(client1), waitForOpen(client2)]);
      await new Promise((r) => setTimeout(r, 50));

      expect(localServer.getSessionCount()).toBe(2);

      client1.close();
      client2.close();
      await new Promise((r) => setTimeout(r, 100));

      await localServer.close();
      expect(localServer.getSessionCount()).toBe(0);

      // Don't assign to `server` so afterEach doesn't try to double-close
    });
  });
});
