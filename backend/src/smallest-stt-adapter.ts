/**
 * Smallest.ai Lightning STT (Speech-to-Text) Adapter
 * 
 * Provides real-time speech-to-text transcription via WebSocket streaming.
 * Alternative to AWS Transcribe for users without AWS credentials.
 */

import WebSocket from 'ws';

const WS_BASE_URL = 'wss://waves-api.smallest.ai/api/v1/lightning/get_text';

export interface AudioChunk {
  data: Buffer;
  sampleRate: number;
  encoding: 'pcm';
}

interface SessionStream {
  ws: WebSocket | null;
  stopped: boolean;
  sampleRate: number;
}

export class SmallestSTTAdapter {
  private apiKey: string;
  private sessions: Map<string, SessionStream> = new Map();

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.SMALLEST_AI_API_KEY ?? '';
    if (!this.apiKey) {
      throw new Error('Smallest.ai API key is required. Set SMALLEST_AI_API_KEY env var.');
    }
  }

  /**
   * Opens a Smallest.ai Lightning STT WebSocket session for the given sessionId.
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

    const sampleRate = 16000;
    
    // Build WebSocket URL with query parameters
    const params = new URLSearchParams({
      language: 'en',
      encoding: 'linear16',
      sample_rate: sampleRate.toString(),
      word_timestamps: 'false',
      full_transcript: 'false',
      sentence_timestamps: 'false',
    });
    
    const wsUrl = `${WS_BASE_URL}?${params.toString()}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      const session: SessionStream = {
        ws,
        stopped: false,
        sampleRate,
      };

      this.sessions.set(sessionId, session);

      ws.on('open', () => {
        console.log(`[SmallestSTT] WebSocket opened for session ${sessionId}`);
        resolve();
      });

      ws.on('message', (data: WebSocket.Data) => {
        if (session.stopped) return;

        try {
          const message = JSON.parse(data.toString());
          
          // Smallest.ai response format:
          // { "text": "...", "is_partial": true/false, "is_last": true/false }
          const text = message.text || message.transcript || '';
          if (!text) return;

          const isPartial = message.is_partial === true;
          const isFinal = !isPartial || message.is_last === true;

          if (isPartial && !isFinal) {
            onPartial(text);
          } else {
            onFinal(text);
          }
        } catch (err) {
          console.error(`[SmallestSTT] Error parsing message:`, err);
        }
      });

      ws.on('error', (err) => {
        console.error(`[SmallestSTT] WebSocket error for session ${sessionId}:`, err);
        if (!session.stopped) {
          this.sessions.delete(sessionId);
          reject(err);
        }
      });

      ws.on('close', () => {
        console.log(`[SmallestSTT] WebSocket closed for session ${sessionId}`);
        this.sessions.delete(sessionId);
      });
    });
  }

  /**
   * Feeds an audio chunk into the active Smallest.ai STT stream for the session.
   */
  feedAudio(sessionId: string, chunk: AudioChunk): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`No active stream for session ${sessionId}`);
    }
    if (session.stopped) {
      throw new Error(`Stream already stopped for session ${sessionId}`);
    }
    if (!session.ws || session.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket not ready for session ${sessionId}`);
    }

    // Send raw PCM audio bytes
    session.ws.send(chunk.data);
  }

  /**
   * Stops the Smallest.ai STT stream for the given session and cleans up resources.
   */
  async stopStream(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`No active stream for session ${sessionId}`);
    }

    session.stopped = true;

    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      // Send end signal
      session.ws.send(JSON.stringify({ type: 'end' }));
      
      // Close WebSocket
      session.ws.close();
    }

    this.sessions.delete(sessionId);
  }

  /**
   * Returns whether a session stream is currently active.
   */
  hasActiveStream(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session != null && !session.stopped && session.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Returns the provider name for logging/debugging.
   */
  getProvider(): string {
    return 'smallest.ai';
  }
}
