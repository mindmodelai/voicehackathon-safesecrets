import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MastraWorkflowEngine, isContextComplete } from './mastra-workflow.js';
import type { WorkflowEventCallbacks } from './mastra-workflow.js';
import type { ConversationContext, StructuredOutput } from '../../shared/types.js';

// ── Mock Agent ──

function createMockAgent(responseObj?: Partial<StructuredOutput>) {
  const defaultOutput: StructuredOutput = {
    style: 'soft',
    spokenResponse: 'Tell me more about who this is for.',
    noteDraft: '',
    tags: [],
    phoneme: 'AHAA',
  };
  const output = { ...defaultOutput, ...responseObj };

  return {
    id: 'test-agent',
    name: 'TestAgent',
    generate: vi.fn().mockResolvedValue({
      object: output,
      text: JSON.stringify(output),
    }),
  } as any;
}

function createComposeAgent(): any {
  const output: StructuredOutput = {
    style: 'soft',
    spokenResponse: 'Here is your love note!',
    noteDraft: 'Roses are red, violets are blue...',
    tags: ['#romantic', '#sweet'],
    phoneme: 'AHAA',
  };
  return {
    id: 'test-agent',
    name: 'TestAgent',
    generate: vi.fn().mockResolvedValue({
      object: output,
      text: JSON.stringify(output),
    }),
  } as any;
}

function createFailingAgent(): any {
  return {
    id: 'test-agent',
    name: 'TestAgent',
    generate: vi.fn().mockRejectedValue(new Error('Bedrock unavailable')),
  } as any;
}

describe('MastraWorkflowEngine', () => {
  describe('session management', () => {
    it('creates a new session in collect stage with null context fields', () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
      const ctx = engine.createSession('session-1');

      expect(ctx.sessionId).toBe('session-1');
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
    });

    it('retrieves an existing session', () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
      engine.createSession('s1');
      const ctx = engine.getSession('s1');
      expect(ctx).toBeDefined();
      expect(ctx!.sessionId).toBe('s1');
    });

    it('returns undefined for non-existent session', () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
      expect(engine.getSession('nope')).toBeUndefined();
    });

    it('deletes a session', () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
      engine.createSession('s1');
      expect(engine.deleteSession('s1')).toBe(true);
      expect(engine.getSession('s1')).toBeUndefined();
    });

    it('tracks session count', () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
      expect(engine.getSessionCount()).toBe(0);
      engine.createSession('s1');
      engine.createSession('s2');
      expect(engine.getSessionCount()).toBe(2);
      engine.deleteSession('s1');
      expect(engine.getSessionCount()).toBe(1);
    });
  });

  describe('processTranscript', () => {
    it('throws for unknown session', async () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
      await expect(engine.processTranscript('unknown', 'hello')).rejects.toThrow(
        'No session found for ID: unknown',
      );
    });

    it('processes transcript in collect stage and returns spoken response', async () => {
      const agent = createMockAgent();
      const engine = new MastraWorkflowEngine(undefined, undefined, agent);
      engine.createSession('s1');

      const result = await engine.processTranscript('s1', 'Hi, I want to write a note');

      expect(result.stage).toBe('collect');
      expect(result.spokenResponse).toBeTruthy();
      expect(agent.generate).toHaveBeenCalled();
    });

    it('adds user and assistant messages to conversation history', async () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
      engine.createSession('s1');

      await engine.processTranscript('s1', 'Hello there');

      const ctx = engine.getSession('s1')!;
      expect(ctx.conversationHistory).toHaveLength(2);
      expect(ctx.conversationHistory[0]).toEqual({ role: 'user', content: 'Hello there' });
      expect(ctx.conversationHistory[1].role).toBe('assistant');
    });

    it('transitions to compose when context is complete', async () => {
      const composeAgent = createComposeAgent();
      const engine = new MastraWorkflowEngine(undefined, undefined, composeAgent);
      const ctx = engine.createSession('s1');

      // Pre-fill context to trigger compose transition
      ctx.recipient = 'My partner';
      ctx.situation = 'Our anniversary';
      ctx.desiredTone = 'soft';
      ctx.desiredOutcome = 'Make them feel loved';

      const result = await engine.processTranscript('s1', 'I think that covers everything');

      expect(result.stage).toBe('compose');
      expect(result.structuredOutput).toBeDefined();
      expect(result.structuredOutput!.noteDraft).toBeTruthy();
    });
  });

  describe('event emission', () => {
    it('emits ui.style and ui.noteDraft events on compose', async () => {
      const onStyleUpdate = vi.fn();
      const onNoteDraftUpdate = vi.fn();
      const callbacks: WorkflowEventCallbacks = { onStyleUpdate, onNoteDraftUpdate };

      const engine = new MastraWorkflowEngine(undefined, callbacks, createComposeAgent());
      const ctx = engine.createSession('s1');
      ctx.recipient = 'My love';
      ctx.situation = 'Valentine\'s Day';
      ctx.desiredTone = 'flirty';
      ctx.desiredOutcome = 'Surprise them';

      await engine.processTranscript('s1', 'Ready to compose');

      expect(onStyleUpdate).toHaveBeenCalledWith('soft');
      expect(onNoteDraftUpdate).toHaveBeenCalledWith(
        'Roses are red, violets are blue...',
        ['#romantic', '#sweet'],
      );
    });

    it('emits events on refinement', async () => {
      const onStyleUpdate = vi.fn();
      const onNoteDraftUpdate = vi.fn();
      const callbacks: WorkflowEventCallbacks = { onStyleUpdate, onNoteDraftUpdate };

      const refinedOutput: StructuredOutput = {
        style: 'flirty',
        spokenResponse: 'I made it shorter for you!',
        noteDraft: 'Roses are red...',
        tags: ['#short', '#sweet'],
        phoneme: 'AHAA',
      };
      const agent = {
        id: 'test-agent',
        name: 'TestAgent',
        generate: vi.fn().mockResolvedValue({
          object: refinedOutput,
          text: JSON.stringify(refinedOutput),
        }),
      } as any;

      const engine = new MastraWorkflowEngine(undefined, callbacks, agent);
      const ctx = engine.createSession('s1');
      ctx.recipient = 'My love';
      ctx.situation = 'Valentine\'s Day';
      ctx.desiredTone = 'soft';
      ctx.desiredOutcome = 'Express love';
      ctx.stage = 'compose';
      ctx.currentDraft = 'A long love note...';
      ctx.currentTags = ['#romantic'];
      ctx.currentStyle = 'soft';

      await engine.processRefinement('s1', { type: 'shorter' });

      expect(onStyleUpdate).toHaveBeenCalledWith('flirty');
      expect(onNoteDraftUpdate).toHaveBeenCalledWith('Roses are red...', ['#short', '#sweet']);
    });
  });

  describe('refinement', () => {
    it('throws when refining in collect stage', async () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
      engine.createSession('s1');

      await expect(engine.processRefinement('s1', { type: 'shorter' })).rejects.toThrow(
        'Cannot refine in stage: collect',
      );
    });

    it('preserves non-draft context fields during refinement', async () => {
      const refinedOutput: StructuredOutput = {
        style: 'serious',
        spokenResponse: 'Made it bolder!',
        noteDraft: 'A bold love note',
        tags: ['#bold'],
        phoneme: 'AHAA',
      };
      const agent = {
        id: 'test-agent',
        name: 'TestAgent',
        generate: vi.fn().mockResolvedValue({
          object: refinedOutput,
          text: JSON.stringify(refinedOutput),
        }),
      } as any;

      const engine = new MastraWorkflowEngine(undefined, undefined, agent);
      const ctx = engine.createSession('s1');
      ctx.recipient = 'Alice';
      ctx.situation = 'Birthday';
      ctx.desiredTone = 'soft';
      ctx.desiredOutcome = 'Make her smile';
      ctx.stage = 'compose';
      ctx.currentDraft = 'Original draft';
      ctx.currentTags = ['#original'];
      ctx.currentStyle = 'soft';

      await engine.processRefinement('s1', { type: 'bolder' });

      const updated = engine.getSession('s1')!;
      // Non-draft fields must be preserved
      expect(updated.recipient).toBe('Alice');
      expect(updated.situation).toBe('Birthday');
      expect(updated.desiredTone).toBe('soft');
      expect(updated.desiredOutcome).toBe('Make her smile');
      // Draft fields should be updated
      expect(updated.currentDraft).toBe('A bold love note');
      expect(updated.currentTags).toEqual(['#bold']);
      expect(updated.currentStyle).toBe('serious');
      expect(updated.stage).toBe('refine');
    });

    it('transitions stage to refine on refinement request', async () => {
      const agent = createComposeAgent();
      const engine = new MastraWorkflowEngine(undefined, undefined, agent);
      const ctx = engine.createSession('s1');
      ctx.stage = 'compose';
      ctx.recipient = 'Someone';
      ctx.situation = 'Something';
      ctx.desiredTone = 'soft';
      ctx.desiredOutcome = 'Something nice';
      ctx.currentDraft = 'Draft';

      await engine.processRefinement('s1', { type: 'more_romantic' });

      expect(engine.getSession('s1')!.stage).toBe('refine');
    });
  });

  describe('error handling', () => {
    it('returns fallback response when agent fails in collect', async () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createFailingAgent());
      engine.createSession('s1');

      const result = await engine.processTranscript('s1', 'Hello');

      expect(result.spokenResponse).toContain('help you write something special');
      expect(result.stage).toBe('collect');
    });

    it('returns fallback response when agent fails in compose stage', async () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createFailingAgent());
      const ctx = engine.createSession('s1');
      ctx.recipient = 'Partner';
      ctx.situation = 'Anniversary';
      ctx.desiredTone = 'soft';
      ctx.desiredOutcome = 'Express love';
      ctx.currentDraft = 'A draft';
      // Set stage to compose directly (simulating post-collect transition)
      ctx.stage = 'compose';

      const result = await engine.processTranscript('s1', 'Make it better');

      expect(result.spokenResponse).toContain('trouble');
    });

    it('retries once on agent failure', async () => {
      const agent = createFailingAgent();
      const engine = new MastraWorkflowEngine(undefined, undefined, agent);
      engine.createSession('s1');

      await engine.processTranscript('s1', 'Hello');

      // Should have been called twice (initial + retry)
      expect(agent.generate).toHaveBeenCalledTimes(2);
    });
  });

  describe('workflow and steps', () => {
    it('exposes collectStep, composeStep, refineStep', () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
      expect(engine.collectStep).toBeDefined();
      expect(engine.collectStep.id).toBe('collect');
      expect(engine.composeStep).toBeDefined();
      expect(engine.composeStep.id).toBe('compose');
      expect(engine.refineStep).toBeDefined();
      expect(engine.refineStep.id).toBe('refine');
    });

    it('exposes the workflow', () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
      expect(engine.workflow).toBeDefined();
    });
  });

  describe('accessors', () => {
    it('returns the agent', () => {
      const agent = createMockAgent();
      const engine = new MastraWorkflowEngine(undefined, undefined, agent);
      expect(engine.getAgent()).toBe(agent);
    });

    it('returns ca-central-1 region', () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
      expect(engine.getRegion()).toBe('ca-central-1');
    });

    it('allows updating callbacks', () => {
      const engine = new MastraWorkflowEngine(undefined, undefined, createMockAgent());
      const newCallbacks: WorkflowEventCallbacks = {
        onStyleUpdate: vi.fn(),
        onNoteDraftUpdate: vi.fn(),
      };
      engine.setCallbacks(newCallbacks);
      // No error means success — callbacks are used internally
    });
  });
});

describe('isContextComplete', () => {
  it('returns false when any field is null', () => {
    const base: ConversationContext = {
      sessionId: 'test',
      stage: 'collect',
      recipient: 'Someone',
      situation: 'Something',
      desiredTone: 'soft',
      desiredOutcome: null,
      currentDraft: null,
      currentTags: [],
      currentStyle: null,
      conversationHistory: [],
      createdAt: new Date(),
    };
    expect(isContextComplete(base)).toBe(false);
  });

  it('returns true when all four fields are non-null', () => {
    const ctx: ConversationContext = {
      sessionId: 'test',
      stage: 'collect',
      recipient: 'Someone',
      situation: 'Something',
      desiredTone: 'soft',
      desiredOutcome: 'Express love',
      currentDraft: null,
      currentTags: [],
      currentStyle: null,
      conversationHistory: [],
      createdAt: new Date(),
    };
    expect(isContextComplete(ctx)).toBe(true);
  });
});
