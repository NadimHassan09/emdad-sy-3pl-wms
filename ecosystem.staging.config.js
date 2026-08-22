// PM2 process definition for the EMDAD WMS staging backend (cluster mode).
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
  path.join('/var/www/emdad-sy-3pl-wms-staging/backend', '.env'),
);

module.exports = {
  apps: [
    backendClusterApp({
      name: 'emdad-wms-backend-staging',
      cwd: '/var/www/emdad-sy-3pl-wms-staging/backend',
      outFile: '/var/log/emdad-wms-staging/backend-out.log',
      errorFile: '/var/log/emdad-wms-staging/backend-err.log',
      defaultInstances: 1, // Redis is off on staging — multi-instance breaks Socket.IO fan-out
      env: {
        ...fileEnv,
        // Hard pins — never inherit shell/prod PORT=3000
        PORT: '3001',
        REALTIME_SYNC_MODE: fileEnv.REALTIME_SYNC_MODE || 'canonical',
      },
    }),
  ],
};
