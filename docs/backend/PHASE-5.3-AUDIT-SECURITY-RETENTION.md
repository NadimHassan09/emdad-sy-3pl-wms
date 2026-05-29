# Phase 5.3 — Audit Security & Retention

Production hardening for the audit-log read path (Phase 5.1 API + Phase 5.2 admin UI). Write path (`AuditLogService.log`) unchanged except export self-audit events.

---

## Summary

| Area | Implementation |
|------|----------------|
| Retention | Configurable `AUDIT_RETENTION_DAYS`; queries cannot read rows older than cutoff |
| Export | Capped CSV/JSON endpoint with date-range requirement, throttling, self-audit |
| Query limits | Env-driven caps on limit, offset, date span, count |
| Performance | Capped `COUNT(*)`, keyset export batches, list omits JSONB |
| Redaction | Recursive sensitive-key redaction on detail `previousState` / `newState` |
| Archival prep | `super_admin` partition candidate report (no auto-delete) |

---

## Configuration (Environment)

| Variable | Default | Purpose |
|----------|---------|---------|
| `AUDIT_RETENTION_DAYS` | `730` | Online query visibility floor (`0` = disabled) |
| `AUDIT_QUERY_MAX_LIMIT` | `100` | Max rows per list page |
| `AUDIT_QUERY_MAX_OFFSET` | `5000` | Max offset pagination depth |
| `AUDIT_QUERY_MAX_DATE_RANGE_DAYS` | `366` | Max list filter span |
| `AUDIT_QUERY_DEFAULT_WINDOW_DAYS` | `30` | Default window when dates omitted |
| `AUDIT_QUERY_COUNT_CAP` | `10000` | Count query stops at cap; sets `totalCapped` |
| `AUDIT_EXPORT_MAX_ROWS` | `500` | Max rows per export |
| `AUDIT_EXPORT_MAX_DATE_RANGE_DAYS` | `90` | Max export date span (stricter than list) |
| `AUDIT_EXPORT_ENABLED` | `true` | Kill switch for export endpoint |

Validated in `env.validation.ts`; documented in `.env.example`.

Central reader: `AuditLogPolicyConfig` (`audit-log-policy.config.ts`).

---

## Retention Protections

1. **Query floor** — `resolveDateRange()` raises `date_from` to the retention cutoff when configured.
2. **Detail gate** — `findById()` returns **404** for rows older than retention (same as cross-tenant leak prevention).
3. **Policy endpoint** — `GET /api/audit-logs/policy` exposes retention days and cutoff ISO for UI/ops.
4. **Archival preparation** — `GET /api/audit-logs/archival-candidates` (`super_admin` only):
   - Lists quarterly partitions (`audit_logs_YYYY_qN`)
   - Marks partitions whose quarter end ≤ retention cutoff as `eligibleForArchival`
   - **Does not delete or detach** — append-only table + DBA runbook note

Online retention is **visibility**, not deletion. Physical archival remains an ops procedure.

---

## Export Protections

**Endpoint:** `GET /api/audit-logs/export?format=csv|json&date_from=…&date_to=…` (+ same filters as list)

| Control | Value |
|---------|--------|
| RBAC | `AuthGroup.ADMIN` (class guard) |
| Rate limit | `@Throttle` 5 requests / minute |
| Date range | **Required** `date_from` + `date_to` |
| Max span | `AUDIT_EXPORT_MAX_DATE_RANGE_DAYS` (default 90) |
| Max rows | `AUDIT_EXPORT_MAX_ROWS` (default 500) |
| Kill switch | `AUDIT_EXPORT_ENABLED=false` → 403 |
| Tenant isolation | Same SQL scope as list |
| Payload | Summary columns only (no JSONB state blobs) |
| Response headers | `Cache-Control: no-store`, `X-Export-Row-Count`, `X-Export-Truncated` |
| Self-audit | Writes `AUDIT_LOG_EXPORT` event with filter metadata |

Export uses **keyset batching** (100 rows/batch) to limit memory.

Frontend: **Export CSV** button (authenticated blob download via Axios); requires applied date filters.

---

## Query Hardening

| Threat | Mitigation |
|--------|------------|
| Huge extraction via offset | Max offset 5000; export capped separately |
| Huge extraction via limit | Max limit 100 (list), 500 (export) |
| Unbounded date scans | Default 30-day window; max 366-day span (list) |
| Expensive `COUNT(*)` | Subquery capped at `AUDIT_QUERY_COUNT_CAP + 1`; response `totalCapped: true` |
| ILIKE abuse | Min search length 2; wildcard escape |
| Cross-tenant reads | Existing `CompanyAccessService` scope unchanged |
| Memory-heavy detail | JSON redaction + depth/array/string caps |

List response additions:

```json
{
  "totalCapped": false,
  "retentionCutoffIso": "2024-05-29T00:00:00.000Z"
}
```

---

## Sensitive Field Redaction

`audit-log-redaction.util.ts` applied on **detail reads** before API response:

- Redacts keys matching: `password`, `token`, `secret`, `authorization`, `jwt`, `apiKey`, etc.
- Strips bearer tokens and `key=value` secret patterns in strings
- Caps recursion depth, array length, string length

List and export summaries never include `previous_state` / `new_state`.

---

## Performance Optimizations

1. **Capped count** — avoids full-table count on large match sets
2. **Partition-friendly filters** — always apply `created_at` range (+ retention floor)
3. **Export keyset pagination** — no large OFFSET in export loop
4. **List SELECT** — summary columns only (unchanged from 5.1)
5. **Sequential read + count** — dropped `$transaction` wrapper for mixed promise types (read-only safety unchanged)

Existing indexes from Phase 5.1 remain the primary scan path.

---

## Files Added / Changed

| File | Change |
|------|--------|
| `audit-log-policy.config.ts` | Env-driven policy |
| `audit-log-redaction.util.ts` | JSON redaction helper |
| `audit-logs.service.ts` | Retention, capped count, export, archival, redaction |
| `audit-logs.controller.ts` | `policy`, `export`, `archival-candidates` routes |
| `export-audit-logs-query.dto.ts` | Export query DTO |
| `audit-logs.module.ts` | Imports `AuditModule`, registers policy config |
| `env.validation.ts`, `.env.example` | Audit env vars |
| `frontend/src/api/audit-logs.ts` | Policy + export download |
| `frontend/src/pages/AuditLogsPage.tsx` | Policy banner, export, count-cap warning |

---

## Operational Limitations

1. **No automatic purge** — Retention hides old rows from API; DB partitions remain until DBA archival.
2. **Count cap ambiguity** — When `totalCapped=true`, true total may exceed displayed cap.
3. **Export summary-only** — Before/after JSON not included in CSV (by design for safety/size).
4. **Archival report is metadata-only** — Requires manual partition detach/archive.
5. **Redaction is heuristic** — Unknown secret key names may still leak; prefer not logging secrets at write time.
6. **Throttle is per-IP** — Shared NAT may affect multiple admins.

---

## Future Scalability Considerations

1. **Cold storage** — Detach eligible partitions to object storage / read replica for compliance archives.
2. **Cursor-only UI** — Frontend could switch to keyset paging for deep history without OFFSET cost.
3. **Approximate counts** — Replace exact capped count with `EXPLAIN` or stats for very large tenants.
4. **Field-level policy** — Role-based masking (e.g. finance sees actions but not IP).
5. **Export async jobs** — For larger compliance exports, queue worker + signed URL instead of synchronous CSV.
6. **Retention job** — Scheduled partition detach after legal hold checks (still no row DELETE).
7. **Search index** — `pg_trgm` or OpenSearch if ILIKE search becomes hot at scale.

---

## Verification

- `npx tsc --noEmit` (backend + frontend) — pass
- Manual:
  - `GET /api/audit-logs/policy` → limits JSON
  - List with broad filters → `totalCapped` when >10k matches
  - Export without dates → 400
  - Export with 7-day range → CSV ≤500 rows + `AUDIT_LOG_EXPORT` audit row
  - Detail state with `password` key → `[REDACTED]`
  - `GET /api/audit-logs/archival-candidates` as non–super_admin → 403
