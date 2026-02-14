import { describe, it, expect, vi } from 'vitest';
import { BedrockAdapter, BedrockValidationError } from './bedrock-adapter.js';
import type { ConversationContext } from '../../shared/types.js';

// ── Helpers ──

function makeContext(overrides: Partial<ConversationContext> = {}): ConversationContext {
  return {
    sessionId: 'test-session',
    stage: 'compose',
    recipient: 'Alice',
    situation: 'anniversary',
    desiredTone: 'romantic',
    desiredOutcome: 'heartfelt note',
    currentDraft: null,
    currentTags: [],
    currentStyle: null,
    conversationHistory: [],
    createdAt: new Date('2025-02-14'),
    ...overrides,
  };
}

const VALID_OUTPUT = {
  style: 'soft' as const,
  spokenResponse: 'Here is your love note.',
  noteDraft: 'Roses are red, violets are blue.',
  tags: ['romantic', 'sweet'],
};

/**
 * Builds a mock BedrockRuntimeClient whose `send()` resolves with
 * a response body containing the given content wrapped in Claude's envelope.
 */
function buildMockClient(textContent: string) {
  const envelope = {
    content: [{ type: 'text', text: textContent }],
  };
  const body = new TextEncoder().encode(JSON.stringify(envelope));
  const send = vi.fn().mockResolvedValue({ body });
  return { send } as any;
}

/** Client that returns raw body (no Claude envelope). */
function buildRawClient(rawBody: string) {
  const body = new TextEncoder().encode(rawBody);
  const send = vi.fn().mockResolvedValue({ body });
  return { send } as any;
}

/** Client whose send() rejects with an error. */
function buildErrorClient(error: Error) {
  const send = vi.fn().mockRejectedValue(error);
  return { send } as any;
}

/** Client that returns different responses on successive calls. */
function buildSequenceClient(responses: string[]) {
  let callIndex = 0;
  const send = vi.fn().mockImplementation(() => {
    const text = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    const envelope = { content: [{ type: 'text', text }] };
    const body = new TextEncoder().encode(JSON.stringify(envelope));
    return Promise.resolve({ body });
  });
  return { send } as any;
}

// ── Tests ──

describe('BedrockAdapter', () => {
  describe('region configuration', () => {
    it('should report ca-central-1 as the pinned region', () => {
      const adapter = new BedrockAdapter(buildMockClient(JSON.stringify(VALID_OUTPUT)));
      expect(adapter.getRegion()).toBe('ca-central-1');
    });
  });

  describe('model ID', () => {
    it('should use the provided model ID', () => {
      const adapter = new BedrockAdapter(
        buildMockClient(JSON.stringify(VALID_OUTPUT)),
        'my-custom-model',
      );
      expect(adapter.getModelId()).toBe('my-custom-model');
    });

    it('should fall back to default model ID when none provided', () => {
      const adapter = new BedrockAdapter(buildMockClient(JSON.stringify(VALID_OUTPUT)));
      expect(adapter.getModelId()).toBeTruthy();
    });
  });

  describe('generateStructuredResponse', () => {
    it('should return a valid StructuredOutput on success', async () => {
      const client = buildMockClient(JSON.stringify(VALID_OUTPUT));
      const adapter = new BedrockAdapter(client, 'test-model');

      const result = await adapter.generateStructuredResponse('Write a love note', makeContext());

      expect(result).toEqual(VALID_OUTPUT);
    });

    it('should send the correct model ID in the command', async () => {
      const client = buildMockClient(JSON.stringify(VALID_OUTPUT));
      const adapter = new BedrockAdapter(client, 'my-model-id');

      await adapter.generateStructuredResponse('test', makeContext());

      expect(client.send).toHaveBeenCalledTimes(1);
      const command = client.send.mock.calls[0][0];
      expect(command.input.modelId).toBe('my-model-id');
      expect(command.input.contentType).toBe('application/json');
      expect(command.input.accept).toBe('application/json');
    });

    it('should include the prompt and context in the request body', async () => {
      const client = buildMockClient(JSON.stringify(VALID_OUTPUT));
      const adapter = new BedrockAdapter(client, 'test-model');
      const ctx = makeContext({ recipient: 'Bob', situation: 'birthday' });

      await adapter.generateStructuredResponse('Make it romantic', ctx);

      const command = client.send.mock.calls[0][0];
      const requestBody = JSON.parse(new TextDecoder().decode(command.input.body));
      const userMessage = requestBody.messages[0].content;

      expect(userMessage).toContain('Make it romantic');
      expect(userMessage).toContain('Bob');
      expect(userMessage).toContain('birthday');
      expect(userMessage).toContain('"spokenResponse"');
    });

    it('should include the JSON schema in the prompt', async () => {
      const client = buildMockClient(JSON.stringify(VALID_OUTPUT));
      const adapter = new BedrockAdapter(client, 'test-model');

      await adapter.generateStructuredResponse('test', makeContext());

      const command = client.send.mock.calls[0][0];
      const requestBody = JSON.parse(new TextDecoder().decode(command.input.body));
      const userMessage = requestBody.messages[0].content;

      expect(userMessage).toContain('"spokenResponse"');
      expect(userMessage).toContain('"noteDraft"');
      expect(userMessage).toContain('"style"');
      expect(userMessage).toContain('"tags"');
    });

    it('should handle response wrapped in markdown fences', async () => {
      const fenced = '```json\n' + JSON.stringify(VALID_OUTPUT) + '\n```';
      const client = buildMockClient(fenced);
      const adapter = new BedrockAdapter(client, 'test-model');

      const result = await adapter.generateStructuredResponse('test', makeContext());
      expect(result).toEqual(VALID_OUTPUT);
    });

    it('should handle older completion-style response format', async () => {
      const envelope = { completion: JSON.stringify(VALID_OUTPUT) };
      const body = new TextEncoder().encode(JSON.stringify(envelope));
      const client = { send: vi.fn().mockResolvedValue({ body }) } as any;
      const adapter = new BedrockAdapter(client, 'test-model');

      const result = await adapter.generateStructuredResponse('test', makeContext());
      expect(result).toEqual(VALID_OUTPUT);
    });
  });

  describe('retry logic', () => {
    it('should retry once on invalid response then succeed', async () => {
      const invalidJson = '{"style":"soft"}'; // missing required fields
      const validJson = JSON.stringify(VALID_OUTPUT);
      const client = buildSequenceClient([invalidJson, validJson]);
      const adapter = new BedrockAdapter(client, 'test-model');

      const result = await adapter.generateStructuredResponse('test', makeContext());

      expect(result).toEqual(VALID_OUTPUT);
      expect(client.send).toHaveBeenCalledTimes(2);
    });

    it('should retry once on unparseable response then succeed', async () => {
      const garbage = 'not json at all';
      const validJson = JSON.stringify(VALID_OUTPUT);
      const client = buildSequenceClient([garbage, validJson]);
      const adapter = new BedrockAdapter(client, 'test-model');

      const result = await adapter.generateStructuredResponse('test', makeContext());

      expect(result).toEqual(VALID_OUTPUT);
      expect(client.send).toHaveBeenCalledTimes(2);
    });

    it('should throw BedrockValidationError after two invalid responses', async () => {
      const invalidJson = '{"style":"soft"}';
      const client = buildSequenceClient([invalidJson, invalidJson]);
      const adapter = new BedrockAdapter(client, 'test-model');

      await expect(
        adapter.generateStructuredResponse('test', makeContext()),
      ).rejects.toThrow(BedrockValidationError);
      expect(client.send).toHaveBeenCalledTimes(2);
    });

    it('should throw BedrockValidationError after two unparseable responses', async () => {
      const garbage = 'not json';
      const client = buildSequenceClient([garbage, garbage]);
      const adapter = new BedrockAdapter(client, 'test-model');

      await expect(
        adapter.generateStructuredResponse('test', makeContext()),
      ).rejects.toThrow(BedrockValidationError);
      expect(client.send).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on SDK/network errors', async () => {
      const client = buildErrorClient(new Error('Network timeout'));
      const adapter = new BedrockAdapter(client, 'test-model');

      await expect(
        adapter.generateStructuredResponse('test', makeContext()),
      ).rejects.toThrow('Network timeout');
      expect(client.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('conversation context handling', () => {
    it('should include conversation history in the prompt', async () => {
      const client = buildMockClient(JSON.stringify(VALID_OUTPUT));
      const adapter = new BedrockAdapter(client, 'test-model');
      const ctx = makeContext({
        conversationHistory: [
          { role: 'user', content: 'Hi there' },
          { role: 'assistant', content: 'Hello!' },
        ],
      });

      await adapter.generateStructuredResponse('test', ctx);

      const command = client.send.mock.calls[0][0];
      const requestBody = JSON.parse(new TextDecoder().decode(command.input.body));
      const userMessage = requestBody.messages[0].content;

      expect(userMessage).toContain('user: Hi there');
      expect(userMessage).toContain('assistant: Hello!');
    });

    it('should include current draft and tags when present', async () => {
      const client = buildMockClient(JSON.stringify(VALID_OUTPUT));
      const adapter = new BedrockAdapter(client, 'test-model');
      const ctx = makeContext({
        currentDraft: 'My love for you...',
        currentTags: ['romantic', 'poetic'],
        currentStyle: 'flirty',
      });

      await adapter.generateStructuredResponse('test', ctx);

      const command = client.send.mock.calls[0][0];
      const requestBody = JSON.parse(new TextDecoder().decode(command.input.body));
      const userMessage = requestBody.messages[0].content;

      expect(userMessage).toContain('My love for you...');
      expect(userMessage).toContain('romantic, poetic');
      expect(userMessage).toContain('flirty');
    });
  });
});
