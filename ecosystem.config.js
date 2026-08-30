// PM2 process definition for the EMDAD WMS backend (production cluster).
const { backendClusterApp } = require('./pm2-backend-cluster');

module.exports = {
  apps: [
    backendClusterApp({
      name: 'emdad-wms-backend',
      cwd: '/var/www/emdad-sy-3pl-wms/backend',
      outFile: '/var/log/emdad-wms/backend-out.log',
      errorFile: '/var/log/emdad-wms/backend-err.log',
      // Redis adapter is off — multi-instance breaks Socket.IO presence fan-out
      // and causes online/offline flapping + reconnect request storms.
      defaultInstances: 1,
      env: {
        // Pin system Chrome so a polluted shell PUPPETEER_CACHE_DIR
        // (e.g. Cursor sandbox) cannot break PDF / API-docs downloads.
        PUPPETEER_EXECUTABLE_PATH: '/usr/bin/google-chrome',
        PUPPETEER_CACHE_DIR: '/root/.cache/puppeteer',
      },
    }),
  ],
};
