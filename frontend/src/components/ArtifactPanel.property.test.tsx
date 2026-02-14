import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { ArtifactPanel } from './ArtifactPanel';
import type { SpeakingStyle, RefinementRequest } from '../../../shared/types';

// Clean up after each test to avoid multiple renders
afterEach(() => {
  cleanup();
});

/**
 * Property tests for Artifact Panel
 * Tests universal correctness properties using fast-check
 */

describe('ArtifactPanel - Property Tests', () => {
  /**
   * Property 8: Artifact panel renders all structured output fields
   * 
   * For any valid StructuredOutput, the panel must render:
   * - noteDraft text
   * - tags
   * - tone label (style)
   */
  it('Property 8: renders all structured output fields', () => {
    const speakingStyleArb = fc.constantFrom<SpeakingStyle>('soft', 'flirty', 'serious');
    const tagArb = fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', '-', '_'), { minLength: 3, maxLength: 10 });
    const tagsArb = fc.array(tagArb, { minLength: 1, maxLength: 3 });
    // Generate meaningful strings (alphanumeric with spaces)
    const noteDraftArb = fc.string({ minLength: 15, maxLength: 100 }).filter(s => s.trim().length >= 10);

    fc.assert(
      fc.property(noteDraftArb, tagsArb, speakingStyleArb, (noteDraft, tags, toneLabel) => {
        const onRefinement = vi.fn();
        const onCopy = vi.fn();

        const { unmount } = render(
          <ArtifactPanel
            noteDraft={noteDraft}
            tags={tags}
            toneLabel={toneLabel}
            onRefinement={onRefinement}
            onCopy={onCopy}
          />
        );

        try {
          // Verify noteDraft is rendered
          const draftElement = screen.getByRole('region', { name: /note draft/i });
          expect(draftElement).toBeInTheDocument();
          expect(draftElement.textContent).toContain(noteDraft.trim());

          // Verify tags section exists
          const tagsElement = screen.getByRole('list', { name: /note tags/i });
          expect(tagsElement).toBeInTheDocument();

          // Verify tone label is rendered
          expect(screen.getByText(toneLabel)).toBeInTheDocument();
        } finally {
          unmount();
        }
      }),
      { numRuns: 30 }
    );
  });

  /**
   * Property 9: Refinement buttons map to correct request types
   * 
   * Each refinement button must emit the correct RefinementRequest type when clicked.
   */
  it('Property 9: refinement buttons map to correct request types', () => {
    const buttonToTypeMap: Record<string, RefinementRequest['type']> = {
      'Make it shorter': 'shorter',
      'Make it bolder': 'bolder',
      'Make it more romantic': 'more_romantic',
      'Translate to French': 'translate_french',
    };

    const buttonTextArb = fc.constantFrom(
      'Make it shorter',
      'Make it bolder',
      'Make it more romantic',
      'Translate to French'
    );

    fc.assert(
      fc.property(buttonTextArb, (buttonText) => {
        const onRefinement = vi.fn();
        const onCopy = vi.fn();

        const { unmount } = render(
          <ArtifactPanel
            noteDraft="Sample note for testing"
            tags={['tag1']}
            toneLabel="soft"
            onRefinement={onRefinement}
            onCopy={onCopy}
          />
        );

        try {
          // Find and click the button
          const buttons = screen.getAllByText(buttonText);
          buttons[buttons.length - 1].click();

          // Verify correct refinement type was emitted
          const expectedType = buttonToTypeMap[buttonText];
          expect(onRefinement).toHaveBeenCalledWith(expectedType);
        } finally {
          unmount();
        }
      }),
      { numRuns: 20 }
    );
  });
});
