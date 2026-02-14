# Implementation Plan: SafeSecrets Voice AI

## Overview

Incremental implementation of the SafeSecrets voice-first Valentine assistant. The plan starts with project scaffolding and shared types, builds the backend voice pipeline and Mastra integration, then the frontend avatar and artifact panel, and finally wires everything together via WebSocket.

## Tasks

- [x] 1. Project scaffolding and shared types
  - [x] 1.1 Initialize monorepo with backend and frontend packages
    - Create `backend/` (Node/TypeScript) and `frontend/` (React/TypeScript) directories
    - Set up `package.json` for each with TypeScript, Vitest, and fast-check
    - Install Mastra SDK: `@mastra/core`, `@mastra/voice`, `@ai-sdk/amazon-bedrock`
    - Install AWS SDK clients: `@aws-sdk/client-transcribe-streaming`, `@aws-sdk/client-polly`, `@aws-sdk/client-bedrock-runtime`
    - Install WebSocket library: `ws` for backend, native WebSocket for frontend
    - _Requirements: 8.1_

  - [x] 1.2 Define shared TypeScript types and interfaces
    - Create `shared/types.ts` with: `StructuredOutput`, `ClientMessage`, `ServerMessage`, `RefinementRequest`, `WorkflowStage`, `ConversationContext`, `AvatarState`, `SpeakingStyle`, `AvatarEvent`
    - Create `shared/schema.ts` with the JSON schema for StructuredOutput validation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x]* 1.3 Write property test for StructuredOutput validation
    - **Property 5: Structured output validation**
    - Generate random JSON objects (valid and invalid), verify the validator accepts valid StructuredOutput and rejects invalid ones
    - **Validates: Requirements 3.3, 7.2, 7.3, 7.4, 7.5, 7.6**

- [x] 2. Avatar state machine
  - [x] 2.1 Implement the Avatar State Machine
    - Create `frontend/src/avatar-state-machine.ts`
    - Implement state transitions with priority order: listening > speaking > thinking > idle
    - Implement `getVideoSource()` that returns the correct video path based on current state and style
    - Handle all AvatarEvent types: USER_SPEAKING_START, USER_SPEAKING_END, TTS_START, TTS_END, THINKING_START, THINKING_END
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 2.2 Write property test for state machine priority invariant
    - **Property 1: Avatar state machine priority invariant**
    - Generate random sequences of AvatarEvents, apply them, verify priority order is never violated
    - **Validates: Requirements 4.5, 5.1, 5.2, 5.3, 5.5, 5.6**

  - [ ]* 2.3 Write property test for speaking style video selection
    - **Property 2: Speaking style selects correct video source**
    - Generate random valid style values, verify correct video source path is returned
    - **Validates: Requirements 5.4**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Backend AWS adapters
  - [x] 4.1 Implement the Transcribe Adapter
    - Create `backend/src/transcribe-adapter.ts`
    - Implement `startStream()`, `feedAudio()`, `stopStream()` wrapping `@aws-sdk/client-transcribe-streaming`
    - Pin region to `ca-central-1`
    - Emit partial and final transcript callbacks
    - Handle Transcribe errors and propagate them
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 8.1_

  - [x] 4.2 Implement the Bedrock Adapter
    - Create `backend/src/bedrock-adapter.ts`
    - Implement `generateStructuredResponse()` wrapping `@aws-sdk/client-bedrock-runtime`
    - Pin region to `ca-central-1`
    - Include StructuredOutput JSON schema in the prompt
    - Parse and validate response against StructuredOutput schema
    - Implement retry-once logic for invalid responses
    - _Requirements: 3.3, 7.1, 7.2, 8.1_

  - [x] 4.3 Implement the Polly Adapter
    - Create `backend/src/polly-adapter.ts`
    - Implement `synthesize()` and `stop()` wrapping `@aws-sdk/client-polly`
    - Pin region to `ca-central-1`
    - Stream audio chunks via callback
    - Support immediate cancellation for barge-in
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 8.1_

  - [x]* 4.4 Write unit tests for AWS adapters
    - Test region configuration is ca-central-1 for all three adapters
    - Test Bedrock adapter retry logic with mocked invalid responses
    - Test Polly adapter stop/cancellation
    - Test Transcribe adapter error propagation
    - _Requirements: 2.5, 3.6, 4.5, 8.1, 8.4_

- [x] 5. Custom Mastra Voice Provider and Workflow
  - [x] 5.1 Implement the Custom Mastra Voice Provider
    - Create `backend/src/custom-voice-provider.ts`
    - Extend `MastraVoice` from `@mastra/voice`
    - Implement `listen()` wrapping the Transcribe Adapter
    - Implement `speak()` wrapping the Polly Adapter
    - Pin both to ca-central-1
    - _Requirements: 2.1, 4.1, 8.1_

  - [x] 5.2 Implement the Mastra Workflow Engine
    - Create `backend/src/mastra-workflow.ts`
    - Configure the Mastra Agent with `@ai-sdk/amazon-bedrock` provider pinned to ca-central-1
    - Define `collectStep`, `composeStep`, `refineStep` using `createStep`
    - Wire steps into a workflow using `createWorkflow`
    - Implement session context management with Mastra memory
    - Implement stage transition logic: collect → compose → refine
    - Parse Bedrock responses as StructuredOutput and emit ui.style, ui.noteDraft events
    - Handle refinement requests: update only noteDraft while preserving context
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 9.3_

  - [x]* 5.3 Write property test for initial session stage
    - **Property 3: New sessions start in collect stage**
    - Generate random session IDs, verify initial stage is "collect" and context fields are null
    - **Validates: Requirements 3.1**

  - [x]* 5.4 Write property test for compose transition
    - **Property 4: Complete context triggers compose transition**
    - Generate random complete ConversationContext objects, verify transition to "compose"
    - **Validates: Requirements 3.2**

  - [x]* 5.5 Write property test for structured output event routing
    - **Property 6: Structured output routes to correct events**
    - Generate random valid StructuredOutputs, verify correct events are emitted
    - **Validates: Requirements 3.4**

  - [x]* 5.6 Write property test for refinement context preservation
    - **Property 7: Refinement preserves non-draft context**
    - Generate random contexts and refinement requests, verify non-draft fields unchanged
    - **Validates: Requirements 3.5**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. WebSocket Server
  - [x] 7.1 Implement the WebSocket Server
    - Create `backend/src/ws-server.ts`
    - Accept WebSocket connections on `/ws`
    - Create session context per connection (Transcribe stream, Mastra session, Polly stream)
    - Route incoming audio messages to the Transcribe Adapter
    - Route control messages (start_conversation, end_conversation, refinement) to the Mastra Workflow
    - Forward all backend ServerEvents to the connected client
    - Implement resource cleanup on disconnect (graceful and unexpected)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x]* 7.2 Write property test for event forwarding
    - **Property 10: Backend events forwarded to client**
    - Generate random ServerEvents, verify they are forwarded with data intact
    - **Validates: Requirements 1.3**

  - [x]* 7.3 Write unit tests for WebSocket Server
    - Test session creation on start_conversation
    - Test resource cleanup on unexpected disconnect
    - Test graceful close cleanup
    - _Requirements: 1.1, 1.4, 1.5_

- [x] 8. Frontend - Artifact Panel
  - [x] 8.1 Implement the Artifact Panel component
    - Create `frontend/src/components/ArtifactPanel.tsx`
    - Render styled notepad with note draft text, tags, and tone label
    - Implement Copy button with clipboard API
    - Implement refinement buttons: "Make it shorter", "Make it bolder", "Make it more romantic", "Translate to French"
    - Display placeholder guidance text when no note exists
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 8.2 Write property test for artifact panel rendering
    - **Property 8: Artifact panel renders all structured output fields**
    - Generate random StructuredOutputs, render the panel, verify noteDraft, tags, and tone label appear
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 8.3 Write property test for refinement button mapping
    - **Property 9: Refinement buttons map to correct request types**
    - Generate random refinement button clicks, verify correct RefinementRequest type is emitted
    - **Validates: Requirements 6.5**

- [x] 9. Frontend - Avatar and main layout
  - [x] 9.1 Implement the 3D Heart Avatar component
    - Create `frontend/src/components/HeartAvatar.tsx`
    - Render video element that switches source based on AvatarState and SpeakingStyle
    - Wire to Avatar State Machine for state-driven video switching
    - Include idle ambient loop, listening glow, thinking shimmer, and 3 speaking variants
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 9.2 Implement the Audio Manager
    - Create `frontend/src/audio-manager.ts`
    - Implement `startCapture()` using MediaRecorder/AudioWorklet for microphone input
    - Implement `playAudioChunk()` for streaming TTS audio playback
    - Implement `stopPlayback()` for barge-in cancellation
    - _Requirements: 4.5_

  - [x] 9.3 Implement the WebSocket Client
    - Create `frontend/src/ws-client.ts`
    - Connect to backend `/ws` endpoint
    - Send audio chunks and control messages
    - Parse incoming ServerMessages and dispatch to event handlers
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 9.4 Implement the main App layout
    - Create `frontend/src/App.tsx` with two-panel layout
    - Left panel: HeartAvatar component
    - Right panel: ArtifactPanel component
    - "Start Conversation" button that triggers WebSocket connection and conversation flow
    - Wire WebSocket events to Avatar State Machine and Artifact Panel
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

- [x] 10. Integration and wiring
  - [x] 10.1 Wire the full voice pipeline end-to-end
    - Connect: Mic → WebSocket → Transcribe → Mastra Workflow → Bedrock → Polly → Audio playback
    - Ensure avatar state transitions fire correctly through the full flow
    - Ensure artifact panel updates on compose and refine stages
    - Implement barge-in: user speaking stops TTS and transitions avatar to listening
    - _Requirements: 1.3, 2.1, 3.4, 4.1, 4.5, 5.5, 9.2, 9.4, 9.5_

  - [x] 10.2 Implement error handling and region enforcement
    - Verify all AWS clients are pinned to ca-central-1 with no fallback
    - Implement graceful error messages for service failures
    - Implement connection timeout cleanup (5 min idle)
    - _Requirements: 2.5, 3.6, 8.1, 8.4_

  - [x]* 10.3 Write integration tests for conversation flow
    - Test full flow: start → collect → compose → refine → end with mocked AWS services
    - Test barge-in during TTS
    - Test error recovery paths
    - _Requirements: 9.2, 9.4, 9.5_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Mastra SDK (`@mastra/core`, `@mastra/voice`, `@ai-sdk/amazon-bedrock`) is a core dependency installed in task 1.1
