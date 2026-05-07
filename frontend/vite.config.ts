import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath, URL as NodeURL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@emdad/wms-task-execution': fileURLToPath(
        new NodeURL('./src/vendor/wms-task-execution/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
});
