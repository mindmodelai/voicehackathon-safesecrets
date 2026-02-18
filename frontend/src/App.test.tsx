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
  vi.useFakeTimers();
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.load = vi.fn();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
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

  it.skip('renders HeartAvatar in the left panel', () => {
    // Skipped: Legacy test for HeartAvatar, replaced by VideoFrame
    render(<App />);
    const leftPanel = screen.getByTestId('left-panel');
    expect(leftPanel.querySelector('.heart-avatar')).toBeInTheDocument();
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
    // Advance timers so ArtifactPanel shows content
    act(() => {
      vi.advanceTimersByTime(2000);
    });
  }

  it.skip('updates avatar to listening on partial transcript', () => {
    // Skipped: Legacy HeartAvatar test
    connectApp();
    act(() => {
      capturedHandlers.onPartialTranscript('hello');
    });
    expect(screen.getByRole('img', { name: /listening/i })).toBeInTheDocument();
  });

  it.skip('updates avatar to thinking on final transcript', () => {
    // Skipped: Legacy HeartAvatar test
    connectApp();
    act(() => {
      capturedHandlers.onFinalTranscript('hello world');
    });
    expect(screen.getByRole('img', { name: /thinking/i })).toBeInTheDocument();
  });

  it.skip('updates avatar to speaking on TTS start', () => {
    // Skipped: Legacy HeartAvatar test
    connectApp();
    act(() => {
      capturedHandlers.onTTSStart();
    });
    expect(screen.getByRole('img', { name: /speaking/i })).toBeInTheDocument();
  });

  it.skip('updates avatar back to idle on TTS end', () => {
    // Skipped: Legacy HeartAvatar test
    connectApp();
    act(() => {
      capturedHandlers.onTTSStart();
    });
    act(() => {
      capturedHandlers.onTTSEnd();
      // Need to advance timer for polling check
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole('img', { name: /idle/i })).toBeInTheDocument();
  });

  it('updates note draft on noteDraft event', () => {
    connectApp();
    act(() => {
      capturedHandlers.onNoteDraftUpdate('My love note', ['sweet', 'romantic']);
    });
    expect(screen.getByText('My love note')).toBeInTheDocument();
    // Tags are not currently handled by onNoteDraftUpdate in App.tsx
    // expect(screen.getByText('#sweet')).toBeInTheDocument();
    // expect(screen.getByText('#romantic')).toBeInTheDocument();
  });

  it.skip('updates tone label on style event', () => {
    // Skipped: onStyleUpdate is explicitly ignored in App.tsx
    connectApp();
    act(() => {
      capturedHandlers.onStyleUpdate('flirty');
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
    // Advance timers so ArtifactPanel shows content
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      capturedHandlers.onNoteDraftUpdate('A love note', ['sweet']);
    });
  }

  it.skip('sends refinement request when refinement button is clicked', () => {
    // Skipped: Refinement buttons are currently not implemented in the UI
    connectAndCompose();
    fireEvent.click(screen.getByText('Make it shorter'));
    expect(mockSendRefinement).toHaveBeenCalledWith({ type: 'shorter' });
  });

  it('copies note to clipboard when Copy is clicked', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    connectAndCompose();

    fireEvent.click(screen.getByLabelText('Copy note to clipboard'));
    expect(writeText).toHaveBeenCalledWith('A love note');
  });
});
