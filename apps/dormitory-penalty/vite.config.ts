import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '../..'),
  base: '/dormitory/',
  resolve: {
    alias: {
      '@gnflhs/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts')
    }
  },
  server: {
    port: 3003
  },
  build: {
    outDir: 'dist'
  }
});
