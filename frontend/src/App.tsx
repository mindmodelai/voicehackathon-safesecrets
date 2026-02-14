import { useState, useRef, useCallback } from 'react';
import { HeartAvatar } from './components/HeartAvatar';
import { ArtifactPanel } from './components/ArtifactPanel';
import { createAvatarStateMachine } from './avatar-state-machine';
import { createWSClient } from './ws-client';
import { createAudioManager } from './audio-manager';
import type { AvatarState, SpeakingStyle, RefinementRequest } from '../../shared/types.js';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws';

export function App() {
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [speakingStyle, setSpeakingStyle] = useState<SpeakingStyle>('soft');
  const [noteDraft, setNoteDraft] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [toneLabel, setToneLabel] = useState<SpeakingStyle | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const stateMachineRef = useRef(createAvatarStateMachine());
  const wsClientRef = useRef<ReturnType<typeof createWSClient> | null>(null);
  const audioManagerRef = useRef(createAudioManager());

  const handleStartConversation = useCallback(() => {
    if (wsClientRef.current?.isConnected()) return;

    const sm = stateMachineRef.current;
    const audio = audioManagerRef.current;

    const client = createWSClient({
      onSessionReady: () => {
        setIsConnected(true);
        client.sendControl('start_conversation');
        audio.startCapture((chunk) => {
          client.sendAudio(chunk, 16000);
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
        const state = sm.transition({ type: 'TTS_START', style: sm.currentStyle });
        setAvatarState(state);
        setSpeakingStyle(sm.currentStyle);
      },
      onTTSEnd: () => {
        const state = sm.transition({ type: 'TTS_END' });
        setAvatarState(state);
        audio.stopPlayback();
      },
      onAudioChunk: (chunk) => {
        audio.playAudioChunk(chunk);
      },
      onPartialTranscript: () => {
        // Drive avatar to listening when user is speaking
        const state = sm.transition({ type: 'USER_SPEAKING_START' });
        setAvatarState(state);
      },
      onFinalTranscript: () => {
        const endState = sm.transition({ type: 'USER_SPEAKING_END' });
        const thinkState = sm.transition({ type: 'THINKING_START' });
        setAvatarState(thinkState);
      },
      onError: (msg) => {
        console.error('[SafeSecrets]', msg);
      },
    });

    wsClientRef.current = client;
    client.connect(WS_URL);
  }, []);

  const handleRefinement = useCallback((type: RefinementRequest['type']) => {
    wsClientRef.current?.sendRefinement({ type });
  }, []);

  const handleCopy = useCallback(() => {
    if (noteDraft) {
      navigator.clipboard.writeText(noteDraft);
    }
  }, [noteDraft]);

  const showStartButton = avatarState === 'idle' && !isConnected;

  return (
    <div className="app" data-testid="app-layout">
      <div className="app__left-panel" data-testid="left-panel">
        <HeartAvatar avatarState={avatarState} speakingStyle={speakingStyle} />
        {showStartButton && (
          <button
            className="app__start-button"
            onClick={handleStartConversation}
            data-testid="start-conversation-button"
          >
            Start Conversation
          </button>
        )}
      </div>
      <div className="app__right-panel" data-testid="right-panel">
        <ArtifactPanel
          noteDraft={noteDraft}
          tags={tags}
          toneLabel={toneLabel}
          onRefinement={handleRefinement}
          onCopy={handleCopy}
        />
      </div>
    </div>
  );
}
