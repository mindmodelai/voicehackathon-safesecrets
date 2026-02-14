// ── Prompt Builders ──
// Stage-specific prompts sent to the LLM on each turn.
// Edit these to change how the AI handles each conversation stage.

import type { ConversationContext, RefinementRequest } from '../../shared/types.js';

export function buildCollectPrompt(transcript: string, ctx: ConversationContext): string {
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

export function buildComposePrompt(ctx: ConversationContext): string {
  return [
    'Stage: COMPOSE',
    `Recipient: ${ctx.recipient}`,
    `Situation: ${ctx.situation}`,
    `Desired tone: ${ctx.desiredTone}`,
    `Desired outcome: ${ctx.desiredOutcome}`,
    '',
    'Compose a beautiful, personalized love note based on the context above.',
    'IMPORTANT: Set spokenResponse to the love note itself, read aloud warmly and naturally.',
    'Do NOT explain or describe the note in spokenResponse — just read it.',
    'Set noteDraft to the same love note text.',
    'Set tags to descriptive tags for the note (e.g., #sweet, #romantic).',
    'Set style to match the desired tone.',
  ].join('\n');
}

export function buildRefinePrompt(
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
    'IMPORTANT: Set spokenResponse to the updated note read aloud. Do NOT explain what changed.',
  ].join('\n');
}
