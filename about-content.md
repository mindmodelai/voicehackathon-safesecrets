# SafeSecrets - About

## Development

### Velocity

**Development Cost**: Approximately 900 Kiro credits at $0.02 per credit (~$18.00 USD)

**Development Environment**: Built using two Kiro instances with separate Kiro Plus accounts. These accounts operate under AWS IAM Identity Center management, providing enterprise-grade privacy controls and centralized identity governance. Offering reliable access to Opus 4.6 without rate limits and attractive pricing. [Kiro integrates with AWS IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html) to enable secure workforce access management, ensuring development activities benefit from AWS's security infrastructure while maintaining data protection standards.

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

### Custom Voice Provider

**Implementation**: `SafeSecretsVoiceProvider extends MastraVoice`

**Purpose**: Bridges Mastra's voice interface with AWS Transcribe (STT) and AWS Polly (TTS), and connects to the Mastra Agent's LLM (Amazon Bedrock — Claude 3 Haiku via `@ai-sdk/amazon-bedrock`) for structured conversational inference.

**Methods**:
- `listen(audioStream)`: Streams audio through Transcribe, returns final transcript
- `speak(text)`: Synthesizes speech via Polly, returns audio stream
- `stopSpeaking()`: Implements barge-in by aborting active TTS
- `getSpeakers()`: Returns available voice IDs
- `getListener()`: Returns STT availability status

**Regional Configuration**: Pinned to ca-central-1 by default, configurable per sovereignty mode

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

### Phoneme-Based Avatar Video Selection

Bedrock tags the first phoneme of each spoken response, and the frontend plays the matching mouth-shape transition video before entering the speaking loop.

**Phoneme Groups** (6 transition clips, 0.5s each):
- **MBP**: Closed lips (e.g., "My", "Beautiful", "Please")
- **TDNL**: Small open (e.g., "The", "Dear", "Now", "Love")
- **AHAA**: Wide open (e.g., "A", "Heart", "Always")
- **OUW**: Rounded (e.g., "Oh", "You", "We")
- **EE**: Smile spread (e.g., "Each", "Evening")
- **FV**: Teeth/lip contact (e.g., "For", "Very")

**State Flow**:
1. **Idle** → User starts speaking → **Listening**
2. **Listening** → User finishes → Random **Thinking** segment (seek to random timestamp)
3. **Thinking** → LLM responds with phoneme tag → **Phoneme Transition** (matching clip)
4. **Phoneme Transition** → Seamlessly flows into → **Speaking Loop**
5. **Speaking Loop** → Continues while TTS plays → Back to **Idle**

## AWS & Third-Party Service Adapters

### TranscribeAdapter
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

### PollyAdapter
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

### SmallestAdapter
**Purpose**: Third-party TTS via Smallest.ai Waves API

**Features**:
- Lightning v3.1 engine
- Voice: Sophia at 1.25x speed (configurable 0.5x–2.0x)
- Bearer token authentication via `SMALLEST_AI_API_KEY`
- Abort controller for barge-in support

**Configuration**:
- Endpoint: `https://waves-api.smallest.ai/api/v1/lightning-v3.1/get_speech`
- Streaming PCM at 16kHz, 4096-byte chunks

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
