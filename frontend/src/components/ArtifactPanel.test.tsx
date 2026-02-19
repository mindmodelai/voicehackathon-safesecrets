import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ArtifactPanel } from './ArtifactPanel';
import type { SovereigntyMode } from '../../../shared/types';

describe('ArtifactPanel', () => {
  const defaultProps = {
    sovereigntyMode: 'full_canada' as SovereigntyMode,
    onModeChange: vi.fn(),
    isActive: false,
  };

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

  it('shows copy button when active and provides feedback on click', async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<ArtifactPanel {...defaultProps} isActive={true} noteText="Test Note" />);

    // Fast-forward past the 2000ms delay
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Find the copy button
    const copyButton = screen.getByLabelText('Copy note to clipboard');
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveTextContent('📋');

    // Click the button
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(writeTextMock).toHaveBeenCalledWith('Test Note');

    // Check feedback state
    expect(screen.getByLabelText('Copied to clipboard')).toBeInTheDocument();
    expect(copyButton).toHaveTextContent('✅');

    // Fast-forward to reset
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Should be back to normal
    expect(screen.getByLabelText('Copy note to clipboard')).toBeInTheDocument();
    expect(copyButton).toHaveTextContent('📋');
  });
});
