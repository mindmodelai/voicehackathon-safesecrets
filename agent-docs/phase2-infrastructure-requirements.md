# SafeSecrets Phase 2 Infrastructure Requirements

## Overview

Phase 2 adds multi-region service routing while keeping the existing EC2 instance in Canada. The application will dynamically call AWS services in different regions based on user sovereignty mode selection.

**Key Change**: Enable cross-region service calls from the existing ca-central-1 EC2 instance to us-east-1 services.

---

## Net-New Infrastructure Tasks

### INFRA-P2-1: Expand IAM Role Permissions (Multi-Region)

Update the existing IAM role `MM-KA-SceneBeat-SafeSecretsEC2Role` to explicitly permit calling services in **both** ca-central-1 and us-east-1.

**Current permissions** (ca-central-1 only):
- Transcribe: `StartStreamTranscription`
- Bedrock: `InvokeModel`, `InvokeModelWithResponseStream`
- Polly: `SynthesizeSpeech`

**Required update**:
- Add resource ARNs or use wildcards to allow the same permissions in us-east-1
- Verify no region-specific resource restrictions exist in current policy

**Validation**:
```bash
# Test from EC2 instance
aws bedrock invoke-model --region us-east-1 --model-id <model-id> ...
aws transcribe start-stream-transcription --region us-east-1 ...
aws polly synthesize-speech --region us-east-1 ...
```

---

### INFRA-P2-2: Bedrock Model Access (us-east-1)

Request access to Claude models in us-east-1 region.

**Already configured**:
- ca-central-1: Claude 3 Haiku, Claude 3 Sonnet

**New requirement**:
- us-east-1: Same models (Claude 3 Haiku, Claude 3 Sonnet)
- Optional: Claude 3 Opus if available in us-east-1

**Action**:
1. Navigate to AWS Bedrock console in us-east-1
2. Request model access for intended Claude models
3. Wait for approval (typically immediate for Claude)
4. Record model IDs for environment configuration

---

### INFRA-P2-3: Verify Polly Generative Voice Availability (us-east-1)

Confirm that Polly Generative voices are available in us-east-1 for Mode 2.

**Target voices**:
- Ruth (Generative)
- Matthew (Generative)
- Joanna (Generative)

**Validation**:
```bash
aws polly describe-voices --region us-east-1 --engine generative
```

**Note**: Generative voices are only available in us-east-1, not ca-central-1.

---

### INFRA-P2-4: Update Security Group (Optional Egress Control)

**Current**: Outbound traffic likely unrestricted

**Recommendation**: Keep unrestricted for simplicity, or implement controlled egress if required by security policy.

**If implementing controlled egress**:
- Configure egress rules to allow HTTPS (443) to AWS service endpoints
- Ensure both ca-central-1 and us-east-1 service endpoints are reachable

**No action required** if current outbound rules already permit HTTPS to AWS services.

---

### INFRA-P2-5: Environment Configuration (Region-Aware)

Add new environment variables to support multi-region routing.

**New variables**:
```bash
# Region configuration
AWS_REGION_DEFAULT=ca-central-1
AWS_REGION_CANADA=ca-central-1
AWS_REGION_USA=us-east-1

# Bedrock model IDs per region
BEDROCK_MODEL_ID_CA=anthropic.claude-3-haiku-20240307-v1:0
BEDROCK_MODEL_ID_US=<model-id-in-us-east-1>

# Optional: Model selector allowlists
BEDROCK_MODEL_ALLOWLIST_CA=anthropic.claude-3-haiku-20240307-v1:0,anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_MODEL_ALLOWLIST_US=<comma-separated-model-ids>

# Polly regions (explicit for clarity)
POLLY_REGION_CA=ca-central-1
POLLY_REGION_US=us-east-1

# Transcribe regions
TRANSCRIBE_REGION_CA=ca-central-1
TRANSCRIBE_REGION_US=us-east-1
```

**Existing variables** (keep as-is):
- AWS credentials via instance profile (no static keys)
- Current Bedrock/Polly/Transcribe configuration for ca-central-1

---

### INFRA-P2-6: Smartest.ai Integration (Mode 4)

**Requirement**: Integrate Smartest.ai as TTS provider for Mode 4.

**Prerequisites**:
- Smartest.ai API key (obtain from Smartest.ai)
- API endpoint documentation

**Configuration**:
```bash
SMARTEST_AI_API_KEY=<api-key>
SMARTEST_AI_ENDPOINT=<endpoint-url>
```

**Note**: Smartest.ai replaces TTS provider only. Mastra retains orchestration control.

---

## Execution Order

```
INFRA-P2-2 (Bedrock us-east-1 access - start first, may require approval time)
    ↓
INFRA-P2-1 (IAM role update) → INFRA-P2-3 (Verify Polly voices)
    ↓
INFRA-P2-5 (Environment config) → INFRA-P2-6 (Smartest.ai setup)
    ↓
INFRA-P2-4 (Security group review - optional)
```

---

## Validation Checklist

Before considering Phase 2 infrastructure complete:

- [ ] IAM role permits Bedrock, Transcribe, Polly in both ca-central-1 and us-east-1
- [ ] Bedrock models accessible in us-east-1 (test with CLI)
- [ ] Polly Generative voices confirmed in us-east-1
- [ ] Environment variables configured for multi-region routing
- [ ] Smartest.ai API key obtained and configured
- [ ] Test calls to us-east-1 services succeed from EC2 instance
- [ ] No region-specific IAM denials in CloudTrail logs

---

## Output Required for Development

When infrastructure setup is complete, provide:

1. **Bedrock model IDs**:
   - ca-central-1: `<model-id>`
   - us-east-1: `<model-id>`

2. **IAM role confirmation**: Updated policy document showing multi-region permissions

3. **Polly voice confirmation**: List of available Generative voices in us-east-1

4. **Smartest.ai credentials**: API key and endpoint (store securely, not in repo)

5. **Test results**: Successful API calls to us-east-1 services from EC2 instance
