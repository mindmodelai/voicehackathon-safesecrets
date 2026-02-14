import { useState, useRef, useCallback } from 'react';
import { HeartAvatar } from './components/HeartAvatar';
import { ArtifactPanel } from './components/ArtifactPanel';
import { VideoFrame } from './components/VideoFrame';
import { Header } from './components/Header';
import { createAvatarStateMachine } from './avatar-state-machine';
import { createWSClient } from './ws-client';
import { createAudioManager } from './audio-manager';
import type { AvatarState, SpeakingStyle, RefinementRequest, SovereigntyMode } from '../../shared/types.js';
import { SOVEREIGNTY_MODES } from '../../shared/types.js';
import './App.css';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws';

export function App() {
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [speakingStyle, setSpeakingStyle] = useState<SpeakingStyle>('soft');
  const [noteDraft, setNoteDraft] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [toneLabel, setToneLabel] = useState<SpeakingStyle | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [transcriptLog, setTranscriptLog] = useState<string[]>([]);
  const [errorText, setErrorText] = useState('');
  const [assistantResponse, setAssistantResponse] = useState('');
  const [conversationStage, setConversationStage] = useState('collect');
  const [sovereigntyMode, setSovereigntyMode] = useState<SovereigntyMode>('full_canada');

  const stateMachineRef = useRef(createAvatarStateMachine());
  const wsClientRef = useRef<ReturnType<typeof createWSClient> | null>(null);
  const audioManagerRef = useRef(createAudioManager());
  const sovereigntyModeRef = useRef<SovereigntyMode>(sovereigntyMode);

  const handleStartConversation = useCallback(() => {
    setStatusText('Connecting...');
    setErrorText('');

    const sm = stateMachineRef.current;
    const audio = audioManagerRef.current;

    // If we already have an open WebSocket, just start a new conversation on it
    if (wsClientRef.current?.isConnected()) {
      wsClientRef.current.sendControl('start_conversation');
      audio.startCapture((chunk) => {
        wsClientRef.current?.sendAudio(chunk, 16000);
      }).then(() => {
        setAvatarState('idle');
        setStatusText('🎙️ Listening — speak now');
      }).catch((err) => {
        setErrorText(`Mic error: ${err.message}`);
        setStatusText('');
      });
      return;
    }

    const client = createWSClient({
      onSessionReady: () => {
        setIsConnected(true);
        setStatusText('Starting conversation...');
        // Send the selected sovereignty mode before starting the conversation
        if (sovereigntyModeRef.current !== 'full_canada') {
          client.sendMode(sovereigntyModeRef.current);
        }
        client.sendControl('start_conversation');
        audio.startCapture((chunk) => {
          client.sendAudio(chunk, 16000);
        }).then(() => {
          setStatusText('🎙️ Listening — speak now');
        }).catch((err) => {
          setErrorText(`Mic error: ${err.message}`);
          setStatusText('');
        });
      },
      onStyleUpdate: (style) => {
        setSpeakingStyle(style);
        setToneLabel(style);
      },
      onNoteDraftUpdate: (draft, newTags) => {
        setNoteDraft(draft);
        setTags(newTags);
      },
      onTTSStart: () => {
        setStatusText('🔊 Speaking...');
        const state = sm.transition({ type: 'TTS_START', style: sm.currentStyle });
        setAvatarState(state);
        setSpeakingStyle(sm.currentStyle);
      },
      onTTSEnd: () => {
        setStatusText('🎙️ Listening — speak now');
        const state = sm.transition({ type: 'TTS_END' });
        setAvatarState(state);
        // Do NOT call stopPlayback here — audio chunks are still queued in the
        // Web Audio scheduler and need to finish playing. stopPlayback is only
        // for barge-in (user starts speaking while TTS is playing).
      },
      onAudioChunk: (chunk) => {
        audio.playAudioChunk(chunk);
      },
      onPartialTranscript: (text) => {
        setPartialTranscript(text);
        // Barge-in: stop TTS playback when user starts speaking
        if (audio.isPlaying()) {
          audio.stopPlayback();
        }
        const state = sm.transition({ type: 'USER_SPEAKING_START' });
        setAvatarState(state);
        setStatusText('🎙️ Hearing you...');
      },
      onFinalTranscript: (text) => {
        setPartialTranscript('');
        setTranscriptLog((prev) => [...prev, `You: ${text}`]);
        sm.transition({ type: 'USER_SPEAKING_END' });
        sm.transition({ type: 'THINKING_START' });
        setAvatarState('thinking');
        setStatusText('🤔 Thinking...');
      },
      onAssistantResponse: (text, stage) => {
        setAssistantResponse(text);
        setConversationStage(stage);
        setTranscriptLog((prev) => [...prev, `🤖 ${text}`]);
      },
      onModeChanged: (mode) => {
        setSovereigntyMode(mode);
        sovereigntyModeRef.current = mode;
      },
      onConversationEnded: () => {
        setAvatarState('idle');
        setStatusText('Conversation ended. Press Start to begin a new one.');
        setPartialTranscript('');
        setConversationStage('collect');
        audio.stopCapture();
        audio.stopPlayback();
      },
      onError: (msg) => {
        console.error('[SafeSecrets]', msg);
        setErrorText(msg);
      },
    });

    wsClientRef.current = client;
    client.connect(WS_URL);
  }, []);

  const handleRefinement = useCallback((type: RefinementRequest['type']) => {
    wsClientRef.current?.sendRefinement({ type });
    setStatusText('🤔 Refining...');
  }, []);

  const handleCopy = useCallback(() => {
    if (noteDraft) {
      navigator.clipboard.writeText(noteDraft);
    }
  }, [noteDraft]);

  const handleModeChange = useCallback((mode: SovereigntyMode) => {
    setSovereigntyMode(mode);
    sovereigntyModeRef.current = mode;
    wsClientRef.current?.sendMode(mode);
  }, []);

  const handleEndConversation = useCallback(() => {
    wsClientRef.current?.sendControl('end_conversation');
    // Don't disconnect the WebSocket — keep the session alive so the user
    // can switch modes and start a new conversation without reconnecting.
    audioManagerRef.current.stopCapture();
    audioManagerRef.current.stopPlayback();
    setAvatarState('idle');
    setStatusText('Conversation ended. Press Start to begin a new one.');
    setPartialTranscript('');
    setConversationStage('collect');
  }, []);

  const showStartButton = !isConnected || avatarState === 'idle';
  const showEndButton = isConnected && avatarState !== 'idle';

  return (
    <div className="app" data-testid="app-layout" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: "'PT Sans Caption', sans-serif", minHeight: '100vh', background: 'linear-gradient(to top, #f8e8ee, #f6f9f8 40%)' }}>
      <Header />

      {/* Sovereignty mode selector */}
      <div data-testid="sovereignty-selector" style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {(Object.entries(SOVEREIGNTY_MODES) as [SovereigntyMode, typeof SOVEREIGNTY_MODES[SovereigntyMode]][]).map(([mode, config]) => (
          <button
            key={mode}
            onClick={() => handleModeChange(mode)}
            title={config.description}
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              border: sovereigntyMode === mode ? '2px solid #DC143C' : '1px solid #ccc',
              borderRadius: '20px',
              background: sovereigntyMode === mode ? '#fce4ec' : '#fff',
              color: '#333',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {config.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      {/* Left column: Avatar + conversation transcript */}
      <div className="app__left-panel" data-testid="left-panel" style={{ flex: '0 0 22%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <HeartAvatar avatarState={avatarState} speakingStyle={speakingStyle} />

        {showStartButton && (
          <button
            className="app__start-button"
            onClick={handleStartConversation}
            data-testid="start-conversation-button"
            style={{ padding: '12px 32px', fontSize: '1.1rem', background: '#DC143C', color: '#fff', border: 'none', borderRadius: '24px', cursor: 'pointer' }}
          >
            Start Conversation
          </button>
        )}

        {showEndButton && (
          <button
            className="app__end-button"
            onClick={handleEndConversation}
            data-testid="end-conversation-button"
            style={{ padding: '12px 32px', fontSize: '1.1rem', background: '#666', color: '#fff', border: 'none', borderRadius: '24px', cursor: 'pointer' }}
          >
            End Conversation
          </button>
        )}

        {statusText && (
          <div data-testid="status-text" style={{ fontSize: '0.95rem', color: '#555', textAlign: 'center' }}>
            {statusText}
          </div>
        )}

        {errorText && (
          <div data-testid="error-text" style={{ fontSize: '0.9rem', color: '#d32f2f', background: '#fce4ec', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
            {errorText}
          </div>
        )}

        {partialTranscript && (
          <div data-testid="partial-transcript" style={{ fontSize: '0.9rem', color: '#888', fontStyle: 'italic', textAlign: 'center' }}>
            "{partialTranscript}"
          </div>
        )}

        {transcriptLog.length > 0 && (
          <div data-testid="transcript-log" style={{ width: '100%', maxHeight: '300px', overflowY: 'auto', fontSize: '0.85rem', color: '#666', background: '#f9f9f9', padding: '12px', borderRadius: '8px', border: '1px solid #eee' }}>
            {transcriptLog.map((line, i) => (
              <div key={i} style={{ marginBottom: '4px', color: line.startsWith('You:') ? '#333' : '#888' }}>{line}</div>
            ))}
          </div>
        )}
      </div>

      {/* Center column: Video frame + LLM spoken response */}
      <div className="app__center-panel" data-testid="center-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <VideoFrame />
        <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          💬 Spoken Response {conversationStage && `(${conversationStage})`}
        </div>
        <div data-testid="assistant-response" style={{
          flex: '1',
          fontSize: '1rem',
          lineHeight: '1.6',
          color: '#1a237e',
          background: '#e8eaf6',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1px solid #c5cae9',
          minHeight: '120px',
          whiteSpace: 'pre-wrap',
        }}>
          {assistantResponse || <span style={{ color: '#9fa8da', fontStyle: 'italic' }}>The assistant's spoken response will appear here...</span>}
        </div>
      </div>

      {/* Right column: Artifact panel (love note draft) — 9:16 portrait */}
      <div className="app__right-panel" data-testid="right-panel" style={{ flex: '0 0 24%', aspectRatio: '9 / 16', position: 'relative', overflow: 'hidden', borderRadius: '16px' }}>
        <ArtifactPanel
          noteDraft={noteDraft}
          tags={tags}
          toneLabel={toneLabel}
          onRefinement={handleRefinement}
          onCopy={handleCopy}
        />
      </div>
      </div>
    </div>
  );
}
