import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { validateStructuredOutput } from '../../shared/schema.js';
import type {
  ConversationContext,
  RefinementRequest,
  StructuredOutput,
  WorkflowStage,
} from '../../shared/types.js';
import type { SafeSecretsVoiceProvider } from './custom-voice-provider.js';

// ── Constants ──

const REGION = 'ca-central-1';

const SYSTEM_INSTRUCTIONS = `You are a warm, creative Valentine's Day assistant called SafeSecrets.
You help users compose personalized love notes and poems through natural conversation.

You operate in three stages:
1. COLLECT: Gather information about the recipient, the situation, desired tone, and desired outcome.
   Ask friendly clarifying questions one at a time. Be warm and encouraging.
2. COMPOSE: Once you have all four pieces of context, compose a beautiful love note.
3. REFINE: When asked to refine, update only the note draft while keeping the same context.

Always respond with valid JSON matching this schema:
{
  "style": "soft" | "flirty" | "serious",
  "spokenResponse": "<conversational text for voice synthesis>",
  "noteDraft": "<the love note text, or empty string if still collecting>",
  "tags": ["<descriptive tags>"]
}`;

// ── Event callback types ──

export interface WorkflowEventCallbacks {
  onStyleUpdate?: (style: StructuredOutput['style']) => void;
  onNoteDraftUpdate?: (noteDraft: string, tags: string[]) => void;
}

// ── Workflow result ──

export interface WorkflowResult {
  structuredOutput?: StructuredOutput;
  spokenResponse: string;
  stage: WorkflowStage;
}

// ── Zod schemas for Mastra steps ──

const transcriptInputSchema = z.object({
  transcript: z.string(),
  sessionId: z.string(),
});

const workflowOutputSchema = z.object({
  spokenResponse: z.string(),
  stage: z.enum(['collect', 'compose', 'refine']),
  style: z.enum(['soft', 'flirty', 'serious']).optional(),
  noteDraft: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const structuredOutputZod = z.object({
  style: z.enum(['soft', 'flirty', 'serious']),
  spokenResponse: z.string().min(1),
  noteDraft: z.string(),
  tags: z.array(z.string()),
  // Context extraction fields (used during collect stage)
  recipient: z.string().nullable().optional(),
  situation: z.string().nullable().optional(),
  desiredTone: z.string().nullable().optional(),
  desiredOutcome: z.string().nullable().optional(),
});

// ── Prompt builders ──

function buildCollectPrompt(transcript: string, ctx: ConversationContext): string {
  const missing: string[] = [];
  if (!ctx.recipient) missing.push('who the message is for');
  if (!ctx.situation) missing.push('what happened or the context/situation');
  if (!ctx.desiredTone) missing.push('the desired tone (soft, flirty, or serious)');
  if (!ctx.desiredOutcome) missing.push('the desired outcome or feeling');

  const historyBlock = ctx.conversationHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  return [
    'Stage: COLLECT',
    `Still need: ${missing.length > 0 ? missing.join(', ') : 'nothing — ready to compose'}`,
    '',
    historyBlock ? `Conversation so far:\n${historyBlock}` : '',
    '',
    `User just said: "${transcript}"`,
    '',
    'Analyze what the user said. Extract any of the four context fields (recipient, situation, desiredTone, desiredOutcome).',
    'Return extracted values in the corresponding fields. Use null for fields not yet known.',
    'If fields are still missing, ask a friendly clarifying question in spokenResponse.',
    'Set noteDraft to "" and tags to [] while still collecting.',
    'Pick a style that matches the conversation mood so far.',
  ].join('\n');
}

function buildComposePrompt(ctx: ConversationContext): string {
  return [
    'Stage: COMPOSE',
    `Recipient: ${ctx.recipient}`,
    `Situation: ${ctx.situation}`,
    `Desired tone: ${ctx.desiredTone}`,
    `Desired outcome: ${ctx.desiredOutcome}`,
    '',
    'Compose a beautiful, personalized love note based on the context above.',
    'Set spokenResponse to a warm conversational message presenting the note.',
    'Set noteDraft to the full love note text.',
    'Set tags to descriptive tags for the note (e.g., #sweet, #romantic).',
    'Set style to match the desired tone.',
  ].join('\n');
}

function buildRefinePrompt(
  transcript: string,
  ctx: ConversationContext,
  refinement?: RefinementRequest,
): string {
  const refinementInstruction = refinement
    ? `The user clicked a refinement button: "${refinement.type}".`
    : `The user said: "${transcript}"`;

  return [
    'Stage: REFINE',
    `Current draft: ${ctx.currentDraft}`,
    `Current tags: ${ctx.currentTags.join(', ')}`,
    `Current style: ${ctx.currentStyle}`,
    `Recipient: ${ctx.recipient}`,
    `Situation: ${ctx.situation}`,
    '',
    refinementInstruction,
    '',
    'Update ONLY the noteDraft based on the refinement request.',
    'Keep the same general meaning but apply the requested change.',
    'Update tags if the character of the note changed.',
    'Set spokenResponse to a brief confirmation of what you changed.',
  ].join('\n');
}

// ── Context helpers ──

export function isContextComplete(ctx: ConversationContext): boolean {
  return (
    ctx.recipient !== null &&
    ctx.situation !== null &&
    ctx.desiredTone !== null &&
    ctx.desiredOutcome !== null
  );
}

function refinementToText(refinement: RefinementRequest): string {
  switch (refinement.type) {
    case 'shorter':
      return 'Make it shorter';
    case 'bolder':
      return 'Make it bolder';
    case 'more_romantic':
      return 'Make it more romantic';
    case 'translate_french':
      return 'Translate it to French';
  }
}

// ── Mastra Workflow Engine ──

export class MastraWorkflowEngine {
  private sessions: Map<string, ConversationContext> = new Map();
  private agent: Agent;
  private callbacks: WorkflowEventCallbacks;

  // Mastra workflow and steps exposed for testing/inspection
  public collectStep;
  public composeStep;
  public refineStep;
  public workflow;

  constructor(
    voiceProvider?: SafeSecretsVoiceProvider,
    callbacks?: WorkflowEventCallbacks,
    agent?: Agent,
  ) {
    this.callbacks = callbacks ?? {};

    const modelId = process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-3-haiku-20240307-v1:0';
    const bedrockProvider = createAmazonBedrock({ region: REGION });

    this.agent =
      agent ??
      new Agent({
        id: 'safesecrets-agent',
        name: 'SafeSecrets',
        model: bedrockProvider(modelId),
        instructions: SYSTEM_INSTRUCTIONS,
        ...(voiceProvider ? { voice: voiceProvider } : {}),
      });

    // Define Mastra steps using createStep
    this.collectStep = createStep({
      id: 'collect',
      inputSchema: transcriptInputSchema,
      outputSchema: workflowOutputSchema,
      execute: async ({ inputData }) => {
        const result = await this.processCollect(inputData.sessionId, inputData.transcript);
        return {
          spokenResponse: result.spokenResponse,
          stage: result.stage,
          style: result.structuredOutput?.style,
          noteDraft: result.structuredOutput?.noteDraft,
          tags: result.structuredOutput?.tags,
        };
      },
    });

    this.composeStep = createStep({
      id: 'compose',
      inputSchema: workflowOutputSchema,
      outputSchema: workflowOutputSchema,
      execute: async ({ inputData }) => {
        // In the pipeline, compose receives the collect step's output.
        // The actual session ID is managed by the engine; this step is
        // primarily for Mastra workflow definition completeness.
        return inputData;
      },
    });

    this.refineStep = createStep({
      id: 'refine',
      inputSchema: workflowOutputSchema,
      outputSchema: workflowOutputSchema,
      execute: async ({ inputData }) => {
        return inputData;
      },
    });

    // Wire steps into a Mastra workflow
    this.workflow = createWorkflow({
      id: 'valentine-note',
      inputSchema: transcriptInputSchema,
      outputSchema: workflowOutputSchema,
    });

    this.workflow
      .then(this.collectStep)
      .then(this.composeStep)
      .then(this.refineStep)
      .commit();
  }

  // ── Session management ──

  createSession(sessionId: string): ConversationContext {
    const ctx: ConversationContext = {
      sessionId,
      stage: 'collect',
      recipient: null,
      situation: null,
      desiredTone: null,
      desiredOutcome: null,
      currentDraft: null,
      currentTags: [],
      currentStyle: null,
      conversationHistory: [],
      createdAt: new Date(),
    };
    this.sessions.set(sessionId, ctx);
    return ctx;
  }

  getSession(sessionId: string): ConversationContext | undefined {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  // ── Main entry points ──

  async processTranscript(sessionId: string, transcript: string): Promise<WorkflowResult> {
    const ctx = this.sessions.get(sessionId);
    if (!ctx) {
      throw new Error(`No session found for ID: ${sessionId}`);
    }

    // Add user message to history
    ctx.conversationHistory.push({ role: 'user', content: transcript });

    let result: WorkflowResult;

    switch (ctx.stage) {
      case 'collect':
        result = await this.processCollect(sessionId, transcript);
        break;
      case 'compose':
        // If already in compose and user sends more text, treat as refinement
        result = await this.processRefine(sessionId, transcript);
        break;
      case 'refine':
        result = await this.processRefine(sessionId, transcript);
        break;
      default:
        throw new Error(`Unknown stage: ${ctx.stage}`);
    }

    // Add assistant response to history
    ctx.conversationHistory.push({ role: 'assistant', content: result.spokenResponse });

    return result;
  }

  async processRefinement(sessionId: string, refinement: RefinementRequest): Promise<WorkflowResult> {
    const ctx = this.sessions.get(sessionId);
    if (!ctx) {
      throw new Error(`No session found for ID: ${sessionId}`);
    }

    if (ctx.stage !== 'compose' && ctx.stage !== 'refine') {
      throw new Error(`Cannot refine in stage: ${ctx.stage}`);
    }

    ctx.stage = 'refine';

    const refinementText = refinementToText(refinement);
    ctx.conversationHistory.push({ role: 'user', content: refinementText });

    const result = await this.processRefine(sessionId, refinementText, refinement);

    ctx.conversationHistory.push({ role: 'assistant', content: result.spokenResponse });

    return result;
  }

  // ── Stage processors ──

  private async processCollect(sessionId: string, transcript: string): Promise<WorkflowResult> {
    const ctx = this.sessions.get(sessionId)!;
    const prompt = buildCollectPrompt(transcript, ctx);

    const output = await this.callAgent(prompt);

    if (output) {
      ctx.currentStyle = output.style;

      // Extract context fields from the LLM response
      const raw = output as unknown as Record<string, unknown>;
      if (raw.recipient && typeof raw.recipient === 'string') {
        ctx.recipient = raw.recipient;
      }
      if (raw.situation && typeof raw.situation === 'string') {
        ctx.situation = raw.situation;
      }
      if (raw.desiredTone && typeof raw.desiredTone === 'string') {
        ctx.desiredTone = raw.desiredTone;
      }
      if (raw.desiredOutcome && typeof raw.desiredOutcome === 'string') {
        ctx.desiredOutcome = raw.desiredOutcome;
      }

      console.log(`[Workflow] Collect stage — recipient: ${ctx.recipient}, situation: ${ctx.situation}, tone: ${ctx.desiredTone}, outcome: ${ctx.desiredOutcome}`);

      // Check if context is now complete → transition to compose
      if (isContextComplete(ctx)) {
        ctx.stage = 'compose';
        return this.processCompose(sessionId);
      }

      return {
        structuredOutput: output,
        spokenResponse: output.spokenResponse,
        stage: ctx.stage,
      };
    }

    return {
      spokenResponse:
        "I'd love to help you write something special. Could you tell me who this message is for?",
      stage: 'collect',
    };
  }

  private async processCompose(sessionId: string): Promise<WorkflowResult> {
    const ctx = this.sessions.get(sessionId)!;
    const prompt = buildComposePrompt(ctx);

    const output = await this.callAgent(prompt);

    if (output) {
      ctx.currentDraft = output.noteDraft;
      ctx.currentTags = output.tags;
      ctx.currentStyle = output.style;
      ctx.stage = 'compose';

      // Emit ui.style and ui.noteDraft events (Requirement 3.4)
      this.callbacks.onStyleUpdate?.(output.style);
      this.callbacks.onNoteDraftUpdate?.(output.noteDraft, output.tags);

      return {
        structuredOutput: output,
        spokenResponse: output.spokenResponse,
        stage: 'compose',
      };
    }

    return {
      spokenResponse: "I'm having trouble composing right now, let me try again.",
      stage: ctx.stage,
    };
  }

  private async processRefine(
    sessionId: string,
    transcript: string,
    refinement?: RefinementRequest,
  ): Promise<WorkflowResult> {
    const ctx = this.sessions.get(sessionId)!;

    // Snapshot non-draft fields to guarantee preservation (Requirement 3.5)
    const preservedRecipient = ctx.recipient;
    const preservedSituation = ctx.situation;
    const preservedDesiredTone = ctx.desiredTone;
    const preservedDesiredOutcome = ctx.desiredOutcome;

    const prompt = buildRefinePrompt(transcript, ctx, refinement);
    const output = await this.callAgent(prompt);

    if (output) {
      // Update only draft-related fields
      ctx.currentDraft = output.noteDraft;
      ctx.currentTags = output.tags;
      ctx.currentStyle = output.style;
      ctx.stage = 'refine';

      // Restore preserved fields — refinement must not alter them
      ctx.recipient = preservedRecipient;
      ctx.situation = preservedSituation;
      ctx.desiredTone = preservedDesiredTone;
      ctx.desiredOutcome = preservedDesiredOutcome;

      // Emit events (Requirement 3.4)
      this.callbacks.onStyleUpdate?.(output.style);
      this.callbacks.onNoteDraftUpdate?.(output.noteDraft, output.tags);

      return {
        structuredOutput: output,
        spokenResponse: output.spokenResponse,
        stage: 'refine',
      };
    }

    return {
      spokenResponse: "I'm having trouble with that refinement, let me try again.",
      stage: ctx.stage,
    };
  }

  // ── LLM call via Mastra Agent ──

  private async callAgent(prompt: string): Promise<StructuredOutput | null> {
    try {
      const response = await this.agent.generate(prompt, {
        structuredOutput: {
          schema: structuredOutputZod,
        },
      });

      // Agent returns typed object when using structuredOutput
      const raw = response.object;
      if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        // Validate core fields exist, but allow extra context fields
        if (obj.style && obj.spokenResponse) {
          return raw as StructuredOutput;
        }
      }

      // Fallback: try parsing text as JSON
      if (response.text) {
        return this.parseResponseText(response.text);
      }

      return null;
    } catch {
      // Retry once on failure (Requirement 3.6)
      try {
        const retryResponse = await this.agent.generate(prompt, {
          structuredOutput: {
            schema: structuredOutputZod,
          },
        });

        const raw = retryResponse.object;
        if (raw && typeof raw === 'object') {
          const obj = raw as Record<string, unknown>;
          if (obj.style && obj.spokenResponse) {
            return raw as StructuredOutput;
          }
        }

        if (retryResponse.text) {
          return this.parseResponseText(retryResponse.text);
        }

        return null;
      } catch {
        return null;
      }
    }
  }

  private parseResponseText(text: string): StructuredOutput | null {
    try {
      let cleaned = text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }
      const parsed = JSON.parse(cleaned);
      const validation = validateStructuredOutput(parsed);
      return validation.valid ? validation.data : null;
    } catch {
      return null;
    }
  }

  // ── Accessors ──

  getAgent(): Agent {
    return this.agent;
  }

  getRegion(): string {
    return REGION;
  }

  setCallbacks(callbacks: WorkflowEventCallbacks): void {
    this.callbacks = callbacks;
  }
}
