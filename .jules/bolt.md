## 2024-05-22 - Polling vs Event Subscriptions in React

**Learning:** The codebase relied on `requestAnimationFrame` polling loops inside `useEffect` to sync React state with external mutable objects (like `AudioManager`). This creates unnecessary CPU overhead (60fps checks) even when state doesn't change.

**Action:** Prefer implementing an observer/listener pattern in the external service (`addPlaybackListener`) and subscribing to it in the React component. This ensures updates happen only when state actually changes, and removes the need for constant polling.
