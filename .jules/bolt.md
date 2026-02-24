## 2024-05-24 - Frontend: Replace Polling with Observers
**Learning:** React components polling external state (like `AudioManager.isPlaying()`) via `requestAnimationFrame` cause unnecessary main thread activity and battery drain, even when idle.
**Action:** Replace polling loops with an observer pattern. Implemented `addPlaybackListener` in `AudioManager` and subscribed in `App.tsx`. This eliminated ~60 calls/sec to `isPlaying()` and ensures updates only happen on state change.
