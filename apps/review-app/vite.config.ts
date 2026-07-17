import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/** Mirror API Basic Auth when AAIRP_REVIEW_BASIC_AUTH_* are set (Vite does not hit Fastify for HTML). */
function reviewBasicAuthDevPlugin(): Plugin {
  return {
    name: 'aairp-review-basic-auth-dev',
    configureServer(server) {
      const user = process.env.AAIRP_REVIEW_BASIC_AUTH_USER?.trim() ?? '';
      const password = process.env.AAIRP_REVIEW_BASIC_AUTH_PASSWORD ?? '';
      if (!user || !password) {
        return;
      }
      const expected = Buffer.from(`${user}:${password}`).toString('base64');
      server.middlewares.use((req, res, next) => {
        const header = req.headers.authorization;
        if (header === `Basic ${expected}`) {
          next();
          return;
        }
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="AAIRP Review", charset="UTF-8"');
        res.end('Authentication required');
      });
    },
  };
}

export default defineConfig({
  base: '/review/',
  plugins: [react(), reviewBasicAuthDevPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/demo': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
