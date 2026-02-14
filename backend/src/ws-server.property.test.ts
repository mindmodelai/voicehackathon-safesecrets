/**
 * Tasks 7.2–7.3 — WebSocket Server Property + Unit Tests
 *
 * 7.2 Property 10: Backend events forwarded to client with data intact
 * 7.3 Unit tests: session creation, resource cleanup on disconnect
 *
 * Validates: Requirements 1.1, 1.3, 1.4, 1.5
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import fc from 'fast-check';
import { SafeSecretsWSServer } from './ws-server.js';
import { TranscribeAdapter } from './transcribe-adapter.js';
import { PollyAdapter } from './polly-adapter.js';
import { MastraWorkflowEngine } from './mastra-workflow.js';
import { SafeSecretsVoiceProvider } from './custom-voice-provider.js';

// ── Helpers ──

const TEST_PORT_BASE = 9600;
let portCounter = 0;
function getTestPort(): number {
  return TEST_PORT_BASE + portCounter++;
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    ws.on('open', () => resolve());
    ws.on('error', (err) => reject(err));
  });
}

function collectMessages(ws: WebSocket, count: number, timeoutMs = 3000): Promise<any[]> {
  return new Promise((resolve) => {
    const messages: any[] = [];
    const timer = setTimeout(() => resolve(messages), timeoutMs);
    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        try { messages.push(JSON.parse(data.toString())); } catch { /* skip */ }
      }
      if (messages.length >= count) {
        clearTimeout(timer);
        resolve(messages);
      }
    });
  });
}

function createMockTranscribeAdapter(): TranscribeAdapter {
  return new TranscribeAdapter({
    send: vi.fn().mockResolvedValue({
      TranscriptResultStream: (async function* () {})(),
    }),
  } as any);
}

function createMockPollyAdapter(): PollyAdapter {
  return new PollyAdapter({
    send: vi.fn().mockResolvedValue({
      AudioStream: (async function* () {})(),
    }),
  } as any);
}

function createMockAgent() {
  return {
    id: 'test-agent',
    name: 'test',
    generate: vi.fn().mockResolvedValue({ text: '', object: null }),
  } as any;
}

function createTestServer(port: number) {
  const mockTranscribe = createMockTranscribeAdapter();
  const mockPolly = createMockPollyAdapter();
  const mockVoice = new SafeSecretsVoiceProvider(mockTranscribe, mockPolly);
  const mockWorkflow = new MastraWorkflowEngine(mockVoice, {}, createMockAgent());
  return new SafeSecretsWSServer({
    port,
    transcribeAdapter: mockTranscribe,
    pollyAdapter: mockPolly,
    mastraWorkflow: mockWorkflow,
    voiceProvider: mockVoice,
  });
}

// ── Property 10: Backend events forwarded to client (Task 7.2) ──

describe('Property 10: Backend events forwarded to client', () => {
  it('session_ready event is always sent on connection', async () => {
    // Property: for any number of connections, each receives session_ready
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        async (numClients) => {
          const port = getTestPort();
          const server = createTestServer(port);
          await new Promise((r) => setTimeout(r, 100));

          const clients: WebSocket[] = [];
          const messagePromises: Promise<any[]>[] = [];

          for (let i = 0; i < numClients; i++) {
            const client = new WebSocket(`ws://localhost:${port}/ws`);
            clients.push(client);
            messagePromises.push(collectMessages(client, 1, 2000));
            await waitForOpen(client);
          }

          const allMessages = await Promise.all(messagePromises);

          for (const messages of allMessages) {
            expect(messages.length).toBeGreaterThanOrEqual(1);
            expect(messages[0]).toEqual({ type: 'event', event: 'session_ready' });
          }

          for (const c of clients) c.close();
          await new Promise((r) => setTimeout(r, 50));
          await server.close();
        },
      ),
      { numRuns: 5 },
    );
  });

  it('error events are forwarded with message data intact', async () => {
    // Property: sending an unknown control action always returns an error with the action name
    const unknownActions = fc.string({ minLength: 1, maxLength: 30 }).filter(
      (s) => !['start_conversation', 'end_conversation', 'refinement'].includes(s),
    );

    await fc.assert(
      fc.asyncProperty(unknownActions, async (action) => {
        const port = getTestPort();
        const server = createTestServer(port);
        await new Promise((r) => setTimeout(r, 100));

        const client = new WebSocket(`ws://localhost:${port}/ws`);
        const messages = collectMessages(client, 2, 2000);
        await waitForOpen(client);

        client.send(JSON.stringify({ type: 'control', payload: { action } }));

        const received = await messages;
        const errorMsg = received.find((m: any) => m.type === 'event' && m.event === 'error');
        expect(errorMsg).toBeDefined();
        // Strict validation now rejects unknown actions as invalid format
        expect(errorMsg.data.message).toBe('Invalid message format');

        client.close();
        await new Promise((r) => setTimeout(r, 50));
        await server.close();
      }),
      { numRuns: 5 },
    );
  });

  it('refinement without conversation always returns error with consistent message', async () => {
    const refinementTypes = fc.constantFrom('shorter', 'bolder', 'more_romantic', 'translate_french');

    await fc.assert(
      fc.asyncProperty(refinementTypes, async (type) => {
        const port = getTestPort();
        const server = createTestServer(port);
        await new Promise((r) => setTimeout(r, 100));

        const client = new WebSocket(`ws://localhost:${port}/ws`);
        const messages = collectMessages(client, 2, 2000);
        await waitForOpen(client);

        client.send(JSON.stringify({
          type: 'control',
          payload: { action: 'refinement', data: { type } },
        }));

        const received = await messages;
        const errorMsg = received.find((m: any) => m.type === 'event' && m.event === 'error');
        expect(errorMsg).toBeDefined();
        expect(errorMsg.data.message).toContain('No active conversation');

        client.close();
        await new Promise((r) => setTimeout(r, 50));
        await server.close();
      }),
      { numRuns: 4 },
    );
  });
});

// ── Unit tests for WebSocket Server (Task 7.3) ──

describe('WebSocket Server unit tests', () => {
  it('creates a session with correct resources on start_conversation', async () => {
    const port = getTestPort();
    const server = createTestServer(port);
    await new Promise((r) => setTimeout(r, 100));

    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    const sessionId = server.getSessionIds()[0];
    const session = server.getSession(sessionId)!;

    // Before start_conversation, context should be null
    expect(session.context).toBeNull();
    expect(session.isActive).toBe(true);
    expect(session.transcribeAdapter).toBeDefined();
    expect(session.pollyAdapter).toBeDefined();
    expect(session.mastraWorkflow).toBeDefined();

    // Start conversation
    client.send(JSON.stringify({ type: 'control', payload: { action: 'start_conversation' } }));
    await new Promise((r) => setTimeout(r, 200));

    // After start_conversation, context should be initialized
    const updatedSession = server.getSession(sessionId)!;
    expect(updatedSession.context).not.toBeNull();
    expect(updatedSession.context!.stage).toBe('collect');
    expect(updatedSession.context!.sessionId).toBe(sessionId);

    client.close();
    await new Promise((r) => setTimeout(r, 50));
    await server.close();
  });

  it('cleans up resources on unexpected disconnect', async () => {
    const port = getTestPort();
    const server = createTestServer(port);
    await new Promise((r) => setTimeout(r, 100));

    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    expect(server.getSessionCount()).toBe(1);
    const sessionId = server.getSessionIds()[0];

    // Start a conversation so there are resources to clean up
    client.send(JSON.stringify({ type: 'control', payload: { action: 'start_conversation' } }));
    await new Promise((r) => setTimeout(r, 200));

    // Simulate unexpected disconnect by terminating the socket
    client.terminate();
    await new Promise((r) => setTimeout(r, 200));

    // Session should be cleaned up
    expect(server.getSessionCount()).toBe(0);
    expect(server.getSession(sessionId)).toBeUndefined();

    await server.close();
  });

  it('cleans up resources on graceful close', async () => {
    const port = getTestPort();
    const server = createTestServer(port);
    await new Promise((r) => setTimeout(r, 100));

    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    expect(server.getSessionCount()).toBe(1);

    // Start conversation
    client.send(JSON.stringify({ type: 'control', payload: { action: 'start_conversation' } }));
    await new Promise((r) => setTimeout(r, 200));

    // Graceful close
    client.close();
    await new Promise((r) => setTimeout(r, 200));

    expect(server.getSessionCount()).toBe(0);

    await server.close();
  });

  it('end_conversation clears context but keeps session alive', async () => {
    const port = getTestPort();
    const server = createTestServer(port);
    await new Promise((r) => setTimeout(r, 100));

    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    const sessionId = server.getSessionIds()[0];

    // Start then end conversation
    client.send(JSON.stringify({ type: 'control', payload: { action: 'start_conversation' } }));
    await new Promise((r) => setTimeout(r, 200));
    expect(server.getSession(sessionId)!.context).not.toBeNull();

    client.send(JSON.stringify({ type: 'control', payload: { action: 'end_conversation' } }));
    await new Promise((r) => setTimeout(r, 200));

    // Context cleared but session still exists
    const session = server.getSession(sessionId)!;
    expect(session.context).toBeNull();
    expect(session.isActive).toBe(true);
    expect(server.getSessionCount()).toBe(1);

    client.close();
    await new Promise((r) => setTimeout(r, 50));
    await server.close();
  });

  it('server.close() cleans up all sessions', async () => {
    const port = getTestPort();
    const server = createTestServer(port);
    await new Promise((r) => setTimeout(r, 100));

    const client1 = new WebSocket(`ws://localhost:${port}/ws`);
    const client2 = new WebSocket(`ws://localhost:${port}/ws`);
    await Promise.all([waitForOpen(client1), waitForOpen(client2)]);
    await new Promise((r) => setTimeout(r, 50));

    expect(server.getSessionCount()).toBe(2);

    client1.close();
    client2.close();
    await new Promise((r) => setTimeout(r, 100));

    await server.close();
    expect(server.getSessionCount()).toBe(0);
  });
});
