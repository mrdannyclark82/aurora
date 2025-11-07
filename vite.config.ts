import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      // Dev-only middleware: provide a simple JSON stub for /api/proxy so client fetches
      // don't receive empty/non-JSON responses while running in the Vite dev server.
      // In production, the real serverless function should handle these requests.
      configureServer: (server) => {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/proxy' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              // Attempt to parse incoming request body to determine action
              try {
                const parsed = body ? JSON.parse(body) : {};
                const action = parsed.action || (parsed.action === undefined ? undefined : parsed.action);

                // If the frontend asks for a streaming response, simulate SSE in dev
                if (action === 'generateChatStream') {
                  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
                  res.setHeader('Cache-Control', 'no-cache, no-transform');
                  res.setHeader('Connection', 'keep-alive');

                  // Send a few fake chunks with delays to simulate streaming
                  const chunks = [
                    { text: 'Thinking...' },
                    { text: 'Generating response part 1.' },
                    { text: 'Generating response part 2.' },
                    { text: 'Finalizing.' }
                  ];

                  let i = 0;
                  const sendChunk = () => {
                    if (i >= chunks.length) {
                      res.write('event: done\ndata: {}\n\n');
                      return res.end();
                    }
                    const str = JSON.stringify(chunks[i]);
                    res.write(`data: ${str}\n\n`);
                    i += 1;
                    setTimeout(sendChunk, 200);
                  };
                  // Start streaming
                  sendChunk();
                  return;
                }

                // Default JSON stub for other proxy actions
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: 'proxy-unavailable-in-dev', message: 'The /api/proxy endpoint is not available in the dev server. This is a dev stub.' }));
                return;
              } catch (err) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: 'invalid-request', details: String(err) }));
                return;
              }
            });
            return;
          }
          next();
        });
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
