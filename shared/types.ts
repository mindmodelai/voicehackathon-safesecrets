// ── Speaking style and workflow types ──

export type SpeakingStyle = 'soft' | 'flirty' | 'serious';

export type WorkflowStage = 'collect' | 'compose' | 'refine';

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';

// ── Sovereignty mode (data residency dial) ──

export type SovereigntyMode =
  | 'full_canada'        // All services in ca-central-1, Polly Neural
  | 'canada_us_voice'    // Bedrock+Transcribe in CA, Polly Generative in us-east-1
  | 'us_bedrock_voice'   // Bedrock+Transcribe+Polly all in us-east-1, Polly Generative
  | 'full_us'            // All US + Smallest.ai TTS
  | 'aws_free';          // Smallest.ai STT+TTS, OpenAI LLM (no AWS required)

export interface SovereigntyModeConfig {
  label: string;
  description: string;
  bedrockRegion: string | null; // null when using OpenAI
  transcribeRegion: string | null; // null when using Smallest.ai STT
  pollyRegion: string | null; // null when using Smallest.ai TTS
  pollyEngine: 'neural' | 'generative';
  ttsProvider: 'polly' | 'smartest_ai';
  sttProvider: 'transcribe' | 'smallest_ai';
  llmProvider: 'bedrock' | 'openai';
}

export const SOVEREIGNTY_MODES: Record<SovereigntyMode, SovereigntyModeConfig> = {
  full_canada: {
    label: 'All Canadian',
    description: 'All services in ca-central-1 (Polly Neural)',
    bedrockRegion: 'ca-central-1',
    transcribeRegion: 'ca-central-1',
    pollyRegion: 'ca-central-1',
    pollyEngine: 'neural',
    ttsProvider: 'polly',
    sttProvider: 'transcribe',
    llmProvider: 'bedrock',
  },
  canada_us_voice: {
    label: 'All American',
    description: 'Bedrock & Transcribe in CA, Polly Generative in US',
    bedrockRegion: 'ca-central-1',
    transcribeRegion: 'ca-central-1',
    pollyRegion: 'us-east-1',
    pollyEngine: 'generative',
    ttsProvider: 'polly',
    sttProvider: 'transcribe',
    llmProvider: 'bedrock',
  },
  us_bedrock_voice: {
    label: 'All USA',
    description: 'All services in us-east-1 (Polly Generative)',
    bedrockRegion: 'us-east-1',
    transcribeRegion: 'us-east-1',
    pollyRegion: 'us-east-1',
    pollyEngine: 'generative',
    ttsProvider: 'polly',
    sttProvider: 'transcribe',
    llmProvider: 'bedrock',
  },
  full_us: {
    label: 'Full US + Smallest.ai',
    description: 'US endpoints with Smallest.ai TTS',
    bedrockRegion: 'us-east-1',
    transcribeRegion: 'us-east-1',
    pollyRegion: 'us-east-1',
    pollyEngine: 'generative',
    ttsProvider: 'smartest_ai',
    sttProvider: 'transcribe',
    llmProvider: 'bedrock',
  },
  aws_free: {
    label: '🚀 AWS-Free (OpenAI + Smallest.ai)',
    description: 'No AWS required - OpenAI LLM, Smallest.ai STT+TTS',
    bedrockRegion: null,
    transcribeRegion: null,
    pollyRegion: null,
    pollyEngine: 'generative',
    ttsProvider: 'smartest_ai',
    sttProvider: 'smallest_ai',
    llmProvider: 'openai',
  },
};

// ── Structured Output (Bedrock LLM response contract) ──

export type Phoneme = 'MBP' | 'TDNL' | 'AHAA' | 'OUW' | 'EE' | 'FV';

export interface StructuredOutput {
  style: SpeakingStyle;
  spokenResponse: string;
  noteDraft: string;
  tags: string[];
  phoneme: Phoneme;
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
  | { type: 'audio'; payload: { data: ArrayBuffer | Uint8Array; sampleRate: number } }
  | { type: 'control'; payload: { action: 'start_conversation' } }
  | { type: 'control'; payload: { action: 'end_conversation' } }
  | { type: 'control'; payload: { action: 'refinement'; data: RefinementRequest } }
  | { type: 'control'; payload: { action: 'set_mode'; data: { mode: SovereigntyMode } } };

export type ServerMessage =
  | { type: 'event'; event: 'session_ready' }
  | { type: 'event'; event: 'user_speaking_start' }
  | { type: 'event'; event: 'partial_transcript'; data: { text: string } }
  | { type: 'event'; event: 'final_transcript'; data: { text: string } }
  | { type: 'event'; event: 'ui.style'; data: { style: SpeakingStyle } }
  | { type: 'event'; event: 'ui.noteDraft'; data: { noteDraft: string; tags: string[] } }
  | { type: 'event'; event: 'tts.start' }
  | { type: 'event'; event: 'tts.end' }
  | { type: 'audio'; payload: { data: ArrayBuffer | Uint8Array } }
  | { type: 'event'; event: 'error'; data: { message: string } }
  | { type: 'event'; event: 'assistant_response'; data: { text: string; stage: string; phoneme?: Phoneme; style?: SpeakingStyle; noteDraft?: string; tags?: string[] } }
  | { type: 'event'; event: 'mode_changed'; data: { mode: SovereigntyMode } }
  | { type: 'event'; event: 'conversation_ended' };

// ── Avatar events ──

export type AvatarEvent =
  | { type: 'USER_SPEAKING_START' }
  | { type: 'USER_SPEAKING_END' }
  | { type: 'TTS_START' }
  | { type: 'TTS_END' }
  | { type: 'THINKING_START' }
  | { type: 'THINKING_END' };
