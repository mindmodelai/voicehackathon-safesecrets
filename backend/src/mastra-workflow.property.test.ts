/**
 * Tasks 5.3–5.6 — Mastra Workflow Property Tests
 *
 * 5.3 Property 3: New sessions start in collect stage
 * 5.4 Property 4: Complete context triggers compose transition
 * 5.5 Property 6: Structured output routes to correct events
 * 5.6 Property 7: Refinement preserves non-draft context
 *
 * Validates: Requirements 3.1, 3.2, 3.4, 3.5
 */
import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { MastraWorkflowEngine, isContextComplete } from './mastra-workflow.js';
import type { WorkflowEventCallbacks } from './mastra-workflow.js';
import type { StructuredOutput, SpeakingStyle, ConversationContext } from '../../shared/types.js';

// ── Helpers ──

const validStyle = fc.constantFrom<SpeakingStyle>('soft', 'flirty', 'serious');
const nonEmptyString = fc.string({ minLength: 1, maxLength: 100 });

function createMockAgent(output?: Partial<StructuredOutput>) {
  const defaultOutput: StructuredOutput = {
    style: 'soft',
    spokenResponse: 'Here is your note.',
    noteDraft: 'A love note for you.',
    tags: ['#sweet'],
  };
  const merged = { ...defaultOutput, ...output };
  return {
    id: 'test-agent',
    name: 'TestAgent',
    generate: vi.fn().mockResolvedValue({
      object: merged,
      text: JSON.stringify(merged),
    }),
  } as any;
}

// ── Property 3: New sessions start in collect stage (Task 5.3) ──

describe('Property 3: New sessions start in collect stage', () => {
  it('any session ID starts in collect with null context fields', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        (sessionId) => {
          const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
          const ctx = engine.createSession(sessionId);

          expect(ctx.sessionId).toBe(sessionId);
          expect(ctx.stage).toBe('collect');
          expect(ctx.recipient).toBeNull();
          expect(ctx.situation).toBeNull();
          expect(ctx.desiredTone).toBeNull();
          expect(ctx.desiredOutcome).toBeNull();
          expect(ctx.currentDraft).toBeNull();
          expect(ctx.currentTags).toEqual([]);
          expect(ctx.currentStyle).toBeNull();
          expect(ctx.conversationHistory).toEqual([]);
          expect(ctx.createdAt).toBeInstanceOf(Date);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('session is retrievable after creation', () => {
    fc.assert(
      fc.property(fc.uuid(), (sessionId) => {
        const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
        engine.createSession(sessionId);
        const retrieved = engine.getSession(sessionId);
        expect(retrieved).toBeDefined();
        expect(retrieved!.sessionId).toBe(sessionId);
        expect(retrieved!.stage).toBe('collect');
      }),
      { numRuns: 50 },
    );
  });

  it('multiple sessions are independent', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        (id1, id2) => {
          fc.pre(id1 !== id2);
          const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
          const ctx1 = engine.createSession(id1);
          const ctx2 = engine.createSession(id2);

          expect(ctx1.sessionId).toBe(id1);
          expect(ctx2.sessionId).toBe(id2);
          expect(engine.getSessionCount()).toBe(2);

          // Modifying one doesn't affect the other
          ctx1.recipient = 'Alice';
          expect(ctx2.recipient).toBeNull();
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── Property 4: Complete context triggers compose transition (Task 5.4) ──

describe('Property 4: Complete context triggers compose transition', () => {
  it('isContextComplete returns true when all four fields are non-null', () => {
    fc.assert(
      fc.property(
        nonEmptyString,
        nonEmptyString,
        nonEmptyString,
        nonEmptyString,
        (recipient, situation, tone, outcome) => {
          const ctx: ConversationContext = {
            sessionId: 'test',
            stage: 'collect',
            recipient,
            situation,
            desiredTone: tone,
            desiredOutcome: outcome,
            currentDraft: null,
            currentTags: [],
            currentStyle: null,
            conversationHistory: [],
            createdAt: new Date(),
          };
          expect(isContextComplete(ctx)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('isContextComplete returns false when any field is null', () => {
    const nullableField = fc.constantFrom('recipient', 'situation', 'desiredTone', 'desiredOutcome');
    fc.assert(
      fc.property(
        nonEmptyString,
        nonEmptyString,
        nonEmptyString,
        nonEmptyString,
        nullableField,
        (recipient, situation, tone, outcome, fieldToNull) => {
          const ctx: ConversationContext = {
            sessionId: 'test',
            stage: 'collect',
            recipient,
            situation,
            desiredTone: tone,
            desiredOutcome: outcome,
            currentDraft: null,
            currentTags: [],
            currentStyle: null,
            conversationHistory: [],
            createdAt: new Date(),
          };
          (ctx as any)[fieldToNull] = null;
          expect(isContextComplete(ctx)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('complete context transitions to compose on processTranscript', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyString,
        nonEmptyString,
        nonEmptyString,
        nonEmptyString,
        nonEmptyString,
        async (recipient, situation, tone, outcome, transcript) => {
          const agent = createMockAgent();
          const engine = new MastraWorkflowEngine(undefined, undefined, agent);
          const ctx = engine.createSession('s1');

          ctx.recipient = recipient;
          ctx.situation = situation;
          ctx.desiredTone = tone;
          ctx.desiredOutcome = outcome;

          const result = await engine.processTranscript('s1', transcript);
          expect(result.stage).toBe('compose');
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── Property 6: Structured output routes to correct events (Task 5.5) ──

describe('Property 6: Structured output routes to correct events', () => {
  it('compose stage emits ui.style with the output style', async () => {
    await fc.assert(
      fc.asyncProperty(
        validStyle,
        nonEmptyString,
        nonEmptyString,
        fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
        async (style, spoken, draft, tags) => {
          const onStyleUpdate = vi.fn();
          const onNoteDraftUpdate = vi.fn();
          const callbacks: WorkflowEventCallbacks = { onStyleUpdate, onNoteDraftUpdate };

          const agent = createMockAgent({ style, spokenResponse: spoken, noteDraft: draft, tags });
          const engine = new MastraWorkflowEngine(undefined, callbacks, agent);
          const ctx = engine.createSession('s1');
          ctx.recipient = 'Someone';
          ctx.situation = 'Valentine';
          ctx.desiredTone = 'soft';
          ctx.desiredOutcome = 'Express love';

          await engine.processTranscript('s1', 'compose now');

          expect(onStyleUpdate).toHaveBeenCalledWith(style);
        },
      ),
      { numRuns: 30 },
    );
  });

  it('compose stage emits ui.noteDraft with draft and tags', async () => {
    await fc.assert(
      fc.asyncProperty(
        validStyle,
        nonEmptyString,
        nonEmptyString,
        fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
        async (style, spoken, draft, tags) => {
          const onStyleUpdate = vi.fn();
          const onNoteDraftUpdate = vi.fn();
          const callbacks: WorkflowEventCallbacks = { onStyleUpdate, onNoteDraftUpdate };

          const agent = createMockAgent({ style, spokenResponse: spoken, noteDraft: draft, tags });
          const engine = new MastraWorkflowEngine(undefined, callbacks, agent);
          const ctx = engine.createSession('s1');
          ctx.recipient = 'Someone';
          ctx.situation = 'Valentine';
          ctx.desiredTone = 'soft';
          ctx.desiredOutcome = 'Express love';

          await engine.processTranscript('s1', 'compose now');

          expect(onNoteDraftUpdate).toHaveBeenCalledWith(draft, tags);
        },
      ),
      { numRuns: 30 },
    );
  });

  it('refine stage also emits both events', async () => {
    await fc.assert(
      fc.asyncProperty(
        validStyle,
        nonEmptyString,
        nonEmptyString,
        fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
        async (style, spoken, draft, tags) => {
          const onStyleUpdate = vi.fn();
          const onNoteDraftUpdate = vi.fn();
          const callbacks: WorkflowEventCallbacks = { onStyleUpdate, onNoteDraftUpdate };

          const agent = createMockAgent({ style, spokenResponse: spoken, noteDraft: draft, tags });
          const engine = new MastraWorkflowEngine(undefined, callbacks, agent);
          const ctx = engine.createSession('s1');
          ctx.recipient = 'Someone';
          ctx.situation = 'Valentine';
          ctx.desiredTone = 'soft';
          ctx.desiredOutcome = 'Express love';
          ctx.stage = 'compose';
          ctx.currentDraft = 'Old draft';
          ctx.currentTags = ['#old'];
          ctx.currentStyle = 'soft';

          await engine.processRefinement('s1', { type: 'shorter' });

          expect(onStyleUpdate).toHaveBeenCalledWith(style);
          expect(onNoteDraftUpdate).toHaveBeenCalledWith(draft, tags);
        },
      ),
      { numRuns: 30 },
    );
  });
});

// ── Property 7: Refinement preserves non-draft context (Task 5.6) ──

describe('Property 7: Refinement preserves non-draft context', () => {
  const refinementTypes = fc.constantFrom(
    'shorter' as const,
    'bolder' as const,
    'more_romantic' as const,
    'translate_french' as const,
  );

  it('non-draft fields are unchanged after refinement', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonEmptyString,
        nonEmptyString,
        nonEmptyString,
        nonEmptyString,
        refinementTypes,
        validStyle,
        nonEmptyString,
        nonEmptyString,
        async (recipient, situation, tone, outcome, refinementType, newStyle, newDraft, newSpoken) => {
          const agent = createMockAgent({
            style: newStyle,
            spokenResponse: newSpoken,
            noteDraft: newDraft,
            tags: ['#refined'],
          });
          const engine = new MastraWorkflowEngine(undefined, undefined, agent);
          const ctx = engine.createSession('s1');
          ctx.recipient = recipient;
          ctx.situation = situation;
          ctx.desiredTone = tone;
          ctx.desiredOutcome = outcome;
          ctx.stage = 'compose';
          ctx.currentDraft = 'Original draft';
          ctx.currentTags = ['#original'];
          ctx.currentStyle = 'soft';

          await engine.processRefinement('s1', { type: refinementType });

          const updated = engine.getSession('s1')!;
          // Non-draft fields MUST be preserved
          expect(updated.recipient).toBe(recipient);
          expect(updated.situation).toBe(situation);
          expect(updated.desiredTone).toBe(tone);
          expect(updated.desiredOutcome).toBe(outcome);
          // Draft fields should be updated
          expect(updated.currentDraft).toBe(newDraft);
          expect(updated.stage).toBe('refine');
        },
      ),
      { numRuns: 50 },
    );
  });

  it('refinement updates draft-related fields correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        refinementTypes,
        validStyle,
        nonEmptyString,
        fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
        async (refinementType, style, draft, tags) => {
          const agent = createMockAgent({ style, noteDraft: draft, tags, spokenResponse: 'Done!' });
          const engine = new MastraWorkflowEngine(undefined, undefined, agent);
          const ctx = engine.createSession('s1');
          ctx.recipient = 'Someone';
          ctx.situation = 'Something';
          ctx.desiredTone = 'soft';
          ctx.desiredOutcome = 'Love';
          ctx.stage = 'compose';
          ctx.currentDraft = 'Old';
          ctx.currentTags = ['#old'];
          ctx.currentStyle = 'soft';

          await engine.processRefinement('s1', { type: refinementType });

          const updated = engine.getSession('s1')!;
          expect(updated.currentDraft).toBe(draft);
          expect(updated.currentTags).toEqual(tags);
          expect(updated.currentStyle).toBe(style);
        },
      ),
      { numRuns: 50 },
    );
  });
});
