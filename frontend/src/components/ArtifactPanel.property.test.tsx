import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import { ArtifactPanel } from './ArtifactPanel';
import type { SovereigntyMode } from '../../../shared/types';

afterEach(() => {
  cleanup();
});

describe('ArtifactPanel - Property Tests', () => {
  it('renders with arbitrary sovereignty modes', () => {
    const modeArb = fc.constantFrom<SovereigntyMode>(
      'full_canada',
      'canada_us_voice',
      'us_bedrock_voice',
      'full_us'
    );

    fc.assert(
      fc.property(modeArb, (mode) => {
        const { unmount } = render(
          <ArtifactPanel
            sovereigntyMode={mode}
            onModeChange={vi.fn()}
            isActive={false}
          />
        );
        unmount();
      })
    );
  });

  it('renders with arbitrary isActive states', () => {
    fc.assert(
      fc.property(fc.boolean(), (isActive) => {
        const { unmount } = render(
          <ArtifactPanel
            sovereigntyMode="full_canada"
            onModeChange={vi.fn()}
            isActive={isActive}
          />
        );
        unmount();
      })
    );
  });
});
