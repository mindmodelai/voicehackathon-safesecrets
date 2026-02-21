import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ArtifactPanel } from './ArtifactPanel';
import type { SovereigntyMode } from '../../../shared/types';

// Mock clipboard
const writeTextMock = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: writeTextMock,
  },
});

describe('ArtifactPanel', () => {
  const defaultProps = {
    sovereigntyMode: 'full_canada' as SovereigntyMode,
    onModeChange: vi.fn(),
    isActive: false,
  };

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
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

  it('provides feedback when copy button is clicked', async () => {
    vi.useFakeTimers();
    writeTextMock.mockResolvedValue(undefined);

    const props = { ...defaultProps, isActive: true, noteText: 'Secret Note' };
    render(<ArtifactPanel {...props} />);

    // Fast-forward initial 2000ms delay for content to appear
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Find copy button
    const copyButton = screen.getByRole('button', { name: /copy note to clipboard/i });
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveTextContent('📋');

    // Click to copy
    fireEvent.click(copyButton);

    // Verify clipboard write
    expect(writeTextMock).toHaveBeenCalledWith('Secret Note');

    // Fast-forward promise resolution (microtask queue)
    await act(async () => {
      // Just waiting for microtasks to resolve the promise chain
    });

    // Check feedback state
    expect(copyButton).toHaveTextContent('✅');
    expect(copyButton).toHaveAttribute('aria-label', 'Copied!');

    // Fast-forward 2000ms delay for feedback reset
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Verify reset
    expect(copyButton).toHaveTextContent('📋');
    expect(copyButton).toHaveAttribute('aria-label', 'Copy note to clipboard');
  });
});
