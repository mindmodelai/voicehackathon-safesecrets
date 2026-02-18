import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ArtifactPanel } from './ArtifactPanel';
import type { SovereigntyMode } from '../../../shared/types';

describe('ArtifactPanel', () => {
  const defaultProps = {
    sovereigntyMode: 'full_canada' as SovereigntyMode,
    onModeChange: vi.fn(),
    isActive: false,
  };

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Mock navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    render(<ArtifactPanel {...defaultProps} />);
  });

  it('renders heading text', () => {
    render(<ArtifactPanel {...defaultProps} />);
    expect(screen.getByText(/How Safe Is/i)).toBeInTheDocument();
  });

  it('renders subheading text', () => {
    render(<ArtifactPanel {...defaultProps} />);
    expect(screen.getByText(/Canadian Sovereignty/i)).toBeInTheDocument();
  });

  it('copies text to clipboard and shows feedback', async () => {
    render(<ArtifactPanel {...defaultProps} isActive={true} noteText="Secret Note" />);

    // Fast-forward to show content
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const copyButton = screen.getByLabelText(/Copy note to clipboard/i);
    expect(copyButton).toHaveTextContent(/📋 Copy/i);

    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Secret Note");

    // Wait for async state update
    await act(async () => {});

    expect(screen.getByText(/✅ Copied/i)).toBeInTheDocument();

    // Fast-forward to reset feedback
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText(/📋 Copy/i)).toBeInTheDocument();
  });
});
