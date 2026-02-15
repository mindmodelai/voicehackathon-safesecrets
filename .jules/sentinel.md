## 2026-02-15 - Missing WebSocket Rate Limiting
**Vulnerability:** The WebSocket server accepted unlimited connections from any IP address, exposing the application to Denial of Service (DoS) attacks and resource exhaustion (AWS Bedrock/Polly costs).
**Learning:** Default WebSocket implementations in Node.js (via 'ws' library) do not provide built-in rate limiting. It requires custom middleware or logic at the connection handler level.
**Prevention:** Implement a rate limiter (e.g., token bucket or sliding window) on the connection event for all public-facing WebSocket servers.
