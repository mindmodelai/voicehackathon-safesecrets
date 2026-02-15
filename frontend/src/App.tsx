import { useState, useRef, useCallback } from 'react';
import { HeartAvatar } from './components/HeartAvatar';
import { ArtifactPanel } from './components/ArtifactPanel';
import { VideoFrame } from './components/VideoFrame';
import { Header } from './components/Header';
import { AboutModal } from './components/AboutModal';
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
  const [sovereigntyMode, setSovereigntyMode] = useState<SovereigntyMode>('full_us');
  const [showAbout, setShowAbout] = useState(false);
  const [conversationActive, setConversationActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [llmOutput, setLlmOutput] = useState<{ phoneme?: string; style?: string; noteDraft?: string; tags?: string[]; stage?: string; spokenResponse?: string } | null>(null);

  // Tuner for note trapezoid
  const [noteTuner, setNoteTuner] = useState({
    perspective: 310,
    originY: 0,
    rotateY: 6,
    height: 108,
    marginTop: -17,
    marginLeft: 6,
    fontSize: 1.1,
    lineHeight: 1.12,
    padTop: 28,
    padRight: 7,
    padBottom: 0,
    padLeft: 36,
    marginBottom: 13,
  });
  const [showTuner, setShowTuner] = useState(false);
  const [tunerText, setTunerText] = useState('');

  const stateMachineRef = useRef(createAvatarStateMachine());
  const wsClientRef = useRef<ReturnType<typeof createWSClient> | null>(null);
  const audioManagerRef = useRef(createAudioManager());
  const sovereigntyModeRef = useRef<SovereigntyMode>(sovereigntyMode);

  const notepadVideoRef = useRef<HTMLVideoElement>(null);
  const reverseRafRef = useRef<number>(0);
  const videoColRef = useRef<HTMLDivElement>(null);

  // Freeze notepad video at first frame once loaded
  const handleNotepadLoaded = useCallback(() => {
    const v = notepadVideoRef.current;
    if (v) {
      v.currentTime = 0;
      v.pause();
    }
  }, []);

  // Play notepad video forward, freeze on last frame
  const playNotepadForward = useCallback(() => {
    const v = notepadVideoRef.current;
    if (!v) return;
    cancelAnimationFrame(reverseRafRef.current);
    v.currentTime = 0;
    v.play().catch(() => {});
    const onEnded = () => {
      v.pause();
      v.removeEventListener('ended', onEnded);
    };
    v.addEventListener('ended', onEnded);
  }, []);

  // Play notepad video in reverse using requestAnimationFrame
  const playNotepadReverse = useCallback(() => {
    const v = notepadVideoRef.current;
    if (!v) return;
    v.pause();
    const step = () => {
      if (v.currentTime <= 0.05) {
        v.currentTime = 0;
        v.pause();
        return;
      }
      v.currentTime = Math.max(0, v.currentTime - 0.04);
      reverseRafRef.current = requestAnimationFrame(step);
    };
    reverseRafRef.current = requestAnimationFrame(step);
  }, []);

  const handleStartConversation = useCallback(() => {
    setStatusText('Connecting...');
    setErrorText('');
    setConversationActive(true);
    setIsConnecting(true);
    playNotepadForward();

    // On mobile, scroll to the video area
    if (window.innerWidth <= 768 && videoColRef.current) {
      setTimeout(() => {
        videoColRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }

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
        setIsConnecting(false);
      }).catch((err) => {
        setErrorText(`Mic error: ${err.message}`);
        setStatusText('');
        setIsConnecting(false);
      });
      return;
    }

    const client = createWSClient({
      onSessionReady: () => {
        setIsConnected(true);
        setStatusText('Starting conversation...');
        // Send the selected sovereignty mode before starting the conversation
        client.sendMode(sovereigntyModeRef.current);
        client.sendControl('start_conversation');
        audio.startCapture((chunk) => {
          client.sendAudio(chunk, 16000);
        }).then(() => {
          setStatusText('🎙️ Listening — speak now');
          setIsConnecting(false);
        }).catch((err) => {
          setErrorText(`Mic error: ${err.message}`);
          setStatusText('');
          setIsConnecting(false);
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
      onAssistantResponse: (text, stage, extra) => {
        setAssistantResponse(text);
        setConversationStage(stage);
        setTranscriptLog((prev) => [...prev, `[ai] ${text}`]);
        setLlmOutput({ phoneme: extra?.phoneme, style: extra?.style, noteDraft: extra?.noteDraft, tags: extra?.tags, stage, spokenResponse: text });
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
  }, [playNotepadForward]);

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
    setConversationActive(false);
    setIsConnecting(false);
    playNotepadReverse();
  }, [playNotepadReverse]);

  const buttonState = isConnecting ? 'connecting' : (conversationActive ? 'end' : 'start');

  return (
    <div className="app" data-testid="app-layout" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 24px 24px', maxWidth: '1400px', margin: '0 auto', fontFamily: "'PT Sans Caption', sans-serif", minHeight: '100vh', background: 'linear-gradient(to top, #f8e8ee, #f6f9f8 40%)' }}>
      <Header onAboutClick={() => setShowAbout(true)} onTunerToggle={() => setShowTuner(s => !s)} showTuner={showTuner} noteTuner={noteTuner} onNoteTunerChange={setNoteTuner} tunerText={tunerText} onTunerTextChange={setTunerText} />

      {/* ── TOP ROW: Notepad (left) + Video screen (right) ── */}
      <div className="app__top-row" style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>

        {/* Left column: Notepad video + buttons underneath */}
        <div className="app__notepad-col" style={{ flex: '0 0 24%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                overflow: 'hidden',
                pointerEvents: 'none',
              }}
            />
            {/* Artifact content overlays on top of the video */}
            <div style={{ position: 'relative', zIndex: 1, height: '100%', overflow: 'visible' }}>
              <ArtifactPanel
                sovereigntyMode={sovereigntyMode}
                onModeChange={handleModeChange}
                isActive={conversationActive}
                noteTuner={noteTuner}
                tunerText={tunerText}
              />
            </div>
          </div>

          {/* Button below the notepad — toggles between Start / End */}
          <div className="app__button-row" style={{ display: 'flex', justifyContent: 'center' }}>
            {buttonState === 'connecting' ? (
              <button
                className="app__start-button"
                disabled
                data-testid="connecting-button"
                style={{ padding: '12px 28px', fontSize: '1rem', background: '#999', color: '#fff', border: 'none', borderRadius: '24px', cursor: 'not-allowed', width: 'calc(100% - 30px)', opacity: 0.7 }}
              >
                Connecting…
              </button>
            ) : buttonState === 'start' ? (
              <button
                className="app__start-button"
                onClick={handleStartConversation}
                data-testid="start-conversation-button"
                style={{ padding: '12px 28px', fontSize: '1rem', background: '#DC143C', color: '#fff', border: 'none', borderRadius: '24px', cursor: 'pointer', width: 'calc(100% - 30px)' }}
              >
                Start Conversation
              </button>
            ) : (
              <button
                className="app__end-button"
                onClick={handleEndConversation}
                data-testid="end-conversation-button"
                style={{ padding: '12px 28px', fontSize: '1rem', background: '#666', color: '#fff', border: 'none', borderRadius: '24px', cursor: 'pointer', width: 'calc(100% - 30px)' }}
              >
                End Conversation
              </button>
            )}
          </div>
        </div>

        {/* Right column: Wide video screen + two sub-columns underneath */}
        <div ref={videoColRef} className="app__video-col" style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <VideoFrame avatarState={avatarState} phoneme={llmOutput?.phoneme} />

          {/* ── BOTTOM ROW under video: Spoken response (left) + Conversation flow (right) ── */}
          <div className="app__sub-row" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

            {/* Sub-column 1: LLM Phoneme Signaling */}
            <div className="app__llm-panel" data-testid="center-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '8px', background: '#e8eaf6', padding: '16px 20px', borderRadius: '12px', border: '1px solid #c5cae9', minHeight: '150px' }}>
              <div style={{ fontSize: '0.8rem', color: '#7986cb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🎬 LLM Phoneme Signaling
              </div>
              <div data-testid="llm-output" style={{
                fontSize: '0.88rem',
                lineHeight: '1.6',
                color: '#1a237e',
                whiteSpace: 'pre-wrap',
              }}>
                {llmOutput ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div><span style={{ color: '#7986cb', fontSize: '0.78rem' }}>phoneme:</span> <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{llmOutput.phoneme ?? '—'}</span></div>
                    {llmOutput.spokenResponse && (
                      <div style={{ fontSize: '0.8rem', color: '#3949ab', fontStyle: 'italic' }}>
                        "{llmOutput.spokenResponse.split(/[.!?]/)[0].trim()}…"
                      </div>
                    )}
                    <div><span style={{ color: '#7986cb', fontSize: '0.78rem' }}>style:</span> {llmOutput.style ?? '—'} <span style={{ color: '#9fa8da', fontSize: '0.7rem' }}>(LLM-chosen)</span></div>
                    <div><span style={{ color: '#7986cb', fontSize: '0.78rem' }}>Mastra Workflow Checkpoint:</span> {llmOutput.stage ?? '—'}</div>
                    {llmOutput.tags && llmOutput.tags.length > 0 && (
                      <div><span style={{ color: '#7986cb', fontSize: '0.78rem' }}>tags:</span> {llmOutput.tags.join(', ')}</div>
                    )}
                    {llmOutput.noteDraft && (
                      <div style={{ marginTop: '4px', padding: '8px', background: 'rgba(121,134,203,0.08)', borderRadius: '6px', fontSize: '0.82rem' }}>
                        <span style={{ color: '#7986cb', fontSize: '0.78rem' }}>noteDraft:</span><br />{llmOutput.noteDraft}
                      </div>
                    )}
                  </div>
                ) : (
                  <span style={{ color: '#9fa8da', fontStyle: 'italic' }}>Bedrock structured output will appear here...</span>
                )}
              </div>
            </div>

            {/* Sub-column 2: Conversation flow — avatar, status, transcript */}
            <div className="app__convo-panel" data-testid="left-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', gap: '12px', background: '#fce4ec', padding: '16px 20px', borderRadius: '12px', border: '1px solid #f8bbd0', minHeight: '150px' }}>
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
                  {transcriptLog.map((line, i) => {
                    const isAi = line.startsWith('[ai] ');
                    const isUser = line.startsWith('You:');
                    return (
                      <div key={i} style={{ marginBottom: '4px', color: isUser ? '#333' : '#888', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                        {isAi && <img src="/logos/favicon-16.png" alt="" width={16} height={16} style={{ marginTop: '1px', flexShrink: 0 }} />}
                        <span>{isAi ? line.slice(5) : line}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

      {/* Footer — Waterloo logo visible on mobile (hidden from header) */}
      <footer className="app__footer">
        <a href="https://waterloo-voice-hackathon.replit.app/" target="_blank" rel="noopener noreferrer">
          <img src="/logos/ailogo.png" alt="AI Voice Hackathon" style={{ height: '28px', width: 'auto' }} />
        </a>
      </footer>
    </div>
  );
}
