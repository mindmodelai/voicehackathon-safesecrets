import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

// Mock window.matchMedia
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

// Mock HTMLMediaElement methods
beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
  HTMLMediaElement.prototype.load = vi.fn();
});

describe('App UX Accessibility', () => {
  it('status text has aria-live attribute', async () => {
    render(<App />);
    // Status text might not be visible initially if empty, but let's trigger it
    const startButton = screen.getByTestId('start-conversation-button');
    act(() => {
        startButton.click();
    });

    // Use findByTestId to wait for element to appear
    const statusText = await screen.findByTestId('status-text');
    expect(statusText).toBeInTheDocument();
    expect(statusText).toHaveAttribute('aria-live', 'polite');
  });

  it('transcript log has aria-live attribute', async () => {
    render(<App />);
    const startButton = screen.getByTestId('start-conversation-button');
    act(() => {
        startButton.click();
    });

    act(() => {
      if (capturedHandlers.onSessionReady) capturedHandlers.onSessionReady();
      // Simulate a transcript
      if (capturedHandlers.onFinalTranscript) capturedHandlers.onFinalTranscript('Hello AI');
    });

    const transcriptLog = await screen.findByTestId('transcript-log');
    expect(transcriptLog).toBeInTheDocument();
    expect(transcriptLog).toHaveAttribute('aria-live', 'polite');
  });
});
