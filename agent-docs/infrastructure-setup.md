# SafeSecrets Infrastructure Setup

## AWS Resources Created

### EC2 Instance (ca-central-1)
- **Type**: t3.large
- **Region**: ca-central-1 (Canada)
- **AMI**: Amazon Linux 2023
- **Note**: Instance ID and IP stored in AWS Console

### SSH Key Pair
- **Name**: safesecrets-key
- **Storage**: Stored securely outside project directory
- **Usage**: SSH access to EC2 instance
- **Connection**: `ssh -i /path/to/safesecrets-key.pem ec2-user@<instance-ip>`
- **IMPORTANT**: Never commit the .pem file to version control

### Security Group (safesecrets-sg)
- Port 22 (SSH)
- Port 80 (HTTP)
- Port 443 (HTTPS)
- Port 3000 (WebSocket/Dev server)

### IAM Role
- **Name**: MM-KA-SceneBeat-SafeSecretsEC2Role
- **Instance Profile**: SafeSecretsEC2Profile
- **Permissions** (must cover both ca-central-1 and us-east-1):
  - Bedrock: InvokeModel, InvokeModelWithResponseStream
  - Transcribe: StartStreamTranscription
  - Polly: SynthesizeSpeech

---

## Sovereignty Modes (Data Residency Dial)

The application supports four sovereignty modes that control which AWS regions and TTS providers are used. Users select a mode from the UI before starting a conversation.

| Mode | Bedrock | Transcribe | TTS Provider | TTS Region | TTS Engine |
|------|---------|------------|-------------|------------|------------|
| 🇨🇦 Full Canada | ca-central-1 | ca-central-1 | Polly | ca-central-1 | Neural |
| 🇨🇦 Canada + US Voice | ca-central-1 | ca-central-1 | Polly | us-east-1 | Generative |
| 🇺🇸 US Bedrock + Voice | us-east-1 | us-east-1 | Polly | us-east-1 | Generative |
| 🇺🇸 Full US + Smallest.ai | us-east-1 | us-east-1 | Smallest.ai | N/A | Lightning v3.1 |

### Voice Configuration
- **Polly Voice**: Joanna (supports both Neural and Generative engines)
- **Smallest.ai Voice**: sophia (default), speed 1.25x
- **Cross-compatible Polly voices**: Danielle, Ruth, Salli, Matthew, Stephen

### Key Trade-offs
- **Full Canada**: Data stays in Canada, Neural voice quality (very good)
- **Canada + US Voice**: Data processing in Canada, Generative voice from US (best Polly quality)
- **US Bedrock + Voice**: All AWS services in US, Generative voice (lowest latency for US)
- **Full US + Smallest.ai**: All US, third-party TTS with expressive voice synthesis

---

## Bedrock Models

### ca-central-1 (Canada)
- **Claude 3 Haiku**: `anthropic.claude-3-haiku-20240307-v1:0` (default)
- **Claude 3 Sonnet**: `anthropic.claude-3-sonnet-20240229-v1:0`

### us-east-1 (US) — Required for modes 3 and 4
- Same models must be enabled via Bedrock console in us-east-1

---

## External Services

### Smallest.ai (Waves API)
- **API**: Lightning v3.1 (`https://waves-api.smallest.ai/api/v1/lightning-v3.1`)
- **Auth**: Bearer token via `SMALLEST_AI_API_KEY` env var
- **Output**: PCM audio at 16kHz, streamed in 4KB chunks
- **Used in**: Full US + Smallest.ai mode only

---

## Agent Artifacts

Test files generated during setup are stored in:
- `agent-artifacts/` — MP3 test files (with region tags)
- `agent-config/` — JSON config and test files

Both directories are in .gitignore.
