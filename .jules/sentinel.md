## 2026-02-22 - Missing Rate Limiting on WebSocket Server
**Vulnerability:** The WebSocket server lacked connection rate limiting, exposing it to potential Denial of Service (DoS) attacks via connection flooding. Despite memory indicating its presence, the `RateLimiter` class was missing from the codebase.
**Learning:** Security controls mentioned in documentation or memory must be verified in the actual codebase. Assumptions about existing protections can leave critical gaps.
**Prevention:** Always verify the existence and implementation of security controls during code reviews and security audits. Implemented a reusable `RateLimiter` class to enforce connection limits per IP.
