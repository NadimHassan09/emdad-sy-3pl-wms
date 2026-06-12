# PERFORMANCE-CERTIFICATION-FINAL

**Generated:** 2026-06-11  
**Environment:** `staging-admin.emdadsy.com` / `staging-client.emdadsy.com`  
**Branch audited:** `staging` (HEAD at certification time)  
**Type:** Audit only — no code changes, migrations, or deployments

---

## Executive Summary

This document is the **final performance certification** for the Emdad SY 3PL WMS platform. It synthesizes:

| Source | Coverage |
|--------|----------|
| P1 load benchmark (`qa-results/performance-p1-certification.json`) | **45 scenarios**, 25 samples each |
| API page benchmark (`qa-results/performance-api-benchmark.json`) | **22 hot-path endpoints**, 5 samples each |
| UI audit (`qa-results/performance-ui-audit.json`) | **14 admin screens** |
| Post-P1 optimization reports | PERF-P2A/B/C (ledger, pagination, locations) |
| Reports refactor | REPORTS-PERF (server-side preview/export) |
| Static code audit | **37 controllers · 229 endpoints** (`qa-results/endpoint-inventory.json`) |

**Certified dataset:** 10,000 products · 50,000 stock rows · 5,000 inbound · 5,000 outbound · 10,000 tasks · 100 users · 200 warehouses · 2,000 locations.

### Performance Scores

| Domain | Score | Grade |
|--------|------:|:------|
| **Backend Performance** | **89 / 100** | Good |
| **Frontend Performance** | **84 / 100** | Good |
| **Database Performance** | **81 / 100** | Good |
| **Overall Performance** | **85 / 100** | **Good** |

### Final Verdict: **Good**

The platform meets performance targets for current staging scale. No measured endpoint exceeds **P1 severity** (p95 ≥ 1000 ms). Two historical **P2** findings (inventory ledger, report ledger fetch) were **resolved** by PERF-P2C-B (SQL grouping) and REPORTS-PERF (server pagination). Remaining debt is concentrated in **stock-by-product in-memory aggregation**, **large task list payloads**, and **unbounded dashboard chart queries** — all manageable at current tenant size but require follow-up before 10× data growth.

### Severity Classification (this report)

| Rank | Criteria |
|------|----------|
| **Critical** | p95 ≥ 2000 ms, or architectural pattern that fails at current dataset scale |
| **High** | p95 ≥ 500 ms, payload ≥ 400 KB on hot paths, or unbounded query at scale risk |
| **Medium** | p95 200–500 ms, payload 100–400 KB, or missing index on growing table |
| **Low** | p95 < 200 ms, paginated, indexed — acceptable |

---

## 1. Methodology

### 1.1 Measured metrics (benchmarked endpoints)

For each P1 scenario (25 samples): **avg**, **p50**, **p95**, **p99**, **response bytes**.

### 1.2 Inferred metrics (static audit)

For the remaining **~184 endpoints** not in P1/API benchmarks:

| Metric | Method |
|--------|--------|
| Query count | Service-layer code review (Prisma `findMany`, `$transaction`, raw SQL) |
| DB execution time | EXPLAIN references from PERF-P2B; estimated from query shape |
| Memory impact | Payload size × concurrency heuristic; Node heap for in-memory aggregation paths |

All inferred values are labeled **(inferred)** in tables below.

### 1.3 Post-certification optimizations applied (included in final assessment)

| Phase | Fix | Impact |
|-------|-----|--------|
| PERF-P2C-A | Removed ledger `productTotalAfterAt` N+1 | ~480 queries → 2 |
| PERF-P2C-B | SQL business-movement grouping + warehouse subquery | UI path p95 **738 ms → 53 ms** (−93%) |
| PERF-P2C-C | Ledger frontend chunked pagination (50 UI / 200 chunk) | Payload **525 KB → 218 KB** (−58%) |
| PERF-P2C-A | Server pagination on products, orders, stock lists | Eliminated client-side full-table fetches |
| REPORTS-PERF | Server report preview/export/aggregate | Preview payload **−67–74%** |
| CLIENT-UX-1 | Client portal server pagination | All list pages paginated |

P1 raw numbers for ledger (p95 596.8 ms) reflect **pre-P2C-B** state. Final ranking uses **post-fix** measurements from PERF-P2C-B/C and REPORTS-PERF where available.

---

## 2. Endpoint Ranking

### 2.1 Critical — 0 endpoints

No endpoint at current certified dataset exceeds p95 2000 ms or fails functionally under load.

> **Note:** Outbound detail p99 **300,697 ms** in P1 is a **single-sample network outlier** (1/25 `fetch failed`); p50/p95 are 20.6 / 87.7 ms — not ranked Critical.

### 2.2 High — 4 items

| Endpoint | Module | avg | p50 | p95 | p99 | Payload | Queries | DB time | Rank | Issue |
|----------|--------|----:|----:|----:|----:|--------:|--------:|--------:|:----:|-------|
| `GET /inventory/stock/by-product` | Inventory | 381 ms | 381 ms | **431 ms** | 458 ms | 61 KB | 2 (inferred) | ~350 ms (inferred) | **High** | Full `groupBy` + in-memory sort/slice |
| `GET /inventory/stock/by-product` (page 2) | Inventory | 438 ms | 388 ms | **456 ms** | 1466 ms | 61 KB | 2 | ~400 ms | **High** | Same anti-pattern; unstable p99 |
| `GET /tasks?limit=500` | Tasks | 71 ms | 69 ms | 99 ms | 109 ms | **435 KB** | 3–5 (inferred) | <20 ms | **High** | Latency OK; excessive payload |
| `GET /dashboard/open-orders-charts` | Dashboard | 152 ms | 152 ms | 187 ms | 201 ms | 427 B | 3+ (inferred) | varies | **High** | Unbounded open-order load — scales with order count |

### 2.3 Medium — 6 items

| Endpoint | Module | avg | p50 | p95 | p99 | Payload | Rank | Issue |
|----------|--------|----:|----:|----:|----:|--------:|:----:|-------|
| `POST /auth/login` | Auth | 212 ms | 212 ms | **212 ms** | 212 ms | — | **Medium** | bcrypt cost; acceptable for auth |
| `GET /inventory/stock?limit=500` | Inventory | 62 ms | 61 ms | 72 ms | 79 ms | **450 KB** | **Medium** | Large default limit |
| `GET /inventory/stock?limit=200&offset=200` | Inventory | 160 ms | 67 ms | 79 ms | 2409 ms | **180 KB** | **Medium** | p99 outlier on deep offset |
| `GET /products?search=…` | Products | 127 ms | 69 ms | 83 ms | **1504 ms** | 122 KB | **Medium** | p99 tail on trigram search |
| `GET /users` | Users | — | — | **51 ms**† | — | 36 KB | **Medium** | Unpaginated full table |
| `POST /backups` / `POST /backups/:id/restore` | Backups | — | — | — | — | — | **Medium** | I/O-bound; blocks on pg_dump/restore (admin-only) |

† From `performance-api-benchmark.json` (5 samples).

### 2.4 Low — measured hot paths (representative)

| Endpoint | p95 | Payload | Rank |
|----------|----:|--------:|:----:|
| `GET /inventory/ledger` (post-P2C-B, limit=100) | **31 ms** | 109 KB | Low |
| `GET /inventory/ledger` (post-P2C-B, limit=500+warehouse) | **53 ms** | 219 KB (post-P2C-C chunk) | Low |
| `GET /reports/:id/run?limit=50` | **12 ms** | 11–17 KB | Low |
| `GET /inbound-orders?limit=200` | 57 ms | 144 KB | Low |
| `GET /outbound-orders?limit=200` | 36 ms | 134 KB | Low |
| `GET /audit-logs?limit=50` | 56 ms | 11 KB | Low |
| `GET /returns?limit=200` | 34 ms | 14 KB | Low |
| `GET /cycle-count/sessions` | 26 ms | 17 KB | Low |
| `GET /dashboard/overview` | 124 ms | 5 KB | Low |
| `GET /billing/invoices` (paginated) | — (not probed) | bounded | Low |
| `GET /client/dashboard/overview` | — (not probed) | ~5–15 KB (inferred) | Low |

### 2.5 Unbenchmarked endpoints (184) — static risk summary

| Controller group | Endpoints | Static rank | Notes |
|------------------|----------:|:-----------:|-------|
| Billing (`billing.controller`) | 19 | Low–Medium | Invoices paginated; dashboard widgets capped at 20 |
| Backups (5 controllers) | 31 | Low–Medium | Read paths fast; write/restore I/O heavy |
| Client portal (8 controllers) | 21 | Low | Server pagination on lists; single overview aggregate |
| Warehouse workflow | 29 | Low | Task mutations; analytics overview bounded |
| Cycle count (3 controllers) | 28 | Low | Session-scoped queries |
| Companies / Warehouses / Locations | 22 | Low–Medium | `/locations/tree` deprecated, 1.8 MB if called |
| Observability | 4 | Low | Health/metrics |
| Adjustments | 8 | Low | Standard CRUD |

---

## 3. Controller Ranking

Ranked by **worst measured or inferred hotspot** within each controller.

| Rank | Controller | Endpoints | Worst p95 | Max payload | Overall |
|:----:|------------|----------:|----------:|------------:|:-------:|
| 1 | `inventory.controller` | 7 | 456 ms‡ | 450 KB | **High** |
| 2 | `warehouse-tasks.controller` | 16 | 99 ms | 435 KB | **High** |
| 3 | `dashboard.controller` | 2 | 187 ms | 5 KB | **High** (scale risk) |
| 4 | `auth.controller` | 4 | 212 ms | — | **Medium** |
| 5 | `products.controller` | 10 | 83 ms | 122 KB | **Medium** |
| 6 | `users.controller` | 8 | 51 ms | 36 KB | **Medium** |
| 7 | `backups.controller` + related | 31 | I/O | — | **Medium** |
| 8 | `reports.controller` | 5 | 12 ms† | 17 KB | **Low** |
| 9 | `inbound.controller` | 6 | 57 ms | 144 KB | **Low** |
| 10 | `outbound.controller` | 5 | 87 ms | 134 KB | **Low** |
| 11 | `returns.controller` | 12 | 34 ms | 14 KB | **Low** |
| 12 | `cycle-count*.controller` | 28 | 26 ms | 17 KB | **Low** |
| 13 | `audit-logs.controller` | 5 | 56 ms | 11 KB | **Low** |
| 14 | `billing.controller` | 19 | — | paginated | **Low** |
| 15 | `client-portal/*.controller` | 21 | — | paginated | **Low** |
| 16 | `notifications.controller` | 3 | — | small | **Low** |
| 17 | `locations.controller` | 8 | 22 ms | 1.8 MB†† | **Low**†† |
| 18 | Remaining (companies, warehouses, workflow, adjustments, observability) | 57 | <50 ms | small | **Low** |

‡ Stock-by-product. † Post-REPORTS-PERF. †† `/locations/tree` only if invoked; UI no longer calls it (PERF-P2A).

---

## 4. Slowest APIs

### 4.1 By p95 (measured, certified dataset)

| # | Endpoint | p95 | p99 | Payload | Status |
|---|----------|----:|----:|--------:|--------|
| 1 | `GET /inventory/stock/by-product` | **456 ms** | 1466 ms | 61 KB | Open |
| 2 | `POST /auth/login` | **212 ms** | 212 ms | — | Acceptable |
| 3 | `GET /dashboard/open-orders-charts` | **187 ms** | 201 ms | 427 B | Scale risk |
| 4 | `GET /tasks?limit=500` | **99 ms** | 109 ms | 435 KB | Payload issue |
| 5 | `GET /products?search=…` | **83 ms** | 1504 ms | 122 KB | p99 tail |
| 6 | `GET /inventory/stock?limit=200&offset=200` | **79 ms** | 2409 ms | 180 KB | p99 outlier |
| 7 | `GET /inventory/stock?limit=200` | **72 ms** | 79 ms | 180 KB | OK |
| 8 | `GET /dashboard/overview` | **124 ms** | — | 5 KB | OK |
| 9 | `GET /inbound-orders?limit=200` | **57 ms** | 73 ms | 144 KB | OK |
| 10 | `GET /audit-logs` | **56 ms** | 122 ms | 11 KB | OK |

### 4.2 Resolved slow paths (post-P1 fixes)

| Endpoint | P1 p95 | Post-fix p95 | Evidence |
|----------|-------:|-------------:|----------|
| `GET /inventory/ledger` | 596.8 ms | **31–53 ms** | PERF-P2C-B |
| Report inventory ledger fetch | 520 ms | **12 ms** (preview) | REPORTS-PERF |
| `GET /locations/tree` | 1800+ ms | N/A (UI removed) | PERF-P2A |

---

## 5. Largest Payloads

| # | Endpoint | Bytes | p95 latency | Severity |
|---|----------|------:|------------:|:--------:|
| 1 | `GET /inventory/ledger?limit=500` (historical) | **524,766** | 520 ms | Resolved → chunked |
| 2 | `GET /inventory/stock?limit=500` | **450,247** | 107 ms | Medium |
| 3 | `GET /tasks?limit=500` | **435,483** | 99 ms | High (size) |
| 4 | `GET /tasks?limit=200&status=in_progress` | **216,973** | 54 ms | Medium |
| 5 | `GET /inventory/stock?limit=200&offset=200` | **179,783** | 79 ms | Medium |
| 6 | `GET /inventory/stock?limit=200` | **179,552** | 72 ms | Medium |
| 7 | `GET /inbound-orders?limit=200` | **144,271** | 57 ms | Low |
| 8 | `GET /products?limit=200` | **121,871** | 57 ms | Low |
| 9 | `GET /outbound-orders?limit=200` | **134,471** | 36 ms | Low |
| 10 | `GET /locations/tree` (if called) | **~1.8 MB** | — | Deprecated |

**Post-fix ledger chunk (PERF-P2C-C):** 218,252 B at `limit=200` — **−58%** vs monolithic 500-row fetch.

---

## 6. Database Bottlenecks

### 6.1 Confirmed patterns

| Pattern | Location | Severity | Evidence |
|---------|----------|:--------:|----------|
| In-memory pagination after full aggregation | `stockByProductSummary()` | **High** | p95 431–456 ms; full `groupBy` before slice |
| Unbounded open-order fetch | `dashboard.service openOrdersCharts` | **High** | Loads all open inbound/outbound |
| Parallel query fan-out | `dashboard.service overview` | **Medium** | 13+ `Promise.all` queries — pool pressure under concurrency |
| Ledger text search ILIKE | `inventory ledger` filters | **Medium** | May bypass trigram GIN on product join |
| Unpaginated users list | `users.service list` | **Medium** | Full table scan; OK at 100 users |
| Task list composite index gap | `warehouse_tasks` | **Medium** | Verify `(company_id, status, updated_at DESC)` |
| Partitioned ledger scans | `inventory_ledger` | **Low** | Date range without partition key may scan multiple partitions |

### 6.2 Resolved DB patterns

| Pattern | Resolution |
|---------|------------|
| Ledger N+1 (`productTotalAfterAt` × ~480) | Removed PERF-P2C-A |
| Ledger in-memory group/sort/paginate | SQL grouping PERF-P2C-B |
| Warehouse filter 11K UUID `IN (...)` | Inline location subquery PERF-P2C-B |
| Report client 2000-row fetch | Server pagination REPORTS-PERF |

### 6.3 Index strengths

- Products: GIN trigram on name/sku
- `current_stock`: composite `(company_id, product_id)`, `(company_id, warehouse_id)`
- `audit_logs`: quarterly partitions + action/actor indexes
- `warehouse_tasks`: `(status, task_type)`, `workflow_instance_id`

### 6.4 Database Performance Score: **81 / 100**

Deductions: stock-by-product anti-pattern (−8), dashboard unbounded queries (−6), minor index/search gaps (−5). Strong partition and trigram foundation (+baseline 100 → 81).

---

## 7. Frontend Bottlenecks

### 7.1 Page load audit (admin UI)

| Screen | Load (ms) | API fetch (ms) | API calls | LCP (ms) | Severity |
|--------|----------:|---------------:|----------:|---------:|:--------:|
| Dashboard | 1454 | 307 | 7 | 452 | P3 |
| Products | 1404 | 169 | 7 | 592 | P3 |
| Inventory stock | 1371 | 76 | 7 | 368 | P3 |
| Inbound orders | 1325 | 195 | 7 | — | P3 |
| Outbound orders | 1323 | 180 | 7 | — | P3 |
| Tasks | 1322 | 133 | 6 | — | P3 |
| Audit logs | 1316 | 75 | 8 | — | P3 |
| Returns | 1319 | 81 | 6 | — | P3 |
| Cycle count | 1299 | 70 | 8 | — | P3 |
| Reports inventory | 1321 | 65 | 6 | — | P3 |

**Average first-load:** 1343 ms · **TTFB:** 14 ms · **FCP:** 118 ms · **Pages > 3 s:** 0

Load time is dominated by SPA bundle hydration + parallel boot API calls (6–8 per page), not slow individual APIs.

### 7.2 Frontend patterns

| Pattern | Status | Notes |
|---------|:------:|-------|
| Server pagination (products, orders, stock, ledger) | ✅ Fixed | PERF-P2C-A/C |
| Chunked ledger loading | ✅ Fixed | 50 UI rows, 200 server chunk |
| Tasks 500-row default fetch | ⚠️ Open | 435 KB JSON despite fast p95 |
| Report client aggregation | ✅ Fixed | REPORTS-PERF |
| Returns/cycle-count 200-row client slice | ⚠️ Monitor | Incomplete at very large tenants |
| WebSocket peer refetch | ✅ Clean | Zero redundant list refetches |

### 7.3 Frontend Performance Score: **84 / 100**

Deductions: ~1.3 s average cold load (−8), tasks payload (−5), returns/cycle-count client pagination (−3). Strong server-pagination adoption on core flows.

---

## 8. Client Portal Bottlenecks

| Area | Endpoints | Assessment |
|------|-----------|------------|
| Auth (`client-auth`) | 3 | Low — JWT flow mirrors admin |
| Dashboard overview | 1 | Low–Medium — 7 parallel counts/aggregates per company; acceptable single-tenant |
| Inbound / Outbound lists | 6 | Low — server pagination (CLIENT-UX-1) |
| Products / Stock | 4 | Low — paginated |
| Billing | 4 | Low — scoped to client company |
| Notifications | 3 | Low — capped list |

**Client portal score (subset):** **86 / 100** — no measured regressions; smaller surface area than admin.

**Watch item:** `client/dashboard/overview` runs `countExpiringProducts` with 90-day horizon — monitor with >10k SKUs per client.

---

## 9. Reporting Bottlenecks

### 9.1 Before vs after (REPORTS-PERF)

| Scenario | Before | After | Δ |
|----------|-------:|------:|---|
| Inventory preview payload | 32.3 KB (limit=500) | **10.8 KB** (limit=50) | **−67%** |
| Product moves preview | 65.5 KB | **17.2 KB** | **−74%** |
| Preview latency | 16–38 ms | **11–12 ms** | **−31–68%** |
| Export | Client Blob | Server stream (10k cap) | Memory safe |

### 9.2 Remaining reporting risks

| Risk | Severity | Mitigation |
|------|:--------:|------------|
| Export at 10k row cap | Low | Throttled 5/min; documented |
| Cache TTL 60s | Low | Redis + in-memory fallback |
| Warehouse-analysis aggregate | Low | Max 500 groups |

**Reporting subsystem score:** **92 / 100** — best-in-class after REPORTS-PERF refactor.

---

## 10. Backup Subsystem Performance

| Operation | Type | Assessment |
|-----------|------|------------|
| `GET /backups/health` | Read | Low — metadata only |
| `GET /backups` | Read | Low — paginated history |
| `GET /backups/:id/status` | Read | Low — job row lookup |
| `POST /backups` (manual) | Write | **Medium** — `pg_dump`; duration ∝ DB size; cooldown guarded |
| `POST /backups/:id/restore` | Write | **Medium** — blocks operations; admin-only |
| `POST /backups/upload` | Write | **Medium** — disk I/O |
| `POST /backups/:id/sync-drive` | Write | Low (out of scope) — async when enabled |
| Health poll (15 min cron) | Background | Negligible |

**Backup subsystem score:** **83 / 100** — appropriate for admin-only, infrequent operations. Not on critical user path.

---

## 11. Billing Subsystem Performance

| Operation | Pagination | Assessment |
|-----------|:-----------:|------------|
| `GET /billing/invoices` | ✅ Server (`listPage`) | Low at any invoice volume |
| `GET /billing/plans` | ✅ Server | Low |
| `GET /billing/cycles` | ✅ Server | Low |
| Dashboard widgets (overdue, recent, suspended) | ✅ Capped at 20 | Low |
| `GET /billing/preview` | Single cycle | Low |
| Usage processor (daily cron) | Batch by company | Low background load |
| Client `GET /client/billing/*` | Scoped + paginated | Low |

**Billing subsystem score:** **88 / 100** — server pagination on invoices resolves prior PERF-5 gap from PERFORMANCE-GAP-ANALYSIS.

---

## 12. Full P1 Scenario Matrix (45 measured)

| Module | Scenario | avg | p50 | p95 | p99 | Bytes | Sev |
|--------|----------|----:|----:|----:|----:|------:|:---:|
| Inventory | Ledger | 446 | 435 | **597** | 617 | 109K | P2→Fixed |
| Reports | Ledger fetch | 466 | 450 | **520** | 821 | 525K | P2→Fixed |
| Inventory | Stock by product p2 | 438 | 388 | **456** | 1466 | 61K | P3 |
| Inventory | Stock by product | 382 | 381 | **431** | 458 | 61K | P3 |
| Auth | Login | 212 | 212 | **212** | 212 | — | P3 |
| Dashboard | Open orders charts | 152 | 152 | 187 | 201 | 427 | OK |
| Reports | Stock fetch | 84 | 82 | 107 | 121 | 450K | OK |
| Tasks | List limit=500 | 71 | 69 | 99 | 109 | 435K | OK |
| Orders | Outbound detail | 12051* | 21 | 88 | 300698* | 1.2K | OK |
| Products | Search | 127 | 69 | 83 | 1504 | 122K | OK |
| *remaining 35 scenarios* | — | <160 | <70 | <80 | <300 | <180K | OK |

\*Outbound detail avg skewed by one failed sample; p50/p95 represent true latency.

---

## 13. Score Calculation

### 13.1 Backend (89 / 100)

| Factor | Points |
|--------|-------:|
| Base | 100 |
| P2 scenarios pre-fix (ledger, reports) | −4 (resolved; partial credit) |
| Stock-by-product p95 > 400 ms | −4 |
| 80% endpoints unbenchmarked (coverage gap) | −3 |
| **Total** | **89** |

### 13.2 Frontend (84 / 100)

| Factor | Points |
|--------|-------:|
| Base | 100 |
| Avg cold load 1.34 s | −8 |
| Tasks 435 KB payload | −5 |
| Returns/cycle-count client pagination | −3 |
| **Total** | **84** |

### 13.3 Database (81 / 100)

| Factor | Points |
|--------|-------:|
| Base | 100 |
| In-memory stock-by-product aggregation | −8 |
| Unbounded dashboard charts | −6 |
| Index/search gaps (tasks, ledger ILIKE) | −5 |
| **Total** | **81** |

### 13.4 Overall (85 / 100)

```
Overall = (Backend × 0.40) + (Frontend × 0.30) + (Database × 0.30)
        = (89 × 0.40) + (84 × 0.30) + (81 × 0.30)
        = 35.6 + 25.2 + 24.3
        = 85.1 → 85
```

| Score range | Verdict |
|-------------|---------|
| 90–100 | Excellent |
| **80–89** | **Good** ← current |
| 70–79 | Needs Optimization |
| < 70 | Critical |

---

## 14. Top 20 Optimization Recommendations

| # | Priority | Area | Recommendation | Expected impact |
|---|:--------:|------|----------------|-----------------|
| 1 | **P0** | Inventory | Push `stockByProductSummary` aggregation + pagination into SQL (materialized view or `GROUP BY` with `LIMIT/OFFSET`) | p95 **456 ms → <100 ms** |
| 2 | **P0** | Dashboard | Add `LIMIT` + status partial indexes on `open-orders-charts` queries | Prevents linear growth with open orders |
| 3 | **P1** | Tasks | Reduce default `limit` from 500 → 100; adopt chunked pagination like ledger | **−75% payload** (~435 KB → ~90 KB) |
| 4 | **P1** | Inventory stock | Lower default list `limit` from 500 → 200 in API defaults | **−55% payload** on stock list |
| 5 | **P1** | Products | Add covering index `(company_id, status, name)` for sorted list | Faster sort at 10k+ products |
| 6 | **P1** | DB | Partial index `inbound_orders (company_id, status) WHERE status NOT IN (completed, cancelled)` | Dashboard chart speed |
| 7 | **P1** | DB | Partial index `outbound_orders (company_id, status)` for open statuses | Dashboard chart speed |
| 8 | **P2** | Tasks | Composite index `warehouse_tasks (company_id, status, updated_at DESC)` | List filter performance |
| 9 | **P2** | Users | Add server pagination to `GET /users` | Scales past 500 users |
| 10 | **P2** | Returns | Migrate returns list to server pagination (like inbound) | Complete data at scale |
| 11 | **P2** | Cycle count | Server pagination on session list | Complete data at scale |
| 12 | **P2** | Products | Investigate search p99 tail (1504 ms) — query plan on trigram | Stable search under load |
| 13 | **P2** | Auth | Consider bcrypt rounds review if login p95 matters at scale | Marginal login improvement |
| 14 | **P2** | API | Deprecate/remove `GET /locations/tree` endpoint | Eliminates 1.8 MB accidental call |
| 15 | **P2** | Infra | PgBouncer transaction mode for Prisma under concurrent dashboard load | Connection pool stability |
| 16 | **P3** | Ledger | BRIN or partition-pruning hint on `inventory_ledger(created_at)` | Faster date-range filters |
| 17 | **P3** | Client portal | Cache dashboard overview 30–60s per company | Fewer parallel counts |
| 18 | **P3** | Frontend | Code-split admin routes to reduce 1.3s cold load | **−200–400 ms** FCP |
| 19 | **P3** | Backup | Stream download responses (already token-gated) — verify no full-buffer read | Memory on large backups |
| 20 | **P3** | Observability | Add per-endpoint p95 metrics to production APM | Closes 80% benchmark coverage gap |

---

## 15. Coverage Summary

| Scope area | Controllers | Endpoints | Benchmarked | Static audit |
|------------|------------:|----------:|------------:|:------------:|
| Inventory | 1 | 7 | 7 | — |
| Inbound / Outbound | 2 | 11 | 6 | 5 |
| Returns | 1 | 12 | 2 | 10 |
| Cycle count | 3 | 28 | 2 | 26 |
| Tasks / Workflow | 4 | 29 | 5 | 24 |
| Products | 1 | 10 | 6 | 4 |
| Dashboard | 1 | 2 | 2 | — |
| Reports | 1 | 5 | 4 | 1 |
| Billing | 1 | 19 | 0 | 19 |
| Backup | 5 | 31 | 0 | 31 |
| Client portal | 8 | 21 | 0 | 21 |
| Auth (admin + client) | 2 | 7 | 4 | 3 |
| Audit logs | 1 | 5 | 4 | 1 |
| Notifications | 2 | 6 | 0 | 6 |
| Other (users, locations, companies, etc.) | 5 | 46 | 7 | 39 |
| **Total** | **37** | **229** | **45 scenarios (~20%)** | **184 endpoints** |

---

## 16. Evidence Index

| Artifact | Path |
|----------|------|
| P1 certification JSON | `qa-results/performance-p1-certification.json` |
| API benchmark JSON | `qa-results/performance-api-benchmark.json` |
| UI audit JSON | `qa-results/performance-ui-audit.json` |
| Endpoint inventory | `qa-results/endpoint-inventory.json` |
| P1 report | `PERFORMANCE-CERTIFICATION-REPORT.md` |
| Ledger backend fix | `PERF-P2C-B-REPORT.md` |
| Ledger frontend fix | `PERF-P2C-C-REPORT.md` |
| Reports refactor | `REPORTS-PERF-REPORT.md` |
| DB findings | `DATABASE-PERFORMANCE-FINDINGS.md` |
| Gap analysis | `PERFORMANCE-GAP-ANALYSIS.md` |
| UI ranking | `PERFORMANCE-UI-RANKING.md` |

---

## 17. Certification Statement

The WMS platform **passes final performance certification** at the certified staging dataset with an **Overall Performance Score of 85/100 (Good)**.

- **0 Critical** performance blockers at current scale
- **Major ledger and reporting bottlenecks resolved** since P1 benchmark
- **Primary remaining risk:** `GET /inventory/stock/by-product` in-memory aggregation — address before 10× stock growth
- **Recommendation:** Proceed to production with Top 20 items 1–3 scheduled for next performance sprint

---

*Audit performed without code changes. Commit contains this report only.*
