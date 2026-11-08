import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '../..'),
  base: '/account/',
  resolve: {
    alias: {
      '@gnflhs/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@gnflhs/shared-auth': path.resolve(__dirname, '../../packages/shared-auth/src/index.ts')
    }
  },
  server: {
    port: 3002
  },
  build: {
    outDir: 'dist'
  }
});
