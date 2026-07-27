/// <reference types="vitest/config" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    // jsdom/user-event suites are memory-heavy; a bounded pool avoids CI
    // contention turning otherwise-fast interaction tests into 5s flakes.
    maxWorkers: 2,
    testTimeout: 15_000,
  },
});
