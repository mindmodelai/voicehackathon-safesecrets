/**
 * WSClient — browser-side WebSocket client for SafeSecrets.
 *
 * Connects to the backend `/ws` endpoint, sends audio chunks as binary
 * frames and control messages as JSON text, and dispatches incoming
 * ServerMessages to registered event handlers.
 */

import type { ClientMessage, ServerMessage, RefinementRequest } from '../../shared/types.js';

// ── Event handler interface ──

export interface WSClientEvents {
  onSessionReady: () => void;
  onPartialTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onStyleUpdate: (style: 'soft' | 'flirty' | 'serious') => void;
  onNoteDraftUpdate: (draft: string, tags: string[]) => void;
  onTTSStart: () => void;
  onTTSEnd: () => void;
  onAudioChunk: (chunk: ArrayBuffer) => void;
  onAssistantResponse: (text: string, stage: string) => void;
  onError: (error: string) => void;
}

export interface WSClient {
  connect(url: string): void;
  disconnect(): void;
  sendAudio(data: ArrayBuffer, sampleRate: number): void;
  sendControl(action: 'start_conversation' | 'end_conversation'): void;
  sendRefinement(request: RefinementRequest): void;
  isConnected(): boolean;
}

export class WSClientImpl implements WSClient {
  private ws: WebSocket | null = null;
  private handlers: Partial<WSClientEvents>;

  constructor(handlers: Partial<WSClientEvents> = {}) {
    this.handlers = handlers;
  }

  connect(url: string): void {
    if (this.ws) {
      return; // already connected or connecting
    }

    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      // Connection established — nothing extra needed; session_ready comes from server
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event);
    };

    this.ws.onclose = () => {
      this.ws = null;
    };

    this.ws.onerror = () => {
      this.handlers.onError?.('WebSocket connection error');
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendAudio(data: ArrayBuffer, sampleRate: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Audio is sent as a raw binary frame
    this.ws.send(data);
  }

  sendControl(action: 'start_conversation' | 'end_conversation'): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientMessage = { type: 'control', payload: { action } };
    this.ws.send(JSON.stringify(msg));
  }

  sendRefinement(request: RefinementRequest): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg: ClientMessage = {
      type: 'control',
      payload: { action: 'refinement', data: request },
    };
    this.ws.send(JSON.stringify(msg));
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ── Internal message dispatch ──

  private handleMessage(event: MessageEvent): void {
    // Binary messages are audio chunks from TTS
    if (event.data instanceof ArrayBuffer) {
      this.handlers.onAudioChunk?.(event.data);
      return;
    }

    // Text messages are JSON ServerMessages
    let message: ServerMessage;
    try {
      message = JSON.parse(event.data as string);
    } catch {
      this.handlers.onError?.('Failed to parse server message');
      return;
    }

    this.dispatchServerMessage(message);
  }

  private dispatchServerMessage(message: ServerMessage): void {
    if (message.type === 'audio') {
      this.handlers.onAudioChunk?.(message.payload.data);
      return;
    }

    // All remaining messages are event type
    switch (message.event) {
      case 'session_ready':
        this.handlers.onSessionReady?.();
        break;
      case 'partial_transcript':
        this.handlers.onPartialTranscript?.(message.data.text);
        break;
      case 'final_transcript':
        this.handlers.onFinalTranscript?.(message.data.text);
        break;
      case 'ui.style':
        this.handlers.onStyleUpdate?.(message.data.style);
        break;
      case 'ui.noteDraft':
        this.handlers.onNoteDraftUpdate?.(message.data.noteDraft, message.data.tags);
        break;
      case 'tts.start':
        this.handlers.onTTSStart?.();
        break;
      case 'tts.end':
        this.handlers.onTTSEnd?.();
        break;
      case 'assistant_response':
        this.handlers.onAssistantResponse?.(message.data.text, message.data.stage);
        break;
      case 'error':
        this.handlers.onError?.(message.data.message);
        break;
      case 'user_speaking_start':
        // No dedicated handler in WSClientEvents — ignored at this layer
        break;
    }
  }
}

export function createWSClient(handlers: Partial<WSClientEvents> = {}): WSClient {
  return new WSClientImpl(handlers);
}
