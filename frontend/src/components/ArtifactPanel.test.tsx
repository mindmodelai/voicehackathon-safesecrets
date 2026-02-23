import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ArtifactPanel } from './ArtifactPanel';
import type { SovereigntyMode } from '../../../shared/types';

describe('ArtifactPanel', () => {
  const defaultProps = {
    sovereigntyMode: 'full_canada' as SovereigntyMode,
    onModeChange: vi.fn(),
    isActive: false,
  };

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

  it('copies note text to clipboard and shows feedback', async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<ArtifactPanel {...defaultProps} isActive={true} noteText="secret note" />);

    // Fast-forward past the initial 2000ms delay for content to appear
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const copyButton = screen.getByRole('button', { name: /copy note to clipboard/i });
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveTextContent('📋');

    // Click to copy
    await act(async () => {
      fireEvent.click(copyButton);
    });

    // Verify clipboard write
    expect(writeTextMock).toHaveBeenCalledWith('secret note');

    // Wait for promise resolution (microtasks)
    await act(async () => {
      await Promise.resolve();
    });

    // Verify feedback state (button text/icon changes)
    expect(screen.getByRole('button', { name: /copied!/i })).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();

    // Fast-forward 2000ms to revert state
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Verify state reverted
    expect(screen.getByRole('button', { name: /copy note to clipboard/i })).toBeInTheDocument();
    expect(screen.getByText('📋')).toBeInTheDocument();

    vi.useRealTimers();
  });
});
