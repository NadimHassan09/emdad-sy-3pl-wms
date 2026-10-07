import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv, type PluginOption, type UserConfig } from 'vite'

const ROOT = fileURLToPath(new URL('.', import.meta.url))

function buildInfo() {
  let commit = ''
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'], cwd: ROOT }).toString().trim()
  } catch {
    /* not a git checkout */
  }
  const ts = Date.now()
  return { version: process.env.npm_package_version ?? '0.1.0', buildId: commit ? `v2-${ts}-${commit}` : `v2-${ts}`, buildTime: new Date().toISOString() }
}

function versionJson(info: ReturnType<typeof buildInfo>): PluginOption {
  return {
    name: 'emdad-version-json',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(info, null, 2) })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/version.json')) {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
          res.end(JSON.stringify(info))
          return
        }
        next()
      })
    },
  }
}

/** Shared Vite config for both portals. `port` differs; `/api` + `/socket.io` proxy to the staging backend (3001). */
export function createConfig(opts: { appDir: string; port: number; mode: string; devOrigin: string }): UserConfig {
  const env = loadEnv(opts.mode, opts.appDir, '')
  const backend = (env.VITE_DEV_BACKEND_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '')
  const info = buildInfo()
  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(info.buildId),
      __APP_VERSION__: JSON.stringify(info.version),
      __OMS_COD_RETURNS_UI_ENABLED__: JSON.stringify(env.OMS_COD_RETURNS_UI_ENABLED ?? 'true'),
      __BACKUP_GDRIVE_UI_ENABLED__: JSON.stringify(env.BACKUP_GDRIVE_UI_ENABLED ?? 'false'),
    },
    plugins: [react(), tailwindcss(), versionJson(info)],
    resolve: {
      alias: {
        '@ui': resolve(ROOT, 'packages/ui/src'),
        '@': resolve(opts.appDir, 'src'),
      },
      dedupe: ['react', 'react-dom', 'react-router', '@tanstack/react-query'],
    },
    server: {
      port: opts.port,
      host: '127.0.0.1',
      proxy: {
        // Use `/api/` (trailing slash) so the client SPA route `/apis` is NOT proxied to Nest.
        // The staging API only accepts its own portal origins (CORS), so the dev proxy presents one.
        '/api/': {
          target: backend,
          changeOrigin: true,
          configure: (proxy) => proxy.on('proxyReq', (req) => req.setHeader('origin', env.VITE_DEV_ORIGIN ?? opts.devOrigin)),
        },
        '/socket.io': {
          target: backend,
          changeOrigin: true,
          ws: true,
          configure: (proxy) => proxy.on('proxyReqWs', (req) => req.setHeader('origin', env.VITE_DEV_ORIGIN ?? opts.devOrigin)),
        },
      },
    },
    preview: { port: opts.port, host: '127.0.0.1' },
    build: {
      sourcemap: false,
      // Avoid splitting React away from peers (Radix, lucide, cmdk, …). Separate chunks
      // evaluate peers before `react` is initialized → createContext/forwardRef crashes.
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('socket.io') || id.includes('engine.io')) return 'vendor-realtime'
            return undefined
          },
        },
      },
    },
  }
}
