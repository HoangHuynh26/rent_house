import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', '');

  // Lấy target từ VITE_API_URL / VITE_API_TARGET trong .env nếu có, mặc định là localhost:5000
  const apiTarget = env.VITE_API_TARGET || (env.VITE_API_URL && env.VITE_API_URL.startsWith('http') ? env.VITE_API_URL : 'http://localhost:5000');

  return {
    plugins: [react()],
    envDir: '../',
    server: {
      port: 5173,
      proxy: {
        // 1. API chính (mặc định trỏ đến backend local: http://localhost:5000 hoặc theo .env)
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
        // 2. API kết nối trực tiếp đến link public Netlify: https://nhatrothanhtam.netlify.app
        '/api-netlify': {
          target: 'https://nhatrothanhtam.netlify.app',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api-netlify/, '/api'),
        }
      }
    }
  };
});
