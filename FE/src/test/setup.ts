import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './server';

function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key) {
      return entries.get(String(key)) ?? null;
    },
    key(index) {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key) {
      entries.delete(String(key));
    },
    setItem(key, value) {
      entries.set(String(key), String(value));
    },
  };
}

function installMemoryStorage(name: 'localStorage' | 'sessionStorage') {
  const storage = createMemoryStorage();
  Object.defineProperty(window, name, { configurable: true, value: storage });
  vi.stubGlobal(name, storage);
  return storage;
}

// Node 25 exposes an experimental Storage object without the Web Storage
// methods unless --localstorage-file is configured. Tests use an explicit
// standards-shaped in-memory implementation so Node 22/25 behave identically.
const testLocalStorage = installMemoryStorage('localStorage');
const testSessionStorage = installMemoryStorage('sessionStorage');

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
  testLocalStorage.clear();
  testSessionStorage.clear();
  document.documentElement.classList.remove('dark');
});

afterAll(() => server.close());

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock implements ResizeObserver {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock);

class IntersectionObserverMock implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds: readonly number[];
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => [] as IntersectionObserverEntry[]);
  unobserve = vi.fn();

  constructor(_callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
    this.rootMargin = options.rootMargin ?? '0px';
    this.thresholds = Array.isArray(options.threshold)
      ? options.threshold
      : [options.threshold ?? 0];
  }
}

vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
