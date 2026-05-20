import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { resolve as pathResolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@emdad/wms-task-execution': fileURLToPath(
        new NodeURL('./src/vendor/wms-task-execution/index.ts', import.meta.url),
      ),
      /** Shared WMS design-system primitive barrel — see shared/design-system/ui. */
      '@ds': fileURLToPath(
        new NodeURL('../shared/design-system/ui/index.ts', import.meta.url),
      ),
      // Resolve react from local node_modules for shared cross-package files.
      'react': pathResolve('./node_modules/react'),
      'react-dom': pathResolve('./node_modules/react-dom'),
      'react/jsx-runtime': pathResolve('./node_modules/react/jsx-runtime.js'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  build: {
    rollupOptions: {
      output: {
        // Split vendor dependencies into stable long-cached chunks.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('socket.io') || id.includes('engine.io')) return 'vendor-realtime';
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
});
