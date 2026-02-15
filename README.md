# SafeSecrets

A real-time conversational voice application that helps users compose personalized love notes through natural speech. Built with Mastra for orchestration, Amazon Bedrock for LLM inference, Amazon Transcribe for speech-to-text, and multiple TTS providers (Amazon Polly, Smallest.ai). Features a data sovereignty dial that lets users control which AWS regions process their data.

## How It Works

You speak to the avatar. It listens, thinks, and talks back — guiding you through writing a love note in three stages:

1. **Collect** — The assistant asks who the note is for, the situation, desired tone, and desired outcome
2. **Compose** — Once it has all four pieces, it writes the note and places it on the notepad
3. **Refine** — You can ask for changes (shorter, bolder, more romantic, translate to French)

The frontend shows a video avatar with phoneme-driven lip-sync animation, and a live notepad panel that updates as the note is composed.

## Sovereignty Modes

A mode selector at the top of the UI lets users choose where their data is processed:

| Mode | LLM + STT | TTS | Notes |
|------|-----------|-----|-------|
| 🇨🇦 Full Canada | ca-central-1 | Polly Neural (ca-central-1) | All data stays in Canada |
| 🇨🇦 Canada + US Voice | ca-central-1 | Polly Generative (us-east-1) | Better voice quality, data processing in CA |
| 🇺🇸 US Bedrock + Voice | us-east-1 | Polly Generative (us-east-1) | All AWS services in US |
| 🇺🇸 Full US + Smallest.ai | us-east-1 | Smallest.ai Lightning v3.1 | Third-party TTS, expressive voice |

Switching modes ends any active conversation and reconfigures all adapters (Transcribe, Bedrock, Polly/Smallest.ai) for the selected regions.

## Architecture — Mastra Orchestration

Mastra is the central orchestration layer. Each WebSocket session gets its own `MastraWorkflowEngine` instance that manages the conversation state machine (collect → compose → refine) and coordinates all AI service adapters. When the user switches sovereignty modes, the entire adapter pipeline is torn down and rebuilt for the new regions.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (React + WebSocket Client)                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐                 │
│  │ AudioMgr │  │ VideoFrame   │  │ ArtifactPanel │                 │
│  │ (mic+spk)│  │ (phoneme/    │  │ (notepad +    │                 │
│  │          │  │  conv-loop)  │  │  sovereignty) │                 │
│  └────┬─────┘  └──────────────┘  └───────────────┘                 │
│       │  PCM audio ↑↓  JSON events ↑↓                               │
└───────┼─────────────────────────────────────────────────────────────┘
        │ WebSocket (binary audio + JSON control)
┌───────┼─────────────────────────────────────────────────────────────┐
│  Node.js Backend (ws-server.ts)                                     │
│       │                                                             │
│  ┌────▼──────────────────────────────────────────────────────────┐  │
│  │  Session Manager (per-connection)                              │  │
│  │  ┌─────────────────────────────────────────────────────────┐  │  │
│  │  │  Mastra Workflow Engine (orchestrator)                   │  │  │
│  │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐           │  │  │
│  │  │  │  COLLECT   │→│  COMPOSE   │→│  REFINE    │           │  │  │
│  │  │  │ (ask Qs)   │  │ (write    │  │ (update   │           │  │  │
│  │  │  │            │  │  note)    │  │  note)    │           │  │  │
│  │  │  └───────────┘  └───────────┘  └───────────┘           │  │  │
│  │  │       ↕ prompt-builders.ts + system-instructions.ts     │  │  │
│  │  └─────────────────────────┬───────────────────────────────┘  │  │
│  │                            │                                  │  │
│  │  ┌─────────────────────────▼───────────────────────────────┐  │  │
│  │  │  Adapter Layer (swapped per sovereignty mode)            │  │  │
│  │  │                                                         │  │  │
│  │  │  STT Adapters:          LLM Adapter:    TTS Adapters:   │  │  │
│  │  │  ┌─────────────────┐   ┌────────────┐  ┌────────────┐  │  │  │
│  │  │  │ TranscribeAdapter│   │  Bedrock    │  │PollyAdapter│  │  │  │
│  │  │  │ (ca/us region)  │   │  (Claude 3  │  │(neural/gen)│  │  │  │
│  │  │  ├─────────────────┤   │   Haiku)    │  ├────────────┤  │  │  │
│  │  │  │ SmallestSTT     │   │  ca/us      │  │ SmallestAI │  │  │  │
│  │  │  │ (Pulse API)     │   │  region     │  │ (Lightning │  │  │  │
│  │  │  │                 │   │             │  │  v3.1)     │  │  │  │
│  │  │  └─────────────────┘   └────────────┘  └────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Adapter Selection Per Mode

| Mode | STT Adapter | LLM (Bedrock) | TTS Adapter |
|------|-------------|---------------|-------------|
| 🇨🇦 Full Canada | TranscribeAdapter → ca-central-1 | Claude 3 Haiku → ca-central-1 | PollyAdapter → Neural, ca-central-1 |
| 🇨🇦 Canada + US Voice | TranscribeAdapter → ca-central-1 | Claude 3 Haiku → ca-central-1 | PollyAdapter → Generative, us-east-1 |
| 🇺🇸 US Bedrock + Voice | TranscribeAdapter → us-east-1 | Claude 3 Haiku → us-east-1 | PollyAdapter → Generative, us-east-1 |
| 🇺🇸 Full US + Smallest.ai | SmallestSTTAdapter → Pulse API | Claude 3 Haiku → us-east-1 | SmallestAdapter → Lightning v3.1 |

When the user switches modes, `handleSetMode()` destroys the current adapters and instantiates new ones with the correct region/provider configuration. The Mastra workflow engine is also recreated with the new Bedrock region. Any active conversation is ended first.

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

## Live Demo

A production instance is available at **https://safesecrets.ca** for testing and evaluation. The demo uses shared AWS resources with a budget cap - if you encounter service errors, the budget limit may have been reached. For full functionality, please run locally with your own AWS credentials.

## Quick Start (Local Development)

### Prerequisites

- **Node.js 18+** (tested with Node 20 and 24)
- **AWS Account** with:
  - Bedrock model access enabled in `ca-central-1` (and optionally `us-east-1` for US modes)
  - Transcribe and Polly available in `ca-central-1` and `us-east-1`
- **AWS Credentials** configured (via environment variables or `~/.aws/credentials`)
- **Smallest.ai API Key** (optional, only needed for "Full US + Smallest.ai" mode)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd safesecrets

# Install all dependencies
cd backend && npm install
cd ../frontend && npm install
cd ../shared && npm install
```

### 2. Configure Environment Variables

Create `backend/.env` from the example:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your credentials:

```bash
# AWS Credentials (required)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=ca-central-1

# Smallest.ai API Key (optional - only needed for "Full US + Smallest.ai" mode)
# Get your key from https://smallest.ai
SMALLEST_AI_API_KEY=your_smallest_ai_api_key_here

# Optional: Override defaults
PORT=8080
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
```

**Note:** The first three modes (Full Canada, Canada + US Voice, US Bedrock + Voice) work with just AWS credentials. The Smallest.ai API key is only required if you want to test the fourth mode.

### 3. Build Shared Types

```bash
cd shared
npm run build
```

This compiles the TypeScript types used by both frontend and backend.

### 4. Start the Backend

```bash
cd backend
npm run dev
```

The backend starts on `http://localhost:8080`. You should see:
```
SafeSecrets backend listening on port 8080
WebSocket endpoint: ws://localhost:8080/ws
Health check: http://localhost:8080/health
```

### 5. Start the Frontend

In a new terminal:

```bash
cd frontend
npm run dev
```

The frontend opens at `http://localhost:5173`.

### 6. Test the Application

1. Open `http://localhost:5173` in your browser
2. Allow microphone access when prompted
3. Select a sovereignty mode from the dropdown
4. Click the heart avatar to start speaking
5. Follow the conversation to compose your love note!

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
│   ├── polly-adapter.ts         # Amazon Polly TTS adapter (neural + generative)
│   ├── smallest-adapter.ts      # Smallest.ai TTS adapter (Lightning v3.1)
│   ├── smallest-stt-adapter.ts  # Smallest.ai STT adapter (Pulse)
│   ├── transcribe-adapter.ts    # Amazon Transcribe STT adapter (region-aware)
│   ├── bedrock-adapter.ts       # Bedrock LLM adapter
│   └── custom-voice-provider.ts # Mastra voice provider wrapper
├── frontend/src/
│   ├── App.tsx                  # Main React app with sovereignty selector
│   ├── ws-client.ts             # Browser WebSocket client
│   ├── audio-manager.ts         # Mic capture + Web Audio playback
│   ├── avatar-state-machine.ts  # Avatar animation state machine
│   └── components/
│       ├── VideoFrame.tsx        # Main video screen (phoneme + conversation-looping)
│       ├── ArtifactPanel.tsx     # Live notepad panel with sovereignty mode selector
│       ├── Header.tsx            # App header with navigation
│       └── AboutModal.tsx        # About dialog
├── shared/
│   ├── types.ts                 # Shared types, sovereignty mode configs
│   └── schema.ts                # Structured output validation
├── agent-docs/                  # Infrastructure and design docs
└── agent-instructions.md        # Quick reference to editable prompt files
```

## Customizing the AI

The AI's personality and prompts are isolated into files you can edit directly:

| What | File |
|------|------|
| System personality & instructions | `backend/src/system-instructions.ts` |
| Per-stage prompts (collect/compose/refine) | `backend/src/prompt-builders.ts` |
| AWS region & config | `backend/src/workflow-constants.ts` |

See [`agent-instructions.md`](agent-instructions.md) for details.

## Running Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
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

## Troubleshooting

### "Cannot find module" errors
Make sure you've built the shared types:
```bash
cd shared && npm run build
```

### AWS credential errors
Verify your AWS credentials are configured:
```bash
aws sts get-caller-identity
```

### Bedrock access denied
Ensure Bedrock model access is enabled in your AWS account:
1. Go to AWS Console → Bedrock → Model access
2. Request access for Claude 3 Haiku in ca-central-1 (and us-east-1 if using US modes)

### Smallest.ai API key warning
If you see "Smallest.ai API key not configured" but aren't using the "Full US + Smallest.ai" mode, you can ignore this warning. The key is only required for that specific mode.

### Microphone not working
Ensure your browser has microphone permissions enabled for localhost.

## Production Deployment

For production deployment to AWS EC2 with SSL, auto-start, and full infrastructure setup, see:
- **[agent-docs/DEPLOYMENT-GUIDE.md](agent-docs/DEPLOYMENT-GUIDE.md)** - Complete EC2 deployment guide
- **[agent-docs/infrastructure-setup.md](agent-docs/infrastructure-setup.md)** - AWS infrastructure details

## Data Sovereignty

The sovereignty mode dial is the core differentiator. In Full Canada mode, all audio, transcription, LLM inference, and speech synthesis stay within `ca-central-1`. No data leaves Canadian infrastructure. The other modes progressively trade data residency for voice quality or provider variety, with the UI clearly indicating which regions are in use.

## License

MIT
