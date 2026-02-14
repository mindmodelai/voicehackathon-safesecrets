import { MastraVoice } from '@mastra/core/voice';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { TranscribeAdapter } from './transcribe-adapter.js';
import { PollyAdapter } from './polly-adapter.js';
import type { AudioChunk } from './transcribe-adapter.js';

const REGION = 'ca-central-1';
const DEFAULT_SAMPLE_RATE = 16_000;

/**
 * Custom Mastra voice provider that wraps Amazon Transcribe (STT) and
 * Amazon Polly Neural (TTS), both pinned to ca-central-1.
 */
export class SafeSecretsVoiceProvider extends MastraVoice {
  private transcribeAdapter: TranscribeAdapter;
  private pollyAdapter: PollyAdapter;

  constructor(
    transcribeAdapter?: TranscribeAdapter,
    pollyAdapter?: PollyAdapter,
  ) {
    super({ name: 'SafeSecretsVoice' });
    this.transcribeAdapter = transcribeAdapter ?? new TranscribeAdapter();
    this.pollyAdapter = pollyAdapter ?? new PollyAdapter();
  }

  /**
   * Convert speech to text by streaming audio through Amazon Transcribe.
   * Accepts a Node.js ReadableStream of PCM audio data and returns the
   * final transcript string.
   */
  async listen(
    audioStream: NodeJS.ReadableStream | unknown,
    _options?: unknown,
  ): Promise<string> {
    if (!isReadableStream(audioStream)) {
      throw new Error('listen() requires a ReadableStream of audio data');
    }

    const sessionId = randomUUID();
    let finalTranscript = '';

    // Start the Transcribe stream and collect the final transcript.
    await this.transcribeAdapter.startStream(
      sessionId,
      () => {}, // partial transcripts — not needed for the voice provider contract
      (text: string) => {
        finalTranscript = text;
      },
    );

    try {
      // Feed audio chunks from the readable stream into Transcribe.
      for await (const chunk of audioStream as AsyncIterable<Buffer>) {
        const audioChunk: AudioChunk = {
          data: Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
          sampleRate: DEFAULT_SAMPLE_RATE,
          encoding: 'pcm',
        };
        this.transcribeAdapter.feedAudio(sessionId, audioChunk);
      }
    } finally {
      // Always stop the stream to clean up resources.
      await this.transcribeAdapter.stopStream(sessionId);
    }

    return finalTranscript;
  }

  /**
   * Convert text to speech using Amazon Polly Neural.
   * Returns a ReadableStream of PCM audio data.
   */
  async speak(
    input: string | NodeJS.ReadableStream,
    _options?: { speaker?: string },
  ): Promise<NodeJS.ReadableStream> {
    // If input is a stream, collect it into a string first.
    const text = typeof input === 'string' ? input : await streamToString(input);

    // Create a passthrough-style readable that receives Polly audio chunks.
    const audioChunks: Buffer[] = [];
    let streamDone = false;
    let resolveWaiting: (() => void) | null = null;

    const readable = new Readable({
      read() {
        if (audioChunks.length > 0) {
          this.push(audioChunks.shift()!);
        } else if (streamDone) {
          this.push(null);
        } else {
          // Wait for the next chunk or completion.
          resolveWaiting = () => {
            if (audioChunks.length > 0) {
              this.push(audioChunks.shift()!);
            } else if (streamDone) {
              this.push(null);
            }
            resolveWaiting = null;
          };
        }
      },
    });

    // Synthesize in the background, pushing chunks into the readable.
    this.pollyAdapter
      .synthesize(text, (chunk: Buffer) => {
        audioChunks.push(chunk);
        if (resolveWaiting) resolveWaiting();
      })
      .then(() => {
        streamDone = true;
        if (resolveWaiting) resolveWaiting();
      })
      .catch((err) => {
        streamDone = true;
        readable.destroy(err instanceof Error ? err : new Error(String(err)));
      });

    return readable;
  }

  /**
   * Returns the AWS region both adapters are pinned to.
   */
  getRegion(): string {
    return REGION;
  }

  /**
   * Returns the underlying TranscribeAdapter (useful for testing).
   */
  getTranscribeAdapter(): TranscribeAdapter {
    return this.transcribeAdapter;
  }

  /**
   * Returns the underlying PollyAdapter (useful for testing).
   */
  getPollyAdapter(): PollyAdapter {
    return this.pollyAdapter;
  }

  /**
   * Stops any in-progress TTS synthesis (barge-in support).
   */
  stopSpeaking(): void {
    this.pollyAdapter.stop();
  }

  async getSpeakers(): Promise<Array<{ voiceId: string }>> {
    return [{ voiceId: this.pollyAdapter.getVoiceId() }];
  }

  async getListener(): Promise<{ enabled: boolean }> {
    return { enabled: true };
  }
}

/**
 * Type guard for NodeJS.ReadableStream.
 */
function isReadableStream(value: unknown): value is NodeJS.ReadableStream {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as any).pipe === 'function' &&
    typeof (value as any)[Symbol.asyncIterator] === 'function'
  );
}

/**
 * Collects a readable stream into a UTF-8 string.
 */
async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}
