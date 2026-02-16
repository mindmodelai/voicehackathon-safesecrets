import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { App } from './App';
import '@testing-library/jest-dom';

// Mocks
let capturedHandlers: Record<string, (...args: unknown[]) => void> = {};

vi.mock('./ws-client', () => ({
  createWSClient: (handlers: Record<string, (...args: unknown[]) => void>) => {
    capturedHandlers = handlers;
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendAudio: vi.fn(),
      sendControl: vi.fn(),
      sendMode: vi.fn(),
      isConnected: vi.fn(() => false),
    };
  },
}));

vi.mock('./audio-manager', () => ({
  createAudioManager: () => ({
    startCapture: vi.fn().mockResolvedValue(undefined),
    stopCapture: vi.fn(),
    playAudioChunk: vi.fn(),
    stopPlayback: vi.fn(),
    isPlaying: vi.fn(() => false),
  }),
}));

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock HTMLMediaElement.prototype.play
HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
HTMLMediaElement.prototype.pause = vi.fn();

describe('App UX Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandlers = {};
  });

  it('status text has aria-live attribute', () => {
    render(<App />);
    const startButton = screen.getByTestId('start-conversation-button');

    act(() => {
      startButton.click();
    });

    // "Connecting..." should be visible and have aria-live
    // Note: The button text changes to Connecting..., but there is also a statusText state
    // In handleStartConversation: setStatusText('Connecting...');

    const statusText = screen.getByTestId('status-text');
    expect(statusText).toBeInTheDocument();
    expect(statusText).toHaveTextContent('Connecting...');
    expect(statusText).toHaveAttribute('aria-live', 'polite');
  });

  it('transcript log has aria-live attribute', async () => {
    render(<App />);
    const startButton = screen.getByTestId('start-conversation-button');

    act(() => {
      startButton.click();
    });

    // Wait for wsClient to be created and handlers captured
    await waitFor(() => {
      expect(capturedHandlers.onSessionReady).toBeDefined();
    });

    act(() => {
      capturedHandlers.onSessionReady();
    });

    act(() => {
      // Simulate a transcript
      capturedHandlers.onFinalTranscript('Hello AI');
    });

    const transcriptLog = await screen.findByTestId('transcript-log');
    expect(transcriptLog).toBeInTheDocument();
    expect(transcriptLog).toHaveAttribute('aria-live', 'polite');
  });
});
