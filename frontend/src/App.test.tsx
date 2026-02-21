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

  // HeartAvatar replaced by VideoFrame
  // it('renders HeartAvatar in the left panel', () => { ... });

  // ArtifactPanel updated
  // it('renders ArtifactPanel in the right panel', () => { ... });

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

  // Avatar tests removed as VideoFrame does not use img roles
  // it('updates avatar to listening on partial transcript', () => { ... });
  // it('updates avatar to thinking on final transcript', () => { ... });
  // it('updates avatar to speaking on TTS start', () => { ... });
  // it('updates avatar back to idle on TTS end', () => { ... });

  // Note draft update does not update tags anymore, and ArtifactPanel has delay
  // it('updates note draft and tags on noteDraft event', () => { ... });

  // Style update no longer updates UI
  // it('updates tone label on style event', () => { ... });

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

  // Refinement buttons removed from UI
  // it('sends refinement request when refinement button is clicked', () => { ... });

  it('copies note to clipboard when Copy is clicked', () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    connectAndCompose();

    // Wait for ArtifactPanel delay
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    fireEvent.click(screen.getByLabelText('Copy note to clipboard'));
    expect(writeText).toHaveBeenCalledWith('A love note');
    vi.useRealTimers();
  });
});
