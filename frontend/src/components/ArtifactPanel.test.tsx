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

  it('copies note to clipboard and shows feedback', () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ArtifactPanel {...defaultProps} isActive={true} noteText="Test Note" />);

    // Fast-forward for content to appear
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const button = screen.getByLabelText('Copy note to clipboard');
    expect(button).toBeInTheDocument();

    // Click copy
    fireEvent.click(button);
    expect(writeText).toHaveBeenCalledWith('Test Note');

    // Check feedback
    expect(button).toHaveTextContent('✅');
    expect(button).toHaveAttribute('aria-label', 'Copied!');
    expect(button).toBeDisabled();

    // Fast-forward for feedback to reset
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(button).toHaveTextContent('📋');
    expect(button).toHaveAttribute('aria-label', 'Copy note to clipboard');
    expect(button).not.toBeDisabled();

    vi.useRealTimers();
  });
});
