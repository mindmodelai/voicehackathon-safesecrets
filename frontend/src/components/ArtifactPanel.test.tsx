import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

    // Render with isActive=true
    render(<ArtifactPanel {...defaultProps} isActive={true} noteText="Test Note" />);

    // Fast-forward past the 2s delay
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const button = screen.getByRole('button', { name: /copy note/i });
    expect(button).toBeInTheDocument();

    // Click copy
    fireEvent.click(button);

    // Verify clipboard call
    expect(writeTextMock).toHaveBeenCalledWith('Test Note');

    // Advance time slightly to allow microtasks/async state updates to settle
    await act(async () => {
      vi.advanceTimersByTime(10);
    });

    // Verify feedback state
    const feedbackButton = screen.getByRole('button', { name: /note copied/i });
    expect(feedbackButton).toHaveTextContent('✅');

    // Fast-forward past the 2s reset delay
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Verify reset
    const resetButton = screen.getByRole('button', { name: /copy note/i });
    expect(resetButton).toHaveTextContent('📋');

    vi.useRealTimers();
  });
});
