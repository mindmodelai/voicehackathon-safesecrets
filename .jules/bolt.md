## 2026-02-23 - [Optimization: Event Listener vs Polling]
**Learning:** `requestAnimationFrame` polling for boolean state (like `isPlaying`) is a significant main-thread waster even if React state updates bail out. Replacing it with an Observer pattern (listeners) eliminates the loop entirely.
**Action:** Prefer `addPlaybackListener` style subscriptions over `isPlaying()` polling loops for audio/video synchronization.

## 2026-02-23 - [Testing: Mocking Accessibility]
**Learning:** Components using `aria-hidden="true"` (like decorative videos) are invisible to `getByRole`. To test state changes in integration tests, mock the component to render an accessible element (e.g., `<img role="img" aria-label={state} />`) that reflects the props.
**Action:** When testing components that wrap non-semantic visual elements, mock them to expose state via ARIA attributes or roles.
