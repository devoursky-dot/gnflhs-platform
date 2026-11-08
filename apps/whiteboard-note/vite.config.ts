import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/whiteboard/',
  resolve: {
    alias: {
      '@gnflhs/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts')
    }
  },
  server: {
    port: 3001
  },
  build: {
    outDir: 'dist',
    target: 'es2015' // 구형 전자칠판 안드로이드 크로미움 호환
  }
});
