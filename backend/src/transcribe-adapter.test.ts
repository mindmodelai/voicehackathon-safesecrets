import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranscribeAdapter, type AudioChunk } from './transcribe-adapter.js';

// ── Helpers ──

function makeChunk(bytes: number[] = [0, 1, 2, 3], sampleRate = 16_000): AudioChunk {
  return { data: Buffer.from(bytes), sampleRate, encoding: 'pcm' };
}

/**
 * Builds a mock TranscribeStreamingClient whose `send()` resolves with
 * a fake TranscriptResultStream async iterable that yields the given events.
 */
function buildMockClient(events: any[] = []) {
  async function* fakeResultStream() {
    for (const e of events) {
      yield e;
    }
  }

  const send = vi.fn().mockResolvedValue({
    TranscriptResultStream: fakeResultStream(),
  });

  // The adapter only calls `send`, so a minimal mock suffices.
  return { send } as any;
}

function buildErrorClient(error: Error) {
  const send = vi.fn().mockRejectedValue(error);
  return { send } as any;
}

function buildStreamErrorClient(events: any[], error: Error) {
  async function* fakeResultStream() {
    for (const e of events) {
      yield e;
    }
    throw error;
  }

  const send = vi.fn().mockResolvedValue({
    TranscriptResultStream: fakeResultStream(),
  });
  return { send } as any;
}

// ── Tests ──

describe('TranscribeAdapter', () => {
  describe('region configuration', () => {
    it('should report ca-central-1 as the pinned region', () => {
      const adapter = new TranscribeAdapter(buildMockClient());
      expect(adapter.getRegion()).toBe('ca-central-1');
    });
  });

  describe('startStream', () => {
    it('should start a stream and track the session', async () => {
      const adapter = new TranscribeAdapter(buildMockClient());
      await adapter.startStream('s1', vi.fn(), vi.fn());
      expect(adapter.hasActiveStream('s1')).toBe(true);
    });

    it('should throw if a stream is already active for the session', async () => {
      const adapter = new TranscribeAdapter(buildMockClient());
      await adapter.startStream('s1', vi.fn(), vi.fn());
      await expect(adapter.startStream('s1', vi.fn(), vi.fn())).rejects.toThrow(
        'Stream already active for session s1',
      );
    });

    it('should call send on the client with correct parameters', async () => {
      const mockClient = buildMockClient();
      const adapter = new TranscribeAdapter(mockClient);
      await adapter.startStream('s1', vi.fn(), vi.fn());

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      const command = mockClient.send.mock.calls[0][0];
      expect(command.input.LanguageCode).toBe('en-US');
      expect(command.input.MediaEncoding).toBe('pcm');
      expect(command.input.MediaSampleRateHertz).toBe(16_000);
    });

    it('should propagate client errors and clean up the session', async () => {
      const err = new Error('Transcribe unavailable');
      const adapter = new TranscribeAdapter(buildErrorClient(err));

      await expect(adapter.startStream('s1', vi.fn(), vi.fn())).rejects.toThrow(
        'Transcribe unavailable',
      );
      expect(adapter.hasActiveStream('s1')).toBe(false);
    });

    it('should throw if TranscriptResultStream is missing', async () => {
      const mockClient = { send: vi.fn().mockResolvedValue({}) } as any;
      const adapter = new TranscribeAdapter(mockClient);

      await expect(adapter.startStream('s1', vi.fn(), vi.fn())).rejects.toThrow(
        'No TranscriptResultStream in response',
      );
    });
  });

  describe('transcript callbacks', () => {
    it('should call onPartial for partial results', async () => {
      const events = [
        {
          TranscriptEvent: {
            Transcript: {
              Results: [
                {
                  IsPartial: true,
                  Alternatives: [{ Transcript: 'hello' }],
                },
              ],
            },
          },
        },
      ];

      const onPartial = vi.fn();
      const onFinal = vi.fn();
      const adapter = new TranscribeAdapter(buildMockClient(events));
      await adapter.startStream('s1', onPartial, onFinal);

      // Give the background async loop time to process.
      await new Promise((r) => setTimeout(r, 50));

      expect(onPartial).toHaveBeenCalledWith('hello');
      expect(onFinal).not.toHaveBeenCalled();
    });

    it('should call onFinal for final results', async () => {
      const events = [
        {
          TranscriptEvent: {
            Transcript: {
              Results: [
                {
                  IsPartial: false,
                  Alternatives: [{ Transcript: 'hello world' }],
                },
              ],
            },
          },
        },
      ];

      const onPartial = vi.fn();
      const onFinal = vi.fn();
      const adapter = new TranscribeAdapter(buildMockClient(events));
      await adapter.startStream('s1', onPartial, onFinal);

      await new Promise((r) => setTimeout(r, 50));

      expect(onFinal).toHaveBeenCalledWith('hello world');
      expect(onPartial).not.toHaveBeenCalled();
    });

    it('should handle multiple results in sequence', async () => {
      const events = [
        {
          TranscriptEvent: {
            Transcript: {
              Results: [
                { IsPartial: true, Alternatives: [{ Transcript: 'hel' }] },
              ],
            },
          },
        },
        {
          TranscriptEvent: {
            Transcript: {
              Results: [
                { IsPartial: true, Alternatives: [{ Transcript: 'hello' }] },
              ],
            },
          },
        },
        {
          TranscriptEvent: {
            Transcript: {
              Results: [
                { IsPartial: false, Alternatives: [{ Transcript: 'hello world' }] },
              ],
            },
          },
        },
      ];

      const onPartial = vi.fn();
      const onFinal = vi.fn();
      const adapter = new TranscribeAdapter(buildMockClient(events));
      await adapter.startStream('s1', onPartial, onFinal);

      await new Promise((r) => setTimeout(r, 50));

      expect(onPartial).toHaveBeenCalledTimes(2);
      expect(onPartial).toHaveBeenCalledWith('hel');
      expect(onPartial).toHaveBeenCalledWith('hello');
      expect(onFinal).toHaveBeenCalledTimes(1);
      expect(onFinal).toHaveBeenCalledWith('hello world');
    });

    it('should skip results with empty transcript', async () => {
      const events = [
        {
          TranscriptEvent: {
            Transcript: {
              Results: [
                { IsPartial: true, Alternatives: [{ Transcript: '' }] },
              ],
            },
          },
        },
      ];

      const onPartial = vi.fn();
      const onFinal = vi.fn();
      const adapter = new TranscribeAdapter(buildMockClient(events));
      await adapter.startStream('s1', onPartial, onFinal);

      await new Promise((r) => setTimeout(r, 50));

      expect(onPartial).not.toHaveBeenCalled();
      expect(onFinal).not.toHaveBeenCalled();
    });
  });

  describe('feedAudio', () => {
    it('should accept audio chunks for an active session', async () => {
      const adapter = new TranscribeAdapter(buildMockClient());
      await adapter.startStream('s1', vi.fn(), vi.fn());

      // Should not throw.
      expect(() => adapter.feedAudio('s1', makeChunk())).not.toThrow();
    });

    it('should throw if no active stream exists', () => {
      const adapter = new TranscribeAdapter(buildMockClient());
      expect(() => adapter.feedAudio('s1', makeChunk())).toThrow(
        'No active stream for session s1',
      );
    });

    it('should throw if the stream has been stopped', async () => {
      const adapter = new TranscribeAdapter(buildMockClient());
      await adapter.startStream('s1', vi.fn(), vi.fn());
      await adapter.stopStream('s1');

      expect(() => adapter.feedAudio('s1', makeChunk())).toThrow(
        'No active stream for session s1',
      );
    });
  });

  describe('stopStream', () => {
    it('should stop and clean up the session', async () => {
      const adapter = new TranscribeAdapter(buildMockClient());
      await adapter.startStream('s1', vi.fn(), vi.fn());
      expect(adapter.hasActiveStream('s1')).toBe(true);

      await adapter.stopStream('s1');
      expect(adapter.hasActiveStream('s1')).toBe(false);
    });

    it('should throw if no stream exists for the session', async () => {
      const adapter = new TranscribeAdapter(buildMockClient());
      await expect(adapter.stopStream('s1')).rejects.toThrow(
        'No active stream for session s1',
      );
    });

    it('should allow starting a new stream after stopping', async () => {
      const adapter = new TranscribeAdapter(buildMockClient());
      await adapter.startStream('s1', vi.fn(), vi.fn());
      await adapter.stopStream('s1');
      await adapter.startStream('s1', vi.fn(), vi.fn());
      expect(adapter.hasActiveStream('s1')).toBe(true);
    });
  });

  describe('multiple sessions', () => {
    it('should manage independent sessions', async () => {
      const adapter = new TranscribeAdapter(buildMockClient());
      await adapter.startStream('s1', vi.fn(), vi.fn());
      await adapter.startStream('s2', vi.fn(), vi.fn());

      expect(adapter.hasActiveStream('s1')).toBe(true);
      expect(adapter.hasActiveStream('s2')).toBe(true);

      await adapter.stopStream('s1');
      expect(adapter.hasActiveStream('s1')).toBe(false);
      expect(adapter.hasActiveStream('s2')).toBe(true);
    });
  });
});
