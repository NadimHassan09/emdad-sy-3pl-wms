# Phase 5.2 — Audit Log Admin Frontend

Operational audit log browser for internal WMS admins. Consumes Phase 5.1 APIs (`GET /api/audit-logs`, `GET /api/audit-logs/:id`).

---

## Route & Navigation

| Item | Value |
|------|-------|
| Path | `/audit-logs` |
| Sidebar | **Audit logs** (clock-rotate-left icon) |
| Allowed roles | `super_admin`, `wh_manager`, `finance` |
| Blocked | `wh_operator` → redirected to role home; backend returns 403 if called directly |

---

## Frontend Components Created

| File | Purpose |
|------|---------|
| `frontend/src/pages/AuditLogsPage.tsx` | Main operational page: filters, table, server pagination, detail trigger |
| `frontend/src/components/audit-logs/AuditLogDetailModal.tsx` | Detail modal with actor, event, metadata, before/after JSON panels |
| `frontend/src/api/audit-logs.ts` | Typed API client for list + detail |
| `frontend/src/lib/audit-log-display.ts` | Formatting helpers, action tone badges, safe JSON stringify |

### Existing components reused (not redesigned)

- `FilterPanel` — draft/applied filter workflow (`useFilters`)
- `DataTable` — enterprise table card (extended with optional `serverPagination`)
- `Combobox`, `TextField`, `SelectField` — filter inputs
- `Modal` — detail overlay
- `@ds` shell via existing `Layout` / sidebar

### Supporting updates

| File | Change |
|------|--------|
| `frontend/src/lib/rbac.ts` | Nav item + route guard group `audit-logs` |
| `frontend/src/router.tsx` | Lazy route `/audit-logs` |
| `frontend/src/constants/query-keys.ts` | `QK.auditLogs` |
| `frontend/src/components/DataTable.tsx` | Optional server-side pagination mode |
| `shared/design-system/lib/sidebar-nav-icons.tsx` | `AuditLogs` icon |
| `frontend/src/components/Layout.tsx` | Arabic sidebar label |

---

## Table Columns

| Column | Source |
|--------|--------|
| Timestamp | `createdAt` (locale medium date/time) |
| Actor | `actorName` + `actorEmail` |
| Role | `actorRole` (friendly label) |
| Company | Resolved name from companies cache, or **System** when `companyId` null |
| Action | Monospace action code (underscores → spaces) |
| Resource | `resourceType` + truncated `resourceId` |
| Summary | One-line operational summary (action + resource type) |
| Status | Tone badge derived from action name (OK / Warn / Failed / Log) |
| Details | **View** button (also row click opens modal) |

List rows **do not** render raw JSON state blobs.

---

## Filters Implemented

Draft → **Apply filters** → server query (same pattern as ledger/users pages).

| UI filter | API param |
|-----------|-----------|
| Search | `search` |
| Company | `company_id` |
| Actor email | `actor_email` (exact) |
| Role | `actor_role` |
| Action | `action` |
| Resource type | `resource_type` |
| Date from | `date_from` |
| Date to | `date_to` |

Apply resets to page 1. Reset restores defaults.

Default server sort: `created_at desc` (fixed in client params).

---

## Detail Modal

Opened by row click or **View**.

Sections:

1. **Actor** — email, name, role, actor ID  
2. **Event** — action, resource type/id, company, timestamp  
3. **Metadata** — IP, user agent, event ID  
4. **Before / After state** — `JSON.stringify` in scrollable `<pre>` panels (dark terminal styling)

Detail fetched via `GET /api/audit-logs/:id` when modal opens (React Query cache per id).

---

## Pagination & Search

- **Server pagination** via `DataTable.serverPagination`
- Page sizes: **25 / 50 / 100** (aligned with backend max `limit=100`)
- Offset computed as `(page - 1) * pageSize`
- Total count from API `total` field
- `placeholderData` keeps prior page visible while fetching next page

Search is server-side (`search` query param, min 2 chars enforced by API).

---

## UX Improvements

- Dense operational table (compact typography, monospace IDs/timestamps)
- Filter panel grouped in one scan line with wrap on narrow viewports
- Status badges color-coded by action semantics (success / warning / danger / neutral)
- Row hover + click affordance consistent with other list pages
- Arabic strings via existing `t(en, ar)` pattern
- Page description clarifies investigation workflow (before/after in detail)

---

## Security Protections

| Control | Implementation |
|---------|----------------|
| Admin-only UI | RBAC route group + `user.authGroup === 'ADMIN'` guard + redirect |
| No client portal | Internal admin app only; route absent from client frontend |
| Tenant-aware company filter | Sends `company_id`; company list from authorized companies API |
| Safe JSON rendering | `formatAuditJson()` → text in `<pre>` only; **no** `dangerouslySetInnerHTML` |
| API errors | Surfaced as inline message; 403/404 from detail handled by query error state |
| Credentials | Axios `withCredentials` + Bearer token (existing client) |

---

## Responsive Behavior

- Filter row: `flex-wrap` — fields stack on small screens
- Table: horizontal scroll via existing `overflow-x-auto` on `DataTable`
- Detail modal: full-width mobile, `max-w-3xl` on desktop; before/after panels stack (`md:grid-cols-2`)
- Pagination footer: stacks on mobile (`flex-col` → `sm:flex-row`)

---

## Performance Optimizations

- Lazy-loaded page chunk (`router.tsx`)
- React Query caching (`QK.auditLogs.list` / `detail`)
- Companies list cached 10 minutes (company name lookup only)
- List payload excludes JSONB snapshots (backend list DTO)
- `placeholderData` reduces flicker on page change
- Server pagination avoids loading full audit history into the browser

---

## Remaining Limitations

1. **No cursor UI** — Frontend uses offset pagination only (backend supports cursor for future deep paging).
2. **Action filter is free text** — No dropdown of known action codes yet.
3. **Actor filter** — Email exact match field separate from substring `search`; no user picker combobox.
4. **No export** — By design (matches backend non-goals).
5. **Status badge is heuristic** — Derived from action string patterns, not a dedicated backend status field.
6. **Finance role** — Has audit access but not Users nav (intentional split).
7. **Real-time updates** — Manual refresh / re-apply filters; no websocket subscription.

---

## Verification

- `npx tsc --noEmit` (frontend) — pass
- Route registered at `/audit-logs`
- Sidebar visible for admin roles only

Manual test:

1. Sign in as `superadmin@emdad.example` / `demo123`
2. Open **Audit logs** in sidebar
3. Apply filters → table updates with server total
4. Click row → detail modal with before/after JSON
