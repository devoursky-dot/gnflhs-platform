import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/dormitory/',
  server: {
    port: 3003
  },
  build: {
    outDir: 'dist'
  }
});
