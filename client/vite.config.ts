import { defineConfig } from 'vite';

// In development the API runs on :8080; proxy it so the client uses same-origin URLs.
export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/v1/realtime': { target: 'ws://localhost:8080', ws: true },
      '/v1': 'http://localhost:8080',
    },
  },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
