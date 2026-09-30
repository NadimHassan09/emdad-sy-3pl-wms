// PM2 process definition for the EMDAD WMS backend (production cluster).
const fs = require('fs');
const path = require('path');
const { backendClusterApp } = require('./pm2-backend-cluster');

/** Minimal .env parser — PM2 env_file is unreliable in this environment. */
function loadEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = loadEnvFile(
  path.join('/var/www/emdad-sy-3pl-wms/backend', '.env'),
);

module.exports = {
  apps: [
    backendClusterApp({
      name: 'emdad-wms-backend',
      cwd: '/var/www/emdad-sy-3pl-wms/backend',
      outFile: '/var/log/emdad-wms/backend-out.log',
      errorFile: '/var/log/emdad-wms/backend-err.log',
      defaultInstances: 1,
      env: {
        ...fileEnv,
        PORT: '3000',
        PUPPETEER_EXECUTABLE_PATH:
          fileEnv.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
        PUPPETEER_CACHE_DIR: '/root/.cache/puppeteer',
      },
    }),
  ],
};
