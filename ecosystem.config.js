// PM2 process definition for the EMDAD WMS backend.
// Single Node process — Socket.IO uses sticky in-memory sessions; horizontal
// scaling requires the @socket.io/redis-adapter (see backend/.env REDIS_*).
module.exports = {
  apps: [
    {
      name: 'emdad-wms-backend',
      cwd: '/var/www/emdad-sy-3pl-wms/backend',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      out_file: '/var/log/emdad-wms/backend-out.log',
      error_file: '/var/log/emdad-wms/backend-err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
