import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath, URL as NodeURL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      /** Shared WMS design-system primitive barrel — see shared/design-system/ui. */
      '@ds': fileURLToPath(
        new NodeURL('../shared/design-system/ui/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5174,
  },
});
