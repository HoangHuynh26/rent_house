import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', '');

  // Lấy target từ VITE_API_TARGET nếu có, mặc định trỏ đến backend Render: https://rent-house-3jm7.onrender.com
  const apiTarget = env.VITE_API_TARGET || (env.VITE_API_URL && env.VITE_API_URL.startsWith('http') ? env.VITE_API_URL : 'https://rent-house-3jm7.onrender.com');

  return {
    plugins: [react()],
    envDir: '../',
    server: {
      port: 5173,
      proxy: {
        // 1. API chính kết nối đến backend Render
        '/api': {
          target: 'https://rent-house-3jm7.onrender.com',
          changeOrigin: true,
          secure: false,
        },
        '/uploads': {
          target: 'https://rent-house-3jm7.onrender.com',
          changeOrigin: true,
          secure: false,
        },
        // 2. Proxy phụ hỗ trợ kết nối trực tiếp
        '/api-render': {
          target: 'https://rent-house-3jm7.onrender.com',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api-render/, '/api'),
        }
      }
    }
  };
});
