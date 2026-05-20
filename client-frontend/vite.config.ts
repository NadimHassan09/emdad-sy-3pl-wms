import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { resolve as pathResolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      /** Shared WMS design-system primitive barrel — see shared/design-system/ui. */
      '@ds': fileURLToPath(
        new NodeURL('../shared/design-system/ui/index.ts', import.meta.url),
      ),
      /** Admin list UI (DataTable, FilterPanel, fields) — shared with WMS frontend. */
      '@wms/components': fileURLToPath(
        new NodeURL('../frontend/src/components', import.meta.url),
      ),
      '@wms/hooks': fileURLToPath(new NodeURL('../frontend/src/hooks', import.meta.url)),
      /**
       * Shared design-system files live outside this app's directory.
       * Rolldown needs an explicit alias so all shared TSX resolves to the
       * same react copy as the app (prevents "two Reacts" and resolution errors).
       */
      'react': pathResolve('./node_modules/react'),
      'react-dom': pathResolve('./node_modules/react-dom'),
      'react/jsx-runtime': pathResolve('./node_modules/react/jsx-runtime.js'),
    },
    // Also dedupe to guarantee a single react instance at runtime
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5174,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@tanstack/react-query')) return 'vendor-query';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
});
