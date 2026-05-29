# Phase 5.1 — Audit Log Backend API Completion

Operational audit-log read APIs for warehouse admins and support teams. Write path unchanged (`AuditLogService.log` / `logTx`); this phase adds secure browse/search/filter/detail endpoints only.

---

## APIs Added

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/audit-logs` | Paginated list with filters, search, sorting |
| `GET` | `/api/audit-logs/:id` | Full event detail including `previousState` / `newState` |

Both routes require a valid internal JWT (`JwtAuthGuard`, global).

### List response shape

```json
{
  "success": true,
  "data": {
    "items": [ { "...summary fields..." } ],
    "total": 123,
    "limit": 50,
    "offset": 0,
    "nextCursor": "2026-05-28T21:58:10.588Z|f6e17928-ae3b-4b9b-b74b-e9804557dd6a"
  }
}
```

List items **omit** heavy JSONB snapshots (`previous_state`, `new_state`, `user_agent`) for bandwidth. Detail endpoint returns them.

### Detail response shape

Same summary fields plus:

- `previousState` (JSON)
- `newState` (JSON)
- `userAgent`

---

## Query Parameters (List)

### Pagination

| Param | Default | Max | Notes |
|-------|---------|-----|-------|
| `limit` | `50` | `100` | Stricter than general API (`500`) |
| `offset` | `0` | `5000` | Offset mode only |
| `cursor` | — | — | Keyset pagination; requires `sort_by=created_at` |

**Cursor format:** `{ISO8601_created_at}|{uuid}` (value of `nextCursor` from prior page).

When `cursor` is set, `offset` is ignored and `total` reflects the current page size (not full count — use offset mode when an exact total is required).

### Sorting

| Param | Values | Default |
|-------|--------|---------|
| `sort_by` | `created_at`, `action`, `actor_email`, `actor_role`, `resource_type` | `created_at` |
| `sort_dir` | `asc`, `desc` | `desc` |

### Filters

| Param | Type | Match |
|-------|------|-------|
| `actor_id` | UUID | Exact |
| `actor_email` | string | Case-insensitive exact |
| `actor_role` | string | Exact |
| `company_id` | UUID | Exact (tenant-validated) |
| `resource_type` | string | Exact |
| `resource_id` | UUID | Exact |
| `action` | string | Exact |
| `date_from` | `YYYY-MM-DD` | Inclusive start (UTC) |
| `date_to` | `YYYY-MM-DD` | Inclusive end (UTC) |

### Search

| Param | Behavior |
|-------|----------|
| `search` | Case-insensitive substring on `action`, `actor_email`, `actor_name`, `resource_type`; if value is UUID-shaped, also matches `resource_id` |

Minimum length: **2** characters. Max length: **128**. Wildcards (`%`, `_`) escaped server-side.

---

## Files Added / Changed

| File | Role |
|------|------|
| `backend/src/modules/audit-logs/audit-logs.module.ts` | Nest module |
| `backend/src/modules/audit-logs/audit-logs.controller.ts` | HTTP routes + RBAC |
| `backend/src/modules/audit-logs/audit-logs.service.ts` | Query builder, tenant scope, pagination |
| `backend/src/modules/audit-logs/dto/list-audit-logs-query.dto.ts` | Validated query DTO |
| `backend/src/modules/audit-logs/dto/audit-log-pagination.dto.ts` | Stricter limit/offset caps |
| `backend/src/app.module.ts` | Registers `AuditLogsModule` |
| `backend/prisma/migrations/20260529140000_audit_log_query_indexes/migration.sql` | Read-path indexes |

Existing write path untouched: `backend/src/common/audit/audit-log.service.ts`.

---

## DB Indexes

**Pre-existing** (init migration):

- `idx_audit_actor` — `(actor_id, created_at DESC)` partial
- `idx_audit_resource` — `(resource_type, resource_id, created_at DESC)`
- `idx_audit_company` — `(company_id, created_at DESC)` partial

**Added in Phase 5.1:**

- `idx_audit_created_at` — `(created_at DESC)` — default sort / date windows
- `idx_audit_action` — `(action, created_at DESC)`
- `idx_audit_actor_email` — `(lower(actor_email), created_at DESC)`
- `idx_audit_actor_role` — `(actor_role, created_at DESC)`
- `idx_audit_company_action` — `(company_id, action, created_at DESC)` partial

Table remains **append-only**, **partitioned by quarter** on `created_at`. Reads use parameterized raw SQL against `audit_logs` (no Prisma model).

Apply migration:

```bash
cd backend && npx prisma migrate deploy
```

---

## Security Protections

### RBAC — ADMIN only

Controller class-level:

```typescript
@UseGuards(RolesGuard)
@Roles(AuthGroup.ADMIN)
```

Allowed roles: `super_admin`, `wh_manager`, `finance` (`AuthGroup.ADMIN`).

Blocked: `wh_operator`, all client portal roles → **403 Forbidden** before query execution.

### Tenant / company isolation

Uses `CompanyAccessService` + `readCompanyIdFilter`:

- **Global admins** (`tenantScope: all`): may list all tenants; optional `company_id` filter validated against active companies.
- **Restricted admins**: rows limited to `authorizedCompanyIds` and/or active session `companyId`.
- **System events** (`company_id IS NULL`, e.g. `AUTH_LOGIN_SUCCESS`): visible to global admins; restricted users only see their **own** actor rows (`actor_id = self`).
- **Detail**: cross-tenant rows return **404** (not 403) to avoid leaking existence.

### Bulk extraction guards

| Control | Value |
|---------|-------|
| Max `limit` | 100 |
| Max `offset` | 5000 |
| Max date span | 366 days |
| Default window (global admin, no narrow filters) | Last 30 days |
| Narrow filters | `actor_id`, `resource_id`, `action`, `search`, `company_id` skip the 30-day default when no dates supplied |

### Query sanitization

- All filters via `class-validator` DTO + `ValidationPipe` (whitelist, forbid unknown keys).
- SQL built with `Prisma.sql` tagged templates (no string concatenation of user input).
- ILIKE patterns escaped (`%`, `_`, `\`).
- Sort columns whitelisted (no dynamic SQL identifiers from client).

### Rate limiting

Inherited global throttler: **120 requests / minute** per IP (`ThrottlerGuard`).

---

## Performance Considerations

1. **Partition pruning** — Always applies a `created_at` range (explicit or defaulted) so PostgreSQL can target relevant quarterly partitions.
2. **Index-aligned filters** — Equality filters on `company_id`, `action`, `actor_id`, `resource_type`/`resource_id` match existing or new indexes.
3. **List vs detail** — List excludes JSONB payloads; detail fetches one row by primary key `id`.
4. **Cursor mode** — Keyset pagination on `(created_at, id)` avoids deep `OFFSET` cost on large tables.
5. **Count query** — Skipped in cursor mode to reduce load; offset mode runs `COUNT(*)` with identical filters.

---

## Example Requests

```http
GET /api/audit-logs?limit=25&action=AUTH_LOGIN_SUCCESS&sort_by=created_at&sort_dir=desc
Authorization: Bearer <token>
```

```http
GET /api/audit-logs?company_id=00000000-0000-4000-8000-000000000001&date_from=2026-05-01&date_to=2026-05-29
Authorization: Bearer <token>
```

```http
GET /api/audit-logs?search=superadmin&limit=10
Authorization: Bearer <token>
```

```http
GET /api/audit-logs?cursor=2026-05-28T21:58:10.588Z|f6e17928-ae3b-4b9b-b74b-e9804557dd6a&limit=50
Authorization: Bearer <token>
```

```http
GET /api/audit-logs/a21091d0-1fde-49e7-b076-3ffbe8520faf
Authorization: Bearer <token>
```

---

## Remaining Limitations

1. **No export endpoint** — By design; bulk CSV/JSON export not included (reduces data-exfil risk).
2. **Search is substring ILIKE** — Not full-text ranked search; large scans possible without date/company filters (mitigated by default 30-day window for global admins).
3. **Cursor pagination** — Only supported with `sort_by=created_at`; other sorts use offset mode.
4. **No realtime stream** — Polling only; websocket feed for audit events not in scope.
5. **Action vocabulary not enumerated** — `action` filter is free-text exact match; no `/api/audit-logs/actions` metadata endpoint yet.
6. **Prisma model absent** — Reads/writes use raw SQL; schema drift must be managed via SQL migrations.
7. **IP / user agent** — Populated when callers pass them into `AuditLogService`; many current writers omit these fields.

---

## Verification

- `npx tsc --noEmit` — pass
- `npx prisma migrate deploy` — indexes applied
- Manual smoke:
  - `GET /api/audit-logs?limit=5` as `superadmin@emdad.example` → 200
  - `GET /api/audit-logs/:id` → 200 with state snapshots
  - `wh_operator` → 403 on both routes
