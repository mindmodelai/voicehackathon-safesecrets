## 2026-02-23 - WebSocket Connection Rate Limiting
**Vulnerability:** The backend WebSocket server allowed unlimited connections from a single IP address, creating a potential Denial of Service (DoS) vulnerability.
**Learning:** Resource-intensive endpoints like WebSockets (which maintain persistent connections and process audio streams) are critical targets for exhaustion attacks. Basic rate limiting was missing in the custom `SafeSecretsWSServer` implementation.
**Prevention:** Implement connection rate limiting at the application layer (or infrastructure layer like AWS WAF) for all public endpoints. For Node.js WebSocket servers, a simple fixed-window counter per IP is an effective first line of defense.
