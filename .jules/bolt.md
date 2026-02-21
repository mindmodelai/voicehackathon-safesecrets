## 2025-05-18 - WebSocket Buffer Pool Pitfall
**Learning:** Node.js `ws` library often allocates messages as slices of a large shared Buffer pool. Creating a new `Uint8Array` from such a slice and accessing its `.buffer` property exposes the *entire* pool, not just the message. This causes massive data over-sending and potential leaks.
**Action:** Always check `byteOffset` and `byteLength` when working with `ArrayBuffer` from `Buffer`. Use `Buffer.from(uint8array)` (which shares memory) or pass the `Buffer` view directly if possible, rather than unwrapping to `ArrayBuffer`.
