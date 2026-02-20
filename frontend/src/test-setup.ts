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

window.requestAnimationFrame = vi.fn((callback) => {
  return setTimeout(callback, 0) as unknown as number;
}) as unknown as typeof window.requestAnimationFrame;

window.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id);
}) as unknown as typeof window.cancelAnimationFrame;
