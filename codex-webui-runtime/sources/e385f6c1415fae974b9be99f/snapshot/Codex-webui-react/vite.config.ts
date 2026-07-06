import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/client')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5175,
    proxy: {
      '/events': 'http://127.0.0.1:5155',
      '/uploads': 'http://127.0.0.1:5155',
      '/transfer': 'http://127.0.0.1:5155',
      '/health': 'http://127.0.0.1:5155',
      '/asset-version': 'http://127.0.0.1:5155',
      '^/(memory|git|skills|mcp|preview|terminal|session|sessions|projects|filesystem|project|path|message|queue|config|restart|new-chat|cancel|thread|apps|plugins|realtime|account|windows-sandbox)(/.*)?$': 'http://127.0.0.1:5155'
    }
  },
  publicDir: 'static',
  build: {
    outDir: 'public',
    emptyOutDir: true
  }
});
