/**
 * OpenAI LLM Adapter
 * 
 * Provides LLM inference via OpenAI API (or OpenAI-compatible endpoints).
 * Alternative to AWS Bedrock for users without AWS credentials.
 */

import OpenAI from 'openai';
import { validateStructuredOutput, structuredOutputSchema } from '../../shared/schema.js';
import type { StructuredOutput, ConversationContext } from '../../shared/types.js';

/**
 * Error thrown when OpenAI returns an invalid or unparseable response
 * after exhausting retry attempts.
 */
export class OpenAIValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message);
    this.name = 'OpenAIValidationError';
  }
}

/**
 * Builds the prompt sent to OpenAI, embedding the JSON schema and conversation context.
 */
function buildPrompt(prompt: string, context: ConversationContext): string {
  const schemaBlock = JSON.stringify(structuredOutputSchema, null, 2);

  const contextBlock = [
    `Session: ${context.sessionId}`,
    `Stage: ${context.stage}`,
    `Recipient: ${context.recipient ?? 'unknown'}`,
    `Situation: ${context.situation ?? 'unknown'}`,
    `Desired tone: ${context.desiredTone ?? 'unknown'}`,
    `Desired outcome: ${context.desiredOutcome ?? 'unknown'}`,
    context.currentDraft ? `Current draft: ${context.currentDraft}` : null,
    context.currentTags.length > 0 ? `Current tags: ${context.currentTags.join(', ')}` : null,
    context.currentStyle ? `Current style: ${context.currentStyle}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const historyBlock =
    context.conversationHistory.length > 0
      ? context.conversationHistory
          .map((m) => `${m.role}: ${m.content}`)
          .join('\n')
      : 'No conversation history yet.';

  return [
    'You are a Valentine\'s Day love-note assistant. Respond ONLY with valid JSON matching this schema:',
    '',
    '```json',
    schemaBlock,
    '```',
    '',
    '--- Conversation context ---',
    contextBlock,
    '',
    '--- Conversation history ---',
    historyBlock,
    '',
    '--- User message ---',
    prompt,
    '',
    'Respond with ONLY the JSON object. No markdown, no explanation.',
  ].join('\n');
}

/**
 * Attempts to parse and validate a raw OpenAI response as StructuredOutput.
 * Returns the validated output or throws with details.
 */
function parseResponse(raw: string): StructuredOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OpenAIValidationError('OpenAI response is not valid JSON', [
      `Parse error for: ${raw.slice(0, 200)}`,
    ]);
  }

  const result = validateStructuredOutput(parsed);
  if (!result.valid) {
    throw new OpenAIValidationError(
      'OpenAI response does not match StructuredOutput schema',
      result.errors,
    );
  }

  return result.data;
}

export class OpenAIAdapter {
  private client: OpenAI;
  private modelId: string;

  constructor(client?: OpenAI, modelId?: string, apiKey?: string, baseURL?: string) {
    if (client) {
      this.client = client;
    } else {
      const key = apiKey ?? process.env.OPENAI_API_KEY;
      if (!key) {
        throw new Error('OpenAI API key is required. Set OPENAI_API_KEY env var.');
      }
      this.client = new OpenAI({
        apiKey: key,
        baseURL: baseURL ?? process.env.OPENAI_BASE_URL,
      });
    }
    this.modelId = modelId ?? process.env.OPENAI_MODEL_ID ?? 'gpt-4o-mini';
  }

  /**
   * Sends a prompt with conversation context to OpenAI and returns a validated
   * StructuredOutput. Retries once on invalid/unparseable responses.
   */
  async generateStructuredResponse(
    prompt: string,
    context: ConversationContext,
  ): Promise<StructuredOutput> {
    const fullPrompt = buildPrompt(prompt, context);

    // First attempt
    try {
      return await this.invoke(fullPrompt);
    } catch (err) {
      if (!(err instanceof OpenAIValidationError)) {
        throw err; // Network / SDK errors are not retried
      }
    }

    // Retry once on validation failure
    return this.invoke(fullPrompt);
  }

  /**
   * Low-level invoke: sends the prompt to OpenAI and parses the response.
   */
  private async invoke(fullPrompt: string): Promise<StructuredOutput> {
    const response = await this.client.chat.completions.create({
      model: this.modelId,
      messages: [{ role: 'user', content: fullPrompt }],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const textContent = response.choices[0]?.message?.content ?? '';
    if (!textContent) {
      throw new OpenAIValidationError('OpenAI returned empty response', []);
    }

    // Strip markdown fences if the model wrapped the JSON
    let cleaned = textContent.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    return parseResponse(cleaned);
  }

  /**
   * Returns the provider name for logging/debugging.
   */
  getProvider(): string {
    return 'openai';
  }

  /**
   * Returns the model ID in use.
   */
  getModelId(): string {
    return this.modelId;
  }
}
