/**
 * Smallest.ai Pulse STT Adapter
 *
 * Real-time speech-to-text via WebSocket streaming.
 * Connects to the Pulse API at wss://waves-api.smallest.ai/api/v1/pulse/get_text
 * Accepts PCM audio at 16kHz (linear16) — matches the existing pipeline.
 */

import WebSocket from 'ws';

const BASE_WS_URL = 'wss://waves-api.smallest.ai/api/v1/pulse/get_text';
const SAMPLE_RATE = 16000;

export interface SmallestSTTCallbacks {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
}

export class SmallestSTTAdapter {
  private apiKey: string;
  private sessions: Map<string, WebSocket> = new Map();

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.SMALLEST_AI_API_KEY ?? '';
    if (!this.apiKey) {
      throw new Error('Smallest.ai API key is required. Set SMALLEST_AI_API_KEY env var.');
    }
  }

  async startStream(
    sessionId: string,
    onPartial: (text: string) => void,
    onFinal: (text: string) => void,
  ): Promise<void> {
    if (this.sessions.has(sessionId)) {
      await this.stopStream(sessionId);
    }

    const params = new URLSearchParams({
      language: 'en',
      encoding: 'linear16',
      sample_rate: String(SAMPLE_RATE),
      word_timestamps: 'false',
      full_transcript: 'false',
    });

    const url = `${BASE_WS_URL}?${params.toString()}`;

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      ws.on('open', () => {
        console.log(`[SmallestSTT] WebSocket connected for session ${sessionId}`);
        this.sessions.set(sessionId, ws);
        resolve();
      });

      ws.on('message', (data: Buffer | string) => {
        try {
          const raw = typeof data === 'string' ? data : data.toString('utf-8');
          console.log(`[SmallestSTT] Message received:`, raw.slice(0, 200));
          const msg = JSON.parse(raw);
          if (msg.transcript) {
            if (msg.is_final || msg.is_last) {
              onFinal(msg.transcript);
            } else {
              onPartial(msg.transcript);
            }
          }
        } catch {
          // ignore non-JSON messages
        }
      });

      ws.on('error', (err) => {
        console.error(`[SmallestSTT] WebSocket error for session ${sessionId}:`, err.message);
        this.sessions.delete(sessionId);
        reject(err);
      });

      ws.on('close', (code, reason) => {
        console.log(`[SmallestSTT] WebSocket closed for session ${sessionId}: code=${code} reason=${reason?.toString()}`);
        this.sessions.delete(sessionId);
      });
    });
  }

  feedAudio(sessionId: string, chunk: { data: Buffer }): void {
    const ws = this.sessions.get(sessionId);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log(`[SmallestSTT] feedAudio skipped — ws state: ${ws?.readyState ?? 'no session'}`);
      return;
    }
    ws.send(chunk.data);
  }

  async stopStream(sessionId: string): Promise<void> {
    const ws = this.sessions.get(sessionId);
    if (!ws) return;

    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'end' }));
        ws.close();
      }
    } catch {
      // ignore close errors
    }
    this.sessions.delete(sessionId);
  }

  hasActiveStream(sessionId: string): boolean {
    const ws = this.sessions.get(sessionId);
    return ws !== null && ws !== undefined && ws.readyState === WebSocket.OPEN;
  }

  getRegion(): string {
    return 'smallest.ai';
  }
}
