# 03 — Integration testing

**Scope.** Modules working together with the **real PostgreSQL** (Prisma, RLS, triggers), real Nest pipeline (guards, pipes, interceptors, exception filter), Redis, file storage, PDF engine, and — through recorded fixtures or sandbox — carriers. HTTP contract of all **594 endpoints** (`generated/ENDPOINT_CATALOGUE.md`).
**Where to run.** (a) *Nest e2e style* against an ephemeral DB created from `prisma/schema` + seed (`tests/api`, `backend/test` — to be created); (b) *API smoke* against staging `http://127.0.0.1:3001/api` (no TLS issue from the VPS).
**Isolation.** Each test creates its own `QA-<test id>-<timestamp>` company/product/order and removes (or soft-deletes) it afterwards; no test depends on seed order. DB assertions use SQL helper (`select …`) so that *what the UI shows* can be compared with *what the DB holds*.

Accounts needed (see `18`): super_admin, wh_manager, wh_operator, finance(accountant), viewer, inventory_controller, a custom role, client_admin A, client_staff A, client_admin B (second tenant).

---

## 1. Endpoint battery — applies to **every** endpoint in the catalogue (EP-01…EP-14)

An endpoint is "covered" only when each applicable battery item has a recorded test (or is marked N/A with reason, e.g. GET has no body).

| ID | Check | Expected |
|---|---|---|
| EP-01★ | **Happy path** with minimal valid input | 2xx, envelope `{success:true,data}`, documented shape, correct status code (201 for create) |
| EP-02★ | **Auth**: no token / expired / tampered / wrong audience (client token on admin route and vice versa) | 401 (never 500); public routes explicitly listed and only those |
| EP-03★ | **Authorisation**: each role allowed/forbidden per RBAC matrix (`09`) | 403 with stable code; no partial data |
| EP-04★ | **Tenancy**: other-tenant id in path/body/query; `X-Company-Id` spoofing by client role | 404/403, never the foreign data |
| EP-05 | **Validation**: missing required, wrong type, extra unknown fields (whitelist), too long, boundary numbers, invalid UUID, invalid enum | 400 with field-level messages; no 500 |
| EP-06 | **Idempotency / double submit** for POST that creates or moves money/stock | second identical request → same result or 409, never duplicate effect |
| EP-07 | **State precondition**: call in wrong entity status | 409/422 with error code from the matrix in `05` |
| EP-08 | **Pagination/sort/filter** (list endpoints): page, size 0/1/max/max+1, sort field whitelist, filter combos, text search injection | correct total/hasMore; invalid → 400 |
| EP-09 | **Export** endpoints: CSV/xlsx content-type, filename, BOM, filter parity, size cap, formula neutralisation | |
| EP-10 | **Side effects**: audit log row (actor, before/after), notification, ledger/finance rows, websocket event, outgoing webhook | exactly once |
| EP-11 | **Concurrency**: two parallel calls on same entity (optimistic lock / unique constraint) | one wins, other clean error |
| EP-12 | **Error envelope**: Prisma error, unknown error, upstream carrier error | no stack/SQL/secret in body |
| EP-13 | **Rate limit** where decorated (`@Throttle`) | 429 + `Retry-After` |
| EP-14 | **Performance smoke**: p95 under the budget in `08` for list endpoints at seed volume (3,608 outbound / 4,320 OMS) | |

Coverage obligation per module (IDs from the catalogue):

| Module | Endpoints (id range) | Count | Module | Endpoints | Count |
|---|---|---|---|---|---|
| adjustments | E001–E008 | 8 | locations | E333–E340 | 8 |
| audit-logs | E009–E013 | 5 | notifications | E341–E343 | 3 |
| auth | E014–E028 | 15 | observability | E344–E347 | 4 |
| backups | E029–E061 | 33 | oms-returns | E348–E365 | 18 |
| billing | E062–E103 | 42 | oms | E366–E433 | 68 |
| client-portal | E104–E218 | 115 | outbound | E434–E463 | 30 |
| cod | E219–E227 | 9 | products | E464–E474 | 11 |
| companies | E228–E240 | 13 | realtime | E475–E476 | 2 |
| cycle-count | E241–E268 | 28 | reports | E477–E481 | 5 |
| dashboard | E269–E270 | 2 | returns | E482–E493 | 12 |
| final-contracts | E271–E274 | 4 | settings | E494–E496 | 3 |
| financial | E275–E299 | 25 | shipping | E497–E534 | 38 |
| forms | E300–E304 | 5 | users | E535–E546 | 12 |
| inbound | E305–E322 | 18 | warehouse-workflow | E547–E577 | 31 |
| inventory | E323–E332 | 10 | warehouses | E578–E584 | 7 |
| pdf | E585–E594 | 10 | **Total** | | **594** |

Number of battery cells to execute ≈ 594 × 14; many are automatable with a generated table-driven runner reading the catalogue (phase 2 deliverable: `tests/api/endpoint-battery.spec.ts` generating EP-02/03/04 for all endpoints automatically from the catalogue + the RBAC matrix).

---

## 2. Scenario integration tests (IT) — cross-module, DB-backed

### 2.1 Tenancy & RLS (P0)

| ID | Scenario | Expected |
|---|---|---|
| IT-TEN-001 | Client A token lists products/orders/inbound/invoices/finance/notifications of company A only; B's ids → 404 | no cross-read |
| IT-TEN-002 | Client A tries POST/PATCH/DELETE on B's order/product/api key/webhook | 404/403 and no change (DB diff empty) |
| IT-TEN-003 | `withTenantRls`: raw SQL with no company set returns 0 rows for tenant tables; with company set returns only that company | DB-level isolation |
| IT-TEN-004 | Admin without company header on tenant endpoint (returns, products) → documented behaviour (V-016: "Select a tenant company") | consistent 400 with code, UI offers selector |
| IT-TEN-005 | Super admin `X-Company-Id` switching; client role header ignored | |
| IT-TEN-006 | Websocket rooms: client A never receives B's events | |
| IT-TEN-007 | Reports/exports/PDF links (`/documents/public/:id/:filename?exp&sig`) for another tenant: signature binds id; tampered `exp`/`sig` → 403; expired → 410/403 | |

### 2.2 Orders & stock (P0)

| ID | Scenario | Expected |
|---|---|---|
| IT-ORD-001 | Inbound lifecycle via API (create → approve → receive → putaway → complete): stock, ledger, GRN, notifications | rows exactly once each |
| IT-ORD-002 | Outbound lifecycle (create → confirm → allocate → pick → pack → ship): reservation→ledger out; DN | |
| IT-ORD-003 | **Race**: 20 parallel outbound confirms for 5 units | ≤ 5 units allocated; no negative stock; others get `INSUFFICIENT_STOCK` |
| IT-ORD-004 | **Race**: double receive / double complete / double putaway | idempotent; one ledger set |
| IT-ORD-005 | Cancel at every status → reservations released, COD voided, fee reversed | invariant checker (`inventory/consistency/validate`) clean |
| IT-ORD-006 | OMS ↔ outbound sync (D-048 regression): OMS returned/delivered vs outbound shipped never desync | 0 mismatches query |
| IT-ORD-007 | D-047 regression: cancelled OMS orders leave no active reservations | 0 rows |
| IT-ORD-008 | Import endpoints (OMS/inbound/outbound/client): 1,000 rows, partial invalid, duplicate refs, resume, tolerant phone/date/Arabic | counts + error rows |
| IT-ORD-009 | Batches: create from list; membership persists after status leaves the list; bulk actions; picking list ≠ packing list PDFs; waybills PDF/Excel | |
| IT-ORD-010 | Returns (OMS + WMS): qty guard, stages, restock location, rollback | ledger signs |
| IT-ORD-011 | Warehouse workflow: tasks generated for worker mode only; assign/start/complete; inventory effects once | |
| IT-ORD-012 | Cycle count full path → adjustments | |
| IT-ORD-013 | Number sequences under concurrency (1,000 parallel creates) | unique, gap policy documented |
| IT-ORD-014 | B3 traceability: OMS order detail lists source inbound orders; reverse lookup | |

### 2.3 Carriers (contract tests; live calls only with owner approval)

| ID | Scenario | Expected |
|---|---|---|
| IT-CAR-001 | Sena sandbox: create, track, webhook delivered, cancel, return, label, edit; all statuses mapped | |
| IT-CAR-002 | Babel recorded fixtures: quote/create/neighbourhood sync/dimensions/price parse; cancel unsupported message | |
| IT-CAR-003 | Sila recorded fixtures for the 9 guidance points (+ live read-only `GET /cargos?reference=` optional) | |
| IT-CAR-004 | Delivery Joud: POST-only regression (4 call sites); mapping Sequence; payer map | |
| IT-CAR-005 | Fatih fixtures | |
| IT-CAR-006 | Webhook endpoint `/shipping/webhooks/:providerCode`: valid/invalid signature, duplicate id, out-of-order, unknown provider, oversize body, replay window | 401/200 semantics |
| IT-CAR-007 | Carrier outage simulation (timeouts, 5xx, 429): retry/backoff, order not stuck, user-visible error with `request_id` | |
| IT-CAR-008 | Eligibility + early warning (carrier cannot serve area) before send | |
| IT-CAR-009 | Currency: quote in SYP old/new/USD → stored `carrierCostUsd` + original currency/unit; `adjust-carrier-cost` history | |
| IT-CAR-010 | Pickup address change used in next create payload | |
| IT-CAR-011 | Credentials: stored encrypted; GET never returns secret; rotate; Test connection | |

### 2.4 Finance, billing, FX (P0 — money)

| ID | Scenario | Expected |
|---|---|---|
| IT-FIN-001 | COD end-to-end under each of the 3 policies with SQL assertions on `financial_transactions` and account balances | exact amounts at exact moments |
| IT-FIN-002 | Concurrency: confirm remit ×10 parallel | one credit |
| IT-FIN-003 | Ledger idempotency (`appendIfAbsent`) with same key from two code paths (UI + webhook) | one row |
| IT-FIN-004 | Append-only guarantee: UPDATE/DELETE on transactions via SQL role used by app → denied/trigger | |
| IT-FIN-005 | Payout life cycle + minimum + locked balance | |
| IT-FIN-006 | B12 float numbers vs SQL; reconciliation upload of 500-line statement | buckets |
| IT-FIN-007 | B15 prep fee debit/credit symmetry on cancel/return | |
| IT-FIN-008 | Client shield hides gaps in all client endpoints (grep DTOs) | |
| IT-BIL-001 | On-demand preview/create for a period with 8 inbound + 2 OMS (INV-2026-00026 pattern) → totals equal manual calc | |
| IT-BIL-002 | Edit cell endpoints: shipping fee, carrier cost, fulfillment cost write-through to order/finance; audit event `oms.carrier_cost_adjusted` | |
| IT-BIL-003 | `GET /billing/storage-usage` with product mix (dimensions null, zero, normal) | CBM math |
| IT-BIL-004 | `GET /billing/incentive-check` at 499/500/501 delivered orders seeded via helper | qualifies flag |
| IT-BIL-005 | Invoice lifecycle: draft→unpaid→paid, settle from balance, cancel returns deduction; edit after finalise logged | |
| IT-BIL-006 | Client billing endpoints never contain `carrierCost`, `margin`, internal notes (JSON schema deny-list scan) | |
| IT-BIL-007 | Legacy cycle cron disabled after cutover: no new cycle notices/invoices | |
| IT-FX-001 | FX refresh cron: success/fail/stale; min-change threshold; manual vs auto; custom API SSRF blocklist | |
| IT-FX-002 | Display currency rules across endpoints: client = USD only | |

### 2.5 Auth & users

| ID | Scenario | Expected |
|---|---|---|
| IT-AUT-001 | Login/refresh/logout cookies: flags HttpOnly/Secure/SameSite, rotation, replay idempotent, revoke on password change | |
| IT-AUT-002 | Forgot/reset password with real SMTP (staging mailbox): email arrives within 60 s, code single-use/expiry | |
| IT-AUT-003 | Suspended/inactive/deleted user: access token still valid? must be refused on next request (token versioning) | |
| IT-AUT-004 | Throttling on login (existing `login-brute-force` spec) + per-IP vs per-account | |
| IT-AUT-005 | Custom roles: create → assign → every protected endpoint decision matches the permission set | |
| IT-AUT-006 | Client API keys: create, hash stored, regenerate invalidates old, revoke, enable/disable, rate limit, signature; used on `/v1/*` | |
| IT-AUT-007 | Google OAuth callback state/nonce (hidden UI) incl. suspended account refusal — run only when owner re-enables | |

### 2.6 Platform

| ID | Scenario | Expected |
|---|---|---|
| IT-PLT-001 | Audit: every mutating endpoint writes an audit row (generate from catalogue: all POST/PUT/PATCH/DELETE) | list of endpoints lacking audit |
| IT-PLT-002 | Notifications generation + realtime emit + read/unread | |
| IT-PLT-003 | Websocket (`realtime`): auth on connect, tenant rooms, reconnect, message ordering | |
| IT-PLT-004 | Backups: create (real `pg_dump`), size > 0, checksum, download token one-use, retention cleanup equals preview, schedule fires, health events, **restore into a scratch DB (never staging live DB)** | |
| IT-PLT-005 | PDF/document generation for each template EN+AR (GRN, DN, final contract, invoice, waybill, picking, packing, COD export, instruction sheets): non-empty, fonts embed Arabic, page count, text assertions from PDF text layer | |
| IT-PLT-006 | Media/images: upload, size/type guard, tenant-scoped download | |
| IT-PLT-007 | Forms public endpoint: validation, throttle, HTML escape, spam | |
| IT-PLT-008 | Observability: `/ops/health/live`, `/ops/health/ready` (DB/Redis down → not ready), metrics endpoints protected | |
| IT-PLT-009 | Migrations: apply on empty DB; apply on copy of staging; seed idempotent; `prisma migrate status` clean; RLS policies present on all tenant tables (query `pg_policies` vs table list) | |
| IT-PLT-010 | Redis down: app degrades gracefully (cache bypass, websocket adapter fallback) | |
| IT-PLT-011 | Cron inventory: list all schedules; each idempotent; no overlap (distributed lock) | |
| IT-PLT-012 | Config/secrets: no secret in logs; `.env` history rotation is an owner decision (tracked only) | |

### 2.7 Client portal & external channels

| ID | Scenario | Expected |
|---|---|---|
| IT-CLI-001 | All 115 client endpoints: tenancy + role (client_admin vs client_staff) + restricted-billing behaviour | |
| IT-CLI-002 | Sheets API: row edit allowed before admin approval, **refused after** (server side, not UI only), validation of dropdown values, built-in credentials hidden | |
| IT-CLI-003 | Order import (client): template, tolerant parse, limits | |
| IT-CLI-004 | Outgoing webhooks: event emission, signature header, retry with backoff, dead-letter, https only | |
| IT-EXT-001 | External API `/v1/oms|inbound|outbound/orders`: create/list/get by id or number, auth by key, scopes, rate limit, idempotency key, validation messages, cross-tenant, revoked key | |

### 2.8 Data integrity invariants (run after every IT suite and nightly)

| ID | Invariant (SQL) |
|---|---|
| IT-INV-001 | stock balance never < 0 |
| IT-INV-002 | Σ ledger by product/location = stock balance |
| IT-INV-003 | reservations only for active orders; none for cancelled/shipped |
| IT-INV-004 | OMS delivered/returned ↔ outbound state agree (0 mismatches) |
| IT-INV-005 | account `current_balance` = Σ transactions per currency |
| IT-INV-006 | each delivered COD order has exactly ≤ 1 COD credit |
| IT-INV-007 | each invoice total = Σ lines; each invoiced order appears on ≤ 1 non-cancelled invoice |
| IT-INV-008 | every tenant table has RLS enabled + policy |
| IT-INV-009 | no orphan rows (FK) and no duplicate order numbers |
| IT-INV-010 | audit log has an entry for every finance transaction creation |

---

## 3. Fixtures & recording

* Carrier fixtures recorded **once** from sandbox/live read-only calls with owner approval, secrets scrubbed, stored under `backend/test/fixtures/carriers/<provider>/<case>.json`.
* DB seed for performance-size tests lives in `08`.
* Time: freeze via injectable clock; cron tests call the handler directly.
