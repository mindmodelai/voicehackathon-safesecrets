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

  it('shows copy feedback when button is clicked', async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn();

    // Mock navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      writable: true,
    });

    render(<ArtifactPanel {...defaultProps} isActive={true} noteText="Secret note" />);

    // Fast-forward to show content (2000ms delay for initial appearance)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const copyButton = screen.getByLabelText('Copy note to clipboard');
    expect(copyButton).toBeInTheDocument();

    // Initial state check
    expect(copyButton).toHaveTextContent('📋');

    // Click the button
    fireEvent.click(copyButton);

    // Verify copy action
    expect(writeTextMock).toHaveBeenCalledWith('Secret note');

    // Verify feedback state (should show checkmark)
    expect(copyButton).toHaveTextContent('✅');
    expect(copyButton).toHaveAttribute('aria-label', 'Copied!');

    // Fast-forward to hide feedback (2000ms delay)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Verify revert to initial state
    expect(copyButton).toHaveTextContent('📋');
    expect(copyButton).toHaveAttribute('aria-label', 'Copy note to clipboard');

    vi.useRealTimers();
  });
});
