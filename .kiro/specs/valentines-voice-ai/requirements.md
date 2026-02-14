# Requirements Document

## Introduction

SafeSecrets is a voice-first Valentine's Day assistant that helps users create personalized love notes and poems through natural conversation. The system features a 3D animated heart avatar, real-time voice interaction via streaming STT/TTS, LLM-powered note composition via Mastra workflows, and a live love-note artifact panel. All processing remains within Canadian AWS infrastructure (ca-central-1) for data sovereignty.

## Glossary

- **SafeSecrets_System**: The complete Valentine voice AI application including frontend and backend components
- **Avatar**: The 3D animated heart displayed in the left panel of the UI, driven by a state machine
- **Artifact_Panel**: The right-side notepad UI that displays the generated love note, tags, and refinement controls
- **Voice_Pipeline**: The end-to-end audio processing chain from browser microphone through STT, LLM, and TTS back to browser audio output
- **Mastra_Workflow**: The backend orchestration engine managing conversation stages (collect, compose, refine)
- **WebSocket_Server**: The real-time communication layer between the browser frontend and the backend services
- **Transcribe_Client**: The Amazon Transcribe streaming client used for speech-to-text in ca-central-1
- **Bedrock_Client**: The Amazon Bedrock client used for LLM inference in ca-central-1
- **Polly_Client**: The Amazon Polly Neural client used for text-to-speech in ca-central-1
- **Structured_Output**: The JSON response from Bedrock containing style, spokenResponse, noteDraft, and tags fields
- **Avatar_State_Machine**: The priority-based state controller for the avatar with states: idle, listening, thinking, speaking

## Requirements

### Requirement 1: WebSocket Real-Time Communication

**User Story:** As a user, I want real-time bidirectional communication between my browser and the backend, so that voice and UI events are transmitted with minimal latency.

#### Acceptance Criteria

1. WHEN a user clicks the "Start Conversation" button, THE WebSocket_Server SHALL establish a WebSocket connection and initialize a Mastra session
2. WHEN the WebSocket connection is established, THE WebSocket_Server SHALL begin accepting audio stream data from the browser microphone
3. WHEN the backend produces events (ui.style, ui.noteDraft, tts.start, tts.end, partial transcripts, final transcript), THE WebSocket_Server SHALL emit those events to the connected frontend client
4. IF the WebSocket connection drops unexpectedly, THEN THE WebSocket_Server SHALL clean up the associated Transcribe stream and Mastra session resources
5. WHEN a user ends the conversation or closes the browser, THE WebSocket_Server SHALL gracefully close the connection and release all associated resources

### Requirement 2: Speech-to-Text via Amazon Transcribe Streaming

**User Story:** As a user, I want my spoken words converted to text in real time, so that the AI assistant can understand what I am saying.

#### Acceptance Criteria

1. WHEN audio data arrives over the WebSocket, THE Transcribe_Client SHALL stream the audio to Amazon Transcribe in ca-central-1
2. WHILE the user is speaking, THE Transcribe_Client SHALL emit partial transcript events to the frontend via the WebSocket_Server
3. WHEN the user finishes a spoken utterance, THE Transcribe_Client SHALL emit a final transcript event containing the complete recognized text
4. WHEN the Transcribe stream starts receiving audio, THE WebSocket_Server SHALL emit a user_speaking_start event to the frontend
5. IF Amazon Transcribe returns an error or the stream fails, THEN THE Transcribe_Client SHALL log the error and notify the frontend of the failure

### Requirement 3: LLM Orchestration via Mastra Workflow

**User Story:** As a user, I want the assistant to guide me through a structured conversation to collect my preferences and compose a personalized love note, so that the output is tailored to my needs.

#### Acceptance Criteria

1. WHEN a new session is initialized, THE Mastra_Workflow SHALL begin in the "collect information" stage, gathering who the message is for, what happened, desired tone, and desired outcome
2. WHEN sufficient context has been collected, THE Mastra_Workflow SHALL transition to the "compose" stage and send the context to the Bedrock_Client for note generation
3. WHEN the Bedrock_Client returns a response, THE Mastra_Workflow SHALL parse it as a Structured_Output containing style, spokenResponse, noteDraft, and tags fields
4. WHEN a Structured_Output is received, THE Mastra_Workflow SHALL emit ui.style and ui.noteDraft events to the frontend and send the spokenResponse to the Polly_Client
5. WHEN the user requests a refinement (e.g., "make it shorter", "more confident", "more poetic"), THE Mastra_Workflow SHALL transition to the "refinement" stage, update only the noteDraft while preserving the conversation context, and generate a spoken confirmation
6. IF the Bedrock_Client returns an invalid or unparseable response, THEN THE Mastra_Workflow SHALL retry the request once and, on continued failure, notify the user via a spoken error message

### Requirement 4: Text-to-Speech via Amazon Polly Neural

**User Story:** As a user, I want the assistant to speak its responses aloud with a natural-sounding voice, so that the interaction feels conversational and engaging.

#### Acceptance Criteria

1. WHEN the Mastra_Workflow provides a spokenResponse text, THE Polly_Client SHALL synthesize speech using Amazon Polly Neural in ca-central-1
2. WHEN speech synthesis begins, THE Polly_Client SHALL emit a tts.start event via the WebSocket_Server
3. WHILE speech audio is being generated, THE Polly_Client SHALL stream the audio data to the frontend via the WebSocket_Server
4. WHEN speech synthesis completes, THE Polly_Client SHALL emit a tts.end event via the WebSocket_Server
5. IF the user begins speaking while TTS is active (barge-in), THEN THE Polly_Client SHALL immediately stop the current speech output and THE Avatar_State_Machine SHALL transition to the listening state

### Requirement 5: 3D Heart Avatar with State Machine

**User Story:** As a user, I want to see an animated 3D heart avatar that visually reflects the current state of the conversation, so that the interaction feels alive and emotionally responsive.

#### Acceptance Criteria

1. WHILE no conversation is active, THE Avatar_State_Machine SHALL display the idle ambient animation loop
2. WHEN a user_speaking_start event is received, THE Avatar_State_Machine SHALL transition to the listening state with a subtle glow change animation
3. WHEN the Mastra_Workflow is processing a request (waiting on Bedrock), THE Avatar_State_Machine SHALL transition to the thinking state with a pulse or shimmer animation
4. WHEN a tts.start event is received, THE Avatar_State_Machine SHALL transition to the speaking state and select the speaking animation variant (soft, flirty, or serious) based on the style field from the Structured_Output
5. THE Avatar_State_Machine SHALL resolve conflicting states using the priority order: listening > speaking > thinking > idle
6. WHEN a tts.end event is received and the user is not speaking, THE Avatar_State_Machine SHALL transition back to the idle state

### Requirement 6: Love Note Artifact Panel

**User Story:** As a user, I want to see my love note displayed and updated in real time on a styled notepad panel, so that I can review, copy, and refine the generated content.

#### Acceptance Criteria

1. WHEN a ui.noteDraft event is received, THE Artifact_Panel SHALL display the updated love note text on the styled notepad
2. WHEN a ui.noteDraft event includes tags, THE Artifact_Panel SHALL display the associated tags (e.g., #sweet, #confident, #playful) alongside the note
3. WHEN a ui.style event is received, THE Artifact_Panel SHALL display the current tone label (soft, flirty, or serious)
4. WHEN the user clicks the "Copy" button, THE Artifact_Panel SHALL copy the current note text to the system clipboard
5. WHEN the user clicks a refinement button ("Make it shorter", "Make it bolder", "Make it more romantic", or "Translate to French"), THE Artifact_Panel SHALL send the corresponding refinement request to the Mastra_Workflow via the WebSocket_Server
6. WHILE no note has been composed yet, THE Artifact_Panel SHALL display an empty notepad with placeholder guidance text

### Requirement 7: Structured Output Contract

**User Story:** As a developer, I want the LLM to return responses in a well-defined JSON structure, so that the backend can reliably route data to the correct UI and voice components.

#### Acceptance Criteria

1. THE Bedrock_Client SHALL request responses from Amazon Bedrock using a prompt that enforces the Structured_Output JSON schema containing style, spokenResponse, noteDraft, and tags fields
2. WHEN a response is received from Bedrock, THE Mastra_Workflow SHALL validate that the response conforms to the Structured_Output schema before processing
3. THE Structured_Output style field SHALL contain one of the values: "soft", "flirty", or "serious"
4. THE Structured_Output spokenResponse field SHALL contain a conversational text string intended for voice synthesis
5. THE Structured_Output noteDraft field SHALL contain the full love note text
6. THE Structured_Output tags field SHALL contain an array of string tags describing the note characteristics

### Requirement 8: Canadian Data Sovereignty

**User Story:** As a user concerned about privacy, I want all voice and AI processing to occur within Canadian AWS infrastructure, so that my personal conversation data remains in Canada.

#### Acceptance Criteria

1. THE SafeSecrets_System SHALL configure all AWS service clients (Transcribe, Bedrock, Polly) to use the ca-central-1 region
2. THE SafeSecrets_System SHALL host the backend application on an EC2 instance in ca-central-1
3. THE SafeSecrets_System SHALL process all audio, text, and AI inference data exclusively within ca-central-1 services
4. IF a service is unavailable in ca-central-1, THEN THE SafeSecrets_System SHALL fail gracefully and inform the user rather than falling back to a non-Canadian region

### Requirement 9: Conversation Flow Management

**User Story:** As a user, I want a smooth and intuitive conversation flow from start to finish, so that creating a love note feels natural and guided.

#### Acceptance Criteria

1. WHILE the system is in the idle state (Step 0), THE SafeSecrets_System SHALL display the ambient avatar and a visible "Start Conversation" button
2. WHEN the user clicks "Start Conversation" (Step 1), THE SafeSecrets_System SHALL open the WebSocket connection, initialize the Mastra session, start Transcribe streaming, and transition the avatar to the listening state
3. WHILE in the collect information stage, THE Mastra_Workflow SHALL ask the user clarifying questions about the recipient, context, tone, and desired outcome through spoken prompts
4. WHEN the compose stage completes, THE SafeSecrets_System SHALL display the generated note in the Artifact_Panel and speak the conversational response
5. WHILE in the refinement stage, THE SafeSecrets_System SHALL accept both voice commands and button clicks for note adjustments and update the Artifact_Panel after each refinement
