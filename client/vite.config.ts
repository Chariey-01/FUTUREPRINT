import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the client calls same-origin /api/v1 and Vite forwards it to Flask,
    // so no CORS setup is needed locally. Override the target with VITE_DEV_API_PROXY.
    // Only used when VITE_API_BASE_URL is empty; an absolute base URL bypasses the proxy.
    proxy: {
      '/api': { target: process.env.VITE_DEV_API_PROXY ?? 'http://localhost:5000' },
    },
  },
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
