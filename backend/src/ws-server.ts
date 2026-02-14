import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { ClientMessage, ServerMessage, ConversationContext } from '../../shared/types.js';
import { TranscribeAdapter } from './transcribe-adapter.js';
import type { AudioChunk } from './transcribe-adapter.js';
import { PollyAdapter } from './polly-adapter.js';
import { MastraWorkflowEngine } from './mastra-workflow.js';
import { SafeSecretsVoiceProvider } from './custom-voice-provider.js';

// ── Constants ──

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ── Session Resources ──

export interface SessionResources {
  sessionId: string;
  ws: WebSocket;
  transcribeAdapter: TranscribeAdapter;
  mastraWorkflow: MastraWorkflowEngine;
  pollyAdapter: PollyAdapter;
  voiceProvider: SafeSecretsVoiceProvider;
  context: ConversationContext | null;
  isActive: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

// ── Helpers ──

/**
 * Sends a ServerMessage to the client as JSON. Binary audio messages
 * are sent as raw buffers.
 */
function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  if (message.type === 'audio') {
    // Send audio payload as binary frame
    const data = message.payload.data;
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    ws.send(buffer);
  } else {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Parses an incoming WebSocket message into a ClientMessage.
 * Binary messages are treated as audio; text messages are parsed as JSON.
 */
function parseClientMessage(data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean): ClientMessage | null {
  if (isBinary) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    return {
      type: 'audio',
      payload: { data: new Uint8Array(buffer).buffer as ArrayBuffer, sampleRate: 16000 },
    };
  }

  try {
    const text = Buffer.isBuffer(data) ? data.toString('utf-8') : new TextDecoder().decode(data as ArrayBuffer);
    const parsed = JSON.parse(text);
    return parsed as ClientMessage;
  } catch {
    return null;
  }
}

// ── SafeSecretsWSServer ──

export interface WSServerOptions {
  /** HTTP server to attach to. If not provided, the WSS listens standalone on `port`. */
  server?: HttpServer;
  /** Port for standalone mode (ignored if `server` is provided). */
  port?: number;
  /** Override adapters for testing. */
  transcribeAdapter?: TranscribeAdapter;
  pollyAdapter?: PollyAdapter;
  mastraWorkflow?: MastraWorkflowEngine;
  voiceProvider?: SafeSecretsVoiceProvider;
}

export class SafeSecretsWSServer {
  private wss: WebSocketServer;
  private sessions: Map<string, SessionResources> = new Map();

  // Shared adapters (can be overridden for testing)
  private defaultTranscribeAdapter?: TranscribeAdapter;
  private defaultPollyAdapter?: PollyAdapter;
  private defaultMastraWorkflow?: MastraWorkflowEngine;
  private defaultVoiceProvider?: SafeSecretsVoiceProvider;

  constructor(options: WSServerOptions = {}) {
    this.defaultTranscribeAdapter = options.transcribeAdapter;
    this.defaultPollyAdapter = options.pollyAdapter;
    this.defaultMastraWorkflow = options.mastraWorkflow;
    this.defaultVoiceProvider = options.voiceProvider;

    if (options.server) {
      this.wss = new WebSocketServer({ server: options.server, path: '/ws' });
    } else {
      this.wss = new WebSocketServer({ port: options.port ?? 8080, path: '/ws' });
    }

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });
  }

  // ── Connection handling ──

  private handleConnection(ws: WebSocket, _req: IncomingMessage): void {
    const sessionId = randomUUID();

    const transcribeAdapter = this.defaultTranscribeAdapter ?? new TranscribeAdapter();
    const pollyAdapter = this.defaultPollyAdapter ?? new PollyAdapter();
    const voiceProvider = this.defaultVoiceProvider ?? new SafeSecretsVoiceProvider(transcribeAdapter, pollyAdapter);

    // Create the workflow engine with event callbacks that forward to the client
    const mastraWorkflow = this.defaultMastraWorkflow ?? new MastraWorkflowEngine(voiceProvider, {
      onStyleUpdate: (style) => {
        sendMessage(ws, { type: 'event', event: 'ui.style', data: { style } });
      },
      onNoteDraftUpdate: (noteDraft, tags) => {
        sendMessage(ws, { type: 'event', event: 'ui.noteDraft', data: { noteDraft, tags } });
      },
    });

    // If a shared workflow was injected, wire up its callbacks for this connection
    if (this.defaultMastraWorkflow) {
      mastraWorkflow.setCallbacks({
        onStyleUpdate: (style) => {
          sendMessage(ws, { type: 'event', event: 'ui.style', data: { style } });
        },
        onNoteDraftUpdate: (noteDraft, tags) => {
          sendMessage(ws, { type: 'event', event: 'ui.noteDraft', data: { noteDraft, tags } });
        },
      });
    }

    const session: SessionResources = {
      sessionId,
      ws,
      transcribeAdapter,
      mastraWorkflow,
      pollyAdapter,
      voiceProvider,
      context: null,
      isActive: true,
      idleTimer: null,
    };

    this.sessions.set(sessionId, session);
    this.resetIdleTimer(session);

    // Send session_ready event
    sendMessage(ws, { type: 'event', event: 'session_ready' });

    // Wire up message handling
    ws.on('message', (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
      this.resetIdleTimer(session);
      this.handleMessage(session, data, isBinary);
    });

    ws.on('close', () => {
      this.cleanupSession(session);
    });

    ws.on('error', (err: Error) => {
      console.error(`[WSServer] WebSocket error for session ${sessionId}:`, err.message);
      this.cleanupSession(session);
    });
  }

  // ── Message routing ──

  private handleMessage(session: SessionResources, data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean): void {
    if (!session.isActive) return;

    const message = parseClientMessage(data, isBinary);
    if (!message) {
      sendMessage(session.ws, {
        type: 'event',
        event: 'error',
        data: { message: 'Invalid message format' },
      });
      return;
    }

    switch (message.type) {
      case 'audio':
        this.handleAudioMessage(session, message.payload);
        break;
      case 'control':
        this.handleControlMessage(session, message.payload);
        break;
    }
  }

  // ── Audio handling ──

  private handleAudioMessage(
    session: SessionResources,
    payload: { data: ArrayBuffer; sampleRate: number },
  ): void {
    if (!session.context) {
      // No active conversation — ignore audio
      return;
    }

    const chunk: AudioChunk = {
      data: Buffer.from(payload.data),
      sampleRate: payload.sampleRate,
      encoding: 'pcm',
    };

    try {
      session.transcribeAdapter.feedAudio(session.sessionId, chunk);
    } catch (err) {
      console.error(`[WSServer] Error feeding audio for session ${session.sessionId}:`, err);
      sendMessage(session.ws, {
        type: 'event',
        event: 'error',
        data: { message: 'Failed to process audio' },
      });
    }
  }

  // ── Control message handling ──

  private handleControlMessage(
    session: SessionResources,
    payload: { action: string; data?: unknown },
  ): void {
    switch (payload.action) {
      case 'start_conversation':
        this.startConversation(session);
        break;
      case 'end_conversation':
        this.endConversation(session);
        break;
      case 'refinement':
        this.handleRefinement(session, payload.data as { type: string });
        break;
      default:
        sendMessage(session.ws, {
          type: 'event',
          event: 'error',
          data: { message: `Unknown control action: ${payload.action}` },
        });
    }
  }

  // ── Conversation lifecycle ──

  private async startConversation(session: SessionResources): Promise<void> {
    const { sessionId, ws, transcribeAdapter, mastraWorkflow, pollyAdapter } = session;

    try {
      // Initialize Mastra session
      const context = mastraWorkflow.createSession(sessionId);
      session.context = context;

      // Start Transcribe stream with callbacks that forward events to the client
      let speakingNotified = false;

      await transcribeAdapter.startStream(
        sessionId,
        // onPartial
        (text: string) => {
          if (!speakingNotified) {
            sendMessage(ws, { type: 'event', event: 'user_speaking_start' });
            speakingNotified = true;

            // Barge-in: if Polly is currently synthesizing, stop it immediately
            if (pollyAdapter.isSynthesizing()) {
              pollyAdapter.stop();
              sendMessage(ws, { type: 'event', event: 'tts.end' });
            }
          }
          sendMessage(ws, { type: 'event', event: 'partial_transcript', data: { text } });
        },
        // onFinal
        (text: string) => {
          speakingNotified = false;
          sendMessage(ws, { type: 'event', event: 'final_transcript', data: { text } });

          // Process the transcript through the Mastra workflow
          this.processTranscript(session, text);
        },
      );
    } catch (err) {
      console.error(`[WSServer] Failed to start conversation for session ${sessionId}:`, err);
      sendMessage(ws, {
        type: 'event',
        event: 'error',
        data: { message: 'Failed to start conversation' },
      });
    }
  }

  private async processTranscript(session: SessionResources, transcript: string): Promise<void> {
    if (!session.isActive || !session.context) return;

    try {
      const result = await session.mastraWorkflow.processTranscript(session.sessionId, transcript);

      // Send the assistant's text response to the client for display
      if (result.spokenResponse) {
        sendMessage(session.ws, {
          type: 'event',
          event: 'assistant_response',
          data: { text: result.spokenResponse, stage: result.stage ?? 'collect' },
        });
        await this.synthesizeAndStream(session, result.spokenResponse);
      }
    } catch (err) {
      console.error(`[WSServer] Error processing transcript for session ${session.sessionId}:`, err);
      sendMessage(session.ws, {
        type: 'event',
        event: 'error',
        data: { message: 'Failed to process your message' },
      });
    }
  }

  private async handleRefinement(
    session: SessionResources,
    data: { type: string },
  ): Promise<void> {
    if (!session.context) {
      sendMessage(session.ws, {
        type: 'event',
        event: 'error',
        data: { message: 'No active conversation for refinement' },
      });
      return;
    }

    try {
      const result = await session.mastraWorkflow.processRefinement(
        session.sessionId,
        { type: data.type as 'shorter' | 'bolder' | 'more_romantic' | 'translate_french' },
      );

      if (result.spokenResponse) {
        sendMessage(session.ws, {
          type: 'event',
          event: 'assistant_response',
          data: { text: result.spokenResponse, stage: result.stage ?? 'refine' },
        });
        await this.synthesizeAndStream(session, result.spokenResponse);
      }
    } catch (err) {
      console.error(`[WSServer] Error processing refinement for session ${session.sessionId}:`, err);
      sendMessage(session.ws, {
        type: 'event',
        event: 'error',
        data: { message: 'Failed to process refinement' },
      });
    }
  }

  // ── TTS streaming ──

  private async synthesizeAndStream(session: SessionResources, text: string): Promise<void> {
    if (!session.isActive) return;

    sendMessage(session.ws, { type: 'event', event: 'tts.start' });

    let chunkCount = 0;
    let totalBytes = 0;

    try {
      await session.pollyAdapter.synthesize(text, (chunk: Buffer) => {
        if (session.isActive && session.ws.readyState === WebSocket.OPEN) {
          chunkCount++;
          totalBytes += chunk.byteLength;
          console.log(`[WSServer] TTS chunk #${chunkCount}: ${chunk.byteLength} bytes (total: ${totalBytes})`);

          sendMessage(session.ws, {
            type: 'audio',
            payload: { data: chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer },
          });
        }
      });
      console.log(`[WSServer] TTS complete: ${chunkCount} chunks, ${totalBytes} total bytes`);
    } catch (err) {
      console.error(`[WSServer] TTS error for session ${session.sessionId}:`, err);
    } finally {
      sendMessage(session.ws, { type: 'event', event: 'tts.end' });
    }
  }

  // ── End conversation ──

  private async endConversation(session: SessionResources): Promise<void> {
    await this.stopSessionStreams(session);
    session.context = null;
  }

  // ── Idle timeout ──

  private resetIdleTimer(session: SessionResources): void {
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }
    session.idleTimer = setTimeout(() => {
      console.log(`[WSServer] Session ${session.sessionId} timed out after 5 minutes of inactivity`);
      this.cleanupSession(session);
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.close(1000, 'Idle timeout');
      }
    }, IDLE_TIMEOUT_MS);
  }

  // ── Cleanup ──

  private async stopSessionStreams(session: SessionResources): Promise<void> {
    // Stop Transcribe stream
    try {
      if (session.transcribeAdapter.hasActiveStream(session.sessionId)) {
        await session.transcribeAdapter.stopStream(session.sessionId);
      }
    } catch (err) {
      console.error(`[WSServer] Error stopping Transcribe for session ${session.sessionId}:`, err);
    }

    // Stop Polly synthesis
    try {
      session.pollyAdapter.stop();
    } catch (err) {
      console.error(`[WSServer] Error stopping Polly for session ${session.sessionId}:`, err);
    }

    // Delete Mastra session
    try {
      session.mastraWorkflow.deleteSession(session.sessionId);
    } catch (err) {
      console.error(`[WSServer] Error deleting Mastra session ${session.sessionId}:`, err);
    }
  }

  private async cleanupSession(session: SessionResources): Promise<void> {
    if (!session.isActive) return;
    session.isActive = false;

    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
      session.idleTimer = null;
    }

    await this.stopSessionStreams(session);
    this.sessions.delete(session.sessionId);
  }

  // ── Public API ──

  /** Returns the number of active sessions. */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /** Returns a session by ID (for testing). */
  getSession(sessionId: string): SessionResources | undefined {
    return this.sessions.get(sessionId);
  }

  /** Returns all active session IDs. */
  getSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /** Gracefully shuts down the server and cleans up all sessions. */
  async close(): Promise<void> {
    // Clean up all sessions
    const cleanupPromises = Array.from(this.sessions.values()).map((session) =>
      this.cleanupSession(session),
    );
    await Promise.all(cleanupPromises);

    // Close the WebSocket server
    return new Promise((resolve, reject) => {
      this.wss.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /** Returns the underlying WebSocketServer (for testing). */
  getWSS(): WebSocketServer {
    return this.wss;
  }
}
