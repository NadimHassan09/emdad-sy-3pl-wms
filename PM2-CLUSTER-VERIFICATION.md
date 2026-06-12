# PM2 Cluster Mode — Verification Report

Generated as part of the production-safe cluster upgrade. Re-run after deploy:

```bash
cd backend && npm run build
pm2 reload ecosystem.staging.config.js --update-env
node scripts/verify-pm2-cluster.mjs
```

Machine-readable output: `docs/ops/pm2-cluster-verification.json`

## Changes

| Area | Implementation |
|------|----------------|
| PM2 | `exec_mode: cluster`, `instances` from `PM2_INSTANCES` (staging default **2**, prod **max**) |
| Graceful shutdown | `enableShutdownHooks()`, `shutdown_with_message`, `kill_timeout: 30s`, PM2 `shutdown` message handler |
| Readiness | `wait_ready: true` + `process.send('ready')`; `/api/ops/health/ready` returns **503** while draining |
| Cron leader | `CronLeaderService` — Redis `SET NX` per job; fallback to instance **0** when Redis disabled |
| Socket.IO | `RedisIoAdapter` (`@socket.io/redis-adapter`) for cross-worker broadcasts |

## PM2 configuration

Shared helper: `pm2-backend-cluster.js`

Reload staging:

```bash
pm2 startOrReload /var/www/emdad-sy-3pl-wms-staging/ecosystem.staging.config.js --update-env
```

## Cron jobs protected (11)

All `@Cron` handlers wrap work in `cronLeader.runExclusive(jobKey, ttlSec, fn)`.

Set `CRON_LEADER_ENABLED=false` only in local dev to run crons on every instance.

## Failover verification checklist

1. **Multi-instance online** — `pm2 jlist` shows ≥2 workers in `cluster_mode`, status `online`
2. **Readiness** — `GET /api/ops/health/ready` → 200 while healthy
3. **Liveness during reload** — `pm2 reload emdad-wms-backend-staging` — API stays reachable
4. **Drain signal** — workers log `Draining traffic` before exit; readiness → 503 on draining worker
5. **Cron dedup** — with Redis, only one `wms:cron:lock:*` holder per tick

## Tests

```bash
cd backend && npm run test:unit -- cron-leader.service.unit.spec.ts
```

## Verification run (2026-06-12)

| Check | Result |
|-------|--------|
| PM2 workers | **2** online, `cluster_mode` |
| `wait_ready` | configured |
| `GET /api/ops/health/live` | **200** (5 samples) |
| `GET /api/ops/health/ready` | **200** (db ok, redis disabled fallback) |
| Failover during `pm2 reload` | **10/10** liveness probes returned **200** |
| Cron leader unit tests | **5/5** passed |

Machine-readable: [`docs/ops/pm2-cluster-verification.json`](docs/ops/pm2-cluster-verification.json)

**Note:** Staging currently runs with `REDIS_ENABLED=false` (no Redis daemon on host). Enable Redis and set `REDIS_ENABLED=true` for cross-worker Socket.IO broadcasts and Redis-based cron locks. Without Redis, crons run only on `NODE_APP_INSTANCE=0`.
