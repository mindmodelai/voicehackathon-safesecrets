// ── Speaking style and workflow types ──

export type SpeakingStyle = 'soft' | 'flirty' | 'serious';

export type WorkflowStage = 'collect' | 'compose' | 'refine';

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

// ── Structured Output (Bedrock LLM response contract) ──

export interface StructuredOutput {
  style: SpeakingStyle;
  spokenResponse: string;
  noteDraft: string;
  tags: string[];
}

// ── Refinement ──

export interface RefinementRequest {
  type: 'shorter' | 'bolder' | 'more_romantic' | 'translate_french';
}

// ── Conversation context ──

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationContext {
  sessionId: string;
  stage: WorkflowStage;
  recipient: string | null;
  situation: string | null;
  desiredTone: string | null;
  desiredOutcome: string | null;
  currentDraft: string | null;
  currentTags: string[];
  currentStyle: SpeakingStyle | null;
  conversationHistory: Message[];
  createdAt: Date;
}

// ── WebSocket messages ──

export type ClientMessage =
  | { type: 'audio'; payload: { data: ArrayBuffer; sampleRate: number } }
  | { type: 'control'; payload: { action: 'start_conversation' } }
  | { type: 'control'; payload: { action: 'end_conversation' } }
  | { type: 'control'; payload: { action: 'refinement'; data: RefinementRequest } };

export type ServerMessage =
  | { type: 'event'; event: 'session_ready' }
  | { type: 'event'; event: 'user_speaking_start' }
  | { type: 'event'; event: 'partial_transcript'; data: { text: string } }
  | { type: 'event'; event: 'final_transcript'; data: { text: string } }
  | { type: 'event'; event: 'ui.style'; data: { style: SpeakingStyle } }
  | { type: 'event'; event: 'ui.noteDraft'; data: { noteDraft: string; tags: string[] } }
  | { type: 'event'; event: 'tts.start' }
  | { type: 'event'; event: 'tts.end' }
  | { type: 'audio'; payload: { data: ArrayBuffer } }
  | { type: 'event'; event: 'error'; data: { message: string } };

// ── Avatar events ──

export type AvatarEvent =
  | { type: 'USER_SPEAKING_START' }
  | { type: 'USER_SPEAKING_END' }
  | { type: 'TTS_START'; style: SpeakingStyle }
  | { type: 'TTS_END' }
  | { type: 'THINKING_START' }
  | { type: 'THINKING_END' };
