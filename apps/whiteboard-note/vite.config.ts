import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/whiteboard/',
  server: {
    port: 3001
  },
  build: {
    outDir: 'dist',
    target: 'es2015' // 구형 전자칠판 안드로이드 크로미움 호환
  }
});
