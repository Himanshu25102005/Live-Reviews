import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const { BACKEND_URL = 'http://127.0.0.1:3000' } = loadEnv(mode, process.cwd(), 'BACKEND_');
  const proxy = {
    '/api': BACKEND_URL,
    '^/ws$': { target: BACKEND_URL, ws: true },
  };

  return {
    plugins: [react()],
    server: { host: '127.0.0.1', strictPort: true, proxy },
    preview: { host: '127.0.0.1', strictPort: true, proxy },
  };
});
