## 2024-05-22 - Missing Rate Limiter Implementation
**Vulnerability:** The memory and documentation suggested a `RateLimiter` class existed and was used in `ws-server.ts`, but it was completely absent from the codebase.
**Learning:** Documentation/Memory can drift from the actual code state. Always verify existence of security controls.
**Prevention:** Implemented a new `RateLimiter` class and integrated it. Added tests to ensure it persists.
