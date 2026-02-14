import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useCallback } from 'react';
import { HeartAvatar } from './components/HeartAvatar';
import { ArtifactPanel } from './components/ArtifactPanel';
import { createAvatarStateMachine } from './avatar-state-machine';
import { createWSClient } from './ws-client';
import { createAudioManager } from './audio-manager';
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws';
export function App() {
    const [avatarState, setAvatarState] = useState('idle');
    const [speakingStyle, setSpeakingStyle] = useState('soft');
    const [noteDraft, setNoteDraft] = useState('');
    const [tags, setTags] = useState([]);
    const [toneLabel, setToneLabel] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [statusText, setStatusText] = useState('');
    const [partialTranscript, setPartialTranscript] = useState('');
    const [transcriptLog, setTranscriptLog] = useState([]);
    const [errorText, setErrorText] = useState('');
    const [assistantResponse, setAssistantResponse] = useState('');
    const [conversationStage, setConversationStage] = useState('collect');
    const stateMachineRef = useRef(createAvatarStateMachine());
    const wsClientRef = useRef(null);
    const audioManagerRef = useRef(createAudioManager());
    const handleStartConversation = useCallback(() => {
        if (wsClientRef.current?.isConnected())
            return;
        setStatusText('Connecting...');
        setErrorText('');
        const sm = stateMachineRef.current;
        const audio = audioManagerRef.current;
        const client = createWSClient({
            onSessionReady: () => {
                setIsConnected(true);
                setStatusText('Starting conversation...');
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
                audio.stopPlayback();
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
                setTranscriptLog((prev) => [...prev, `Assistant: ${text}`]);
            },
            onError: (msg) => {
                console.error('[SafeSecrets]', msg);
                setErrorText(msg);
            },
        });
        wsClientRef.current = client;
        client.connect(WS_URL);
    }, []);
    const handleRefinement = useCallback((type) => {
        wsClientRef.current?.sendRefinement({ type });
        setStatusText('🤔 Refining...');
    }, []);
    const handleCopy = useCallback(() => {
        if (noteDraft) {
            navigator.clipboard.writeText(noteDraft);
        }
    }, [noteDraft]);
    const showStartButton = avatarState === 'idle' && !isConnected;
    return (_jsxs("div", { className: "app", "data-testid": "app-layout", style: { display: 'flex', gap: '24px', padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }, children: [_jsxs("div", { className: "app__left-panel", "data-testid": "left-panel", style: { flex: '0 0 40%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }, children: [_jsx(HeartAvatar, { avatarState: avatarState, speakingStyle: speakingStyle }), showStartButton && (_jsx("button", { className: "app__start-button", onClick: handleStartConversation, "data-testid": "start-conversation-button", style: { padding: '12px 32px', fontSize: '1.1rem', background: '#DC143C', color: '#fff', border: 'none', borderRadius: '24px', cursor: 'pointer' }, children: "Start Conversation" })), statusText && (_jsx("div", { "data-testid": "status-text", style: { fontSize: '0.95rem', color: '#555', textAlign: 'center' }, children: statusText })), errorText && (_jsx("div", { "data-testid": "error-text", style: { fontSize: '0.9rem', color: '#d32f2f', background: '#fce4ec', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }, children: errorText })), partialTranscript && (_jsxs("div", { "data-testid": "partial-transcript", style: { fontSize: '0.9rem', color: '#888', fontStyle: 'italic', textAlign: 'center' }, children: ["\"", partialTranscript, "\""] })), transcriptLog.length > 0 && (_jsx("div", { "data-testid": "transcript-log", style: { width: '100%', maxHeight: '200px', overflowY: 'auto', fontSize: '0.85rem', color: '#666', background: '#f9f9f9', padding: '12px', borderRadius: '8px', border: '1px solid #eee' }, children: transcriptLog.map((line, i) => (_jsx("div", { style: { marginBottom: '4px', color: line.startsWith('Assistant:') ? '#1a237e' : '#666' }, children: line }, i))) })), assistantResponse && (_jsxs("div", { "data-testid": "assistant-response", style: { width: '100%', fontSize: '0.9rem', color: '#1a237e', background: '#e8eaf6', padding: '12px 16px', borderRadius: '8px', border: '1px solid #c5cae9' }, children: [_jsxs("div", { style: { fontSize: '0.75rem', color: '#5c6bc0', marginBottom: '4px' }, children: ["\uD83D\uDCAC Assistant (", conversationStage, ")"] }), assistantResponse] }))] }), _jsx("div", { className: "app__right-panel", "data-testid": "right-panel", style: { flex: '1' }, children: _jsx(ArtifactPanel, { noteDraft: noteDraft, tags: tags, toneLabel: toneLabel, onRefinement: handleRefinement, onCopy: handleCopy }) })] }));
}
//# sourceMappingURL=App.js.map