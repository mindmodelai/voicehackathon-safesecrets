# SafeSecrets - About

## Development

### Velocity

**Development Cost**: Approximately 900 Kiro credits at $0.02 per credit (~$18.00 USD)

**Development Environment**: Built using two Kiro instances with separate Kiro Plus accounts. These accounts operate under AWS IAM Identity Center management, providing enterprise-grade privacy controls and centralized identity governance. [Kiro integrates with AWS IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html) to enable secure workforce access management, ensuring development activities benefit from AWS's security infrastructure while maintaining data protection standards.

### Visuals

**Image Generation**: Google Gemini 3.0

**Video Generation**: Google Veo 3.1

### Diagrams

**Infrastructure Architecture**:
- Multi-region AWS service routing with sovereignty mode selection
- EC2 instance (t3.large) hosted in ca-central-1 (Canada)
- Cross-region service orchestration supporting both Canadian and US AWS regions
- WebSocket-based real-time communication architecture

**Data Flow**:
1. User audio capture via browser MediaRecorder API
2. WebSocket streaming to backend server
3. Regional service routing based on sovereignty mode
4. Real-time transcription, inference, and speech synthesis
5. Bidirectional audio streaming back to client

## Orchestration

SafeSecrets uses [Mastra](https://mastra.ai) as its core orchestration framework, providing a structured workflow engine for managing multi-stage conversational AI interactions.

### Mastra Workflow Engine

**Framework**: `@mastra/core` with Agent and Workflow primitives

**Architecture**: Three-stage workflow pipeline (Collect → Compose → Refine) orchestrated through Mastra's `createWorkflow` and `createStep` APIs.

**Workflow Definition**:
```typescript
workflow
  .then(collectStep)   // Gather context (recipient, situation, tone, outcome)
  .then(composeStep)   // Generate personalized love note
  .then(refineStep)    // Apply user-requested modifications
  .commit()
```

**Key Features**:
- **Stateful Session Management**: Per-session conversation context with full history tracking
- **Stage Transitions**: Automatic progression from collect → compose when context is complete
- **Structured Output Enforcement**: Zod schema validation with automatic retry on malformed responses
- **Event Callbacks**: Real-time UI updates via `onStyleUpdate` and `onNoteDraftUpdate` hooks
- **Context Preservation**: Immutable context fields during refinement stage (recipient, situation, tone, outcome)

### Mastra Agent Integration

**Agent Configuration**:
- **ID**: `safesecrets-agent`
- **Model**: Amazon Bedrock (Claude 3 Haiku) via `@ai-sdk/amazon-bedrock`
- **Instructions**: Custom system prompt defining three-stage behavior and JSON response format
- **Voice Provider**: Custom `SafeSecretsVoiceProvider` implementing Mastra's `MastraVoice` interface

**Structured Output**:
- Enforced via Mastra's `structuredOutput` option with Zod schema
- Automatic validation and retry on schema violations
- Fields: `style`, `spokenResponse`, `noteDraft`, `tags`, plus optional context extraction fields

### Custom Voice Provider

**Implementation**: `SafeSecretsVoiceProvider extends MastraVoice`

**Purpose**: Bridges Mastra's voice interface with AWS Transcribe (STT) and AWS Polly (TTS)

**Methods**:
- `listen(audioStream)`: Streams audio through Transcribe, returns final transcript
- `speak(text)`: Synthesizes speech via Polly, returns audio stream
- `stopSpeaking()`: Implements barge-in by aborting active TTS
- `getSpeakers()`: Returns available voice IDs
- `getListener()`: Returns STT availability status

**Regional Configuration**: Pinned to ca-central-1 by default, configurable per sovereignty mode

### AWS Service Adapters

#### TranscribeAdapter
**Purpose**: Real-time speech-to-text streaming

**Features**:
- Session-based stream management with unique session IDs
- Async generator pattern for feeding audio chunks to AWS SDK
- Dual callback system: `onPartial` for interim results, `onFinal` for complete transcripts
- Automatic cleanup on stream termination
- Multi-region support (ca-central-1, us-east-1)

**Configuration**:
- Language: English (US)
- Sample Rate: 16kHz PCM
- Encoding: PCM (uncompressed)

#### PollyAdapter
**Purpose**: Neural and Generative text-to-speech synthesis

**Features**:
- Dual engine support: Neural (ca-central-1) and Generative (us-east-1)
- Streaming audio output with fixed 4KB chunk size for consistent playback
- Abort controller for immediate cancellation (barge-in support)
- Voice: Joanna (cross-compatible with both engines)

**Configuration**:
- Output Format: PCM at 16kHz
- Chunk Size: 4096 bytes for low-latency streaming
- Engine selection based on sovereignty mode

#### SmallestAdapter
**Purpose**: Third-party TTS via Smallest.ai Waves API

**Features**:
- Lightning v3.1 engine integration
- Streaming PCM audio at 16kHz (matches AWS pipeline)
- Configurable voice (default: Sophia) and speed (default: 1.25x)
- Bearer token authentication via `SMALLEST_AI_API_KEY`
- Abort controller for barge-in support

**Configuration**:
- Endpoint: `https://waves-api.smallest.ai/api/v1/lightning-v3.1/get_speech`
- Sample Rate: 16kHz PCM
- Speed Range: 0.5x–2.0x (default 1.25x)
- Chunk Size: 4096 bytes

**API Request Format**:
```json
{
  "text": "<text to synthesize>",
  "voice_id": "sophia",
  "sample_rate": 16000,
  "output_format": "pcm",
  "speed": 1.25,
  "language": "en"
}
```

### Prompt Engineering

**Stage-Specific Prompts**: Three distinct prompt builders for each workflow stage

**Collect Stage**:
- Tracks missing context fields (recipient, situation, tone, outcome)
- Generates friendly clarifying questions
- Extracts context from user responses
- Returns empty `noteDraft` until context is complete

**Compose Stage**:
- Synthesizes personalized love note from complete context
- `spokenResponse` contains the note read aloud (not a description)
- `noteDraft` contains identical text for UI display
- Generates descriptive tags (#sweet, #romantic, etc.)

**Refine Stage**:
- Preserves immutable context fields (recipient, situation, tone, outcome)
- Updates only `noteDraft` based on refinement request
- Supports button-based refinements (shorter, bolder, more romantic, translate to French)
- `spokenResponse` reads the updated note aloud

**System Instructions**: Core personality prompt defining SafeSecrets as a "warm, creative Valentine's Day assistant" with explicit stage behavior and JSON response format requirements

### Error Handling & Resilience

**Bedrock Validation**:
- Custom `BedrockValidationError` for schema violations
- Automatic single retry on invalid/unparseable responses
- JSON fence stripping (handles markdown-wrapped responses)
- Detailed error reporting with validation failure reasons

**Transcribe Stream Management**:
- Per-session stream isolation prevents cross-talk
- Graceful cleanup on abort or error
- Background event processing with error propagation
- Stopped stream detection prevents feed-after-close errors

**TTS Abort Handling**:
- Unified abort controller pattern across Polly and Smallest adapters
- Silent resolution on intentional cancellation (barge-in)
- Error propagation only for unexpected failures
- Chunk-level abort checking for responsive cancellation

### Multi-Region Orchestration

**Dynamic Service Routing**: Sovereignty mode determines regional endpoints for each service

**Region Mapping**:
- Full Canada: All services → ca-central-1
- Canada + US Voice: Bedrock/Transcribe → ca-central-1, Polly → us-east-1
- US Bedrock + Voice: All AWS services → us-east-1
- Full US: All AWS → us-east-1, TTS → Smallest.ai (external)

**Adapter Instantiation**: Region-aware constructors accept region parameter, defaulting to ca-central-1

**IAM Permissions**: Single EC2 role with multi-region access to Bedrock, Transcribe, and Polly in both ca-central-1 and us-east-1

## Speech-to-Text (STT)

**Service**: AWS Transcribe Streaming

**Regional Options**:
- 🇨🇦 **ca-central-1** (Canada): Full Canada, Canada + US Voice modes
- 🇺🇸 **us-east-1** (US): US Bedrock + Voice, Full US modes

**Configuration**:
- Language: English (US)
- Sample Rate: 16kHz PCM
- Streaming: Real-time partial and final transcripts

## Inference

**Service**: AWS Bedrock

**Models**:
- **Claude 3 Haiku**: `anthropic.claude-3-haiku-20240307-v1:0` (primary)
- **Claude 3 Sonnet**: `anthropic.claude-3-sonnet-20240229-v1:0` (available)

**Regional Options**:
- 🇨🇦 **ca-central-1** (Canada): Full Canada, Canada + US Voice modes
- 🇺🇸 **us-east-1** (US): US Bedrock + Voice, Full US modes

**Features**:
- Structured output with JSON schema enforcement
- Conversation context management across workflow stages
- Dynamic speaking style adaptation (soft, flirty, serious)
- Multi-turn dialogue with memory

## Text-to-Speech (TTS)

### AWS Polly

**Voice**: Joanna

**Engine Options**:
- **Neural**: Available in ca-central-1 (very high quality)
- **Generative**: Available in us-east-1 (highest quality, most expressive)

**Regional Configuration**:
- 🇨🇦 **ca-central-1 (Neural)**: Full Canada mode
- 🇺🇸 **us-east-1 (Generative)**: Canada + US Voice, US Bedrock + Voice modes

**Output Format**: PCM audio at 16kHz, streamed in real-time

### Smallest.ai (Waves API)

**Service**: Lightning v3.1 TTS

**Voice**: Sophia (default)

**Configuration**:
- Speed: 1.25x (configurable 0.5–2.0x)
- Output: PCM audio at 16kHz
- Streaming: 4KB chunks for low-latency playback

**Availability**: Full US mode only

**Endpoint**: `https://waves-api.smallest.ai/api/v1/lightning-v3.1/get_speech`

## Sovereignty Modes

SafeSecrets offers four data residency configurations, allowing users to choose where their data is processed:

| Mode | Bedrock | Transcribe | TTS Provider | TTS Region | TTS Engine |
|------|---------|------------|-------------|------------|------------|
| 🇨🇦 **Full Canada** | ca-central-1 | ca-central-1 | Polly | ca-central-1 | Neural |
| 🇨🇦 **Canada + US Voice** | ca-central-1 | ca-central-1 | Polly | us-east-1 | Generative |
| 🇺🇸 **US Bedrock + Voice** | us-east-1 | us-east-1 | Polly | us-east-1 | Generative |
| 🇺🇸 **Full US + Smallest.ai** | us-east-1 | us-east-1 | Smallest.ai | N/A | Lightning v3.1 |

**Trade-offs**:
- **Full Canada**: Complete data residency in Canada with high-quality Neural voice
- **Canada + US Voice**: Canadian data processing with best-in-class Generative voice from US
- **US Bedrock + Voice**: All AWS services in US for lowest latency
- **Full US + Smallest.ai**: US processing with third-party expressive TTS

## Infrastructure

**Hosting**: AWS EC2 t3.large instance in ca-central-1

**IAM Role**: `MM-KA-SceneBeat-SafeSecretsEC2Role` with multi-region permissions for Bedrock, Transcribe, and Polly

**Security Group**: Configured for SSH (22), HTTP (80), HTTPS (443), and WebSocket (3000)

**Architecture**: Node.js backend with WebSocket server, React frontend with real-time audio streaming
