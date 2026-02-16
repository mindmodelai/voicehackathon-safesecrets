import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock matchMedia
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

// Mock HTMLMediaElement play/pause
if (!HTMLMediaElement.prototype.play) {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
}
if (!HTMLMediaElement.prototype.pause) {
  HTMLMediaElement.prototype.pause = vi.fn();
}
