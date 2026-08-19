import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { resolve as pathResolve } from 'node:path';

/** NestJS local API (`backend/.env` PORT, default 3000). */
const DEFAULT_DEV_BACKEND = 'http://127.0.0.1:3000';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devBackend = (env.VITE_DEV_BACKEND_URL ?? DEFAULT_DEV_BACKEND).replace(/\/$/, '');

  const backupGdriveUiEnabled = env.BACKUP_GDRIVE_UI_ENABLED ?? 'false';
  const omsCodReturnsUiEnabled = env.OMS_COD_RETURNS_UI_ENABLED ?? 'true';

  return {
  define: {
    __BACKUP_GDRIVE_UI_ENABLED__: JSON.stringify(backupGdriveUiEnabled),
    __OMS_COD_RETURNS_UI_ENABLED__: JSON.stringify(omsCodReturnsUiEnabled),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@emdad/wms-task-execution': fileURLToPath(
        new NodeURL('./src/vendor/wms-task-execution/index.ts', import.meta.url),
      ),
      /** Shared WMS design-system primitive barrel — see shared/design-system-next/ui. */
      '@ds': fileURLToPath(
        new NodeURL('../shared/design-system-next/ui/index.ts', import.meta.url),
      ),
      // Resolve react from local node_modules for shared cross-package files.
      'react': pathResolve('./node_modules/react'),
      'react-dom': pathResolve('./node_modules/react-dom'),
      'react/jsx-runtime': pathResolve('./node_modules/react/jsx-runtime.js'),
      '@tanstack/react-query': pathResolve(
        './node_modules/@tanstack/react-query/build/modern/index.js',
      ),
      'libphonenumber-js/max': pathResolve('./node_modules/libphonenumber-js/max/index.js'),
      'libphonenumber-js': pathResolve('./node_modules/libphonenumber-js/index.js'),
    },
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: devBackend,
        changeOrigin: true,
      },
      '/socket.io': {
        target: devBackend,
        changeOrigin: true,
        ws: true,
      },
    },
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
          // Keep React + its runtime deps in one chunk. Splitting `scheduler`
          // into the catch-all vendor chunk creates a circular
          // vendor <-> vendor-react import that leaves React undefined
          // (forwardRef TypeError) when recharts loads.
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('/react-is/')
          ) {
            return 'vendor-react';
          }
          if (
            id.includes('recharts') ||
            id.includes('/d3-') ||
            id.includes('victory-vendor')
          ) {
            return 'vendor-recharts';
          }
          return 'vendor';
        },
      },
    },
  },
};
});
