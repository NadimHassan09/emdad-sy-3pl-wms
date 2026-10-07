import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { createConfig } from '../../vite.shared'

export default defineConfig(({ mode }) =>
  createConfig({ appDir: fileURLToPath(new URL('.', import.meta.url)), port: 5274, devOrigin: 'https://staging-client.emdadsy.com', mode }),
)
