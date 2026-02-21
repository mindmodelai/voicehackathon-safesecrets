# Sentinel's Journal

## 2024-05-23 - WebSocket Rate Limiting
**Vulnerability:** Missing rate limiting on WebSocket connections allowed unlimited connection attempts from single IP addresses.
**Learning:** WebSocket servers are stateful and resource-intensive. Without limits, a single IP can exhaust server resources (connections, memory) or downstream API quotas (AWS Bedrock/Transcribe).
**Prevention:** Always implement connection rate limiting at the application level (or infrastructure level) for public-facing WebSocket endpoints.
