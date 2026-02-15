import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import type { IncomingMessage } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { ClientMessage, ServerMessage, ConversationContext, SovereigntyMode, SOVEREIGNTY_MODES } from '../../shared/types.js';
import { SOVEREIGNTY_MODES as MODE_CONFIGS } from '../../shared/types.js';
import { TranscribeAdapter } from './transcribe-adapter.js';
import type { AudioChunk } from './transcribe-adapter.js';
import { PollyAdapter } from './polly-adapter.js';
import { MastraWorkflowEngine } from './mastra-workflow.js';
import { SafeSecretsVoiceProvider } from './custom-voice-provider.js';
import { SmallestAdapter } from './smallest-adapter.js';
import { SmallestSTTAdapter } from './smallest-stt-adapter.js';
import { OpenAIAdapter } from './openai-adapter.js';

// ── Constants ──

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ── Session Resources ──

export interface SessionResources {
  sessionId: string;
  ws: WebSocket;
  transcribeAdapter: TranscribeAdapter | null;
  mastraWorkflow: MastraWorkflowEngine;
  pollyAdapter: PollyAdapter | null;
  voiceProvider: SafeSecretsVoiceProvider | null;
  context: ConversationContext | null;
  isActive: boolean;
  idleTimer: ReturnType<typeof setTimeout> | null;
  sovereigntyMode: SovereigntyMode;
  smallestAdapter: SmallestAdapter | null;
  smallestSTTAdapter: SmallestSTTAdapter | null;
  openaiAdapter: OpenAIAdapter | null;
}

// ── Helpers ──

const ClientControlMessageSchema = z.object({
  type: z.literal('control'),
  payload: z.discriminatedUnion('action', [
    z.object({ action: z.literal('start_conversation') }),
    z.object({ action: z.literal('end_conversation') }),
    z.object({
      action: z.literal('refinement'),
      data: z.object({
        type: z.enum(['shorter', 'bolder', 'more_romantic', 'translate_french']),
      }),
    }),
    z.object({
      action: z.literal('set_mode'),
      data: z.object({
        mode: z.enum(['full_canada', 'canada_us_voice', 'us_bedrock_voice', 'full_us', 'aws_free']),
      }),
    }),
  ]),
});

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
    const result = ClientControlMessageSchema.safeParse(parsed);

    if (result.success) {
      return result.data as ClientMessage;
    }
    console.error('[WSServer] Message validation failed:', result.error.issues);
    return null;
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
      sovereigntyMode: 'full_canada',
      smallestAdapter: null,
      smallestSTTAdapter: null,
      openaiAdapter: null,
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

    const buffer = Buffer.from(payload.data);

    try {
      if (session.smallestSTTAdapter) {
        // Using Smallest.ai STT
        session.smallestSTTAdapter.feedAudio(session.sessionId, {
          data: buffer,
          sampleRate: payload.sampleRate,
          encoding: 'pcm',
        });
      } else if (session.transcribeAdapter) {
        // Using AWS Transcribe
        const chunk: AudioChunk = {
          data: buffer,
          sampleRate: payload.sampleRate,
          encoding: 'pcm',
        };
        session.transcribeAdapter.feedAudio(session.sessionId, chunk);
      }
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
      case 'set_mode':
        this.handleSetMode(session, (payload.data as { mode: SovereigntyMode }).mode);
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

    const config = MODE_CONFIGS[session.sovereigntyMode];

    // Log pipeline settings
    const llmProvider = config.llmProvider === 'openai'
      ? `OpenAI (${session.openaiAdapter?.getModelId()})`
      : `Bedrock (${mastraWorkflow.getModelId()}, region: ${mastraWorkflow.getRegion()})`;
    
    const sttProvider = session.smallestSTTAdapter
      ? 'Smallest.ai Lightning STT'
      : transcribeAdapter
        ? `Amazon Transcribe (region: ${transcribeAdapter.getRegion()})`
        : 'None';
    
    const ttsProvider = session.smallestAdapter
      ? `Smallest.ai (voice: ${session.smallestAdapter.getVoiceId()})`
      : pollyAdapter
        ? `Polly ${pollyAdapter.getEngine()} (voice: ${pollyAdapter.getVoiceId()}, region: ${pollyAdapter.getRegion()})`
        : 'None';

    console.log([
      `[WSServer] ▶ Starting conversation`,
      `  Mode:  ${session.sovereigntyMode}`,
      `  STT:   ${sttProvider}`,
      `  LLM:   ${llmProvider}`,
      `  TTS:   ${ttsProvider}`,
    ].join('\n'));

    try {
      // Initialize Mastra session
      const context = mastraWorkflow.createSession(sessionId);
      session.context = context;

      // Start STT stream with callbacks that forward events to the client
      let speakingNotified = false;
      let lastPartialText = ''; // Track last partial to avoid sending duplicates

      const onPartial = (text: string) => {
        // Skip if this is the same as the last partial (Smallest.ai sends cumulative partials)
        if (text === lastPartialText) return;
        lastPartialText = text;

        if (!speakingNotified) {
          sendMessage(ws, { type: 'event', event: 'user_speaking_start' });
          speakingNotified = true;

          // Barge-in: if TTS is currently synthesizing, stop it immediately
          if (pollyAdapter?.isSynthesizing()) {
            pollyAdapter.stop();
            sendMessage(ws, { type: 'event', event: 'tts.end' });
          }
          if (session.smallestAdapter?.isSynthesizing()) {
            session.smallestAdapter.stop();
            sendMessage(ws, { type: 'event', event: 'tts.end' });
          }
        }
        sendMessage(ws, { type: 'event', event: 'partial_transcript', data: { text } });
      };

      const onFinal = (text: string) => {
        speakingNotified = false;
        lastPartialText = ''; // Reset for next utterance
        sendMessage(ws, { type: 'event', event: 'final_transcript', data: { text } });
        this.processTranscript(session, text);
      };

      if (session.smallestSTTAdapter) {
        await session.smallestSTTAdapter.startStream(sessionId, onPartial, onFinal);
      } else if (transcribeAdapter) {
        await transcribeAdapter.startStream(sessionId, onPartial, onFinal);
      } else {
        throw new Error('No STT adapter configured');
      }
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

    console.log(`[WSServer] Processing transcript: "${transcript}"`);

    try {
      const result = await session.mastraWorkflow.processTranscript(session.sessionId, transcript);
      console.log(`[WSServer] Bedrock result received — spokenResponse length: ${result.spokenResponse?.length ?? 0}`);

      // Send the assistant's text response to the client for display
      if (result.spokenResponse) {
        sendMessage(session.ws, {
          type: 'event',
          event: 'assistant_response',
          data: {
            text: result.spokenResponse,
            stage: result.stage ?? 'collect',
            phoneme: result.structuredOutput?.phoneme,
            style: result.structuredOutput?.style,
            noteDraft: result.structuredOutput?.noteDraft,
            tags: result.structuredOutput?.tags,
          },
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
          data: {
            text: result.spokenResponse,
            stage: result.stage ?? 'refine',
            phoneme: result.structuredOutput?.phoneme,
            style: result.structuredOutput?.style,
            noteDraft: result.structuredOutput?.noteDraft,
            tags: result.structuredOutput?.tags,
          },
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

    const onChunk = (chunk: Buffer) => {
      if (session.isActive && session.ws.readyState === WebSocket.OPEN) {
        chunkCount++;
        totalBytes += chunk.byteLength;

        sendMessage(session.ws, {
          type: 'audio',
          payload: { data: chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer },
        });
      }
    };

    try {
      if (session.smallestAdapter) {
        console.log(`[WSServer] TTS via Smallest.ai for session ${session.sessionId}`);
        await session.smallestAdapter.synthesize(text, onChunk);
      } else if (session.pollyAdapter) {
        console.log(`[WSServer] TTS via Polly for session ${session.sessionId}`);
        await session.pollyAdapter.synthesize(text, onChunk);
      } else {
        throw new Error('No TTS adapter configured');
      }
    } catch (err) {
      console.error(`[WSServer] TTS error for session ${session.sessionId}:`, err);
    } finally {
      sendMessage(session.ws, { type: 'event', event: 'tts.end' });
    }
  }

  // ── End conversation ──

  private async endConversation(session: SessionResources): Promise<void> {
    console.log(`[WSServer] ■ Ending conversation — session ${session.sessionId}`);
    await this.stopSessionStreams(session);
    session.context = null;
    sendMessage(session.ws, { type: 'event', event: 'conversation_ended' });
  }
  private handleSetMode(session: SessionResources, mode: SovereigntyMode): void {
    const config = MODE_CONFIGS[mode];
    if (!config) {
      sendMessage(session.ws, {
        type: 'event',
        event: 'error',
        data: { message: `Unknown sovereignty mode: ${mode}` },
      });
      return;
    }

    // End any active conversation before switching modes
    if (session.context) {
      this.endConversation(session);
    }

    // Reset all adapters
    session.smallestAdapter = null;
    session.smallestSTTAdapter = null;
    session.openaiAdapter = null;
    session.transcribeAdapter = null;
    session.pollyAdapter = null;
    session.voiceProvider = null;

    // Configure TTS provider
    if (config.ttsProvider === 'smartest_ai') {
      const apiKey = process.env.SMALLEST_AI_API_KEY;
      if (!apiKey) {
        sendMessage(session.ws, {
          type: 'event',
          event: 'error',
          data: { message: 'Smallest.ai API key not configured. Set SMALLEST_AI_API_KEY.' },
        });
        return;
      }
      session.smallestAdapter = new SmallestAdapter(apiKey, 'sophia');
    } else if (config.pollyRegion) {
      session.pollyAdapter = new PollyAdapter({
        region: config.pollyRegion,
        engine: config.pollyEngine,
      });
    }

    // Configure STT provider
    if (config.sttProvider === 'smallest_ai') {
      const apiKey = process.env.SMALLEST_AI_API_KEY;
      if (!apiKey) {
        sendMessage(session.ws, {
          type: 'event',
          event: 'error',
          data: { message: 'Smallest.ai API key not configured. Set SMALLEST_AI_API_KEY.' },
        });
        return;
      }
      session.smallestSTTAdapter = new SmallestSTTAdapter(apiKey);
    } else if (config.transcribeRegion) {
      session.transcribeAdapter = new TranscribeAdapter(config.transcribeRegion);
    }

    // Configure LLM provider
    if (config.llmProvider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        sendMessage(session.ws, {
          type: 'event',
          event: 'error',
          data: { message: 'OpenAI API key not configured. Set OPENAI_API_KEY.' },
        });
        return;
      }
      session.openaiAdapter = new OpenAIAdapter(undefined, undefined, apiKey);
    }

    // Create voice provider if using AWS services
    if (session.transcribeAdapter && session.pollyAdapter) {
      session.voiceProvider = new SafeSecretsVoiceProvider(session.transcribeAdapter, session.pollyAdapter);
    }

    // Recreate the workflow engine with the appropriate LLM adapter
    session.mastraWorkflow = new MastraWorkflowEngine(
      session.voiceProvider ?? undefined,
      {
        onStyleUpdate: (style) => {
          sendMessage(session.ws, { type: 'event', event: 'ui.style', data: { style } });
        },
        onNoteDraftUpdate: (noteDraft, tags) => {
          sendMessage(session.ws, { type: 'event', event: 'ui.noteDraft', data: { noteDraft, tags } });
        },
      },
      undefined,
      config.bedrockRegion ?? undefined,
    );

    session.sovereigntyMode = mode;

    // Log the new pipeline settings
    const llmDesc = config.llmProvider === 'openai'
      ? `OpenAI (${session.openaiAdapter?.getModelId()})`
      : `Bedrock (${session.mastraWorkflow.getModelId()}, region: ${session.mastraWorkflow.getRegion()})`;
    
    const ttsDesc = config.ttsProvider === 'smartest_ai'
      ? `Smallest.ai (voice: ${session.smallestAdapter?.getVoiceId()})`
      : session.pollyAdapter
        ? `Polly ${session.pollyAdapter.getEngine()} (voice: ${session.pollyAdapter.getVoiceId()}, region: ${session.pollyAdapter.getRegion()})`
        : 'None';
    
    const sttDesc = config.sttProvider === 'smallest_ai'
      ? 'Smallest.ai Lightning STT'
      : session.transcribeAdapter
        ? `Amazon Transcribe (region: ${session.transcribeAdapter.getRegion()})`
        : 'None';

    console.log([
      `[WSServer] 🔄 Mode switched`,
      `  Mode:  ${mode}`,
      `  STT:   ${sttDesc}`,
      `  LLM:   ${llmDesc}`,
      `  TTS:   ${ttsDesc}`,
    ].join('\n'));

    sendMessage(session.ws, {
      type: 'event',
      event: 'mode_changed',
      data: { mode },
    });
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
    // Stop STT stream (Transcribe or Smallest)
    try {
      if (session.smallestSTTAdapter?.hasActiveStream(session.sessionId)) {
        await session.smallestSTTAdapter.stopStream(session.sessionId);
      } else if (session.transcribeAdapter?.hasActiveStream(session.sessionId)) {
        await session.transcribeAdapter.stopStream(session.sessionId);
      }
    } catch (err) {
      console.error(`[WSServer] Error stopping STT for session ${session.sessionId}:`, err);
    }

    // Stop TTS synthesis
    try {
      session.pollyAdapter?.stop();
      session.smallestAdapter?.stop();
    } catch (err) {
      console.error(`[WSServer] Error stopping TTS for session ${session.sessionId}:`, err);
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
