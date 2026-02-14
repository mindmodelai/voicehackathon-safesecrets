import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { validateStructuredOutput, structuredOutputSchema } from '../../shared/schema.js';
import type { StructuredOutput, ConversationContext } from '../../shared/types.js';

const REGION = 'ca-central-1';

/**
 * Error thrown when Bedrock returns an invalid or unparseable response
 * after exhausting retry attempts.
 */
export class BedrockValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[],
  ) {
    super(message);
    this.name = 'BedrockValidationError';
  }
}

/**
 * Builds the prompt sent to Bedrock, embedding the JSON schema and conversation context.
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
 * Attempts to parse and validate a raw Bedrock response body as StructuredOutput.
 * Returns the validated output or throws with details.
 */
function parseResponse(raw: string): StructuredOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BedrockValidationError('Bedrock response is not valid JSON', [
      `Parse error for: ${raw.slice(0, 200)}`,
    ]);
  }

  const result = validateStructuredOutput(parsed);
  if (!result.valid) {
    throw new BedrockValidationError(
      'Bedrock response does not match StructuredOutput schema',
      result.errors,
    );
  }

  return result.data;
}

export class BedrockAdapter {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor(client?: BedrockRuntimeClient, modelId?: string) {
    this.client = client ?? new BedrockRuntimeClient({ region: REGION });
    this.modelId = modelId ?? process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-3-haiku-20240307-v1:0';
  }

  /**
   * Sends a prompt with conversation context to Bedrock and returns a validated
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
      if (!(err instanceof BedrockValidationError)) {
        throw err; // Network / SDK errors are not retried
      }
    }

    // Retry once on validation failure
    return this.invoke(fullPrompt);
  }

  /**
   * Low-level invoke: sends the prompt to Bedrock and parses the response.
   */
  private async invoke(fullPrompt: string): Promise<StructuredOutput> {
    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages: [{ role: 'user', content: fullPrompt }],
    });

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(body),
    });

    const response = await this.client.send(command);
    const responseBody = new TextDecoder().decode(response.body);

    // Bedrock wraps the model output in a JSON envelope
    let textContent: string;
    try {
      const envelope = JSON.parse(responseBody);
      // Claude models return content as an array of blocks
      if (Array.isArray(envelope.content)) {
        textContent = envelope.content
          .filter((block: { type: string }) => block.type === 'text')
          .map((block: { text: string }) => block.text)
          .join('');
      } else if (typeof envelope.completion === 'string') {
        // Older model format
        textContent = envelope.completion;
      } else {
        textContent = responseBody;
      }
    } catch {
      textContent = responseBody;
    }

    // Strip markdown fences if the model wrapped the JSON
    textContent = textContent.trim();
    if (textContent.startsWith('```')) {
      textContent = textContent.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    return parseResponse(textContent);
  }

  /**
   * Returns the AWS region this adapter is pinned to.
   */
  getRegion(): string {
    return REGION;
  }

  /**
   * Returns the model ID in use.
   */
  getModelId(): string {
    return this.modelId;
  }
}
