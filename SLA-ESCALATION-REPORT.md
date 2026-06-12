# SLA Breach Escalation — Implementation Report

**Date:** 2026-06-12  
**Environment:** staging (`emdad-wms-backend-staging`, port 3001)

## Summary

Replaced the SLA escalation notification stub with a production workflow: overdue in-progress warehouse tasks are detected every 5 minutes, escalation level is bumped idempotently, warehouse managers receive in-app notifications (deduplicated per level), and every escalation is recorded in the audit log and `task_events`.

## Components

| Component | Role |
|-----------|------|
| `SlaEscalationService` | Cron monitor (`*/5 * * * *`); detects SLA breaches; bumps `escalation_level`; degrades workflow |
| `sla-breach.util.ts` | Breach detection helpers (`startedAt + slaMinutes`) |
| `NotificationsService.notifyManagersSlaBreach` | In-app alerts to `super_admin` + `wh_manager` via realtime |
| `SlaAuditService` | Audit action `sla.task.escalated` with breach metadata |
| `task_events` (`sla_escalation`) | Per-task escalation history + 1h cooldown between levels |

## Overdue detection

A task is **overdue** when:

- `status = in_progress`
- `sla_minutes` and `started_at` are set
- `now > started_at + sla_minutes`
- `escalation_level < 20`

Default SLA minutes per task type are defined in `task-sla-defaults.ts` (e.g. pick 480 min, pack 240 min).

## Notification flow

1. Cron finds breached task (outside 1h cooldown since last `sla_escalation` event).
2. Transaction increments `escalation_level`, writes `task_events`, marks workflow `degraded` if needed.
3. `notifyManagersSlaBreach` creates notifications with type `admin_sla_breach_l{N}`.
4. **Dedup:** one notification set per `(taskId, escalation level)` — replays/cron overlap do not duplicate.
5. Realtime `notification.created` pushed to each manager.

Example notification body:

> Pick task 11111111 at Main DC (Acme Imports) is 45 min past its 60 min SLA.

## Audit evidence

| Evidence type | Location |
|---------------|----------|
| Audit log | `action = sla.task.escalated`, `resource_type = warehouse_task` |
| Task timeline | `task_events.event = sla_escalation` with `escalationLevel`, `breachedAtTs` |
| In-app notifications | `notifications.type LIKE 'admin_sla_breach_l%'` |
| Unit tests | `sla-breach.util.unit.spec.ts`, `sla-escalation.service.unit.spec.ts` |

Audit `new_state` payload includes: `escalationLevel`, `slaMinutes`, `breachedAt`, `notifiedManagers`, `workflowInstanceId`.

## Verification queries

```sql
-- Recent SLA escalations (audit)
SELECT action, resource_id, new_state, created_at
FROM audit_logs
WHERE action = 'sla.task.escalated'
ORDER BY created_at DESC
LIMIT 20;

-- Manager notifications for SLA breaches
SELECT type, title, body, reference_id, created_at
FROM notifications
WHERE type LIKE 'admin_sla_breach_l%'
ORDER BY created_at DESC
LIMIT 20;

-- Task event trail
SELECT task_id, payload, created_at
FROM task_events
WHERE event = 'sla_escalation'
ORDER BY created_at DESC
LIMIT 20;
```

## Tests

```bash
cd backend
npm run test:unit -- sla-breach.util.unit.spec.ts sla-escalation.service.unit.spec.ts
```

## Deploy

```bash
cd backend && npm run build
pm2 reload emdad-wms-backend-staging --update-env
```

Managers see alerts in the admin notification bell; audit rows appear under **Settings → Audit log** (filter `sla.task.escalated`).
