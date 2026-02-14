import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  type AudioStream,
} from '@aws-sdk/client-transcribe-streaming';

/**
 * Audio chunk fed into the Transcribe stream.
 */
export interface AudioChunk {
  data: Buffer;
  sampleRate: number;
  encoding: 'pcm';
}

/**
 * Per-session state for an active Transcribe stream.
 */
interface SessionStream {
  /** Resolves the current pending audio chunk (pushes it into the async generator). */
  pushAudio: ((chunk: AudioChunk) => void) | null;
  /** Signals the async generator to stop yielding. */
  endStream: (() => void) | null;
  /** Whether the stream has been stopped. */
  stopped: boolean;
  /** The sample rate used when the stream was started. */
  sampleRate: number;
}

const REGION = 'ca-central-1';

export class TranscribeAdapter {
  private client: TranscribeStreamingClient;
  private sessions: Map<string, SessionStream> = new Map();

  constructor(client?: TranscribeStreamingClient) {
    this.client = client ?? new TranscribeStreamingClient({ region: REGION });
  }

  /**
   * Opens a Transcribe streaming session for the given sessionId.
   * Calls `onPartial` for partial transcripts and `onFinal` for final transcripts.
   */
  async startStream(
    sessionId: string,
    onPartial: (text: string) => void,
    onFinal: (text: string) => void,
  ): Promise<void> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Stream already active for session ${sessionId}`);
    }

    const sampleRate = 16_000; // default; feedAudio will use the chunk's rate

    // Queue for audio chunks — the async generator pulls from here.
    const audioQueue: AudioChunk[] = [];
    let resolveWaiting: (() => void) | null = null;
    let done = false;

    const session: SessionStream = {
      pushAudio: (chunk: AudioChunk) => {
        audioQueue.push(chunk);
        if (resolveWaiting) {
          const r = resolveWaiting;
          resolveWaiting = null;
          r();
        }
      },
      endStream: () => {
        done = true;
        if (resolveWaiting) {
          const r = resolveWaiting;
          resolveWaiting = null;
          r();
        }
      },
      stopped: false,
      sampleRate,
    };

    this.sessions.set(sessionId, session);

    // Async generator that yields AudioStream events to the SDK.
    async function* audioStreamGenerator(): AsyncGenerator<AudioStream> {
      while (!done) {
        if (audioQueue.length > 0) {
          const chunk = audioQueue.shift()!;
          yield { AudioEvent: { AudioChunk: new Uint8Array(chunk.data) } };
        } else {
          // Wait for the next push or end signal.
          await new Promise<void>((resolve) => {
            resolveWaiting = resolve;
          });
        }
      }
      // Drain remaining chunks.
      while (audioQueue.length > 0) {
        const chunk = audioQueue.shift()!;
        yield { AudioEvent: { AudioChunk: new Uint8Array(chunk.data) } };
      }
    }

    const command = new StartStreamTranscriptionCommand({
      LanguageCode: 'en-US',
      MediaSampleRateHertz: sampleRate,
      MediaEncoding: 'pcm',
      AudioStream: audioStreamGenerator(),
    });

    try {
      const response = await this.client.send(command);
      const resultStream = response.TranscriptResultStream;

      if (!resultStream) {
        throw new Error('No TranscriptResultStream in response');
      }

      // Process transcript events in the background.
      (async () => {
        try {
          for await (const event of resultStream) {
            if (session.stopped) break;

            if (event.TranscriptEvent?.Transcript?.Results) {
              for (const result of event.TranscriptEvent.Transcript.Results) {
                const transcript = result.Alternatives?.[0]?.Transcript ?? '';
                if (!transcript) continue;

                if (result.IsPartial) {
                  onPartial(transcript);
                } else {
                  onFinal(transcript);
                }
              }
            }
          }
        } catch (err) {
          // If the stream was intentionally stopped, don't propagate.
          if (!session.stopped) {
            throw err;
          }
        }
      })().catch((err) => {
        // Propagate errors that escape the background loop.
        if (!session.stopped) {
          console.error(`[TranscribeAdapter] Stream error for session ${sessionId}:`, err);
          throw err;
        }
      });
    } catch (err) {
      // Clean up on startup failure.
      this.sessions.delete(sessionId);
      throw err;
    }
  }

  /**
   * Feeds an audio chunk into the active Transcribe stream for the session.
   */
  feedAudio(sessionId: string, chunk: AudioChunk): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`No active stream for session ${sessionId}`);
    }
    if (session.stopped) {
      throw new Error(`Stream already stopped for session ${sessionId}`);
    }
    session.pushAudio?.(chunk);
  }

  /**
   * Stops the Transcribe stream for the given session and cleans up resources.
   */
  async stopStream(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`No active stream for session ${sessionId}`);
    }
    session.stopped = true;
    session.endStream?.();
    session.pushAudio = null;
    session.endStream = null;
    this.sessions.delete(sessionId);
  }

  /**
   * Returns the AWS region this adapter is pinned to.
   */
  getRegion(): string {
    return REGION;
  }

  /**
   * Returns whether a session stream is currently active.
   */
  hasActiveStream(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session != null && !session.stopped;
  }
}
