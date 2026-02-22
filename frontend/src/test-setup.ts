import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock window.matchMedia
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

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => setTimeout(callback, 0));
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

// Mock HTMLMediaElement methods
Object.defineProperty(window.HTMLMediaElement.prototype, 'load', {
  configurable: true,
  writable: true,
  value: vi.fn(),
});
Object.defineProperty(window.HTMLMediaElement.prototype, 'play', {
  configurable: true,
  writable: true,
  value: vi.fn(),
});
Object.defineProperty(window.HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  writable: true,
  value: vi.fn(),
});
Object.defineProperty(window.HTMLMediaElement.prototype, 'addTextTrack', {
  configurable: true,
  writable: true,
  value: vi.fn().mockReturnValue({
    addCue: vi.fn(),
    removeCue: vi.fn(),
  }),
});
