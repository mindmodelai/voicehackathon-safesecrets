import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import { SafeSecretsVoiceProvider } from './custom-voice-provider.js';
import { MastraVoice } from '@mastra/core/voice';

// ── Helpers ──

/**
 * Creates a Readable stream from an array of Buffer chunks.
 */
function readableFromChunks(chunks: Buffer[]): Readable {
  let i = 0;
  return new Readable({
    read() {
      if (i < chunks.length) {
        this.push(chunks[i++]);
      } else {
        this.push(null);
      }
    },
  });
}

/**
 * Creates a Readable stream from a string.
 */
function readableFromString(text: string): Readable {
  return readableFromChunks([Buffer.from(text, 'utf-8')]);
}

/**
 * Collects all chunks from a readable stream into a single Buffer.
 */
async function collectStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Builds a mock TranscribeAdapter.
 */
function buildMockTranscribe(finalText = 'hello world') {
  let onFinalCb: ((t: string) => void) | null = null;
  return {
    startStream: vi.fn().mockImplementation(
      async (_sid: string, _onPartial: any, onFinal: (t: string) => void) => {
        onFinalCb = onFinal;
      },
    ),
    feedAudio: vi.fn().mockImplementation(() => {
      // Deliver the final transcript when audio is fed (simulates real behavior)
      if (onFinalCb) {
        onFinalCb(finalText);
        onFinalCb = null;
      }
    }),
    stopStream: vi.fn().mockResolvedValue(undefined),
    getRegion: vi.fn().mockReturnValue('ca-central-1'),
    hasActiveStream: vi.fn().mockReturnValue(false),
  } as any;
}

/**
 * Builds a mock PollyAdapter.
 */
function buildMockPolly(audioChunks: Buffer[] = [Buffer.from([1, 2, 3])]) {
  return {
    synthesize: vi.fn().mockImplementation(
      async (_text: string, onChunk: (chunk: Buffer) => void) => {
        for (const chunk of audioChunks) {
          onChunk(chunk);
        }
      },
    ),
    stop: vi.fn(),
    getVoiceId: vi.fn().mockReturnValue('Joanna'),
    getRegion: vi.fn().mockReturnValue('ca-central-1'),
    isSynthesizing: vi.fn().mockReturnValue(false),
  } as any;
}

// ── Tests ──

describe('SafeSecretsVoiceProvider', () => {
  describe('class hierarchy', () => {
    it('should extend MastraVoice', () => {
      const provider = new SafeSecretsVoiceProvider(
        buildMockTranscribe(),
        buildMockPolly(),
      );
      expect(provider).toBeInstanceOf(MastraVoice);
    });
  });

  describe('region configuration', () => {
    it('should report ca-central-1 as the pinned region', () => {
      const provider = new SafeSecretsVoiceProvider(
        buildMockTranscribe(),
        buildMockPolly(),
      );
      expect(provider.getRegion()).toBe('ca-central-1');
    });
  });

  describe('listen() — STT via Transcribe', () => {
    it('should start a Transcribe stream and return the final transcript', async () => {
      const transcribe = buildMockTranscribe('I love you');
      const provider = new SafeSecretsVoiceProvider(transcribe, buildMockPolly());

      const audioStream = readableFromChunks([
        Buffer.alloc(320, 0xaa),
        Buffer.alloc(320, 0xbb),
      ]);

      const result = await provider.listen(audioStream);

      expect(result).toBe('I love you');
      expect(transcribe.startStream).toHaveBeenCalledTimes(1);
      expect(transcribe.feedAudio).toHaveBeenCalledTimes(2);
      expect(transcribe.stopStream).toHaveBeenCalledTimes(1);
    });

    it('should feed each audio chunk with correct format', async () => {
      const transcribe = buildMockTranscribe();
      const provider = new SafeSecretsVoiceProvider(transcribe, buildMockPolly());

      const chunk = Buffer.alloc(160, 0xcc);
      const audioStream = readableFromChunks([chunk]);

      await provider.listen(audioStream);

      expect(transcribe.feedAudio).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          data: chunk,
          sampleRate: 16_000,
          encoding: 'pcm',
        }),
      );
    });

    it('should stop the Transcribe stream even if feeding throws', async () => {
      const transcribe = buildMockTranscribe();
      transcribe.feedAudio.mockImplementation(() => {
        throw new Error('feed error');
      });
      const provider = new SafeSecretsVoiceProvider(transcribe, buildMockPolly());

      const audioStream = readableFromChunks([Buffer.alloc(100)]);

      await expect(provider.listen(audioStream)).rejects.toThrow('feed error');
      expect(transcribe.stopStream).toHaveBeenCalledTimes(1);
    });

    it('should throw if input is not a readable stream', async () => {
      const provider = new SafeSecretsVoiceProvider(
        buildMockTranscribe(),
        buildMockPolly(),
      );

      await expect(provider.listen('not a stream' as any)).rejects.toThrow(
        'listen() requires a ReadableStream',
      );
    });

    it('should handle empty audio stream', async () => {
      const transcribe = buildMockTranscribe('');
      const provider = new SafeSecretsVoiceProvider(transcribe, buildMockPolly());

      const audioStream = readableFromChunks([]);
      const result = await provider.listen(audioStream);

      expect(result).toBe('');
      expect(transcribe.feedAudio).not.toHaveBeenCalled();
      expect(transcribe.stopStream).toHaveBeenCalledTimes(1);
    });
  });

  describe('speak() — TTS via Polly', () => {
    it('should synthesize text and return a readable audio stream', async () => {
      const audioData = Buffer.from([10, 20, 30, 40, 50]);
      const polly = buildMockPolly([audioData]);
      const provider = new SafeSecretsVoiceProvider(buildMockTranscribe(), polly);

      const stream = await provider.speak('Hello darling');
      const output = await collectStream(stream!);

      expect(polly.synthesize).toHaveBeenCalledWith('Hello darling', expect.any(Function));
      expect(output).toEqual(audioData);
    });

    it('should handle multiple audio chunks from Polly', async () => {
      const chunk1 = Buffer.from([1, 2, 3]);
      const chunk2 = Buffer.from([4, 5, 6]);
      const polly = buildMockPolly([chunk1, chunk2]);
      const provider = new SafeSecretsVoiceProvider(buildMockTranscribe(), polly);

      const stream = await provider.speak('test');
      const output = await collectStream(stream!);

      expect(output).toEqual(Buffer.concat([chunk1, chunk2]));
    });

    it('should accept a ReadableStream input and convert to string', async () => {
      const polly = buildMockPolly([Buffer.from([7, 8, 9])]);
      const provider = new SafeSecretsVoiceProvider(buildMockTranscribe(), polly);

      const textStream = readableFromString('stream input text');
      const stream = await provider.speak(textStream);
      await collectStream(stream!);

      expect(polly.synthesize).toHaveBeenCalledWith('stream input text', expect.any(Function));
    });

    it('should propagate Polly errors through the stream', async () => {
      const polly = buildMockPolly();
      polly.synthesize.mockRejectedValue(new Error('Polly failure'));
      const provider = new SafeSecretsVoiceProvider(buildMockTranscribe(), polly);

      const stream = await provider.speak('test');

      await expect(collectStream(stream!)).rejects.toThrow('Polly failure');
    });
  });

  describe('stopSpeaking() — barge-in', () => {
    it('should delegate to PollyAdapter.stop()', () => {
      const polly = buildMockPolly();
      const provider = new SafeSecretsVoiceProvider(buildMockTranscribe(), polly);

      provider.stopSpeaking();

      expect(polly.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSpeakers()', () => {
    it('should return the Polly voice ID', async () => {
      const polly = buildMockPolly();
      polly.getVoiceId.mockReturnValue('Ruth');
      const provider = new SafeSecretsVoiceProvider(buildMockTranscribe(), polly);

      const speakers = await provider.getSpeakers();
      expect(speakers).toEqual([{ voiceId: 'Ruth' }]);
    });
  });

  describe('getListener()', () => {
    it('should report listening as enabled', async () => {
      const provider = new SafeSecretsVoiceProvider(
        buildMockTranscribe(),
        buildMockPolly(),
      );
      const listener = await provider.getListener();
      expect(listener).toEqual({ enabled: true });
    });
  });

  describe('adapter accessors', () => {
    it('should expose the TranscribeAdapter', () => {
      const transcribe = buildMockTranscribe();
      const provider = new SafeSecretsVoiceProvider(transcribe, buildMockPolly());
      expect(provider.getTranscribeAdapter()).toBe(transcribe);
    });

    it('should expose the PollyAdapter', () => {
      const polly = buildMockPolly();
      const provider = new SafeSecretsVoiceProvider(buildMockTranscribe(), polly);
      expect(provider.getPollyAdapter()).toBe(polly);
    });
  });
});
