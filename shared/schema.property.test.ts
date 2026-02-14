/**
 * Task 1.3 — Property test for StructuredOutput validation (Property 5)
 *
 * Generates random JSON objects (valid and invalid), verifies the validator
 * accepts valid StructuredOutput and rejects invalid ones.
 *
 * Validates: Requirements 3.3, 7.2, 7.3, 7.4, 7.5, 7.6
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateStructuredOutput } from './schema.js';
import type { StructuredOutput, SpeakingStyle } from './types.js';

// ── Arbitraries ──

const validStyle = fc.constantFrom<SpeakingStyle>('soft', 'flirty', 'serious');
const nonEmptyString = fc.string({ minLength: 1, maxLength: 200 });
const tagArray = fc.array(fc.string({ minLength: 0, maxLength: 50 }), { maxLength: 10 });

/** Generates a valid StructuredOutput object. */
const validStructuredOutput: fc.Arbitrary<StructuredOutput> = fc.record({
  style: validStyle,
  spokenResponse: nonEmptyString,
  noteDraft: nonEmptyString,
  tags: tagArray,
});

/** Generates an arbitrary JSON-serializable value (not necessarily a valid StructuredOutput). */
const arbitraryJsonValue: fc.Arbitrary<unknown> = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.boolean(),
  fc.integer(),
  fc.double({ noNaN: true }),
  fc.string(),
  fc.array(fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))),
  fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))),
);

// ── Property Tests ──

describe('Property 5: StructuredOutput validation', () => {
  it('accepts all valid StructuredOutput objects', () => {
    fc.assert(
      fc.property(validStructuredOutput, (output) => {
        const result = validateStructuredOutput(output);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data).toEqual(output);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('rejects objects with invalid style values', () => {
    const invalidStyle = fc.string().filter((s) => !['soft', 'flirty', 'serious'].includes(s));
    fc.assert(
      fc.property(invalidStyle, nonEmptyString, nonEmptyString, tagArray, (style, spoken, draft, tags) => {
        const result = validateStructuredOutput({ style, spokenResponse: spoken, noteDraft: draft, tags });
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('rejects objects with empty spokenResponse', () => {
    fc.assert(
      fc.property(validStyle, nonEmptyString, tagArray, (style, draft, tags) => {
        const result = validateStructuredOutput({ style, spokenResponse: '', noteDraft: draft, tags });
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('rejects objects with empty noteDraft', () => {
    fc.assert(
      fc.property(validStyle, nonEmptyString, tagArray, (style, spoken, tags) => {
        const result = validateStructuredOutput({ style, spokenResponse: spoken, noteDraft: '', tags });
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('rejects objects with non-string items in tags', () => {
    const badTags = fc.array(fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)), { minLength: 1, maxLength: 5 });
    fc.assert(
      fc.property(validStyle, nonEmptyString, nonEmptyString, badTags, (style, spoken, draft, tags) => {
        const result = validateStructuredOutput({ style, spokenResponse: spoken, noteDraft: draft, tags });
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('rejects objects with additional properties', () => {
    const extraKey = fc.string({ minLength: 1, maxLength: 20 }).filter(
      (k) => !['style', 'spokenResponse', 'noteDraft', 'tags'].includes(k),
    );
    fc.assert(
      fc.property(validStructuredOutput, extraKey, fc.string(), (output, key, value) => {
        const withExtra = { ...output, [key]: value };
        const result = validateStructuredOutput(withExtra);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.errors.some((e) => e.includes('Unexpected property'))).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('rejects missing required fields', () => {
    const requiredFields = ['style', 'spokenResponse', 'noteDraft', 'tags'] as const;
    fc.assert(
      fc.property(
        validStructuredOutput,
        fc.constantFrom(...requiredFields),
        (output, fieldToRemove) => {
          const partial = { ...output };
          delete (partial as any)[fieldToRemove];
          const result = validateStructuredOutput(partial);
          expect(result.valid).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects arbitrary non-object values', () => {
    const nonObjects = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.boolean(),
      fc.integer(),
      fc.double({ noNaN: true }),
      fc.string(),
      fc.array(fc.integer()),
    );
    fc.assert(
      fc.property(nonObjects, (value) => {
        const result = validateStructuredOutput(value);
        expect(result.valid).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it('round-trips: valid output → validate → data equals original', () => {
    fc.assert(
      fc.property(validStructuredOutput, (output) => {
        const result = validateStructuredOutput(output);
        expect(result.valid).toBe(true);
        if (result.valid) {
          expect(result.data.style).toBe(output.style);
          expect(result.data.spokenResponse).toBe(output.spokenResponse);
          expect(result.data.noteDraft).toBe(output.noteDraft);
          expect(result.data.tags).toEqual(output.tags);
        }
      }),
      { numRuns: 200 },
    );
  });
});
