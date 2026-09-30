import { execSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import { resolve as pathResolve } from 'node:path';

function resolveBuildInfo() {
  const version = process.env.npm_package_version ?? '0.1.0';
  let gitCommit = '';
  try {
    gitCommit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    /* ignore */
  }
  const timestamp = Date.now();
  const buildId = gitCommit ? `${timestamp}-${gitCommit}` : String(timestamp);
  return {
    version,
    buildId,
    buildTime: new Date().toISOString(),
  };
}

const buildInfo = resolveBuildInfo();

function versionJsonPlugin(info: typeof buildInfo) {
  return {
    name: 'version-json-plugin',
    generateBundle(this: any) {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(info, null, 2),
      });
    },
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/version.json')) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.end(JSON.stringify(info));
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildInfo.buildId),
    __APP_VERSION__: JSON.stringify(buildInfo.version),
  },
  plugins: [react(), versionJsonPlugin(buildInfo)],
  resolve: {
    alias: {
      '@ds': fileURLToPath(
        new NodeURL('../shared/design-system-next/ui/index.ts', import.meta.url),
      ),
      'react': pathResolve('./node_modules/react'),
      'react-dom': pathResolve('./node_modules/react-dom'),
      'react/jsx-runtime': pathResolve('./node_modules/react/jsx-runtime.js'),
      '@tanstack/react-query': pathResolve('./node_modules/@tanstack/react-query'),
      'libphonenumber-js/max': pathResolve('./node_modules/libphonenumber-js/max/index.js'),
      'libphonenumber-js': pathResolve('./node_modules/libphonenumber-js/index.js'),
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
