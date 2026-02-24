import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from './App';

// ── Mocks ──

// Track the most recent WSClient handlers so tests can simulate server events
let capturedHandlers: Record<string, (...args: unknown[]) => void> = {};
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockSendAudio = vi.fn();
const mockSendControl = vi.fn();
const mockSendRefinement = vi.fn();
const mockSendMode = vi.fn();
const mockIsConnected = vi.fn(() => false);

vi.mock('./ws-client', () => ({
  createWSClient: (handlers: Record<string, (...args: unknown[]) => void>) => {
    capturedHandlers = handlers;
    return {
      connect: mockConnect,
      disconnect: mockDisconnect,
      sendAudio: mockSendAudio,
      sendControl: mockSendControl,
      sendRefinement: mockSendRefinement,
      sendMode: mockSendMode,
      isConnected: mockIsConnected,
    };
  },
}));

const mockStartCapture = vi.fn().mockResolvedValue(undefined);
const mockStopCapture = vi.fn();
const mockPlayAudioChunk = vi.fn();
const mockStopPlayback = vi.fn();
const mockIsPlaying = vi.fn(() => false);
const mockAddPlaybackListener = vi.fn().mockImplementation((cb) => {
  // Immediately invoke with current state to match implementation
  cb(mockIsPlaying());
  return vi.fn();
});

vi.mock('./audio-manager', () => ({
  createAudioManager: () => ({
    startCapture: mockStartCapture,
    stopCapture: mockStopCapture,
    playAudioChunk: mockPlayAudioChunk,
    stopPlayback: mockStopPlayback,
    isPlaying: mockIsPlaying,
    addPlaybackListener: mockAddPlaybackListener,
  }),
}));

vi.mock('./components/VideoFrame', () => ({
  VideoFrame: ({ avatarState }: { avatarState: string }) => (
    <img src="mock.png" alt={avatarState} role="img" />
  ),
}));

// Stub HTMLMediaElement for HeartAvatar video
beforeEach(() => {
  vi.useFakeTimers();
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.load = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  capturedHandlers = {};
});

describe('App layout', () => {
  it('renders three-panel layout', () => {
    render(<App />);
    expect(screen.getByTestId('left-panel')).toBeInTheDocument();
    expect(screen.getByTestId('center-panel')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel')).toBeInTheDocument();
  });

  it('renders ArtifactPanel in the right panel', () => {
    render(<App />);
    expect(screen.getByText(/How Safe Is/i)).toBeInTheDocument();
  });

  it('shows Start Conversation button when idle', () => {
    render(<App />);
    expect(screen.getByTestId('start-conversation-button')).toBeInTheDocument();
  });
});

describe('Start Conversation flow', () => {
  it('connects WebSocket when Start Conversation is clicked', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('start-conversation-button'));
    expect(mockConnect).toHaveBeenCalledWith('ws://localhost:8080/ws');
  });

  it('sends start_conversation control and starts audio capture on session_ready', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('start-conversation-button'));

    act(() => {
      capturedHandlers.onSessionReady();
    });

    expect(mockSendControl).toHaveBeenCalledWith('start_conversation');
    expect(mockStartCapture).toHaveBeenCalled();
  });

  it('hides Start Conversation button after connecting', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('start-conversation-button'));

    act(() => {
      capturedHandlers.onSessionReady();
    });

    expect(screen.queryByTestId('start-conversation-button')).not.toBeInTheDocument();
  });
});

describe('WebSocket event wiring', () => {
  function connectApp() {
    render(<App />);
    fireEvent.click(screen.getByTestId('start-conversation-button'));
    act(() => {
      capturedHandlers.onSessionReady();
    });
    // Advance timer to show ArtifactPanel content
    act(() => {
      vi.advanceTimersByTime(3000);
    });
  }

  it('updates avatar to listening on partial transcript', () => {
    connectApp();
    act(() => {
      capturedHandlers.onPartialTranscript('hello');
    });
    expect(screen.getByRole('img', { name: /listening/i })).toBeInTheDocument();
  });

  it('updates avatar to thinking on final transcript', () => {
    connectApp();
    act(() => {
      capturedHandlers.onFinalTranscript('hello world');
    });
    expect(screen.getByRole('img', { name: /thinking/i })).toBeInTheDocument();
  });

  it('updates avatar to speaking on TTS start', () => {
    connectApp();
    act(() => {
      capturedHandlers.onTTSStart();
    });
    expect(screen.getByRole('img', { name: /speaking/i })).toBeInTheDocument();
  });

  it('updates avatar back to idle on TTS end', () => {
    connectApp();
    act(() => {
      capturedHandlers.onTTSStart();
    });
    act(() => {
      capturedHandlers.onTTSEnd();
    });
    expect(screen.getByRole('img', { name: /idle/i })).toBeInTheDocument();
  });

  it('updates note draft and tags on noteDraft event', () => {
    connectApp();
    act(() => {
      capturedHandlers.onAssistantResponse('response', 'stage', {
        noteDraft: 'My love note',
        tags: ['sweet', 'romantic']
      });
    });
    // Tags are displayed as comma separated list in LLM output panel
    expect(screen.getAllByText(/My love note/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/sweet, romantic/i)).toBeInTheDocument();
  });

  it('updates tone label on assistant response', () => {
    connectApp();
    act(() => {
      capturedHandlers.onAssistantResponse('text', 'stage', { style: 'flirty' });
    });
    expect(screen.getByText('flirty')).toBeInTheDocument();
  });

  it('plays audio chunks through AudioManager', () => {
    connectApp();
    const chunk = new ArrayBuffer(8);
    act(() => {
      capturedHandlers.onAudioChunk(chunk);
    });
    expect(mockPlayAudioChunk).toHaveBeenCalledWith(chunk);
  });

  it('stops playback on TTS end', () => {
    connectApp();
    act(() => {
      capturedHandlers.onTTSStart();
    });
    act(() => {
      capturedHandlers.onTTSEnd();
    });
    // stopPlayback is NOT called on tts.end — audio needs to finish playing.
    // stopPlayback is only for barge-in (user starts speaking).
    expect(mockStopPlayback).not.toHaveBeenCalled();
  });
});

describe('Refinement and copy', () => {
  function connectAndCompose() {
    render(<App />);
    fireEvent.click(screen.getByTestId('start-conversation-button'));
    act(() => {
      capturedHandlers.onSessionReady();
    });
    // Advance timer to show ArtifactPanel content
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => {
      capturedHandlers.onAssistantResponse('response', 'stage', { noteDraft: 'A love note', tags: ['sweet'] });
    });
  }

  it('copies note to clipboard when Copy is clicked', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    connectAndCompose();
    fireEvent.click(screen.getByLabelText('Copy note to clipboard'));
    expect(writeText).toHaveBeenCalledWith('A love note');
  });
});
