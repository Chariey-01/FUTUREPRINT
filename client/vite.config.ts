import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          // framer-motion is deliberately NOT forced into one chunk: its animation features
          // load lazily (see app/motionFeatures.ts) so they stay out of the initial bundle.
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
    // Multi-step journey tests with lazy route chunks are slow on the WSL filesystem.
    testTimeout: 20_000,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
