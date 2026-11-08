import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/account/',
  server: {
    port: 3002
  },
  build: {
    outDir: 'dist'
  }
});
