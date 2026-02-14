# SafeSecrets

A real-time conversational voice application that helps users compose personalized love notes through natural speech. Built with Mastra for orchestration, Amazon Bedrock for LLM inference, Amazon Transcribe for speech-to-text, and multiple TTS providers (Amazon Polly, Smallest.ai). Features a data sovereignty dial that lets users control which AWS regions process their data.

## How It Works

You speak to the avatar. It listens, thinks, and talks back — guiding you through writing a love note in three stages:

1. **Collect** — The assistant asks who the note is for, the situation, desired tone, and desired outcome
2. **Compose** — Once it has all four pieces, it writes the note and reads it back
3. **Refine** — You can ask for changes (shorter, bolder, more romantic, translate to French)

The frontend shows a 3D heart avatar that animates based on conversation state, and a live notepad panel that updates as the note is composed.

## Sovereignty Modes

A mode selector at the top of the UI lets users choose where their data is processed:

| Mode | LLM + STT | TTS | Notes |
|------|-----------|-----|-------|
| 🇨🇦 Full Canada | ca-central-1 | Polly Neural (ca-central-1) | All data stays in Canada |
| 🇨🇦 Canada + US Voice | ca-central-1 | Polly Generative (us-east-1) | Better voice quality, data processing in CA |
| 🇺🇸 US Bedrock + Voice | us-east-1 | Polly Generative (us-east-1) | All AWS services in US |
| 🇺🇸 Full US + Smallest.ai | us-east-1 | Smallest.ai Lightning v3.1 | Third-party TTS, expressive voice |

Switching modes ends any active conversation and reconfigures all adapters (Transcribe, Bedrock, Polly/Smallest.ai) for the selected regions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Orchestration | Mastra SDK (`@mastra/core`, `@ai-sdk/amazon-bedrock`) |
| LLM | Amazon Bedrock — Claude 3 Haiku (ca-central-1 or us-east-1) |
| Speech-to-Text | Amazon Transcribe Streaming (ca-central-1 or us-east-1) |
| Text-to-Speech | Amazon Polly Neural/Generative, Smallest.ai Lightning v3.1 |
| Frontend | React 18 + TypeScript, Vite, WebSocket client |
| Backend | Node.js + TypeScript, WebSocket server (ws), dotenv |
| Transport | WebSocket — binary audio frames + JSON control messages |

## Project Structure

```
safesecrets/
├── backend/src/
│   ├── index.ts                 # HTTP server + WS attachment, port 8080
│   ├── ws-server.ts             # WebSocket server, session & mode management
│   ├── mastra-workflow.ts       # Mastra workflow engine (collect/compose/refine)
│   ├── system-instructions.ts   # AI personality prompt (editable)
│   ├── prompt-builders.ts       # Per-stage LLM prompts (editable)
│   ├── workflow-constants.ts    # Region and config constants
│   ├── polly-adapter.ts         # Polly TTS adapter (neural + generative)
│   ├── smallest-adapter.ts      # Smallest.ai TTS adapter (Lightning v3.1)
│   ├── transcribe-adapter.ts    # Transcribe STT adapter (region-aware)
│   ├── bedrock-adapter.ts       # Bedrock LLM adapter
│   └── custom-voice-provider.ts # Mastra voice provider wrapper
├── frontend/src/
│   ├── App.tsx                  # Main React app with sovereignty selector
│   ├── ws-client.ts             # Browser WebSocket client
│   ├── audio-manager.ts         # Mic capture + audio playback
│   ├── avatar-state-machine.ts  # Avatar animation state machine
│   └── components/
│       ├── HeartAvatar.tsx       # 3D heart avatar component
│       └── ArtifactPanel.tsx     # Live notepad panel
├── shared/
│   ├── types.ts                 # Shared types, sovereignty mode configs
│   └── schema.ts                # Structured output validation
├── agent-docs/                  # Infrastructure and design docs
└── agent-instructions.md        # Quick reference to editable prompt files
```

## Prerequisites

- Node.js 18+ (tested with Node 24)
- AWS account with:
  - Bedrock model access enabled in ca-central-1 (and us-east-1 for US modes)
  - Transcribe and Polly available in ca-central-1 and us-east-1
- AWS credentials (env vars or `~/.aws/credentials`)
- Smallest.ai API key (for Full US mode only)

## Setup

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Environment variables

Create `backend/.env`:

```bash
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_REGION=ca-central-1

# Optional: Smallest.ai TTS (required for Full US mode)
SMALLEST_AI_API_KEY=<your-smallest-ai-key>

# Optional overrides
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
PORT=8080
```

### 3. Compile shared types

```bash
npx tsc --project shared/tsconfig.json --outDir shared --declaration --declarationMap --sourceMap
```

### 4. Run the backend

```bash
cd backend
npm run dev
```

Starts the HTTP + WebSocket server on port 8080. Health check at `http://localhost:8080/health`.

### 5. Run the frontend

In a separate terminal:

```bash
cd frontend
npm run dev
```

Opens at `http://localhost:5173`.

## Editing the AI Behavior

The AI's personality and prompts are isolated into three files you can edit directly:

| What | File |
|------|------|
| System personality & instructions | `backend/src/system-instructions.ts` |
| Per-stage prompts (collect/compose/refine) | `backend/src/prompt-builders.ts` |
| AWS region & config | `backend/src/workflow-constants.ts` |

See [`agent-instructions.md`](agent-instructions.md) for a quick reference.

## Running Tests

```bash
cd backend && npm test    # Backend tests
cd frontend && npm test   # Frontend tests
```

Both use Vitest. Test suites include unit tests and property-based tests (fast-check).

## WebSocket Protocol

The frontend and backend communicate over a single WebSocket connection at `/ws`.

**Client → Server:**
- Binary frames: raw PCM audio chunks from the microphone (16kHz, mono, 16-bit)
- JSON text: control messages
  - `start_conversation` — begin a new conversation
  - `end_conversation` — end the current conversation (keeps WS alive)
  - `refinement` — request a note refinement (shorter, bolder, etc.)
  - `set_mode` — switch sovereignty mode (ends active conversation first)

**Server → Client:**
- Binary frames: TTS audio chunks (PCM 16kHz from Polly or Smallest.ai)
- JSON text: events
  - `session_ready` — WebSocket session established
  - `partial_transcript` / `final_transcript` — STT results
  - `assistant_response` — LLM spoken response text + stage
  - `ui.style` / `ui.noteDraft` — artifact panel updates
  - `tts.start` / `tts.end` — TTS playback boundaries
  - `mode_changed` — sovereignty mode switch confirmed
  - `conversation_ended` — conversation teardown complete
  - `error` — error message

## Data Sovereignty

The sovereignty mode dial is the core differentiator. In Full Canada mode, all audio, transcription, LLM inference, and speech synthesis stay within `ca-central-1`. No data leaves Canadian infrastructure. The other modes progressively trade data residency for voice quality or provider variety, with the UI clearly indicating which regions are in use.

## Deployment

See `agent-docs/infrastructure-setup.md` for EC2 and AWS resource details, and `agent-docs/phase2-infrastructure-requirements.md` for the multi-region deployment checklist.

## License

MIT
