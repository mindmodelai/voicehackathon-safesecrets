# Infrastructure Requirements: SafeSecrets Voice AI

## Overview

These are the AWS infrastructure tasks to be fulfilled via AWS CLI in ca-central-1. This work runs in parallel with the application code tasks and must be complete before Task 10 (Integration and wiring) begins.

## Region

All resources MUST be provisioned in `ca-central-1` (Canada Central). No exceptions.

## Tasks

### INFRA-1: EC2 Instance Provisioning
- Launch an EC2 instance in ca-central-1
- Instance type: t3.medium or larger (CPU sufficient, no GPU needed)
- Amazon Linux 2023 or Ubuntu 22.04 AMI
- Security group rules:
  - Inbound: TCP 443 (HTTPS), TCP 8080 (WebSocket), TCP 22 (SSH)
  - Outbound: All traffic
- Elastic IP recommended for stable endpoint
- **Validates: Requirement 8.2**

### INFRA-2: IAM Role and Permissions
- Create an IAM role for the EC2 instance with the following policies:
  - `transcribe:StartStreamTranscription` — for real-time STT
  - `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream` — for LLM inference
  - `polly:SynthesizeSpeech` — for TTS
- All permissions scoped to `ca-central-1` where possible
- Attach the role as an EC2 instance profile
- **Validates: Requirement 8.1, 8.3**

### INFRA-3: Bedrock Model Access
- Request access to a foundation model in ca-central-1 (e.g., Anthropic Claude or Amazon Titan)
- Verify the model supports structured JSON output
- Note: Model access approval may take time — do this first
- Record the model ID for the application `.env` file
- **Validates: Requirement 3.3, 7.1**

### INFRA-4: Verify Service Availability
- Confirm Amazon Transcribe Streaming is available in ca-central-1
- Confirm Amazon Polly Neural voices are available in ca-central-1
- Confirm the requested Bedrock model is active in ca-central-1
- **Validates: Requirement 8.1, 8.3, 8.4**

### INFRA-5: EC2 Runtime Setup
- Install Node.js 18+ on the EC2 instance
- Install PM2 or set up Docker Compose for process management
- Install Nginx for static frontend hosting (optional, can use Node static server)
- Clone the repo: `https://github.com/mindmodelai/voicehackathon-safesecrets.git`
- **Validates: Requirement 8.2**

### INFRA-6: Environment Configuration
- Create `.env` file on the EC2 instance with:
  ```
  AWS_REGION=ca-central-1
  BEDROCK_MODEL_ID=<model-id-from-INFRA-3>
  ```
- Verify AWS credentials are available via instance profile (no hardcoded keys)
- **Validates: Requirement 8.1**

## Execution Order

```
INFRA-3 (Bedrock access — start first, approval lag)
    ↓
INFRA-1 (EC2) → INFRA-2 (IAM) → INFRA-4 (verify services)
    ↓
INFRA-5 (runtime setup) → INFRA-6 (env config)
```

## Convergence Point

These infra tasks must be complete before the code repo's **Task 10** (Integration and wiring) can run end-to-end. Tasks 1–9 in the code repo are independent and can proceed without infra.

## Output Required for Code Repo

When complete, provide:
1. EC2 public IP or Elastic IP
2. Bedrock model ID
3. Confirmation that IAM role is attached and all three services (Transcribe, Bedrock, Polly) are accessible from the instance
