import { useState, useRef, useCallback } from 'react';
import { HeartAvatar } from './components/HeartAvatar';
import { ArtifactPanel } from './components/ArtifactPanel';
import { VideoFrame } from './components/VideoFrame';
import { Header } from './components/Header';
import { createAvatarStateMachine } from './avatar-state-machine';
import { createWSClient } from './ws-client';
import { createAudioManager } from './audio-manager';
import type { AvatarState, SpeakingStyle, SovereigntyMode } from '../../shared/types.js';
import './App.css';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws';

export function App() {
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [speakingStyle, setSpeakingStyle] = useState<SpeakingStyle>('soft');
  const [isConnected, setIsConnected] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [transcriptLog, setTranscriptLog] = useState<string[]>([]);
  const [errorText, setErrorText] = useState('');
  const [assistantResponse, setAssistantResponse] = useState('');
  const [conversationStage, setConversationStage] = useState('collect');
  const [sovereigntyMode, setSovereigntyMode] = useState<SovereigntyMode>('full_canada');
  const [showAbout, setShowAbout] = useState(false);

  const stateMachineRef = useRef(createAvatarStateMachine());
  const wsClientRef = useRef<ReturnType<typeof createWSClient> | null>(null);
  const audioManagerRef = useRef(createAudioManager());
  const sovereigntyModeRef = useRef<SovereigntyMode>(sovereigntyMode);

  const notepadVideoRef = useRef<HTMLVideoElement>(null);

  // Freeze notepad video at first frame once loaded
  const handleNotepadLoaded = useCallback(() => {
    const v = notepadVideoRef.current;
    if (v) {
      v.currentTime = 0;
      v.pause();
    }
  }, []);

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
      },
      onNoteDraftUpdate: (draft) => {
        // Note draft available for future use
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

  return (
    <div className="app" data-testid="app-layout" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 24px 24px', maxWidth: '1400px', margin: '0 auto', fontFamily: "'PT Sans Caption', sans-serif", minHeight: '100vh', background: 'linear-gradient(to top, #f8e8ee, #f6f9f8 40%)' }}>
      <Header onAboutClick={() => setShowAbout(true)} />

      {/* ── TOP ROW: Notepad (left) + Video screen (right) ── */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>

        {/* Left column: Notepad video + buttons underneath */}
        <div style={{ flex: '0 0 24%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Notepad video container — 9:16 portrait */}
          <div className="app__right-panel" data-testid="right-panel" style={{ aspectRatio: '9 / 16', position: 'relative', borderRadius: '16px', background: 'none', boxShadow: 'none', border: 'none' }}>
            {/* Notepad video background — frozen at first frame, flipped on Y axis */}
            <video
              ref={notepadVideoRef}
              src="/videos/notepad-transparent.webm"
              muted
              playsInline
              preload="auto"
              onLoadedData={handleNotepadLoaded}
              data-testid="notepad-video"
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '16px',
                zIndex: 0,
                transform: 'scaleX(-1)',
                overflow: 'hidden',
              }}
            />
            {/* Artifact content overlays on top of the video */}
            <div style={{ position: 'relative', zIndex: 1, height: '100%', overflow: 'visible' }}>
              <ArtifactPanel
                sovereigntyMode={sovereigntyMode}
                onModeChange={handleModeChange}
              />
            </div>
          </div>

          {/* Button below the notepad — toggles between Start / End */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {showStartButton ? (
              <button
                className="app__start-button"
                onClick={handleStartConversation}
                data-testid="start-conversation-button"
                style={{ padding: '12px 28px', fontSize: '1rem', background: '#DC143C', color: '#fff', border: 'none', borderRadius: '24px', cursor: 'pointer', width: '100%' }}
              >
                Start Conversation
              </button>
            ) : (
              <button
                className="app__end-button"
                onClick={handleEndConversation}
                data-testid="end-conversation-button"
                style={{ padding: '12px 28px', fontSize: '1rem', background: '#666', color: '#fff', border: 'none', borderRadius: '24px', cursor: 'pointer', width: '100%' }}
              >
                End Conversation
              </button>
            )}
          </div>
        </div>

        {/* Right column: Wide video screen + two sub-columns underneath */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <VideoFrame />

          {/* ── BOTTOM ROW under video: Spoken response (left) + Conversation flow (right) ── */}
          <div style={{ display: 'flex', gap: '16px', flex: '1' }}>

            {/* Sub-column 1: Assistant spoken response */}
            <div data-testid="center-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '8px', background: '#e8eaf6', padding: '16px 20px', borderRadius: '12px', border: '1px solid #c5cae9', minHeight: '150px' }}>
              <div style={{ fontSize: '0.8rem', color: '#7986cb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                💬 Spoken Response {conversationStage && `(${conversationStage})`}
              </div>
              <div data-testid="assistant-response" style={{
                flex: '1',
                fontSize: '1rem',
                lineHeight: '1.6',
                color: '#1a237e',
                whiteSpace: 'pre-wrap',
              }}>
                {assistantResponse || <span style={{ color: '#9fa8da', fontStyle: 'italic' }}>The assistant's spoken response will appear here...</span>}
              </div>
            </div>

            {/* Sub-column 2: Conversation flow — avatar, status, transcript */}
            <div data-testid="left-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', background: '#fce4ec', padding: '16px 20px', borderRadius: '12px', border: '1px solid #f8bbd0', minHeight: '150px' }}>
              <HeartAvatar avatarState={avatarState} speakingStyle={speakingStyle} />

              {statusText && (
                <div data-testid="status-text" style={{ fontSize: '0.9rem', color: '#555', textAlign: 'center' }}>
                  {statusText}
                </div>
              )}

              {errorText && (
                <div data-testid="error-text" style={{ fontSize: '0.85rem', color: '#d32f2f', background: '#fce4ec', padding: '6px 12px', borderRadius: '8px', textAlign: 'center' }}>
                  {errorText}
                </div>
              )}

              {partialTranscript && (
                <div data-testid="partial-transcript" style={{ fontSize: '0.85rem', color: '#888', fontStyle: 'italic', textAlign: 'center' }}>
                  "{partialTranscript}"
                </div>
              )}

              {transcriptLog.length > 0 && (
                <div data-testid="transcript-log" style={{ width: '100%', maxHeight: '200px', overflowY: 'auto', fontSize: '0.8rem', color: '#666', background: '#f9f9f9', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
                  {transcriptLog.map((line, i) => (
                    <div key={i} style={{ marginBottom: '4px', color: line.startsWith('You:') ? '#333' : '#888' }}>{line}</div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* About modal */}
      {showAbout && (
        <div
          onClick={() => setShowAbout(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '40px 60px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '40px',
              maxWidth: '100%',
              width: '100%',
              maxHeight: '100%',
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setShowAbout(false)}
              aria-label="Close about dialog"
              style={{
                position: 'absolute',
                top: '16px',
                right: '20px',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#888',
              }}
            >
              ✕
            </button>
            <h2 style={{ fontFamily: "'Handlee', cursive", fontSize: '2rem', color: '#DC143C', marginBottom: '16px' }}>About SafeSecrets</h2>
            <p style={{ lineHeight: 1.7, color: '#444', fontSize: '1rem' }}>
              SafeSecrets is an AI-powered love note assistant built for the Waterloo Voice Hackathon.
              Speak your feelings and let AI help you craft the perfect message — with full data sovereignty controls
              so you choose where your data lives.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
