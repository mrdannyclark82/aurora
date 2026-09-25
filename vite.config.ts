import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: Do not inline secrets (e.g. GEMINI_API_KEY) into the client bundle via `define`.
// All Gemini / Google API calls go through the /api/proxy serverless function, which
// reads GEMINI_API_KEY from the server environment only.
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
