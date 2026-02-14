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
- **Permissions**:
  - Bedrock: InvokeModel, InvokeModelWithResponseStream
  - Transcribe: StartStreamTranscription
  - Polly: SynthesizeSpeech

## Voice Configuration

### Canada Mode (Data Sovereignty)
- **Region**: ca-central-1
- **Engine**: Neural
- **Voices**: Joanna, Matthew, Gabrielle (fr-CA), Liam (fr-CA)
- **Trade-off**: Data stays in Canada ✓, Neural voice quality (very good)

### Premium Mode (Best Quality)
- **Region**: us-east-1
- **Engine**: Generative or Long-form
- **Voices**: Ruth, Danielle, Matthew, Joanna, Stephen
- **Trade-off**: Best voice quality ✓, Data leaves Canada ✗

## Bedrock Models (ca-central-1)

### Recommended for SafeSecrets
- **Claude 3 Haiku**: `anthropic.claude-3-haiku-20240307-v1:0`
  - Fast, cost-effective
  - Good for structured output
  - Regional only (stays in Canada)

- **Claude 3 Sonnet**: `anthropic.claude-3-sonnet-20240229-v1:0`
  - Better emotional intelligence
  - Regional only (stays in Canada)

## Agent Artifacts

Test files generated during setup are stored in:
- `agent-artifacts/` - MP3 test files (with region tags)
- `agent-config/` - JSON config and test files

Both directories are in .gitignore.
