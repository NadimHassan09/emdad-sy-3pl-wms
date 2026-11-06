# Returns & Cycle Count — Server Pagination

## Summary

Migrated Returns and Cycle Count list views from **200/500-row chunked or bulk loads** to **server-side pagination** (25/50/100 per page). Cycle Count session filters that were client-side are now applied on the API.

## API contracts

### `GET /api/return-orders`

Existing pagination unchanged. UI now requests `limit=25&offset=N` per page.

| Query param | Description |
|-------------|-------------|
| `limit` / `offset` | Page size and offset (default limit 50) |
| `companyId` | Tenant scope |
| `status` | Return status |
| `orderSearch` | Order #, reference, or UUID |
| `createdFrom` / `createdTo` | Created date range (`YYYY-MM-DD`) |

### `GET /api/cycle-count/counts`

| Query param | Description |
|-------------|-------------|
| `limit` / `offset` | Page size and offset |
| `companyId`, `warehouseId`, `status` | Existing filters |
| `assignedWorkerId` | **New** — filter by assigned worker |
| `discrepancyOnly` | **New** — `yes`/`true`/`1` → `status=pending_review` |
| `createdFrom` / `createdTo` | **New** — session created date range |

### `GET /api/cycle-count/product-history`

Now returns `{ items, total, limit, offset }` (was plain array).

| Query param | Description |
|-------------|-------------|
| `limit` / `offset` | Page size and offset |
| `warehouseId` | Required |
| `overdueOnly` | **New** — `yes`/`true`/`1` → `nextDueAt < now` |
| `lastCountedFrom` / `lastCountedTo` | **New** — last count date range |

## Frontend

- `ReturnsListPage` — `useServerPagination`, mobile page controls via `ServerPaginationBar`
- `CycleCountListPage` — both tabs paginated; all filters sent to API
- Realtime cache patches `['return-orders', 'list']` and `['cycle-count', 'list']`

## Benchmark

```bash
node scripts/benchmark-returns-cycle-count-list.mjs
```

Output: `docs/perf/returns-cycle-count-benchmark.json`

## Tests

```bash
cd backend && npm run test:unit -- returns-list.service.unit.spec.ts cycle-count-list.service.unit.spec.ts
```
