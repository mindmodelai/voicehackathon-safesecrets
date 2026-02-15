import type { StructuredOutput } from './types.js';

// JSON Schema for Bedrock prompt enforcement
export const structuredOutputSchema = {
  type: 'object',
  required: ['style', 'spokenResponse', 'noteDraft', 'tags', 'phoneme'],
  properties: {
    style: { type: 'string', enum: ['soft', 'flirty', 'serious'] },
    spokenResponse: { type: 'string', minLength: 1 },
    noteDraft: { type: 'string', minLength: 1 },
    tags: { type: 'array', items: { type: 'string' } },
    phoneme: { type: 'string', enum: ['MBP', 'TDNL', 'AHAA', 'OUW', 'EE', 'FV'] },
  },
  additionalProperties: false,
} as const;

const VALID_STYLES = new Set(['soft', 'flirty', 'serious']);
const VALID_PHONEMES = new Set(['MBP', 'TDNL', 'AHAA', 'OUW', 'EE', 'FV']);

/**
 * Validates that a value conforms to the StructuredOutput schema.
 * Returns `{ valid: true, data }` on success or `{ valid: false, errors }` on failure.
 */
export function validateStructuredOutput(
  value: unknown,
): { valid: true; data: StructuredOutput } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { valid: false, errors: ['Value must be a non-null object'] };
  }

  const obj = value as Record<string, unknown>;

  // Check for additional properties
  const allowedKeys = new Set(['style', 'spokenResponse', 'noteDraft', 'tags', 'phoneme']);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unexpected property: "${key}"`);
    }
  }

  // style
  if (!('style' in obj)) {
    errors.push('Missing required property: "style"');
  } else if (typeof obj.style !== 'string' || !VALID_STYLES.has(obj.style)) {
    errors.push('Property "style" must be one of: "soft", "flirty", "serious"');
  }

  // spokenResponse
  if (!('spokenResponse' in obj)) {
    errors.push('Missing required property: "spokenResponse"');
  } else if (typeof obj.spokenResponse !== 'string' || obj.spokenResponse.length < 1) {
    errors.push('Property "spokenResponse" must be a non-empty string');
  }

  // noteDraft
  if (!('noteDraft' in obj)) {
    errors.push('Missing required property: "noteDraft"');
  } else if (typeof obj.noteDraft !== 'string' || obj.noteDraft.length < 1) {
    errors.push('Property "noteDraft" must be a non-empty string');
  }

  // tags
  if (!('tags' in obj)) {
    errors.push('Missing required property: "tags"');
  } else if (!Array.isArray(obj.tags)) {
    errors.push('Property "tags" must be an array');
  } else if (!obj.tags.every((item: unknown) => typeof item === 'string')) {
    errors.push('All items in "tags" must be strings');
  }

  // phoneme
  if (!('phoneme' in obj)) {
    errors.push('Missing required property: "phoneme"');
  } else if (typeof obj.phoneme !== 'string' || !VALID_PHONEMES.has(obj.phoneme)) {
    errors.push('Property "phoneme" must be one of: "MBP", "TDNL", "AHAA", "OUW", "EE", "FV"');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: value as StructuredOutput };
}
