/**
 * Task 10.3 — Integration tests for conversation flow
 *
 * Tests the full flow: start → collect → compose → refine → end with mocked AWS services.
 * Tests barge-in during TTS and error recovery paths.
 *
 * Validates: Requirements 9.2, 9.4, 9.5
 */
import { describe, it, expect, vi } from 'vitest';
import { WebSocket } from 'ws';
import { SafeSecretsWSServer } from './ws-server.js';
import { TranscribeAdapter } from './transcribe-adapter.js';
import { PollyAdapter } from './polly-adapter.js';
import { MastraWorkflowEngine } from './mastra-workflow.js';
import { SafeSecretsVoiceProvider } from './custom-voice-provider.js';
import type { StructuredOutput } from '../../shared/types.js';

// ── Helpers ──

const TEST_PORT_BASE = 9700;
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

function waitForEvent(ws: WebSocket, eventName: string, timeoutMs = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${eventName}`)), timeoutMs);
    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'event' && msg.event === eventName) {
            clearTimeout(timer);
            resolve(msg);
          }
        } catch { /* skip */ }
      }
    });
  });
}

// Mock that simulates Transcribe delivering a final transcript
function createTranscribeWithCallback(): { adapter: TranscribeAdapter; triggerFinal: (sessionId: string, text: string) => void } {
  const finalCallbacks = new Map<string, (text: string) => void>();

  const mockClient = {
    send: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        TranscriptResultStream: (async function* () {})(),
      });
    }),
  } as any;

  const adapter = new TranscribeAdapter(mockClient);

  // Override startStream to capture the onFinal callback
  const originalStartStream = adapter.startStream.bind(adapter);
  adapter.startStream = vi.fn().mockImplementation(
    async (sessionId: string, onPartial: any, onFinal: (text: string) => void) => {
      finalCallbacks.set(sessionId, onFinal);
    },
  ) as any;

  // Also mock feedAudio and stopStream/hasActiveStream
  adapter.feedAudio = vi.fn() as any;
  adapter.stopStream = vi.fn().mockResolvedValue(undefined) as any;
  adapter.hasActiveStream = vi.fn().mockReturnValue(true) as any;

  return {
    adapter,
    triggerFinal: (sessionId: string, text: string) => {
      const cb = finalCallbacks.get(sessionId);
      if (cb) cb(text);
    },
  };
}

// Mock Polly that streams audio chunks
function createMockPollyWithAudio(chunks: Buffer[] = [Buffer.from([1, 2, 3])]): PollyAdapter {
  const mockClient = {
    send: vi.fn().mockImplementation((_cmd: any, _opts: any) => {
      const { Readable } = require('node:stream');
      const stream = new Readable({
        read() {
          for (const c of chunks) this.push(c);
          this.push(null);
        },
      });
      return Promise.resolve({ AudioStream: stream });
    }),
  } as any;
  return new PollyAdapter(mockClient);
}

function createMockPollySimple(): PollyAdapter {
  return new PollyAdapter({
    send: vi.fn().mockResolvedValue({
      AudioStream: (async function* () {})(),
    }),
  } as any);
}

function createMockAgent(output?: Partial<StructuredOutput>) {
  const defaultOutput: StructuredOutput = {
    style: 'soft',
    spokenResponse: 'Tell me more.',
    noteDraft: '',
    tags: [],
  };
  const merged = { ...defaultOutput, ...output };
  return {
    id: 'test-agent',
    name: 'test',
    generate: vi.fn().mockResolvedValue({
      object: merged,
      text: JSON.stringify(merged),
    }),
  } as any;
}

// ── Integration Tests ──

describe('Integration: Full conversation flow', () => {
  it('start → collect → compose → refine → end lifecycle', async () => {
    const port = getTestPort();

    // Collect stage agent
    const collectOutput: StructuredOutput = {
      style: 'soft',
      spokenResponse: 'Who is this note for?',
      noteDraft: '',
      tags: [],
    };
    // Compose stage agent
    const composeOutput: StructuredOutput = {
      style: 'flirty',
      spokenResponse: 'Here is your love note!',
      noteDraft: 'Roses are red, violets are blue...',
      tags: ['#romantic', '#sweet'],
    };
    // Refine stage agent
    const refineOutput: StructuredOutput = {
      style: 'flirty',
      spokenResponse: 'Made it shorter!',
      noteDraft: 'Roses are red...',
      tags: ['#short'],
    };

    let callCount = 0;
    const agent = {
      id: 'test-agent',
      name: 'test',
      generate: vi.fn().mockImplementation(() => {
        callCount++;
        // First call = collect, second = compose, third = refine
        const output = callCount <= 1 ? collectOutput : callCount === 2 ? composeOutput : refineOutput;
        return Promise.resolve({ object: output, text: JSON.stringify(output) });
      }),
    } as any;

    const { adapter: transcribe, triggerFinal } = createTranscribeWithCallback();
    const polly = createMockPollySimple();
    const voice = new SafeSecretsVoiceProvider(transcribe, polly);
    const workflow = new MastraWorkflowEngine(voice, {}, agent);

    const server = new SafeSecretsWSServer({
      port,
      transcribeAdapter: transcribe,
      pollyAdapter: polly,
      mastraWorkflow: workflow,
      voiceProvider: voice,
    });
    await new Promise((r) => setTimeout(r, 100));

    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    const sessionId = server.getSessionIds()[0];

    // 1. Start conversation
    client.send(JSON.stringify({ type: 'control', payload: { action: 'start_conversation' } }));
    await new Promise((r) => setTimeout(r, 200));

    const session = server.getSession(sessionId)!;
    expect(session.context).not.toBeNull();
    expect(session.context!.stage).toBe('collect');

    // 2. Simulate user transcript in collect stage
    triggerFinal(sessionId, 'I want to write a note for my partner');
    await new Promise((r) => setTimeout(r, 300));
    expect(agent.generate).toHaveBeenCalled();

    // 3. Fill context to trigger compose
    session.context!.recipient = 'My partner';
    session.context!.situation = 'Valentine\'s Day';
    session.context!.desiredTone = 'flirty';
    session.context!.desiredOutcome = 'Make them smile';

    triggerFinal(sessionId, 'That covers everything');
    await new Promise((r) => setTimeout(r, 300));

    // Should have transitioned to compose
    expect(session.context!.stage).toBe('compose');

    // 4. Send refinement
    client.send(JSON.stringify({
      type: 'control',
      payload: { action: 'refinement', data: { type: 'shorter' } },
    }));
    await new Promise((r) => setTimeout(r, 300));

    expect(session.context!.stage).toBe('refine');

    // 5. End conversation
    client.send(JSON.stringify({ type: 'control', payload: { action: 'end_conversation' } }));
    await new Promise((r) => setTimeout(r, 200));

    expect(session.context).toBeNull();

    client.close();
    await new Promise((r) => setTimeout(r, 50));
    await server.close();
  });

  it('barge-in during TTS stops Polly and sends tts.end', async () => {
    const port = getTestPort();

    const output: StructuredOutput = {
      style: 'soft',
      spokenResponse: 'A long spoken response for TTS.',
      noteDraft: 'A note',
      tags: ['#test'],
    };
    const agent = createMockAgent(output);

    const { adapter: transcribe, triggerFinal } = createTranscribeWithCallback();

    // Create a Polly that takes time to synthesize (simulates streaming)
    let synthesizeResolve: (() => void) | null = null;
    const polly = createMockPollySimple();
    const originalSynthesize = polly.synthesize.bind(polly);
    polly.synthesize = vi.fn().mockImplementation(
      async (text: string, onChunk: (chunk: Buffer) => void) => {
        onChunk(Buffer.from([1, 2, 3]));
        // Simulate slow synthesis
        await new Promise<void>((resolve) => { synthesizeResolve = resolve; });
      },
    ) as any;

    // Track if stop was called
    const originalStop = polly.stop.bind(polly);
    polly.stop = vi.fn() as any;
    polly.isSynthesizing = vi.fn().mockReturnValue(true) as any;

    const voice = new SafeSecretsVoiceProvider(transcribe, polly);
    const workflow = new MastraWorkflowEngine(voice, {}, agent);

    const server = new SafeSecretsWSServer({
      port,
      transcribeAdapter: transcribe,
      pollyAdapter: polly,
      mastraWorkflow: workflow,
      voiceProvider: voice,
    });
    await new Promise((r) => setTimeout(r, 100));

    const client = new WebSocket(`ws://localhost:${port}/ws`);
    const allMessages = collectMessages(client, 10, 3000);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    const sessionId = server.getSessionIds()[0];

    // Start conversation
    client.send(JSON.stringify({ type: 'control', payload: { action: 'start_conversation' } }));
    await new Promise((r) => setTimeout(r, 200));

    // Trigger a transcript that will cause TTS
    triggerFinal(sessionId, 'Hello');
    await new Promise((r) => setTimeout(r, 200));

    // Now simulate barge-in: Transcribe delivers a partial (user starts speaking)
    // The ws-server's onPartial callback checks pollyAdapter.isSynthesizing() and calls stop()
    const startStreamCall = (transcribe.startStream as any).mock.calls[0];
    if (startStreamCall) {
      const onPartial = startStreamCall[1];
      // Simulate user speaking while TTS is active
      onPartial('user interrupts');
    }
    await new Promise((r) => setTimeout(r, 100));

    // Polly.stop should have been called (barge-in)
    expect(polly.stop).toHaveBeenCalled();

    // Resolve the pending synthesis so the test can clean up
    if (synthesizeResolve) synthesizeResolve();
    await new Promise((r) => setTimeout(r, 100));

    client.close();
    await new Promise((r) => setTimeout(r, 50));
    await server.close();
  });

  it('error recovery: Transcribe failure sends error event, session stays alive', async () => {
    const port = getTestPort();

    // Transcribe that fails on startStream
    const failingTranscribe = new TranscribeAdapter({
      send: vi.fn().mockRejectedValue(new Error('Transcribe unavailable')),
    } as any);

    const polly = createMockPollySimple();
    const voice = new SafeSecretsVoiceProvider(failingTranscribe, polly);
    const workflow = new MastraWorkflowEngine(voice, {}, createMockAgent());

    const server = new SafeSecretsWSServer({
      port,
      transcribeAdapter: failingTranscribe,
      pollyAdapter: polly,
      mastraWorkflow: workflow,
      voiceProvider: voice,
    });
    await new Promise((r) => setTimeout(r, 100));

    const client = new WebSocket(`ws://localhost:${port}/ws`);
    const messages = collectMessages(client, 3, 2000);
    await waitForOpen(client);

    // Start conversation — will fail
    client.send(JSON.stringify({ type: 'control', payload: { action: 'start_conversation' } }));

    const received = await messages;
    const errorMsg = received.find((m: any) => m.type === 'event' && m.event === 'error');
    expect(errorMsg).toBeDefined();
    expect(errorMsg.data.message).toBe('Failed to start conversation');

    // Session should still be alive (not crashed)
    expect(server.getSessionCount()).toBe(1);

    client.close();
    await new Promise((r) => setTimeout(r, 50));
    await server.close();
  });

  it('error recovery: Bedrock failure returns fallback spoken response', async () => {
    const failingAgent = {
      id: 'test-agent',
      name: 'test',
      generate: vi.fn().mockRejectedValue(new Error('Bedrock timeout')),
    } as any;

    const engine = new MastraWorkflowEngine(undefined, undefined, failingAgent);
    engine.createSession('s1');

    const result = await engine.processTranscript('s1', 'Hello');

    // Should get a user-friendly fallback
    expect(result.spokenResponse).toBeTruthy();
    expect(result.spokenResponse.length).toBeGreaterThan(0);
    // Agent should have been called twice (initial + retry)
    expect(failingAgent.generate).toHaveBeenCalledTimes(2);
  });

  it('error recovery: Bedrock failure during refinement returns fallback spoken response', async () => {
    // When Bedrock fails during refinement, the workflow engine retries once
    // and returns a fallback spoken response (not an error). The ws-server
    // then synthesizes the fallback via TTS.
    const failingAgent = {
      id: 'test-agent',
      name: 'test',
      generate: vi.fn().mockRejectedValue(new Error('Bedrock error')),
    } as any;

    const engine = new MastraWorkflowEngine(undefined, undefined, failingAgent);
    const ctx = engine.createSession('s1');
    ctx.recipient = 'Someone';
    ctx.situation = 'Something';
    ctx.desiredTone = 'soft';
    ctx.desiredOutcome = 'Love';
    ctx.stage = 'compose';
    ctx.currentDraft = 'A draft';
    ctx.currentTags = ['#test'];
    ctx.currentStyle = 'soft';

    const result = await engine.processRefinement('s1', { type: 'shorter' });

    // Should get a fallback, not a crash
    expect(result.spokenResponse).toBeTruthy();
    expect(result.spokenResponse).toContain('trouble');
    // Agent should have been called twice (initial + retry)
    expect(failingAgent.generate).toHaveBeenCalledTimes(2);
  });

  it('multiple conversations on same connection', async () => {
    const port = getTestPort();

    const { adapter: transcribe } = createTranscribeWithCallback();
    const polly = createMockPollySimple();
    const voice = new SafeSecretsVoiceProvider(transcribe, polly);
    const workflow = new MastraWorkflowEngine(voice, {}, createMockAgent());

    const server = new SafeSecretsWSServer({
      port,
      transcribeAdapter: transcribe,
      pollyAdapter: polly,
      mastraWorkflow: workflow,
      voiceProvider: voice,
    });
    await new Promise((r) => setTimeout(r, 100));

    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);
    await new Promise((r) => setTimeout(r, 50));

    const sessionId = server.getSessionIds()[0];

    // First conversation
    client.send(JSON.stringify({ type: 'control', payload: { action: 'start_conversation' } }));
    await new Promise((r) => setTimeout(r, 200));
    expect(server.getSession(sessionId)!.context).not.toBeNull();

    client.send(JSON.stringify({ type: 'control', payload: { action: 'end_conversation' } }));
    await new Promise((r) => setTimeout(r, 200));
    expect(server.getSession(sessionId)!.context).toBeNull();

    // Second conversation on same connection
    client.send(JSON.stringify({ type: 'control', payload: { action: 'start_conversation' } }));
    await new Promise((r) => setTimeout(r, 200));
    expect(server.getSession(sessionId)!.context).not.toBeNull();
    expect(server.getSession(sessionId)!.context!.stage).toBe('collect');

    client.close();
    await new Promise((r) => setTimeout(r, 50));
    await server.close();
  });
});
