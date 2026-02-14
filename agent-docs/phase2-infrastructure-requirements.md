# SafeSecrets Phase 2 Infrastructure Requirements

## Overview

Phase 2 adds multi-region service routing while keeping the existing EC2 instance in Canada. The application dynamically calls AWS services in different regions based on the user's sovereignty mode selection.

**Key Change**: Enable cross-region service calls from the existing ca-central-1 EC2 instance to us-east-1 services.

**Implementation Status**: The application code for all four sovereignty modes is complete. The infrastructure tasks below must be completed before deploying to EC2.

---

## Net-New Infrastructure Tasks

### INFRA-P2-1: Expand IAM Role Permissions (Multi-Region)

Update the existing IAM role `MM-KA-SceneBeat-SafeSecretsEC2Role` to permit calling services in **both** ca-central-1 and us-east-1.

**Current permissions** (ca-central-1 only):
- Transcribe: `StartStreamTranscription`
- Bedrock: `InvokeModel`, `InvokeModelWithResponseStream`
- Polly: `SynthesizeSpeech`

**Required update**:
- Add resource ARNs or use wildcards to allow the same permissions in us-east-1
- Verify no region-specific resource restrictions exist in current policy

**Validation**:
```bash
aws bedrock invoke-model --region us-east-1 --model-id <model-id> ...
aws transcribe start-stream-transcription --region us-east-1 ...
aws polly synthesize-speech --region us-east-1 --engine generative --voice-id Joanna ...
```

---

### INFRA-P2-2: Bedrock Model Access (us-east-1)

Request access to Claude models in us-east-1 region.

**Already configured**:
- ca-central-1: Claude 3 Haiku, Claude 3 Sonnet

**New requirement**:
- us-east-1: Same models (Claude 3 Haiku at minimum)

**Action**:
1. Navigate to AWS Bedrock console in us-east-1
2. Request model access for Claude 3 Haiku
3. Wait for approval (typically immediate)
4. Verify with CLI

---

### INFRA-P2-3: Verify Polly Generative Voice Availability (us-east-1)

Confirm that Polly Generative engine works with Joanna in us-east-1.

**Validation**:
```bash
aws polly synthesize-speech --region us-east-1 --engine generative --voice-id Joanna --output-format pcm --text "Test" output.pcm
```

**Note**: Generative engine is not available in ca-central-1. Neural is used for Canada modes.

---

### INFRA-P2-4: Smallest.ai API Key

Obtain and configure the Smallest.ai API key for Mode 4 (Full US + Smallest.ai).

**Configuration**:
- Store as `SMALLEST_AI_API_KEY` in the backend `.env` file
- Never commit to version control
- On EC2: set as environment variable or in `.env` on the instance

**API Details**:
- Endpoint: `https://waves-api.smallest.ai/api/v1/lightning-v3.1/get_speech`
- Auth: `Authorization: Bearer <api_key>`
- Voice: sophia (default), configurable
- Speed: 1.25x (default), range 0.5–2.0

---

### INFRA-P2-5: Environment Configuration

**Required env vars for backend** (`.env` file or system environment):

```bash
# AWS credentials (on EC2, use instance profile instead)
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=ca-central-1

# Smallest.ai TTS (required for Full US mode)
SMALLEST_AI_API_KEY=<api-key>

# Optional overrides
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
PORT=8080
```

**Note**: Region routing is handled in code via `SOVEREIGNTY_MODES` in `shared/types.ts`. No per-region env vars are needed — the mode config determines which region each service uses.

---

### INFRA-P2-6: Security Group (Optional)

**Current**: Outbound traffic likely unrestricted.

**No action required** if current outbound rules already permit HTTPS to AWS services and `waves-api.smallest.ai`.

---

## Execution Order

```
INFRA-P2-2 (Bedrock us-east-1 access — start first, may need approval)
    ↓
INFRA-P2-1 (IAM role update) → INFRA-P2-3 (Verify Polly Generative)
    ↓
INFRA-P2-4 (Smallest.ai key) → INFRA-P2-5 (Environment config)
    ↓
INFRA-P2-6 (Security group review — optional)
```

---

## Validation Checklist

- [ ] IAM role permits Bedrock, Transcribe, Polly in both ca-central-1 and us-east-1
- [ ] Bedrock models accessible in us-east-1 (test with CLI)
- [ ] Polly Generative with Joanna confirmed in us-east-1
- [ ] Smallest.ai API key obtained and configured
- [ ] Environment variables set on EC2 instance
- [ ] Test calls to us-east-1 services succeed from EC2 instance
- [ ] All four sovereignty modes tested end-to-end from the deployed app
