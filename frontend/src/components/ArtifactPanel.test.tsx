import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ArtifactPanel } from './ArtifactPanel';
import type { SovereigntyMode } from '../../../shared/types';

describe('ArtifactPanel', () => {
  const defaultProps = {
    sovereigntyMode: 'full_canada' as SovereigntyMode,
    onModeChange: vi.fn(),
    isActive: false,
  };

  beforeAll(() => {
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

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('handles copy interaction correctly', async () => {
    vi.useFakeTimers();
    render(<ArtifactPanel {...defaultProps} isActive={true} noteText="Test Note" />);

    // Wait for the 2000ms delay for content to appear
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const copyButton = screen.getByTestId('copy-button');
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveTextContent('📋');
    expect(copyButton).toHaveAttribute('aria-label', 'Copy note to clipboard');

    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test Note');
    expect(copyButton).toHaveTextContent('✅');
    expect(copyButton).toHaveAttribute('aria-label', 'Copied!');

    // Wait for the revert timeout
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(copyButton).toHaveTextContent('📋');
    expect(copyButton).toHaveAttribute('aria-label', 'Copy note to clipboard');
  });
});
