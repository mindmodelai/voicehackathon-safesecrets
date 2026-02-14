# ❤️ Canada-Sovereign Valentine Voice AI – Architecture & Execution Plan

## 🎯 Concept Overview
A voice-first Valentine assistant with a 3D animated heart avatar (left panel) and a dynamic love-note artifact panel (right panel).

The assistant:
- Listens via streaming STT
- Orchestrates logic via Mastra workflows
- Generates structured outputs via Bedrock (Canada region)
- Speaks responses via Polly (Canada region)
- Updates a live note artifact in the UI

All processing remains in Canadian AWS infrastructure.

---

# 🏗 Infrastructure Architecture

## AWS Region
- **ca-central-1 (Canada Central)**

## EC2 Instance (CPU is sufficient)
Runs:
- Mastra backend (Node/TypeScript)
- WebSocket server
- Static site hosting (Nginx or Node static server)

Optional:
- PM2 or Docker Compose for process management

## AWS Services Used

### 🎤 STT
Amazon Transcribe (Streaming) – ca-central-1

### 🧠 LLM
Amazon Bedrock – ca-central-1
- Streaming inference enabled

### 🔊 TTS
Amazon Polly Neural – ca-central-1

---

# 🌐 Frontend Layout

## Left Panel – 3D Heart Avatar
States:
- Idle (ambient animation loop)
- Listening (subtle glow change)
- Thinking (pulse or shimmer)
- Speaking (3 variations based on style)

Video Layers:
- Ambient idle loop
- Speaking Soft
- Speaking Flirty
- Speaking Serious

State changes are driven by backend WebSocket events.

---

## Right Panel – Love Note Artifact
Styled as a notepad.

Displays:
- Draft note
- Tags (e.g. #sweet, #confident, #playful)
- Tone label

Buttons:
- Copy
- Make it shorter
- Make it bolder
- Make it more romantic
- Translate to French (optional Canada flex)

---

# 🔄 Conversation Flow

## Step 0 – Idle
- Avatar is ambient
- No WebSocket connection active

## Step 1 – "Start Conversation"
- WebSocket connection opens
- Mastra session initializes
- Transcribe streaming starts
- Avatar state → Listening

---

# 🧠 Mastra Orchestration

Mastra runs a structured workflow with stages.

## Workflow Stages

### 1️⃣ Collect Information
Mastra gathers:
- Who is the message for?
- What happened?
- Desired tone
- Desired outcome

Output:
Structured context object stored in memory.

---

### 2️⃣ Compose the Poem / Note
Bedrock returns structured JSON:

{
  "style": "soft | flirty | serious",
  "spokenResponse": "Conversational reply for voice",
  "noteDraft": "Full love note text",
  "tags": ["#sweet", "#romantic"]
}

Backend actions:
- Emit `ui.style`
- Emit `ui.noteDraft`
- Send `spokenResponse` to Polly
- Emit `tts.start`

Frontend switches avatar video based on style.

---

### 3️⃣ Refinement Stage
User can say:
- Make it shorter
- More confident
- More poetic
- Less desperate

Mastra updates only the noteDraft while keeping context.

Spoken response confirms the change.

---

# 🔊 Voice Pipeline

Browser Mic → WebSocket → Mastra Voice Provider

### listen()
- Streams audio to Transcribe
- Emits:
  - user_speaking_start
  - partial transcripts
  - final transcript

### speak()
- Sends text to Polly Neural
- Streams audio back
- Emits:
  - tts.start
  - tts.end

---

# 🎬 Avatar State Machine

Priority Order:

1. If user speaking → Listening animation
2. Else if TTS active → Speaking animation (based on style)
3. Else if waiting on Bedrock → Thinking animation
4. Else → Idle animation

No lip sync required.
Illusion created by switching layered videos.

---

# 🇨🇦 Data Sovereignty Positioning

All components hosted in Canada:
- EC2: Canada
- Transcribe: Canada
- Bedrock: Canada
- Polly Neural: Canada

Optional toggle:
- Premium Voice Mode (non-sovereign) if generative voice used in another region

---

# 🏆 Hackathon Scoring Alignment

## Voice AI Quality
- Real-time streaming
- Barge-in handling
- Natural conversational pacing
- Emotional avatar feedback

## Technical Execution
- Custom Mastra voice provider
- Structured workflow orchestration
- Streaming STT + TTS
- Deterministic UI signaling

## Innovation
- Voice-first UX
- Artifact-building interface
- Emotional avatar

## Real-World Impact
- Private relationship assistant
- Canada data residency

## Sponsor Integration
- Deep Mastra integration
- Custom voice provider
- Workflow orchestration

---

# 🚀 Implementation Checklist

Backend:
- [ ] EC2 provisioned in ca-central-1
- [ ] Mastra app scaffolded
- [ ] Custom voice provider implemented
- [ ] Transcribe streaming wired
- [ ] Bedrock streaming wired
- [ ] Polly streaming wired
- [ ] WebSocket event schema implemented

Frontend:
- [ ] 3D heart ambient loop
- [ ] 3 speaking loops
- [ ] State machine logic
- [ ] Notepad rendering
- [ ] Start Conversation button

---

# 📄 Judge-Ready README Template

## Project Name
**HeartSpeak AI** (example name)

## Summary
A voice-first Valentine AI assistant with a 3D animated heart avatar that helps users create personalized love notes and poems.

This project is built with **Mastra** as the orchestration layer and is designed to support **Canadian data sovereignty** by keeping voice processing in **AWS Canada (ca-central-1)**.

---

## Why This Matters
Relationship conversations are personal. This assistant demonstrates how voice AI can be deployed in a privacy-first way where sensitive audio and AI processing can remain inside Canadian infrastructure.

---

## Key Features
- Real-time conversational voice assistant
- 3D animated heart avatar with state-driven animations
- Live notepad artifact that updates as the note is composed
- Multi-stage workflow: collect → compose → refine
- Streaming STT + LLM + TTS pipeline
- Barge-in ready architecture (stop talking instantly when user speaks)

---

## Tech Stack

### Sponsor Integration (Mastra)
- Mastra Agent orchestration
- Mastra Workflow stages
- Custom Mastra Voice Provider implementation

### Voice + AI Services
- **Amazon Transcribe (Streaming)** for STT (ca-central-1)
- **Amazon Bedrock** for LLM inference (ca-central-1)
- **Amazon Polly Neural** for TTS (ca-central-1)

### Deployment
- AWS EC2 (ca-central-1)
- Static site hosted on the same instance

---

## Architecture Overview

Browser UI:
- Left panel: animated heart avatar (video-based illusion)
- Right panel: notepad artifact (love note output)

Backend:
- WebSocket server
- Mastra workflow engine
- Custom Mastra voice provider wrapping AWS voice services

Bedrock structured output:
1. `style` (drives avatar speaking video)
2. `spokenResponse` (sent to Polly)
3. `noteDraft` (displayed in notepad)

---

## How It Works

1. User clicks **Start Conversation**
2. Browser opens WebSocket to backend
3. Microphone audio streams to backend
4. Backend streams audio to Transcribe
5. Mastra workflow collects context
6. Bedrock generates structured response
7. Polly speaks the conversational reply
8. UI displays the love note draft
9. User can refine by speaking adjustments

---

## Data Sovereignty (Canada)

All processing is designed to remain within **Canada Central (ca-central-1)**:
- EC2 hosting
- Transcribe
- Bedrock
- Polly Neural

No third-party telephony services are used.

---

## Local Setup (Required for Judges)

### Prerequisites
- Node.js 18+
- AWS account with Bedrock enabled
- AWS credentials configured locally

### Environment Variables
Create a `.env` file:

```bash
AWS_REGION=ca-central-1
AWS_PROFILE=default
BEDROCK_MODEL_ID=<your-model-id>
```

### Install + Run

```bash
npm install
npm run dev
```

Then open:

```
http://localhost:3000
```

---

## Deployment (EC2)

The production deployment runs on EC2 in **ca-central-1**.

Recommended:
- Docker Compose or PM2
- Nginx for static frontend hosting

---

## Demo Script (Suggested)

1. Start in idle mode (heart pulsing)
2. Click Start Conversation
3. Ask: "Help me write a love note to my wife"
4. Assistant asks clarifying questions
5. Assistant generates a love note draft
6. User says: "Make it shorter and more confident"
7. Assistant refines instantly
8. Copy note from notepad

---

## Hackathon Scoring Alignment

- **Voice AI Quality**: streaming STT/TTS, barge-in readiness, avatar feedback
- **Technical Execution**: Mastra workflow orchestration, structured output contract
- **Innovation**: voice-first note building, artifact UI
- **Sponsor Integration**: deep Mastra usage via custom voice provider
- **Real-World Impact**: privacy-first personal assistant with Canada residency

---

# 🎉 Final Outcome

A sovereign, voice-first Valentine assistant with:
- Real-time conversational AI
- Animated avatar driven by Mastra signaling
- Structured love note artifact generation
- Clean orchestration via Mastra

Confident, memorable, and hackathon-ready.

