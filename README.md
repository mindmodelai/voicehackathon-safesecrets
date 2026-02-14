# SafeSecrets

SafeSecrets is a real-time conversational voice application built with Mastra as the orchestration layer. Mastra manages multi-stage workflows and generates structured outputs including style signals that drive dynamic avatar behavior. The platform gives users the option of true Canadian data sovereignty by running inference and voice services in AWS Canada (ca-central-1).

## Tech Stack

- **Orchestration**: Mastra SDK (`@mastra/core`, `@mastra/voice`, `@ai-sdk/amazon-bedrock`)
- **STT**: Amazon Transcribe Streaming (ca-central-1)
- **LLM**: Amazon Bedrock (ca-central-1)
- **TTS**: Amazon Polly Neural (ca-central-1)
- **Frontend**: React/TypeScript with 3D heart avatar and love-note artifact panel
- **Backend**: Node/TypeScript with WebSocket server
- **Deployment**: AWS EC2 (ca-central-1)

## Features

- Real-time conversational voice assistant
- 3D animated heart avatar with state-driven animations
- Live notepad artifact that updates as the note is composed
- Multi-stage workflow: collect → compose → refine
- Streaming STT + LLM + TTS pipeline
- Barge-in ready architecture
- Canadian data sovereignty (all processing in ca-central-1)

## Getting Started

### Prerequisites

- Node.js 18+
- AWS account with Bedrock enabled in ca-central-1
- AWS credentials configured locally

### Environment Variables

Create a `.env` file:

```bash
AWS_REGION=ca-central-1
AWS_PROFILE=default
BEDROCK_MODEL_ID=<your-model-id>
```

### Install & Run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`

## Architecture

See `.kiro/specs/valentines-voice-ai/design.md` for the full architecture and design document.

## License

MIT
