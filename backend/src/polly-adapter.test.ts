import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PollyAdapter } from './polly-adapter.js';
import { Readable } from 'node:stream';

// ── Helpers ──

/**
 * Creates a Node.js Readable stream from an array of Buffer chunks.
 */
function createReadableFromChunks(chunks: Buffer[]): Readable {
  let index = 0;
  return new Readable({
    read() {
      if (index < chunks.length) {
        this.push(chunks[index]);
        index++;
      } else {
        this.push(null);
      }
    },
  });
}

/**
 * Creates a slow Readable that yields chunks with a delay,
 * useful for testing cancellation mid-stream.
 */
function createSlowReadable(chunks: Buffer[], delayMs: number): Readable {
  let index = 0;
  return new Readable({
    read() {
      if (index < chunks.length) {
        const chunk = chunks[index];
        index++;
        setTimeout(() => this.push(chunk), delayMs);
      } else {
        setTimeout(() => this.push(null), delayMs);
      }
    },
  });
}

/**
 * Builds a mock PollyClient whose `send()` resolves with a fake AudioStream.
 */
function buildMockClient(audioChunks: Buffer[]) {
  const stream = createReadableFromChunks(audioChunks);
  const send = vi.fn().mockResolvedValue({ AudioStream: stream });
  return { send } as any;
}

/**
 * Builds a mock PollyClient with a slow stream for cancellation testing.
 */
function buildSlowMockClient(audioChunks: Buffer[], delayMs: number) {
  const stream = createSlowReadable(audioChunks, delayMs);
  const send = vi.fn().mockResolvedValue({ AudioStream: stream });
  return { send } as any;
}

/** Client whose send() rejects with an error. */
function buildErrorClient(error: Error) {
  const send = vi.fn().mockRejectedValue(error);
  return { send } as any;
}

/** Client that returns no AudioStream. */
function buildNoStreamClient() {
  const send = vi.fn().mockResolvedValue({});
  return { send } as any;
}

// ── Tests ──

describe('PollyAdapter', () => {
  describe('region configuration', () => {
    it('should report ca-central-1 as the pinned region', () => {
      const adapter = new PollyAdapter(buildMockClient([]));
      expect(adapter.getRegion()).toBe('ca-central-1');
    });
  });

  describe('voice configuration', () => {
    it('should use the provided voice ID', () => {
      const adapter = new PollyAdapter(buildMockClient([]), 'Ruth');
      expect(adapter.getVoiceId()).toBe('Ruth');
    });

    it('should default to Joanna when no voice ID provided', () => {
      const adapter = new PollyAdapter(buildMockClient([]));
      expect(adapter.getVoiceId()).toBe('Joanna');
    });
  });

  describe('synthesize', () => {
    it('should call Polly with correct parameters', async () => {
      const client = buildMockClient([Buffer.from([1, 2, 3])]);
      const adapter = new PollyAdapter(client, 'Ruth');

      await adapter.synthesize('Hello world', vi.fn());

      expect(client.send).toHaveBeenCalledTimes(1);
      const command = client.send.mock.calls[0][0];
      expect(command.input.Engine).toBe('neural');
      expect(command.input.OutputFormat).toBe('pcm');
      expect(command.input.SampleRate).toBe('16000');
      expect(command.input.Text).toBe('Hello world');
      expect(command.input.TextType).toBe('text');
      expect(command.input.VoiceId).toBe('Ruth');
    });

    it('should pass an abort signal to the client', async () => {
      const client = buildMockClient([Buffer.from([1, 2, 3])]);
      const adapter = new PollyAdapter(client);

      await adapter.synthesize('test', vi.fn());

      expect(client.send).toHaveBeenCalledTimes(1);
      const options = client.send.mock.calls[0][1];
      expect(options).toBeDefined();
      expect(options.abortSignal).toBeDefined();
    });

    it('should stream audio chunks via the callback', async () => {
      const chunk1 = Buffer.alloc(100, 0xaa);
      const chunk2 = Buffer.alloc(100, 0xbb);
      const client = buildMockClient([chunk1, chunk2]);
      const adapter = new PollyAdapter(client);

      const receivedChunks: Buffer[] = [];
      await adapter.synthesize('test', (chunk) => receivedChunks.push(chunk));

      expect(receivedChunks.length).toBeGreaterThanOrEqual(2);
      const combined = Buffer.concat(receivedChunks);
      expect(combined).toEqual(Buffer.concat([chunk1, chunk2]));
    });

    it('should split large chunks into fixed-size pieces', async () => {
      // Create a chunk larger than the 4096 chunk size
      const largeChunk = Buffer.alloc(10000, 0xcc);
      const client = buildMockClient([largeChunk]);
      const adapter = new PollyAdapter(client);

      const receivedChunks: Buffer[] = [];
      await adapter.synthesize('test', (chunk) => receivedChunks.push(chunk));

      // Should be split into 3 chunks: 4096 + 4096 + 1808
      expect(receivedChunks.length).toBe(3);
      expect(receivedChunks[0].length).toBe(4096);
      expect(receivedChunks[1].length).toBe(4096);
      expect(receivedChunks[2].length).toBe(10000 - 4096 - 4096);
      expect(Buffer.concat(receivedChunks)).toEqual(largeChunk);
    });

    it('should handle empty audio stream', async () => {
      const client = buildMockClient([]);
      const adapter = new PollyAdapter(client);

      const receivedChunks: Buffer[] = [];
      await adapter.synthesize('test', (chunk) => receivedChunks.push(chunk));

      expect(receivedChunks).toHaveLength(0);
    });

    it('should throw if AudioStream is missing from response', async () => {
      const client = buildNoStreamClient();
      const adapter = new PollyAdapter(client);

      await expect(adapter.synthesize('test', vi.fn())).rejects.toThrow(
        'No AudioStream in Polly response',
      );
    });

    it('should propagate SDK errors', async () => {
      const client = buildErrorClient(new Error('Polly service unavailable'));
      const adapter = new PollyAdapter(client);

      await expect(adapter.synthesize('test', vi.fn())).rejects.toThrow(
        'Polly service unavailable',
      );
    });

    it('should track synthesizing state during synthesis', async () => {
      const chunk = Buffer.alloc(100, 0xdd);
      const client = buildSlowMockClient([chunk], 50);
      const adapter = new PollyAdapter(client);

      expect(adapter.isSynthesizing()).toBe(false);

      const promise = adapter.synthesize('test', vi.fn());

      // After starting, should be synthesizing
      // (need a small delay for the async operation to begin)
      await new Promise((r) => setTimeout(r, 10));
      expect(adapter.isSynthesizing()).toBe(true);

      await promise;
      expect(adapter.isSynthesizing()).toBe(false);
    });
  });

  describe('stop / cancellation', () => {
    it('should resolve silently when stop() is called during synthesis', async () => {
      const chunks = Array.from({ length: 10 }, () => Buffer.alloc(1000, 0xee));
      const client = buildSlowMockClient(chunks, 30);
      const adapter = new PollyAdapter(client);

      const receivedChunks: Buffer[] = [];
      const promise = adapter.synthesize('test', (chunk) => receivedChunks.push(chunk));

      // Let some chunks flow, then cancel
      await new Promise((r) => setTimeout(r, 80));
      adapter.stop();

      // Should resolve without throwing
      await promise;

      // Should have received fewer chunks than the total
      expect(receivedChunks.length).toBeLessThan(10);
    });

    it('should be a no-op when stop() is called with no active synthesis', () => {
      const adapter = new PollyAdapter(buildMockClient([]));
      // Should not throw
      expect(() => adapter.stop()).not.toThrow();
    });

    it('should clear synthesizing state after stop()', async () => {
      const chunks = Array.from({ length: 5 }, () => Buffer.alloc(1000, 0xff));
      const client = buildSlowMockClient(chunks, 50);
      const adapter = new PollyAdapter(client);

      const promise = adapter.synthesize('test', vi.fn());
      await new Promise((r) => setTimeout(r, 30));

      adapter.stop();
      await promise;

      expect(adapter.isSynthesizing()).toBe(false);
    });

    it('should handle stop() when send() itself is aborted', async () => {
      // Simulate abort during the send() call
      const abortError = new DOMException('The operation was aborted.', 'AbortError');
      const send = vi.fn().mockImplementation((_cmd: any, opts: any) => {
        return new Promise((_resolve, reject) => {
          if (opts?.abortSignal) {
            opts.abortSignal.addEventListener('abort', () => reject(abortError));
          }
        });
      });
      const client = { send } as any;
      const adapter = new PollyAdapter(client);

      const promise = adapter.synthesize('test', vi.fn());

      // Abort immediately
      adapter.stop();

      // Should resolve silently (not throw)
      await promise;
      expect(adapter.isSynthesizing()).toBe(false);
    });
  });

  describe('sequential synthesis calls', () => {
    it('should allow a new synthesis after the previous one completes', async () => {
      const chunk1 = Buffer.from([1, 2, 3]);
      const chunk2 = Buffer.from([4, 5, 6]);

      const client = {
        send: vi.fn()
          .mockResolvedValueOnce({ AudioStream: createReadableFromChunks([chunk1]) })
          .mockResolvedValueOnce({ AudioStream: createReadableFromChunks([chunk2]) }),
      } as any;

      const adapter = new PollyAdapter(client);

      const received1: Buffer[] = [];
      await adapter.synthesize('first', (c) => received1.push(c));

      const received2: Buffer[] = [];
      await adapter.synthesize('second', (c) => received2.push(c));

      expect(Buffer.concat(received1)).toEqual(chunk1);
      expect(Buffer.concat(received2)).toEqual(chunk2);
      expect(client.send).toHaveBeenCalledTimes(2);
    });

    it('should allow a new synthesis after stop()', async () => {
      const chunks = Array.from({ length: 5 }, () => Buffer.alloc(1000, 0xaa));
      const slowClient = buildSlowMockClient(chunks, 50);

      // Override send to return a fresh stream on second call
      const chunk2 = Buffer.from([7, 8, 9]);
      slowClient.send.mockResolvedValueOnce(
        { AudioStream: createSlowReadable(chunks, 50) },
      ).mockResolvedValueOnce(
        { AudioStream: createReadableFromChunks([chunk2]) },
      );

      const adapter = new PollyAdapter(slowClient);

      // Start and cancel first synthesis
      const promise1 = adapter.synthesize('first', vi.fn());
      await new Promise((r) => setTimeout(r, 30));
      adapter.stop();
      await promise1;

      // Second synthesis should work fine
      const received: Buffer[] = [];
      await adapter.synthesize('second', (c) => received.push(c));
      expect(Buffer.concat(received)).toEqual(chunk2);
    });
  });
});
