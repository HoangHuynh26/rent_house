import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

const frontendDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  // Only load variables prefixed with VITE_ to avoid NODE_ENV conflicts
  const envLocal = loadEnv(mode, frontendDir, 'VITE_');
  let envParent = {};
  try {
    envParent = loadEnv(mode, path.resolve(frontendDir, '..'), 'VITE_');
  } catch (e) {}
  const env = { ...envParent, ...envLocal };

  // Resolve API target: priority from VITE_API_TARGET, then VITE_API_URL, default to Render backend
  const apiTarget = env.VITE_API_TARGET || (env.VITE_API_URL && env.VITE_API_URL.startsWith('http') ? env.VITE_API_URL.replace(/\/api\/?$/, '') : 'https://rent-house-3jm7.onrender.com');

  return {
    plugins: [react()],
    envDir: frontendDir,
    server: {
      port: 5173,
      proxy: {
        // 1. API chính kết nối đến backend
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        // 2. Proxy phụ hỗ trợ kết nối trực tiếp
        '/api-render': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api-render/, '/api'),
        }
      }
    }
  };
});
