import { defineConfig } from 'vite';

// In development the API runs on :8080; proxy it so the client uses same-origin URLs.
// TIMELINE=1 builds only the timeline game (a standalone page with no server).
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const timelineOnly = env.TIMELINE === '1';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    // Allow the Claude app's preview proxy (and LAN devices) to reach the dev server.
    allowedHosts: true,
    proxy: {
      '/v1/realtime': { target: 'ws://localhost:8080', ws: true },
      '/v1': 'http://localhost:8080',
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: timelineOnly
        ? { timeline: 'timeline.html' }
        : { main: 'index.html', timeline: 'timeline.html' },
    },
  },
});
