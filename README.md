# SafeSecrets

A real-time conversational voice application that helps users compose personalized love notes through natural speech. Built with Mastra as the orchestration layer, Amazon Bedrock for LLM inference, Amazon Transcribe for speech-to-text, and Amazon Polly for text-to-speech. All processing runs in AWS Canada (ca-central-1) for data sovereignty.

## How It Works

You speak to the avatar. It listens, thinks, and talks back — guiding you through writing a love note in three stages:

1. **Collect** — The assistant asks who the note is for, the situation, desired tone, and desired outcome
2. **Compose** — Once it has all four pieces, it writes the note and reads it back
3. **Refine** — You can ask for changes (shorter, bolder, more romantic, translate to French)

The frontend shows a 3D heart avatar that animates based on conversation state, and a live notepad panel that updates as the note is composed.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Orchestration | Mastra SDK (`@mastra/core`, `@ai-sdk/amazon-bedrock`) |
| LLM | Amazon Bedrock (Claude) in ca-central-1 |
| Speech-to-Text | Amazon Transcribe Streaming in ca-central-1 |
| Text-to-Speech | Amazon Polly Neural in ca-central-1 |
| Frontend | React 18 + TypeScript, Vite, WebSocket client |
| Backend | Node.js + TypeScript, WebSocket server (ws) |
| Transport | WebSocket — binary audio frames + JSON control messages |

## Project Structure

```
safesecrets/
├── backend/src/
│   ├── index.ts                 # HTTP server + WS attachment, port 8080
│   ├── ws-server.ts             # WebSocket server, session management
│   ├── mastra-workflow.ts       # Mastra workflow engine (collect/compose/refine)
│   ├── system-instructions.ts   # AI personality prompt (editable)
│   ├── prompt-builders.ts       # Per-stage LLM prompts (editable)
│   ├── workflow-constants.ts    # Region and config constants (editable)
│   ├── bedrock-adapter.ts       # Bedrock LLM adapter
│   ├── polly-adapter.ts         # Polly TTS adapter
│   ├── transcribe-adapter.ts    # Transcribe STT adapter
│   └── custom-voice-provider.ts # Mastra voice provider wrapper
├── frontend/src/
│   ├── App.tsx                  # Main React app
│   ├── ws-client.ts             # Browser WebSocket client
│   ├── audio-manager.ts         # Mic capture + audio playback
│   ├── avatar-state-machine.ts  # Avatar animation state machine
│   └── components/
│       ├── HeartAvatar.tsx       # 3D heart avatar component
│       └── ArtifactPanel.tsx     # Live notepad panel
├── shared/
│   ├── types.ts                 # Shared TypeScript types
│   └── schema.ts                # Structured output validation
├── agent-instructions.md         # Quick reference to editable prompt files
└── agent-docs/                  # Design docs and video config
```

## Prerequisites

- Node.js 18+
- AWS account with Bedrock model access enabled in **ca-central-1**
- AWS credentials configured locally (`~/.aws/credentials` or environment variables)
- A Bedrock model ID (e.g., `anthropic.claude-3-haiku-20240307-v1:0`)

## Setup

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Environment variables

Set these in your shell or a `.env` file in the backend directory:

```bash
AWS_REGION=ca-central-1
AWS_PROFILE=default
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
PORT=8080
```

### 3. Run the backend

```bash
cd backend
npm run dev
```

This starts the HTTP + WebSocket server on port 8080. Health check at `http://localhost:8080/health`.

### 4. Run the frontend

In a separate terminal:

```bash
cd frontend
npm run dev
```

Opens at `http://localhost:5173`. The Vite dev server proxies `/ws` to the backend automatically.

### 5. Build for production

```bash
cd frontend
npm run build        # outputs to frontend/dist/

cd ../backend
npm run build        # compiles TypeScript to backend/dist/
npm start            # runs the compiled backend
```

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
# Backend tests (173 tests)
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

Both use Vitest. The test suites include unit tests and property-based tests (fast-check).

## WebSocket Protocol

The frontend and backend communicate over a single WebSocket connection at `/ws`.

**Client → Server:**
- Binary frames: raw audio chunks from the microphone
- JSON text: control messages (`start_conversation`, `end_conversation`, `refinement`)

**Server → Client:**
- Binary frames: TTS audio chunks from Polly
- JSON text: events (`session_ready`, `partial_transcript`, `final_transcript`, `ui.style`, `ui.noteDraft`, `tts.start`, `tts.end`, `assistant_response`, `error`)

## Architecture

See `.kiro/specs/safesecrets/design.md` for the full architecture and design document.

## License

MIT
