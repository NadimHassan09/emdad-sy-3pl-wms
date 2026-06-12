/**
 * Shared PM2 cluster settings for the NestJS backend.
 * Socket.IO uses Redis adapter (see RedisIoAdapter); cron uses CronLeaderService.
 */
function resolveInstances(defaultInstances) {
  const raw = process.env.PM2_INSTANCES;
  if (raw === undefined || raw === '') return defaultInstances;
  if (raw === 'max') return 'max';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : defaultInstances;
}

function backendClusterApp({
  name,
  cwd,
  outFile,
  errorFile,
  defaultInstances,
}) {
  return {
    name,
    cwd,
    script: 'dist/src/main.js',
    instances: resolveInstances(defaultInstances),
    exec_mode: 'cluster',
    autorestart: true,
    max_restarts: 20,
    restart_delay: 2000,
    max_memory_restart: '768M',
    wait_ready: true,
    listen_timeout: 30_000,
    kill_timeout: 30_000,
    shutdown_with_message: true,
    env_file: '.env',
    env: {
      CRON_LEADER_ENABLED: 'true',
    },
    out_file: outFile,
    error_file: errorFile,
    merge_logs: true,
    time: true,
  };
}

module.exports = { backendClusterApp, resolveInstances };
