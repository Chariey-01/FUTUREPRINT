import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { sessionToken } from '../lib/sessionToken';
import { mockControl } from '../mocks/mockServer';

// jsdom gaps used by framer-motion.
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: IO });
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
window.scrollTo = () => {};
// axe-core probes canvas; jsdom doesn't implement it.
HTMLCanvasElement.prototype.getContext = () => null;

// Route chunks are lazy-loaded; dynamic imports in jsdom can exceed the 1s default.
configure({ asyncUtilTimeout: 5000 });

beforeEach(() => {
  window.sessionStorage.clear();
  sessionToken.reload();
  mockControl.reset();
  mockControl.setLatency(0);
});

afterEach(() => {
  cleanup();
});
