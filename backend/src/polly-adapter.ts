import {
  PollyClient,
  SynthesizeSpeechCommand,
  type VoiceId,
  type Engine,
} from '@aws-sdk/client-polly';
import type { Readable } from 'node:stream';

const DEFAULT_REGION = 'ca-central-1';
const DEFAULT_VOICE_ID = 'Joanna' as VoiceId;
const DEFAULT_ENGINE = 'neural' as Engine;
const DEFAULT_OUTPUT_FORMAT = 'pcm';
const DEFAULT_SAMPLE_RATE = '16000';
const CHUNK_SIZE = 4096;

export interface PollyAdapterOptions {
  region?: string;
  voiceId?: VoiceId;
  engine?: Engine;
}

export class PollyAdapter {
  private client: PollyClient;
  private voiceId: VoiceId;
  private engine: Engine;
  private region: string;
  private abortController: AbortController | null = null;

  constructor(clientOrOptions?: PollyClient | PollyAdapterOptions, voiceId?: VoiceId) {
    if (clientOrOptions instanceof PollyClient) {
      // Legacy constructor: (client, voiceId)
      this.client = clientOrOptions;
      this.voiceId = voiceId ?? DEFAULT_VOICE_ID;
      this.engine = DEFAULT_ENGINE;
      this.region = DEFAULT_REGION;
    } else {
      const opts = clientOrOptions ?? {};
      this.region = opts.region ?? DEFAULT_REGION;
      this.voiceId = opts.voiceId ?? DEFAULT_VOICE_ID;
      this.engine = opts.engine ?? DEFAULT_ENGINE;
      this.client = new PollyClient({ region: this.region });
    }
  }

  /**
   * Synthesizes speech from text using Polly Neural and streams audio chunks
   * back via the provided callback. Resolves when synthesis is complete or
   * cancelled.
   */
  async synthesize(
    text: string,
    onAudioChunk: (chunk: Buffer) => void,
  ): Promise<void> {
    const abortController = new AbortController();
    this.abortController = abortController;

    const command = new SynthesizeSpeechCommand({
      Engine: this.engine,
      OutputFormat: DEFAULT_OUTPUT_FORMAT,
      SampleRate: DEFAULT_SAMPLE_RATE,
      Text: text,
      TextType: 'text',
      VoiceId: this.voiceId,
    });

    console.log(`[Polly] Synthesizing — engine: ${this.engine}, voice: ${this.voiceId}, region: ${this.region}, text length: ${text.length}`);

    let response;
    try {
      response = await this.client.send(command, {
        abortSignal: abortController.signal,
      });
    } catch (err: unknown) {
      this.abortController = null;
      if (isAbortError(err)) {
        return; // Cancelled via stop() — resolve silently
      }
      throw err;
    }

    const audioStream = response.AudioStream;
    if (!audioStream) {
      this.abortController = null;
      throw new Error('No AudioStream in Polly response');
    }

    try {
      // The SDK returns a streaming blob; in Node.js this is a Readable stream.
      const readable = audioStream as unknown as Readable;

      for await (const chunk of readable) {
        if (abortController.signal.aborted) {
          break;
        }

        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

        // Emit in fixed-size chunks for consistent streaming
        let offset = 0;
        while (offset < buffer.length) {
          if (abortController.signal.aborted) break;
          const end = Math.min(offset + CHUNK_SIZE, buffer.length);
          onAudioChunk(buffer.subarray(offset, end));
          offset = end;
        }
      }
    } catch (err: unknown) {
      if (isAbortError(err)) {
        return; // Cancelled — resolve silently
      }
      throw err;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Immediately cancels any in-progress synthesis. Used for barge-in scenarios
   * where the user starts speaking while TTS is active.
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Returns whether a synthesis is currently in progress.
   */
  isSynthesizing(): boolean {
    return this.abortController !== null;
  }

  /**
   * Returns the AWS region this adapter is pinned to.
   */
  getRegion(): string {
    return this.region;
  }

  /**
   * Returns the voice ID in use.
   */
  getVoiceId(): string {
    return this.voiceId;
  }

  getEngine(): string {
    return this.engine;
  }
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}
