# SafeSecrets – Phase 2 Specification

## Sovereignty Slider, Model Selector, Latency Meter, and Phoneme-Driven Avatar System

---

# Phase 2A – Data Sovereignty Slider + Model Selector + Latency Intelligence

## 🎯 Objective

Add a user-facing sovereignty control system that:

* Allows selection between four voice pipeline configurations
* Dynamically switches STT, LLM, and TTS routing
* Preserves Mastra orchestration
* Displays real latency metrics to all users

---

# 1️⃣ Sovereignty Slider UI

Vertical slider with 4 snap positions.

Top: 🇨🇦 Canada
Bottom: 🇺🇸 USA

The slider defines a complete voice pipeline preset.

Users must select before conversation begins.

---

# 2️⃣ Voice Pipeline Modes

## 🔒 Mode 1 – Full Canada Sovereignty (Default)

Chips:

* LLM: Claude (Bedrock ca-central-1)
* STT: Transcribe (ca-central-1)
* TTS: Polly Neural (ca-central-1)

---

## 🇨🇦 Mode 2 – Canada Core + US Generative Voice

Chips:

* LLM: Claude (ca-central-1)
* STT: Transcribe (ca-central-1)
* TTS: Polly Generative (us-east-1)

---

## 🇺🇸 Mode 3 – All US East

Chips:

* LLM: Claude (us-east-1)
* STT: Transcribe (us-east-1)
* TTS: Polly (us-east-1)

---

## 🧠 Mode 4 – Smartest AI Voice Mode

Chips:

* LLM: Claude (us-east-1)
* Voice: Smartest.ai
* Orchestrator: Mastra

Smartest.ai replaces TTS provider only.
Mastra retains orchestration control.

---

# 3️⃣ Voice Stack Factory

Backend abstraction:

createVoiceStack(mode)

Returns:

{
sttProvider,
llmProvider,
ttsProvider
}

Mastra interface remains consistent:

listen()
speak(text)

Only provider implementation changes.

---

# 4️⃣ Optional Model Selector

Dropdown shown under sovereignty slider.

If Mode 1 or 2:

* Claude 3 Haiku (CA)
* Claude 3 Sonnet (CA)
* Claude 3 Opus (CA if available)

If Mode 3 or 4:

* Claude 3 Haiku (US)
* Claude 3 Sonnet (US)
* Claude 3 Opus (US)

Model selector changes model ID only.
Region is locked by slider mode.

---

# 5️⃣ Latency Meter (Visible to All Users)

## 🎯 Purpose

Expose real performance tradeoffs between sovereignty levels.

## Metrics Captured Per Turn

* sttFirstPartialMs
* sttFinalMs
* llmFirstTokenMs
* ttsFirstAudioMs
* turnTotalMs

## UI Display

Example:

STT 180ms | LLM 420ms | Voice 220ms | Total 920ms

This component is always visible.

---

# 6️⃣ Mastra Timing Instrumentation

Backend must record timestamps at:

* Mic stream start
* First STT partial
* Final STT transcript
* Bedrock stream start
* First LLM token
* TTS request start
* First TTS audio chunk
* Turn complete

Emit consolidated event:

metrics.turn

Frontend renders values immediately.

---

# Phase 2B – Simplified Avatar System (Thinking Variants + Phoneme-Tagged Speaking Clips)

## 🎯 Objective

* Remove “speaking body style” selection from the LLM output.
* Use a small set of **speaking clips** that already start on the correct mouth shape.
* Randomize **thinking body** animations while waiting for the model response.
* Enable earlier parsing of control metadata by putting small tags at the start of the streamed response.

---

# 1️⃣ Asset Strategy Update

## Speaking assets change

Instead of layering a speaking body loop plus a mouth overlay, use **pre-rendered speaking clips**.

Each speaking clip:

* Starts with a specific mouth shape that matches a phoneme group
* Includes body motion and mouth motion together
* Is designed to loop or at least look continuous during short utterances

This eliminates the need for:

* speakingBodyStyle
* per-style phoneme tags

## Thinking assets change

Thinking is now a pool of 2 to 6 “thinking” loops.

Mastra randomly selects a thinking loop when:

* user finished speaking
* STT is final
* system is waiting on LLM tokens

---

# 2️⃣ Control Metadata: Stream-Friendly Tags (Not JSON)

## Rationale

When model output is streamed, JSON is inconvenient because you typically need most of the payload before parsing safely.

Instead, output begins with a short, parseable tag block in the first bytes.

## Recommended format

Use one line of square bracket tags, then a newline, then the natural language content.

Example:

[MOUTH=OUW][SPEAKCLIP=spk_ouw_01]
Okay wow, that is actually adorable.

### Required tags

* MOUTH: one of MBP, TDNL, AHAA, OUW, EE, FV
* SPEAKCLIP: clip id that starts with that mouth shape

Optional tags (future-friendly)

* THINKPOOL: name of thinking pool to use
* SPEED: hint for playback pacing

---

# 3️⃣ Allowed Mouth Tags

* MBP
* TDNL
* AHAA
* OUW
* EE
* FV

---

# 4️⃣ Speaking Clip Mapping

Mastra maintains the mapping from mouth tag to one or more clip ids.

Example mapping:

* MBP → spk_mbp_01, spk_mbp_02
* TDNL → spk_tdnl_01, spk_tdnl_02
* AHAA → spk_ahaa_01
* OUW → spk_ouw_01
* EE → spk_ee_01
* FV → spk_fv_01

Mastra picks one at random within the selected tag.

---

# 5️⃣ Runtime Event Sequence

When a turn completes and the assistant is about to speak:

1. Begin receiving streamed LLM tokens
2. Parse the first tag line as soon as it arrives
3. Immediately set avatar to speaking state using SPEAKCLIP
4. Begin TTS streaming once you have enough text to speak

WebSocket events (suggested):

* avatar.thinkingStart (selected thinking clip)
* avatar.thinkingEnd
* avatar.speakingStart (selected speaking clip)
* tts.start
* tts.end
* avatar.speakingEnd

Fallback:

* If tags are missing, default to TDNL and a default speaking clip.

---

# 6️⃣ Acceptance Criteria

* No speakingBodyStyle is required from the model.
* Thinking loops are randomly selected by Mastra while waiting.
* The first bytes of streamed output include control tags.
* Avatar switches to the correct speaking clip before audio begins.
* Latency meter remains visible to all users.

---

# 7️⃣ Phase 2 Outcome

SafeSecrets now includes:

* Sovereignty control dial

* Optional model selector

* Transparent latency instrumentation

* Thinking animation randomization

* Phoneme-tagged, pre-rendered speaking clips

* Stream-friendly tag parsing

* Clean Mastra orchestration preservation

* Slider switches entire voice stack

* Smartest.ai integrates via speak()

* Model selector changes Bedrock model ID only

* Latency meter visible to all users

* startPhonemeTag always present in LLM output

* First speaking frame matches phoneme

* No avatar topology drift

---

# 🚀 Phase 2 Outcome

SafeSecrets now includes:

* Sovereignty control dial
* Model intelligence selector
* Transparent latency instrumentation
* Phoneme-aligned speaking start
* Layered avatar animation system
* Clean Mastra orchestration preservation

This elevates the project from hackathon demo to production-grade architecture.

---

# Infrastructure Requirements

See `agent-docs/phase2-infrastructure-requirements.md` for detailed infrastructure setup tasks.
