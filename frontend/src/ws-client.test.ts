import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WSClientImpl, createWSClient } from './ws-client';
import type { WSClientEvents } from './ws-client';

// ── Mock WebSocket ─────────────────────────────────────────

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.OPEN;
  binaryType: string = 'blob';

  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  });

  constructor(url: string) {
    this.url = url;
    // Simulate async open
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.({} as Event);
    }, 0);
  }

  /** Test helper: simulate receiving a text message */
  _receiveText(json: string): void {
    this.onmessage?.({ data: json } as MessageEvent);
  }

  /** Test helper: simulate receiving a binary message */
  _receiveBinary(buffer: ArrayBuffer): void {
    this.onmessage?.({ data: buffer } as MessageEvent);
  }

  /** Test helper: simulate an error */
  _triggerError(): void {
    this.onerror?.({} as Event);
  }
}

// ── Helpers ─────────────────────────────────────────────────

let lastMockWs: MockWebSocket;

function getLastWs(): MockWebSocket {
  return lastMockWs;
}

function setupHandlers(): { handlers: WSClientEvents; calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {};
  const track = (name: string) => (...args: unknown[]) => {
    if (!calls[name]) calls[name] = [];
    calls[name].push(args);
  };

  const handlers: WSClientEvents = {
    onSessionReady: track('onSessionReady'),
    onPartialTranscript: track('onPartialTranscript'),
    onFinalTranscript: track('onFinalTranscript'),
    onStyleUpdate: track('onStyleUpdate'),
    onNoteDraftUpdate: track('onNoteDraftUpdate'),
    onTTSStart: track('onTTSStart'),
    onTTSEnd: track('onTTSEnd'),
    onAudioChunk: track('onAudioChunk'),
    onError: track('onError'),
  };

  return { handlers, calls };
}

// ── Tests ───────────────────────────────────────────────────

describe('WSClient', () => {
  beforeEach(() => {
    const ctor = vi.fn((url: string) => {
      lastMockWs = new MockWebSocket(url);
      return lastMockWs;
    }) as unknown as typeof WebSocket;
    // Expose static constants so code like `WebSocket.OPEN` works
    Object.assign(ctor, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    });
    vi.stubGlobal('WebSocket', ctor);
  });

  // ── Factory ──

  it('createWSClient returns a WSClientImpl', () => {
    const client = createWSClient();
    expect(client).toBeInstanceOf(WSClientImpl);
  });

  // ── Connection ──

  describe('connect', () => {
    it('creates a WebSocket with the given URL', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      expect(WebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws');
    });

    it('sets binaryType to arraybuffer', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      expect(getLastWs().binaryType).toBe('arraybuffer');
    });

    it('does nothing if already connected', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      client.connect('ws://localhost:8080/ws');
      expect(WebSocket).toHaveBeenCalledTimes(1);
    });

    it('reports isConnected true when socket is open', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      getLastWs().readyState = MockWebSocket.OPEN;
      expect(client.isConnected()).toBe(true);
    });

    it('reports isConnected false before connect', () => {
      const client = new WSClientImpl();
      expect(client.isConnected()).toBe(false);
    });
  });

  // ── Disconnect ──

  describe('disconnect', () => {
    it('closes the WebSocket', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      const ws = getLastWs();
      client.disconnect();
      expect(ws.close).toHaveBeenCalled();
    });

    it('sets isConnected to false', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it('is safe to call when not connected', () => {
      const client = new WSClientImpl();
      expect(() => client.disconnect()).not.toThrow();
    });

    it('allows reconnecting after disconnect', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      client.disconnect();
      client.connect('ws://localhost:8080/ws');
      expect(WebSocket).toHaveBeenCalledTimes(2);
    });
  });

  // ── Sending messages ──

  describe('sendAudio', () => {
    it('sends binary data over the WebSocket', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      const ws = getLastWs();
      const buf = new ArrayBuffer(16);
      client.sendAudio(buf, 16000);
      expect(ws.send).toHaveBeenCalledWith(buf);
    });

    it('does nothing when not connected', () => {
      const client = new WSClientImpl();
      client.sendAudio(new ArrayBuffer(16), 16000);
      // No error thrown, no send called
    });

    it('does nothing when socket is not open', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      getLastWs().readyState = MockWebSocket.CLOSING;
      const ws = getLastWs();
      client.sendAudio(new ArrayBuffer(16), 16000);
      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('sendControl', () => {
    it('sends start_conversation as JSON', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      client.sendControl('start_conversation');
      const sent = JSON.parse(getLastWs().send.mock.calls[0][0]);
      expect(sent).toEqual({
        type: 'control',
        payload: { action: 'start_conversation' },
      });
    });

    it('sends end_conversation as JSON', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      client.sendControl('end_conversation');
      const sent = JSON.parse(getLastWs().send.mock.calls[0][0]);
      expect(sent).toEqual({
        type: 'control',
        payload: { action: 'end_conversation' },
      });
    });

    it('does nothing when not connected', () => {
      const client = new WSClientImpl();
      client.sendControl('start_conversation');
      // No error
    });
  });

  describe('sendRefinement', () => {
    it('sends refinement request as JSON', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      client.sendRefinement({ type: 'shorter' });
      const sent = JSON.parse(getLastWs().send.mock.calls[0][0]);
      expect(sent).toEqual({
        type: 'control',
        payload: { action: 'refinement', data: { type: 'shorter' } },
      });
    });

    it('sends all refinement types correctly', () => {
      const types = ['shorter', 'bolder', 'more_romantic', 'translate_french'] as const;
      for (const t of types) {
        const client = new WSClientImpl();
        client.connect('ws://localhost:8080/ws');
        client.sendRefinement({ type: t });
        const sent = JSON.parse(getLastWs().send.mock.calls[0][0]);
        expect(sent.payload.data.type).toBe(t);
      }
    });
  });

  // ── Receiving messages ──

  describe('message dispatch', () => {
    it('dispatches session_ready event', () => {
      const { handlers, calls } = setupHandlers();
      const client = new WSClientImpl(handlers);
      client.connect('ws://localhost:8080/ws');
      getLastWs()._receiveText(JSON.stringify({ type: 'event', event: 'session_ready' }));
      expect(calls.onSessionReady).toHaveLength(1);
    });

    it('dispatches partial_transcript with text', () => {
      const { handlers, calls } = setupHandlers();
      const client = new WSClientImpl(handlers);
      client.connect('ws://localhost:8080/ws');
      getLastWs()._receiveText(JSON.stringify({
        type: 'event', event: 'partial_transcript', data: { text: 'hello' },
      }));
      expect(calls.onPartialTranscript).toEqual([['hello']]);
    });

    it('dispatches final_transcript with text', () => {
      const { handlers, calls } = setupHandlers();
      const client = new WSClientImpl(handlers);
      client.connect('ws://localhost:8080/ws');
      getLastWs()._receiveText(JSON.stringify({
        type: 'event', event: 'final_transcript', data: { text: 'hello world' },
      }));
      expect(calls.onFinalTranscript).toEqual([['hello world']]);
    });

    it('dispatches ui.style event', () => {
      const { handlers, calls } = setupHandlers();
      const client = new WSClientImpl(handlers);
      client.connect('ws://localhost:8080/ws');
      getLastWs()._receiveText(JSON.stringify({
        type: 'event', event: 'ui.style', data: { style: 'flirty' },
      }));
      expect(calls.onStyleUpdate).toEqual([['flirty']]);
    });

    it('dispatches ui.noteDraft event with draft and tags', () => {
      const { handlers, calls } = setupHandlers();
      const client = new WSClientImpl(handlers);
      client.connect('ws://localhost:8080/ws');
      getLastWs()._receiveText(JSON.stringify({
        type: 'event', event: 'ui.noteDraft', data: { noteDraft: 'My love note', tags: ['#sweet'] },
      }));
      expect(calls.onNoteDraftUpdate).toEqual([['My love note', ['#sweet']]]);
    });

    it('dispatches tts.start event', () => {
      const { handlers, calls } = setupHandlers();
      const client = new WSClientImpl(handlers);
      client.connect('ws://localhost:8080/ws');
      getLastWs()._receiveText(JSON.stringify({ type: 'event', event: 'tts.start' }));
      expect(calls.onTTSStart).toHaveLength(1);
    });

    it('dispatches tts.end event', () => {
      const { handlers, calls } = setupHandlers();
      const client = new WSClientImpl(handlers);
      client.connect('ws://localhost:8080/ws');
      getLastWs()._receiveText(JSON.stringify({ type: 'event', event: 'tts.end' }));
      expect(calls.onTTSEnd).toHaveLength(1);
    });

    it('dispatches error event with message', () => {
      const { handlers, calls } = setupHandlers();
      const client = new WSClientImpl(handlers);
      client.connect('ws://localhost:8080/ws');
      getLastWs()._receiveText(JSON.stringify({
        type: 'event', event: 'error', data: { message: 'Something went wrong' },
      }));
      expect(calls.onError).toEqual([['Something went wrong']]);
    });

    it('dispatches binary messages as audio chunks', () => {
      const { handlers, calls } = setupHandlers();
      const client = new WSClientImpl(handlers);
      client.connect('ws://localhost:8080/ws');
      const buf = new ArrayBuffer(32);
      getLastWs()._receiveBinary(buf);
      expect(calls.onAudioChunk).toHaveLength(1);
      expect(calls.onAudioChunk![0][0]).toBe(buf);
    });

    it('dispatches JSON audio messages via onAudioChunk', () => {
      const { handlers, calls } = setupHandlers();
      const client = new WSClientImpl(handlers);
      client.connect('ws://localhost:8080/ws');
      const payload = { data: {} };
      getLastWs()._receiveText(JSON.stringify({ type: 'audio', payload }));
      expect(calls.onAudioChunk).toHaveLength(1);
    });

    it('calls onError for unparseable JSON', () => {
      const { handlers, calls } = setupHandlers();
      const client = new WSClientImpl(handlers);
      client.connect('ws://localhost:8080/ws');
      getLastWs()._receiveText('not valid json{{{');
      expect(calls.onError).toEqual([['Failed to parse server message']]);
    });

    it('ignores user_speaking_start without error', () => {
      const { handlers, calls } = setupHandlers();
      const client = new WSClientImpl(handlers);
      client.connect('ws://localhost:8080/ws');
      getLastWs()._receiveText(JSON.stringify({ type: 'event', event: 'user_speaking_start' }));
      // No error should be dispatched
      expect(calls.onError).toBeUndefined();
    });
  });

  // ── Error handling ──

  describe('error handling', () => {
    it('calls onError when WebSocket fires an error event', () => {
      const { handlers, calls } = setupHandlers();
      const client = new WSClientImpl(handlers);
      client.connect('ws://localhost:8080/ws');
      getLastWs()._triggerError();
      expect(calls.onError).toEqual([['WebSocket connection error']]);
    });

    it('clears ws reference on close', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      getLastWs().readyState = MockWebSocket.OPEN;
      expect(client.isConnected()).toBe(true);

      // Simulate server-side close
      getLastWs().readyState = MockWebSocket.CLOSED;
      getLastWs().onclose?.({} as CloseEvent);
      expect(client.isConnected()).toBe(false);
    });
  });

  // ── Partial handlers ──

  describe('partial handlers', () => {
    it('works with no handlers registered', () => {
      const client = new WSClientImpl();
      client.connect('ws://localhost:8080/ws');
      // Should not throw
      getLastWs()._receiveText(JSON.stringify({ type: 'event', event: 'session_ready' }));
      getLastWs()._receiveBinary(new ArrayBuffer(8));
    });

    it('works with only some handlers registered', () => {
      const onSessionReady = vi.fn();
      const client = new WSClientImpl({ onSessionReady });
      client.connect('ws://localhost:8080/ws');
      getLastWs()._receiveText(JSON.stringify({ type: 'event', event: 'session_ready' }));
      expect(onSessionReady).toHaveBeenCalledTimes(1);

      // Other events should not throw
      getLastWs()._receiveText(JSON.stringify({ type: 'event', event: 'tts.start' }));
    });
  });
});
