import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArtifactPanel } from './ArtifactPanel';
import type { RefinementRequest } from '../../../shared/types.js';

const defaultProps = {
  noteDraft: '',
  tags: [] as string[],
  toneLabel: null as 'soft' | 'flirty' | 'serious' | null,
  onRefinement: vi.fn(),
  onCopy: vi.fn(),
};

describe('ArtifactPanel', () => {
  it('shows placeholder text when noteDraft is empty', () => {
    render(<ArtifactPanel {...defaultProps} />);
    expect(screen.getByText(/your love note will appear here/i)).toBeInTheDocument();
  });

  it('renders note draft text when provided', () => {
    render(<ArtifactPanel {...defaultProps} noteDraft="Roses are red" />);
    expect(screen.getByText('Roses are red')).toBeInTheDocument();
    expect(screen.queryByText(/your love note will appear here/i)).not.toBeInTheDocument();
  });

  it('renders tags with # prefix', () => {
    render(<ArtifactPanel {...defaultProps} noteDraft="Hello" tags={['sweet', 'playful']} />);
    expect(screen.getByText('#sweet')).toBeInTheDocument();
    expect(screen.getByText('#playful')).toBeInTheDocument();
  });

  it('does not render tags section when tags array is empty', () => {
    render(<ArtifactPanel {...defaultProps} noteDraft="Hello" tags={[]} />);
    expect(screen.queryByRole('list', { name: /note tags/i })).not.toBeInTheDocument();
  });

  it('renders tone label when provided', () => {
    render(<ArtifactPanel {...defaultProps} noteDraft="Hello" toneLabel="flirty" />);
    expect(screen.getByText('flirty')).toBeInTheDocument();
  });

  it('does not render tone label when null', () => {
    render(<ArtifactPanel {...defaultProps} noteDraft="Hello" toneLabel={null} />);
    expect(screen.queryByText('soft')).not.toBeInTheDocument();
    expect(screen.queryByText('flirty')).not.toBeInTheDocument();
    expect(screen.queryByText('serious')).not.toBeInTheDocument();
  });

  it('calls onCopy when Copy button is clicked', async () => {
    const onCopy = vi.fn();
    render(<ArtifactPanel {...defaultProps} noteDraft="Hello" onCopy={onCopy} />);
    await userEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(onCopy).toHaveBeenCalledOnce();
  });

  it('disables Copy button when no note exists', () => {
    render(<ArtifactPanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeDisabled();
  });

  it('disables refinement buttons when no note exists', () => {
    render(<ArtifactPanel {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it.each([
    ['Make it shorter', 'shorter'],
    ['Make it bolder', 'bolder'],
    ['Make it more romantic', 'more_romantic'],
    ['Translate to French', 'translate_french'],
  ] as [string, RefinementRequest['type']][])('clicking "%s" calls onRefinement with "%s"', async (label, expectedType) => {
    const onRefinement = vi.fn();
    render(<ArtifactPanel {...defaultProps} noteDraft="Hello" onRefinement={onRefinement} />);
    await userEvent.click(screen.getByRole('button', { name: label }));
    expect(onRefinement).toHaveBeenCalledWith(expectedType);
  });

  it('renders semantic section element with accessible label', () => {
    render(<ArtifactPanel {...defaultProps} />);
    expect(screen.getByRole('region', { name: /love note artifact panel/i })).toBeInTheDocument();
  });
});
