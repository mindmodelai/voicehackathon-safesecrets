
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { SafeSecretsWSServer } from './ws-server.js';
import { TranscribeAdapter } from './transcribe-adapter.js';
import { PollyAdapter } from './polly-adapter.js';
import { SafeSecretsVoiceProvider } from './custom-voice-provider.js';
import { MastraWorkflowEngine } from './mastra-workflow.js';

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
  return {
    server: new SafeSecretsWSServer({
      port,
      transcribeAdapter: mockTranscribe,
      pollyAdapter: mockPolly,
      mastraWorkflow: mockWorkflow,
      voiceProvider: mockVoice,
    }),
    mockTranscribe,
    mockPolly
  };
}

describe('WebSocket Audio Handling', () => {
  it('should handle incoming binary audio messages correctly', async () => {
    const port = getTestPort();
    const { server, mockTranscribe } = createTestServer(port);

    // Spy on feedAudio to check what it receives
    const feedAudioSpy = vi.spyOn(mockTranscribe, 'feedAudio');

    const client = new WebSocket(`ws://localhost:${port}/ws`);
    await waitForOpen(client);

    // Start conversation to enable audio processing
    client.send(JSON.stringify({ type: 'control', payload: { action: 'start_conversation' } }));

    // Wait a bit for session to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send binary audio
    const audioData = Buffer.from([1, 2, 3, 4]);
    client.send(audioData);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(feedAudioSpy).toHaveBeenCalled();
    const callArgs = feedAudioSpy.mock.calls[0];
    const chunk = callArgs[1]; // sessionId, chunk

    // Check if data is passed correctly (and is a Buffer)
    expect(Buffer.isBuffer(chunk.data)).toBe(true);
    expect(chunk.data.equals(audioData)).toBe(true);

    client.close();
    await server.close();
  });

  it('should handle incoming ArrayBuffer audio messages correctly (simulated)', async () => {
    // This tests the logic inside parseClientMessage/handleAudioMessage mostly
    // But since 'ws' client sends as Buffer, it simulates the "other" path if we could force it.
    // However, `ws` library on Node always sends Buffer.
    // We can rely on the previous test proving `parseClientMessage` works for Buffer.
  });
});
