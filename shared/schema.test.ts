import { describe, it, expect } from 'vitest';
import { validateStructuredOutput, structuredOutputSchema } from './schema.js';

describe('structuredOutputSchema', () => {
  it('has the correct required fields', () => {
    expect(structuredOutputSchema.required).toEqual([
      'style',
      'spokenResponse',
      'noteDraft',
      'tags',
    ]);
  });

  it('disallows additional properties', () => {
    expect(structuredOutputSchema.additionalProperties).toBe(false);
  });

  it('restricts style to valid enum values', () => {
    expect(structuredOutputSchema.properties.style.enum).toEqual([
      'soft',
      'flirty',
      'serious',
    ]);
  });
});

describe('validateStructuredOutput', () => {
  const validOutput = {
    style: 'soft' as const,
    spokenResponse: 'Hello there',
    noteDraft: 'Dear love...',
    tags: ['sweet', 'romantic'],
  };

  it('accepts a valid StructuredOutput', () => {
    const result = validateStructuredOutput(validOutput);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toEqual(validOutput);
    }
  });

  it('accepts all valid style values', () => {
    for (const style of ['soft', 'flirty', 'serious'] as const) {
      const result = validateStructuredOutput({ ...validOutput, style });
      expect(result.valid).toBe(true);
    }
  });

  it('accepts empty tags array', () => {
    const result = validateStructuredOutput({ ...validOutput, tags: [] });
    expect(result.valid).toBe(true);
  });

  // ── Rejection cases ──

  it('rejects null', () => {
    const result = validateStructuredOutput(null);
    expect(result.valid).toBe(false);
  });

  it('rejects non-object values', () => {
    for (const val of [42, 'string', true, undefined, []]) {
      const result = validateStructuredOutput(val);
      expect(result.valid).toBe(false);
    }
  });

  it('rejects missing style', () => {
    const { style, ...rest } = validOutput;
    const result = validateStructuredOutput(rest);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain('Missing required property: "style"');
    }
  });

  it('rejects invalid style value', () => {
    const result = validateStructuredOutput({ ...validOutput, style: 'angry' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing spokenResponse', () => {
    const { spokenResponse, ...rest } = validOutput;
    const result = validateStructuredOutput(rest);
    expect(result.valid).toBe(false);
  });

  it('rejects empty spokenResponse', () => {
    const result = validateStructuredOutput({ ...validOutput, spokenResponse: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing noteDraft', () => {
    const { noteDraft, ...rest } = validOutput;
    const result = validateStructuredOutput(rest);
    expect(result.valid).toBe(false);
  });

  it('rejects empty noteDraft', () => {
    const result = validateStructuredOutput({ ...validOutput, noteDraft: '' });
    expect(result.valid).toBe(false);
  });

  it('rejects missing tags', () => {
    const { tags, ...rest } = validOutput;
    const result = validateStructuredOutput(rest);
    expect(result.valid).toBe(false);
  });

  it('rejects non-array tags', () => {
    const result = validateStructuredOutput({ ...validOutput, tags: 'not-array' });
    expect(result.valid).toBe(false);
  });

  it('rejects tags with non-string items', () => {
    const result = validateStructuredOutput({ ...validOutput, tags: [1, 2] });
    expect(result.valid).toBe(false);
  });

  it('rejects objects with additional properties', () => {
    const result = validateStructuredOutput({ ...validOutput, extra: 'field' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain('Unexpected property: "extra"');
    }
  });

  it('collects multiple errors', () => {
    const result = validateStructuredOutput({});
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    }
  });
});
