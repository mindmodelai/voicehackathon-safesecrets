import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
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

Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: vi.fn().mockImplementation((cb) => setTimeout(cb, 0)),
});

Object.defineProperty(window, 'cancelAnimationFrame', {
  writable: true,
  value: vi.fn().mockImplementation((id) => clearTimeout(id)),
});

// Mock HTMLMediaElement methods
Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
  writable: true,
  value: vi.fn(),
});
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  writable: true,
  value: vi.fn().mockResolvedValue(undefined),
});
Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  writable: true,
  value: vi.fn(),
});
Object.defineProperty(window.HTMLMediaElement.prototype, 'addTextTrack', {
  writable: true,
  value: vi.fn().mockReturnValue({
    addCue: vi.fn(),
    removeCue: vi.fn(),
    cues: [],
  }),
});
