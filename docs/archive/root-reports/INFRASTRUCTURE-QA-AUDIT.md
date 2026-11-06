# Infrastructure QA Audit

**Phase:** Phase 10 — Production Infrastructure Audit  
**Audit date:** 2026-06-12  
**Auditor:** Independent QA (FINAL-QA-CERTIFICATION)

---

## Summary

| Metric | Value |
|--------|------:|
| **Phase score** | **81/100** |
| PM2 process | emdad-wms-backend — **online** |
| PM2 instances | 1 (production) |
| PM2 uptime | ~3h at audit time |
| PM2 restarts | 1 |
| Nginx vhosts | emdad-wms-admin, emdad-wms-client |
| SSL | TLS 1.2/1.3, HSTS enabled |
| Redis | Disabled in production |
| Cron jobs | 11 in-process |

## Production Topology

```mermaid
flowchart TB
    Users[Internet] --> CF[Cloudflare]
    CF --> Nginx[nginx :443]
    Nginx --> Admin[admin.emdadsy.com SPA]
    Nginx --> Client[client.emdadsy.com SPA]
    Nginx --> API[NestJS :3000]
    API --> PG[(PostgreSQL wms_db)]
    API --> FS[/var/lib/emdad-wms/backups/production]
```

## PM2 Configuration

| Setting | Value |
|---------|-------|
| Process name | emdad-wms-backend |
| Script | dist/src/main.js |
| CWD | /var/www/emdad-sy-3pl-wms/backend |
| Instances | 1 (ecosystem supports cluster max) |
| Logs | /var/log/emdad-wms/backend-{out,err}.log |
| Cron leader | CRON_LEADER_ENABLED=true (PM2 instance 0 fallback) |

## Nginx & SSL

| File | Purpose |
|------|---------|
| /etc/nginx/sites-enabled/emdad-wms-admin | Admin SPA + API proxy |
| /etc/nginx/sites-enabled/emdad-wms-client | Client SPA + API proxy |
| /etc/nginx/snippets/emdad-wms-backend-locations.conf | /api, /realtime, /socket.io |
| SSL certs | /etc/nginx/ssl/emdad-wms/ |

## Health Monitoring

| Endpoint | Result (live) |
|----------|---------------|
| GET /api/ops/health/live | 200 OK |
| GET /api/ops/health/ready | db ok, redis disabled, websocket ok, process ok, queues ok |
| GET /api/backups/health | 200 OK (authenticated) |

## Logging

- PM2 stdout/stderr → `/var/log/emdad-wms/`
- Nginx access/error → `/var/log/nginx/emdad-{admin,client}.*.log`
- Application structured JSON HTTP logs via stdout

## Cron Jobs (11)

| Schedule | Service |
|----------|---------|
| Every minute | BackupSchedulerService |
| Every 2 min | BackupDriveRetryService |
| Every 5 min | SlaEscalationService |
| Every 15 min | BillingCycleProcessor, BackupHealthAlert |
| 03:00 daily | CycleCountScheduler |
| 04:00 daily | BillingUsageProcessor |
| 05:15 daily | BackupRetentionCleanup |
| 05:30 daily | BackupDriveRetentionCleanup |
| 06:00 daily | BillingInvoiceOverdue |
| 08:00 daily | BillingExpiryReminder |

## Findings

| ID | Severity | Finding |
|----|----------|---------|
| I-01 | Medium | Single PM2 instance — no API horizontal redundancy |
| I-02 | Medium | Redis disabled — cron leader uses PM2 instance 0 only |
| I-03 | Medium | No external APM/alerting (Datadog/Prometheus) |
| I-04 | Low | No containerization |
| I-05 | Info | Staging nginx configs not in deploy/ (staging decommissioned) |

## Phase Score: 81/100

Production is stable with documented nginx/PM2/SSL stack and working health probes. Deductions for single-instance deployment, disabled Redis, and lack of external monitoring.
