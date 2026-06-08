import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { resolve as pathResolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ds': fileURLToPath(
        new NodeURL('../shared/design-system/ui/index.ts', import.meta.url),
      ),
      '@wms/components': fileURLToPath(
        new NodeURL('../frontend/src/components', import.meta.url),
      ),
      '@wms/hooks': fileURLToPath(new NodeURL('../frontend/src/hooks', import.meta.url)),
      'react': pathResolve('./node_modules/react'),
      'react-dom': pathResolve('./node_modules/react-dom'),
      'react/jsx-runtime': pathResolve('./node_modules/react/jsx-runtime.js'),
      '@tanstack/react-query': pathResolve('./node_modules/@tanstack/react-query'),
    },
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
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
