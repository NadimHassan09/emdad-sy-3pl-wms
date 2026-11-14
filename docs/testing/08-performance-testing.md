# 08 — Performance testing

**Goals.** (1) Pages and APIs stay fast with realistic volume (staging already holds 4,320 OMS, 3,608 outbound, 806 COD, 477 returns, 337 shipments). (2) No N+1 / runaway queries. (3) System survives expected concurrent users and bursts (imports, bulk shipping, carrier webhooks). (4) No memory/FD leaks (the backend build needs a 4 GB heap — a hint of heavy code).
**Tools (phase 2).** k6 (API), Playwright + Chrome tracing / Lighthouse CI (browser), `EXPLAIN (ANALYZE, BUFFERS)` and `pg_stat_statements` (DB), `pm2 monit`, `clinic.js`/`--inspect` heap snapshots, nginx access log timings.
**Where.** Staging only. Heavy load only in an agreed window (the staging DB is shared with the owner's own testing) and never against carriers (carrier calls mocked/stubbed for load).

## 1. Budgets (pass/fail; adjust only with owner consent)

| Metric | Target (p95) | Hard fail |
|---|---|---|
| List API (≤ 100 rows) at seed volume | < 400 ms | > 1,500 ms |
| Detail API | < 300 ms | > 1,000 ms |
| Create/confirm/approve API | < 800 ms | > 2,500 ms |
| Report Generate (1-year range) | < 5 s (progress shown if > 2 s) | > 15 s |
| Export (CSV/Excel) ≤ 10,000 rows | < 10 s | > 30 s, or memory > 1 GB |
| PDF generation (waybill/GRN/invoice) | < 3 s each; batch waybills 100 pages < 30 s | > 60 s |
| Page load (admin dashboard, cold, cable 25 Mbps / 4G mobile profile) | LCP < 2.5 s, TTI < 4 s | LCP > 5 s |
| Initial JS per route (gzip) | < 300 KB | > 800 KB |
| API calls per page load | ≤ 12 and no duplicate identical call | > 30 or repeated polling < 5 s without need |
| DB: any single query | < 100 ms typical | > 1 s |
| Websocket event latency | < 1 s | > 5 s |
| Error rate under load | < 0.5 % | > 2 % |

## 2. Test cases

### 2.1 Page / browser performance (PERF-UI)

| ID | Scenario | Expected |
|---|---|---|
| PERF-UI-001 | Each of the 88 admin and 33 client routes: Lighthouse mobile + desktop, 3 runs median: LCP, CLS, TBT, bundle size | within budget; CLS < 0.1 |
| PERF-UI-002 | Network waterfall per page: count requests, detect N+1 (same endpoint with different ids in a loop — e.g. outbound list firing one request per row) | no loop of > 5 similar calls |
| PERF-UI-003 | Outbound list 3,608 rows: first page, page 100, filter by status, search, group-by, select-all eligible, export | each < budget; UI does not freeze (main thread long tasks < 200 ms) |
| PERF-UI-004 | OMS list 4,320 rows with 11 status cards: counters query cost (`/oms/orders/nav-counts`) | < 300 ms cached |
| PERF-UI-005 | Combobox with 5,000 products / 3,000 locations / all areas (Syria hierarchy): open, type, scroll | keystroke < 50 ms, virtualised |
| PERF-UI-006 | Reports with large pivot/graph; switch views | no jank; memory stable |
| PERF-UI-007 | Dashboard auto refresh / realtime: CPU and request rate over 30 min idle | no growth; polling intervals documented |
| PERF-UI-008 | Memory leak: navigate 200 route changes, take heap snapshots | growth < 20 % |
| PERF-UI-009 | Slow network (Slow 3G) and CPU 4× throttle: skeletons, no layout shift, actions still usable | |
| PERF-UI-010 | Caching: static assets immutable 1 y; `index.html` no-store; after deploy new hash loads (update modal) | |
| PERF-UI-011 | Image/media: product images lazy, sized; waybill/QR rendering | |
| PERF-UI-012 | Token refresh storms: audit log shows `AUTH REFRESH REPLAY IDEMPOTENT` bursts (4 within one second at 04:37:43) — count refresh calls per minute with 5 tabs open | ≤ 1 per expiry per tab; no replay bursts (V-028) |

### 2.2 API load (k6) — scenarios

| ID | Scenario | Load profile | Expected |
|---|---|---|---|
| PERF-API-001 | Read mix (60 % lists, 30 % details, 10 % reports) | ramp 0→50 VUs 5 min, hold 15 min | budgets met, errors < 0.5 % |
| PERF-API-002 | Write mix: create OMS orders, confirm, approve, ship (carrier mocked) | 10 VUs, 10 min | no deadlocks; sequences unique |
| PERF-API-003 | Stock race: 200 parallel allocate requests on 50 units | | exact 50 allocated; no negative |
| PERF-API-004 | Webhook burst from carriers: 500 events/min for 10 min incl. duplicates/out-of-order | | idempotent; queue drained; latency < 1 s |
| PERF-API-005 | Import 5,000-row OMS file; client import 1,000 rows ×5 concurrent | | completes < 5 min; no memory spike; progress |
| PERF-API-006 | Bulk shipping 200 orders (mock carrier 300 ms) | | per-order results; < 2 min |
| PERF-API-007 | Export 50,000 rows OMS CSV/Excel | | streamed; < 60 s; memory flat |
| PERF-API-008 | PDF burst: 50 concurrent waybills (headless browser pool) | | no crash; queueing |
| PERF-API-009 | Auth: 100 logins/min + refresh; brute force protection does not lock legit users | | |
| PERF-API-010 | Report endpoints: all 21 with 1-year range, 3 concurrent | | budgets |
| PERF-API-011 | Soak: 4 h at 30 % load | | no memory growth > 15 %, no FD leak, no log explosion |
| PERF-API-012 | Spike: 0→200 VUs in 30 s | | graceful 429/503, recovers < 2 min |
| PERF-API-013 | Throttler: global 120 req/min/IP — verify normal heavy pages (dashboard + reports) do not trip it for a single user; and that nginx IP is not the only identity (X-Forwarded-For handling) | | no false 429 for one active user; per-user limits |
| PERF-API-014 | Websocket: 500 concurrent connections, tenant rooms, broadcast | | |

### 2.3 Database

| ID | Scenario | Expected |
|---|---|---|
| PERF-DB-001 | Top 30 slowest queries via `pg_stat_statements` after the above runs; `EXPLAIN` each | no seq scan on > 10k-row tables without reason; missing indexes listed |
| PERF-DB-002 | RLS overhead: same query with/without `withTenantRls` | < 20 % |
| PERF-DB-003 | Locks: long transactions > 5 s, lock waits during stock race | none |
| PERF-DB-004 | Table/index bloat, autovacuum on ledger/audit tables; growth projection (audit 730 d retention) | |
| PERF-DB-005 | Connection pool: saturation behaviour (max connections vs pm2 instances) | queue, no crash |
| PERF-DB-006 | Backup duration/size with data growth ×10; restore time | within window |

### 2.4 Infrastructure

| ID | Scenario | Expected |
|---|---|---|
| PERF-INF-001 | nginx: gzip/brotli on, HTTP/2, keep-alive; `client_max_body_size 25m` vs upload limits | consistent |
| PERF-INF-002 | PM2: cluster vs fork on staging; restart time; graceful shutdown with in-flight requests | < 10 s, no 502 for > 5 s |
| PERF-INF-003 | Disk: backups 39.5 GB used of 95.8 GB (41 %): alert thresholds, retention cleanup effect | |
| PERF-INF-004 | Cron load at 01:18 (backup) vs user traffic | no visible slowdown |
| PERF-INF-005 | Memory: backend RSS baseline, after load, after soak; build 4 GB heap only at build time | |

## 3. Reporting

For each case: numbers (p50/p95/p99, throughput, error %, CPU/RSS), environment state (data volume, concurrent owner activity), raw k6 JSON/Lighthouse JSON, and **bottleneck diagnosis** for every miss (query, N+1, payload size, serialization, PDF engine…).
