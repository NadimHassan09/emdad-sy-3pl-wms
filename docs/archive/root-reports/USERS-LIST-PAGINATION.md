# Users List — Server Pagination

## Summary

Replaced the unpaginated `GET /api/users` full-list load with server-side pagination. Search, role, kind, and company (tenant) filters are applied on the API.

## API contract (`GET /api/users`)

| Query param | Type | Default | Description |
|-------------|------|---------|-------------|
| `limit` | int | **50** | Page size (1–500) |
| `offset` | int | 0 | Zero-based offset |
| `kind` | `all` / `system` / `client` | `all` | User category |
| `search` | string | — | Case-insensitive match on `fullName` or `email` |
| `role` | `UserRole` | — | Exact role filter |
| `companyId` | uuid | — | Client users for one company (tenant-scoped) |

### Response

```json
{
  "items": [ /* UserListRow */ ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

Restricted-tenant admins still see only authorized companies; `companyId` narrows further when set.

## Frontend

- `UsersPage` uses `useServerPagination` with **20 rows/page** (options 10/20/50/100) — matches prior `DataTable` client pagination UX
- Warehouse vs client views pass `kind=system` / `kind=client`
- Tenant company id passed as `companyId` when scoped

## Benchmark

```bash
node scripts/benchmark-users-list.mjs
```

Output: `docs/perf/users-list-benchmark.json`

## Tests

```bash
cd backend && npm run test:unit -- users-list.service.unit.spec.ts
```
