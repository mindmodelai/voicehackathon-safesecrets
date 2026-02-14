/**
 * WSClient — browser-side WebSocket client for SafeSecrets.
 *
 * Connects to the backend `/ws` endpoint, sends audio chunks as binary
 * frames and control messages as JSON text, and dispatches incoming
 * ServerMessages to registered event handlers.
 */
export class WSClientImpl {
    ws = null;
    handlers;
    constructor(handlers = {}) {
        this.handlers = handlers;
    }
    connect(url) {
        if (this.ws) {
            return; // already connected or connecting
        }
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';
        this.ws.onopen = () => {
            // Connection established — nothing extra needed; session_ready comes from server
        };
        this.ws.onmessage = (event) => {
            this.handleMessage(event);
        };
        this.ws.onclose = () => {
            this.ws = null;
        };
        this.ws.onerror = () => {
            this.handlers.onError?.('WebSocket connection error');
        };
    }
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    sendAudio(data, sampleRate) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
            return;
        // Audio is sent as a raw binary frame
        this.ws.send(data);
    }
    sendControl(action) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
            return;
        const msg = { type: 'control', payload: { action } };
        this.ws.send(JSON.stringify(msg));
    }
    sendRefinement(request) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
            return;
        const msg = {
            type: 'control',
            payload: { action: 'refinement', data: request },
        };
        this.ws.send(JSON.stringify(msg));
    }
    isConnected() {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
    // ── Internal message dispatch ──
    handleMessage(event) {
        // Binary messages are audio chunks from TTS
        if (event.data instanceof ArrayBuffer) {
            this.handlers.onAudioChunk?.(event.data);
            return;
        }
        // Text messages are JSON ServerMessages
        let message;
        try {
            message = JSON.parse(event.data);
        }
        catch {
            this.handlers.onError?.('Failed to parse server message');
            return;
        }
        this.dispatchServerMessage(message);
    }
    dispatchServerMessage(message) {
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
export function createWSClient(handlers = {}) {
    return new WSClientImpl(handlers);
}
//# sourceMappingURL=ws-client.js.map