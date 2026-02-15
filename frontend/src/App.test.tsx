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
const mockIsConnected = vi.fn(() => false);
const mockSendMode = vi.fn();

vi.mock('./ws-client', () => ({
  createWSClient: (handlers: Record<string, (...args: unknown[]) => void>) => {
    capturedHandlers = handlers;
    return {
      connect: mockConnect,
      disconnect: mockDisconnect,
      sendAudio: mockSendAudio,
      sendControl: mockSendControl,
      sendRefinement: mockSendRefinement,
      isConnected: mockIsConnected,
      sendMode: mockSendMode,
    };
  },
}));

const mockStartCapture = vi.fn().mockResolvedValue(undefined);
const mockStopCapture = vi.fn();
const mockPlayAudioChunk = vi.fn();
const mockStopPlayback = vi.fn();
const mockIsPlaying = vi.fn(() => false);

vi.mock('./audio-manager', () => ({
  createAudioManager: () => ({
    startCapture: mockStartCapture,
    stopCapture: mockStopCapture,
    playAudioChunk: mockPlayAudioChunk,
    stopPlayback: mockStopPlayback,
    isPlaying: mockIsPlaying,
  }),
}));

// Stub HTMLMediaElement for HeartAvatar video
beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.load = vi.fn();
});

afterEach(() => {
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

  it('renders VideoFrame', () => {
    render(<App />);
    const video = document.querySelector('video[src*="idle-compressed"]');
    expect(video).toBeInTheDocument();
  });

  it('renders ArtifactPanel in the right panel', () => {
    vi.useFakeTimers();
    render(<App />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByLabelText('Sovereignty mode')).toBeInTheDocument();
    vi.useRealTimers();
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
  }

  it('updates status to listening on partial transcript', () => {
    connectApp();
    act(() => {
      capturedHandlers.onPartialTranscript('hello');
    });
    expect(screen.getByText(/Hearing you/i)).toBeInTheDocument();
  });

  it('updates status to thinking on final transcript', () => {
    connectApp();
    act(() => {
      capturedHandlers.onFinalTranscript('hello world');
    });
    expect(screen.getByText(/Thinking/i)).toBeInTheDocument();
  });

  it('updates status to speaking on TTS start', () => {
    connectApp();
    act(() => {
      capturedHandlers.onTTSStart();
    });
    expect(screen.getByText(/Speaking/i)).toBeInTheDocument();
  });

  it('updates status back to idle on TTS end', async () => {
    vi.useFakeTimers();
    connectApp();
    act(() => {
      capturedHandlers.onTTSStart();
    });
    // App.tsx uses a poller for audioManager.isPlaying().
    // We need to advance timers and ensure mockIsPlaying returns false.
    // mockIsPlaying defaults to false.

    act(() => {
      capturedHandlers.onTTSEnd();
    });

    // onTTSEnd starts a poller requestAnimationFrame.
    // We need to advance time for the poller to run.
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Status should revert to Listening
    expect(screen.getByText(/Listening — speak now/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('updates note draft on noteDraft event', () => {
    vi.useFakeTimers();
    connectApp();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      capturedHandlers.onNoteDraftUpdate('My love note', ['sweet', 'romantic']);
    });
    expect(screen.getByText('My love note')).toBeInTheDocument();
    vi.useRealTimers();
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
    act(() => {
      capturedHandlers.onNoteDraftUpdate('A love note', ['sweet']);
    });
  }

  it('copies note to clipboard when Copy is clicked', () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    connectAndCompose();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    fireEvent.click(screen.getByLabelText('Copy note to clipboard'));
    expect(writeText).toHaveBeenCalledWith('A love note');
    vi.useRealTimers();
  });
});
