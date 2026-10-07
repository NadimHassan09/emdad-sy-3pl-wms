import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { createConfig } from '../../vite.shared'

export default defineConfig(({ mode }) =>
  createConfig({ appDir: fileURLToPath(new URL('.', import.meta.url)), port: 5273, devOrigin: 'https://staging-admin.emdadsy.com', mode }),
)
