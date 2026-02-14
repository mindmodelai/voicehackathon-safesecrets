import type { StructuredOutput } from './types.js';
export declare const structuredOutputSchema: {
    readonly type: "object";
    readonly required: readonly ["style", "spokenResponse", "noteDraft", "tags"];
    readonly properties: {
        readonly style: {
            readonly type: "string";
            readonly enum: readonly ["soft", "flirty", "serious"];
        };
        readonly spokenResponse: {
            readonly type: "string";
            readonly minLength: 1;
        };
        readonly noteDraft: {
            readonly type: "string";
            readonly minLength: 1;
        };
        readonly tags: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
    };
    readonly additionalProperties: false;
};
/**
 * Validates that a value conforms to the StructuredOutput schema.
 * Returns `{ valid: true, data }` on success or `{ valid: false, errors }` on failure.
 */
export declare function validateStructuredOutput(value: unknown): {
    valid: true;
    data: StructuredOutput;
} | {
    valid: false;
    errors: string[];
};
