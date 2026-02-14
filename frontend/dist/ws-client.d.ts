/**
 * WSClient — browser-side WebSocket client for SafeSecrets.
 *
 * Connects to the backend `/ws` endpoint, sends audio chunks as binary
 * frames and control messages as JSON text, and dispatches incoming
 * ServerMessages to registered event handlers.
 */
import type { RefinementRequest } from '../../shared/types.js';
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
export declare class WSClientImpl implements WSClient {
    private ws;
    private handlers;
    constructor(handlers?: Partial<WSClientEvents>);
    connect(url: string): void;
    disconnect(): void;
    sendAudio(data: ArrayBuffer, sampleRate: number): void;
    sendControl(action: 'start_conversation' | 'end_conversation'): void;
    sendRefinement(request: RefinementRequest): void;
    isConnected(): boolean;
    private handleMessage;
    private dispatchServerMessage;
}
export declare function createWSClient(handlers?: Partial<WSClientEvents>): WSClient;
