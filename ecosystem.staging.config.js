// PM2 process definition for the EMDAD WMS staging backend (cluster mode).
const { backendClusterApp } = require('./pm2-backend-cluster');

module.exports = {
  apps: [
    backendClusterApp({
      name: 'emdad-wms-backend-staging',
      cwd: '/var/www/emdad-sy-3pl-wms-staging/backend',
      outFile: '/var/log/emdad-wms-staging/backend-out.log',
      errorFile: '/var/log/emdad-wms-staging/backend-err.log',
      defaultInstances: 2,
    }),
  ],
};
