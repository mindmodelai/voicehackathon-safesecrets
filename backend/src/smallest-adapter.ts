/**
 * Smallest.ai (Waves) TTS Adapter
 *
 * Streams speech synthesis via the Lightning v3.1 API.
 * Returns PCM audio chunks at 16kHz to match the existing audio pipeline.
 */

const API_BASE = 'https://waves-api.smallest.ai/api/v1/lightning-v3.1';
const DEFAULT_VOICE_ID = 'sophia';
const DEFAULT_SPEED = 1.25;
const SAMPLE_RATE = 16000;
const CHUNK_SIZE = 4096;

export class SmallestAdapter {
  private apiKey: string;
  private voiceId: string;
  private speed: number;
  private abortController: AbortController | null = null;

  constructor(apiKey?: string, voiceId?: string, speed?: number) {
    this.apiKey = apiKey ?? process.env.SMALLEST_AI_API_KEY ?? '';
    this.voiceId = voiceId ?? DEFAULT_VOICE_ID;
    this.speed = speed ?? DEFAULT_SPEED;
    if (!this.apiKey) {
      throw new Error('Smallest.ai API key is required. Set SMALLEST_AI_API_KEY env var.');
    }
  }

  /**
   * Synthesizes speech from text using Smallest.ai Lightning v3.1
   * and streams PCM audio chunks via the provided callback.
   */
  async synthesize(
    text: string,
    onAudioChunk: (chunk: Buffer) => void,
  ): Promise<void> {
    const abortController = new AbortController();
    this.abortController = abortController;

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/get_speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice_id: this.voiceId,
          sample_rate: SAMPLE_RATE,
          output_format: 'pcm',
          speed: this.speed,
          language: 'en',
        }),
        signal: abortController.signal,
      });
    } catch (err: unknown) {
      this.abortController = null;
      if (isAbortError(err)) return;
      throw err;
    }

    if (!response.ok) {
      this.abortController = null;
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Smallest.ai API error ${response.status}: ${errorText}`);
    }

    if (!response.body) {
      this.abortController = null;
      throw new Error('No response body from Smallest.ai');
    }

    try {
      // The API returns raw PCM binary as a streaming response.
      // Read it in chunks and forward to the callback.
      const reader = response.body.getReader();
      let remainder = Buffer.alloc(0);

      while (true) {
        if (abortController.signal.aborted) break;

        const { done, value } = await reader.read();
        if (done) break;

        // Combine any leftover bytes from previous iteration
        const incoming = Buffer.from(value);
        const combined = remainder.length > 0
          ? Buffer.concat([remainder, incoming])
          : incoming;

        // Emit fixed-size chunks
        let offset = 0;
        while (offset + CHUNK_SIZE <= combined.length) {
          if (abortController.signal.aborted) break;
          onAudioChunk(combined.subarray(offset, offset + CHUNK_SIZE));
          offset += CHUNK_SIZE;
        }

        // Keep leftover bytes for next iteration
        remainder = offset < combined.length
          ? combined.subarray(offset)
          : Buffer.alloc(0);
      }

      // Flush any remaining bytes
      if (remainder.length > 0 && !abortController.signal.aborted) {
        onAudioChunk(remainder);
      }
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      throw err;
    } finally {
      this.abortController = null;
    }
  }

  /** Immediately cancels any in-progress synthesis (barge-in). */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  isSynthesizing(): boolean {
    return this.abortController !== null;
  }

  getVoiceId(): string {
    return this.voiceId;
  }
}

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}
