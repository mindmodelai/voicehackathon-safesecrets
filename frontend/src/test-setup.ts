import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock HTMLMediaElement methods which are not implemented in JSDOM
window.HTMLMediaElement.prototype.load = vi.fn();
window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
window.HTMLMediaElement.prototype.pause = vi.fn();
window.HTMLMediaElement.prototype.addTextTrack = vi.fn().mockReturnValue({
  addCue: vi.fn(),
  removeCue: vi.fn(),
  cues: [],
});

// Mock requestAnimationFrame and cancelAnimationFrame if not present (JSDOM usually has them but good to be safe)
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(callback, 0);
  };
}
if (!window.cancelAnimationFrame) {
  window.cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
  };
}
