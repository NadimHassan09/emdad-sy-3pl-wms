# 01 — Unit testing

**Scope.** Pure functions and single classes with every I/O mocked (Prisma, Redis, HTTP, clock, filesystem). One behaviour per test. Fast (< 10 ms each).
**Tools (already in repo).** Backend: Jest via `npm run test:unit` (4 GB heap, 165 spec files / ~990 tests today). Frontends: Vitest (`frontend`: 32 specs; `client-frontend`: **0 specs**).
**Out of scope here:** anything needing a database or network → `03`. UI rendering → `02`.

## 1. Coverage targets (phase 3 gate)

| Area | Target (line / branch) | Note |
|---|---|---|
| Money, currency, FX, fee calculation, billing calc, COD policy, ledger idempotency | **100 % / 100 %** | every branch, every rounding path |
| State machines (OMS, outbound, inbound, returns, tasks, invoices, payouts, COD) | 100 % of transitions, allowed and forbidden | table-driven |
| Auth, RBAC guards, permission resolution | 95 / 90 | |
| Adapters (5 carriers): request builders, response mappers, status mapping, error mapping | 95 / 90 | recorded fixtures |
| Parsers/normalisers (address, phone, date, CSV/Excel import, tabular export) | 95 / 95 | property-style tables |
| Other services | 80 / 70 | |
| Frontend `lib/`, `hooks/`, `utils` | 90 / 85 | |
| client-frontend `lib/`, `hooks/` | 90 / 85 (from 0) | **no unit test exists today** |

Gaps found by script: `generated/UNIT_GAP_BACKEND.md` (208 backend files without sibling spec, largest first) and `generated/UNIT_GAP_FRONTEND.md` (122 of 137 lib/hook/util files without spec). Every file in these lists gets at least one case below or an explicit "covered by IT-xxx instead" note in the matrix.

**Test-data rules.** Fixed clock (`jest.useFakeTimers().setSystemTime('2026-11-14T10:00:00Z')`), fixed UUIDs, `Decimal` for money (never float asserts: compare strings `'12.50'`). No network. Each table below is **table-driven**: ID is the row, expected is exact.

---

## 2. Backend units

### 2.1 Money, currency, FX (`common/money`, `shipping/shipping-fx.service.ts`, `shipping-fee.service.ts`) — P0

| ID | Target | Case | Expected | Oracle |
|---|---|---|---|---|
| UT-MON-001 | money util | USD add/sub/mul with Decimal: 0.1+0.2, 19.995→2 dp, 1e-7, 1e12 | exact decimal strings; rounding HALF_UP to 2 dp (confirm mode A-18) | C |
| UT-MON-002 | money util | negative zero, NaN, Infinity, null, "", "12,5", "١٢" | rejected / parsed per rule, never NaN stored | C |
| UT-MON-003 | currency model | 1 new SYP = 100 old SYP (fixed) both directions, round-trip loses < 1 old-SYP | exact | S owner Nov |
| UT-MON-004 | currency model | USD↔new SYP with rate 130.01 and 120 (manual) | amount × rate; 4-dp rate stored | S |
| UT-MON-005 | currency model | Client-facing amounts only USD; carrier amounts keep carrier currency & unit | no SYP in client DTO | S #4/#5 |
| UT-FX-001 | shipping-fx | manual rate overrides automatic until switched back | active source = manual | D |
| UT-FX-002 | shipping-fx | automatic: refresh every N hours; skip when fetched < N h ago | no call | D |
| UT-FX-003 | shipping-fx | stale limit: rate older than X h rejected → fallback to last good? | per rule (A-08) → error `FX_STALE` | D |
| UT-FX-004 | shipping-fx | min-change threshold 0.5 %: new rate within threshold ignored, above accepted | active rate unchanged / changed | D #9 |
| UT-FX-005 | shipping-fx | custom HTTPS JSON API: reject `http://`, reject private IPs (SSRF: 127.0.0.1, 169.254.169.254, 10.x, localhost, ::1, DNS rebinding hostnames), accept https | block list | D I-12, SEC |
| UT-FX-006 | shipping-fx | custom API response shapes: missing field, string number, negative, 0, huge | rejected | C |
| UT-FX-007 | shipping-fx | built-in source (fawazahmed0 + jsDelivr) failure → keep last rate + alert | no crash | C |
| UT-FEE-001 | shipping-fee | group priority: city/neighbourhood rule beats governorate rule beats "All Syria" | picks most specific | D page text |
| UT-FEE-002 | shipping-fee | weight policy "up to 10 kg + $1 per 5 kg": 0, 10, 10.01, 14.99, 15, 15.01, 100 kg | 2.00, 2.00, 3.00, 3.00, 3.00(?), 4.00 … exact table in test (confirm A-09) | D |
| UT-FEE-003 | shipping-fee | destination with no group → `NO_FEE_RATE` (blocks confirm) | error code | S #24 |
| UT-FEE-004 | shipping-fee | inactive group ignored; group with no destinations never matches | skipped | I A-09 |
| UT-FEE-005 | shipping-fee | per-client scoped group overrides global | client wins | D |
| UT-FEE-006 | shipping-fee | coverage summary: governorates covered count, uncovered list | 14 of 14 | D |

### 2.2 Carrier layer (`shipping/*`) — P0

| ID | Target | Case | Expected |
|---|---|---|---|
| UT-CAR-001 | eligibility rules | weight limit, COD currency, zone/governorate served per carrier; Babel excludes Raqqa/Deir ez-Zor/Hasakah/Suwayda | ineligible list with reason codes |
| UT-CAR-002 | quote comparison | quotes in USD, old SYP, new SYP → best by converted USD; ties; missing quote | deterministic order |
| UT-CAR-003 | bulk-shipping.service | partial failure: 2 ok / 1 fail → per-order results, no all-or-nothing rollback | result array |
| UT-CAR-004 | bulk-shipping.service | idempotency: same order twice in selection | one shipment |
| UT-CAR-005 | shipment cost fields | `carrierCostUsd` stored in `rawResultMeta`; `adjust-carrier-cost` keeps history (previous/new/reason/actor) | audit payload |
| UT-SEN-001..008 | sena-express adapter | build create payload (COD, address mapping), parse response, status map (all Sena statuses → internal), label URL, cancel, return, webhook signature valid/invalid/duplicate/out-of-order | fixtures per case |
| UT-BAB-001..008 | babel-express adapter | create payload (neighbourhood sync, dimensions), price parse, status map, **no cancel API** → `CANCEL_NOT_SUPPORTED` with manual-instruction message, tracking poll, error mapping | fixtures |
| UT-SIL-001..012 | sila-sy adapter | 9 guidance points: create 201 without courier code; read courier code by `GET /cargos/{id}`; webhook `cargo.courier_barcode_assigned`; never query by courier code; cancel only `PUT /cargos/{id}/cancel`; COD = amount recipient pays incl. shipping in stated currency; USD pricing for TARABUT; `recipient.area_id` leaf only; `GET /cargos?reference=` before re-send; surface `error.message` + keep `request_id`; detailed tracking statuses (Arabic) | each point = one test |
| UT-DJ-001..008 | delivery-joud adapter + http client | **all calls are POST** (regression of GET-with-body bug): `get_areas`, `order_types`, `order`(×2); GET never sends body; Sequence mapper; payer map; areas lookup; error JSON-RPC mapping | method asserted `POST` |
| UT-FAT-001..006 | fatih-cargo adapter | create/track/cancel mapping, SYP unit | fixtures |
| UT-MOCK-001 | mock-carrier | deterministic outputs for tests | |
| UT-WH-001 | shipping webhook handler | HMAC/secret check constant-time; replay window; unknown provider → 404; body size limit | |

### 2.3 OMS / outbound / inbound / returns state machines — P0

Table-driven: for each *(entity, from-status, action, role)* assert **allowed → new status + side-effects** or **forbidden → exact error code**. The full matrix is generated from the services; minimum rows:

| ID | Entity | Matrix |
|---|---|---|
| UT-OMS-001 | `oms-orders.service` | statuses: waiting_for_confirmation → waiting_for_admin → processing → ready_to_ship → out_for_delivery → delivered / failed_delivery → return_pending_receipt → return_received / cancelled. All allowed edges + all forbidden edges |
| UT-OMS-002 | edit rules | field-level editability per status; super_admin override after shipment sets "local only" flag; client edit only before EMDAD confirmation (B8) |
| UT-OMS-003 | cancel | with/without shipment; releases reservation; voids COD; refunds fee recognition |
| UT-OMS-004 | `oms-outbound-sync.service` | OMS ↔ outbound status sync; guards against D-048 desync (OMS delivered ↔ outbound shipped counts) |
| UT-OMS-005 | `oms-batch.service` | batch numbering, membership persistence after status leaves list filter, counters |
| UT-OMS-006 | `oms-client-import.service` / import parser | see 2.6 |
| UT-OUT-001 | `outbound.service` | draft→pending→confirmed→allocated→picking→packing→waiting_for_shipping_details→shipped / cancelled; packing optional; admin vs worker execution |
| UT-OUT-002 | allocation | FEFO by expiry, lot-tracked vs not, partial allocation rule, reservation release on cancel |
| UT-INB-001 | `inbound.service` | draft→pending approval→confirmed→in progress→partially received→completed / cancelled; GRN number sequence |
| UT-INB-002 | receiving | received > expected (over-receipt rule), < expected, zero, damaged |
| UT-RET-001 | `oms-returns.service`, `returns.service`, `return-quantity.validation` | return qty ≤ delivered − already returned; rollback transitions; express return; restock location; stage separation (approve → receive → putaway) |
| UT-TSK-001 | `warehouse-tasks`, `workflow-engine`, `workflow-orchestration`, `task-inventory-effects` | task generation per execution mode; assignment; start/stop timing (`task-timing`); duration; inventory effects exactly once on completion (idempotent); cannot complete twice |
| UT-CYC-001 | `cycle-count*` | schedule due calc; variance threshold; approve → adjustment; reason codes |

### 2.4 Inventory & ledger — P0

| ID | Target | Case | Expected |
|---|---|---|---|
| UT-LED-001 | `LedgerIdempotencyService.appendIfAbsent` | same idempotency key twice | one row, second returns existing |
| UT-LED-002 | ledger | update/delete attempts | not exposed; DB trigger/guard (IT) |
| UT-INV-001 | availability | on-hand − reserved − allocated, never negative; lot/expiry filter | |
| UT-INV-002 | reservation | reserve > available → error; concurrent (simulated) | |
| UT-INV-003 | `inventory-consistency.service` | detect ledger ≠ balance, orphan reservations, negative stock; report shape | |
| UT-INV-004 | `adjustments.service` | approve/reject; decrease below zero blocked; ledger exactly once | |
| UT-INV-005 | internal transfer | same location rejected; two ledger rows share reference | |
| UT-INV-006 | stock health/low stock | threshold null vs 0 vs n | `stock-health.ts` |

### 2.5 Billing & finance — P0 (money)

| ID | Target | Case | Expected |
|---|---|---|---|
| UT-BIL-001 | `billing-invoice-calculation` | fulfillment per inbound/outbound/OMS from plan prices, weight/lines dynamic | cents exact |
| UT-BIL-002 | on-demand preview | period inclusive bounds (00:00–23:59 Asia/Damascus), orders already on another invoice skipped, cancelled orders $0 | list + totals |
| UT-BIL-003 | OMS vs outbound | OMS fulfilment covers its own outbound; outbound billed once | no double |
| UT-BIL-004 | storage (`billing-automation`) | CBM = Σ qty × L×W×H(cm)/1,000,000; missing dims → CBM 0 + warning; rate $10; rounding; qty 0 skipped; 10 000 SKUs | exact |
| UT-BIL-005 | incentive | delivered count 499/500/501 in period using `deliveredAt`; 20 % of fulfilment total; negative line; configurable threshold/pct | boundaries |
| UT-BIL-006 | charge rules | per-client optional items; disabled item excluded | |
| UT-BIL-007 | invoice lifecycle | draft editable; finalise locks; edit-after-finalise logged; cancel returns balance deduction (see TXN "Invoice … cancelled: deduction returned") | |
| UT-BIL-008 | invoice totals | admin: client total, carrier cost, margin = client total − carrier cost; client DTO omits carrier cost & margin | |
| UT-BIL-009 | plans/templates | validation (volume ≥ 0, price ≥ 0, cycle ≥ 1); template inheritance | |
| UT-BIL-010 | `billing-access` | restricted account rules | |
| UT-FIN-001 | `financial-cod.service` | COD policy: (a) on carrier remittance, (b) on collection confirmation, (c) immediately on delivery → exact moment pending→available | S B15 |
| UT-FIN-002 | cod | collect twice / remit before collect / remit twice | idempotent / rejected |
| UT-FIN-003 | `financial-accounts` | available = current − pending COD − payout locked; per-currency separation | formula |
| UT-FIN-004 | `financial-payouts` | min payout 10 USD; cannot exceed available; approve → lock; disburse → debit once; reject → unlock | |
| UT-FIN-005 | `financial-transactions` | append-only; TXN number format `TXN-YYYYMMDD-XXXXXX` unique | |
| UT-FIN-006 | shipping-fee recognition | At dispatch vs On delivery timing debits once | S |
| UT-FIN-007 | B12 float | float = Σ carrierCost of shipments not final (not delivered/returned/cancelled) per provider; limit alert at 5000 | S B12 |
| UT-FIN-008 | B12 reconciliation | statement lines (AWB, amount, currency): match / amount mismatch / missing in EMDAD / duplicate in statement / currency conversion | four buckets |
| UT-FIN-009 | B12 client shield | client DTOs never include in-transit gaps when shield ON | |
| UT-FIN-010 | B15 prep fee | fee = % × order value while COD outstanding; disabled → none; percent bounds 0–100 | |
| UT-FIN-011 | cutover flag | legacy billing cycles disabled: cron does not generate cycle notifications/invoices | A-07 |
| UT-FIN-012 | statements | opening + movements = closing; period boundaries | |

### 2.6 Parsers, normalisers, exports — P0/P1

| ID | Target | Case | Expected |
|---|---|---|---|
| UT-ADR-001 | `resolveSyriaAddress` / hierarchy | exact, Arabic letter folding (أ/ا/إ, ة/ه, ى/ي), diacritics, typos `حللب`→حلب ("Did you mean"), wrong governorate for known town, unknown neighbourhood, empty | resolved + suggestion list |
| UT-ADR-002 | hierarchy data | every governorate has cities; no duplicate ids; carriers' mapped areas exist (Babel sync) | |
| UT-PHN-001 | phone normaliser | `+963 99 900 0111`, `0999000111`, `00963999000111`, Arabic digits, spaces/dashes, too short/long, non-Syrian numbers (+966…) | E.164 or error |
| UT-DAT-001 | date parser (import) | `2026-11-14`, `14/11/2026`, `11/14/2026` (ambiguous!), Excel serial, Arabic digits, empty | documented rule |
| UT-IMP-001 | OMS/inbound/outbound import parsers | header aliases (AR+EN), extra columns, blank rows, BOM, `;` vs `,`, quoted newlines, 10k rows, duplicate order refs | row errors array |
| UT-IMP-002 | template builder | xlsx has Instructions sheet (AR+EN), hidden Lists/Areas, named ranges, dependent dropdown formulas | structural asserts |
| UT-EXP-001 | `tabular-export.util` | CSV escaping, UTF-8 BOM, Arabic, Excel branded sheet + analytics block, **formula-injection**: cells starting `= + - @ \t \r` neutralised | |
| UT-EXP-002 | export column catalogue | columns per module equal UI table columns (`export-filter-parity` exists on FE) | |
| UT-PDF-001 | pdf services (GRN, DN, final contract, invoice, waybill, picking/packing list, COD export) | data mapping only: totals, Arabic text shaping flag, QR payload content, page size 10×15 | snapshot of view-model |
| UT-ID-001 | number generators | INB/OUT/OMS/OR/INV/GRN/BATCH/TXN sequences: format, year rollover, concurrency safe (mock lock) | |

### 2.7 Auth, security, platform

| ID | Target | Case | Expected |
|---|---|---|---|
| UT-AUT-001 | `auth.service` | login ok / wrong pw / inactive / suspended / unknown email (same error) | |
| UT-AUT-002 | refresh rotation | replay of used refresh within grace = idempotent success; after grace = revoke family | `AUTH REFRESH REPLAY IDEMPOTENT` |
| UT-AUT-003 | password reset | code 6-digit, TTL, single-use, attempt limit, new password policy ≥ 8 | |
| UT-AUT-004 | lockout/throttle | N failures → 429 with Retry-After | existing `login-brute-force` spec |
| UT-AUT-005 | `client-auth.service` | same set + "remember me" 30 days vs session | |
| UT-AUT-006 | Google sign-in | suspended/inactive user refused even with valid Google token; unlinked account; state/nonce checked (hidden UI) | |
| UT-RBAC-001 | guards (`InternalAdminGuard`, roles, tenant guard, company-access) | matrix 10 roles × guard decisions | |
| UT-RBAC-002 | custom roles (O-11) | permission set resolution module×action; unknown module denied; role deletion while assigned | |
| UT-TEN-001 | `withTenantRls` / company-access | client role always scoped to own company; `X-Company-Id` header ignored for client roles; super_admin chooses | |
| UT-EXC-001 | `all-exceptions.filter` | Prisma errors / validation / HTTP exceptions → stable error envelope, no stack/SQL in production mode | |
| UT-INT-001 | response interceptor | `{success,data}` envelope; BigInt/Decimal serialisation | |
| UT-RED-001 | redis service/adapter | fallback when Redis down; cache TTL constants | |
| UT-THR-001 | throttler config | per-route limits (backup download 20/min) | |
| UT-LOG-001 | logging/redaction | secrets, tokens, passwords, Google credentials never logged | |
| UT-CRN-001 | cron jobs (`common/cron`) | schedules registered/unregistered per flags; idempotent | |

### 2.7b Platform: backups, notifications, realtime, audit, forms, settings

| ID | Target | Case |
|---|---|---|
| UT-BKP-001 | `backup-retention.service` | buckets daily 7 / weekly 4 / monthly 12; pre-snapshot protection 7 days; preview == deletion set |
| UT-BKP-002 | `backup-health.service` | status healthy/warning/critical thresholds (stale > 48 h critical); events dedupe; "healthy" vs critical contradiction rule |
| UT-BKP-003 | `backup-runner`, `backup-pg-tools` | command construction without shell injection; cooldown; size > 0 check |
| UT-BKP-004 | schedule next-run calc (timezone) | |
| UT-BKP-005 | download token | HMAC, expiry, one-use, id binding |
| UT-BKP-006 | `backup-restore-runner` | guard conditions (never in prod unless flag) — unit only with mocks |
| UT-NOT-001 | notifications | dedupe key; read/unread; legacy billing-cycle notices off |
| UT-RT-001 | `realtime.service` | room membership by tenant; no cross-tenant emit; reconnect |
| UT-AUD-001 | `audit-logs.service` | before/after diff, redaction, retention 730 d, export cap 500 rows / 90 d, query window 30 d |
| UT-FRM-001 | forms | public submit validation, HTML stripping, rate limit |
| UT-SET-001 | settings.service | secret encryption at rest, masked read, Google OAuth credential save/test (no value echoed) |

---

## 3. Frontend units (`frontend/src/lib`, `hooks`, `data`) — gaps first

Existing 32 specs stay as regression. New cases (one file = at least these):

| ID | File | Cases |
|---|---|---|
| UT-FE-001 | `lib/rbac.ts` (exists) + new `custom-role` resolution | nav per role incl. accountant/viewer/inventory; custom role permissions; forbidden deep link redirect |
| UT-FE-002 | `lib/reports/registry.ts`, `report-catalog.ts`, `chart-data.ts`, `pivot-helpers.ts`, `framework/report-filters.ts` | every report registered once; filters→query params; pivot totals = list totals; empty data |
| UT-FE-003 | `lib/billing-invoice-display.ts`, `billing-invoice-print.ts`, `billing-plan-overview.ts` | currency format (USD "$1,234.50" vs "205 USD" — pick one, A-19), rounding, negative discount display, margin hidden for client |
| UT-FE-004 | `lib/oms-commercial-status.ts`, `oms-operational-stage.ts`(exists), `oms-return-status.ts`(exists) | status → label/colour/next actions map, no raw enum, AR+EN |
| UT-FE-005 | `lib/ledger-display.ts`, `audit-log-display.ts` | humanised action/category/reference (replace `oms_order: …`, `cod credit`) |
| UT-FE-006 | `lib/execution-plan.ts`, `workflow-next-task.ts`, `task-timing.ts`, `task-list-search.ts`, `task-mutation-cache.ts`, `ui-labels/task-execution.ts` | worker flow state, duration, search tokens |
| UT-FE-007 | `lib/location-types.ts`, `inventory-location-options.ts`, `geography.ts`, `data/syria-address` (exists) | type filter per context (putaway only Storage), hierarchy build |
| UT-FE-008 | `lib/stock-health.ts` | thresholds |
| UT-FE-009 | `lib/section-sub-nav.ts` | tabs per section (billing sub-nav lacks Templates/Charge rules — decide) |
| UT-FE-010 | `lib/ui-i18n.ts`, `ui-labels/*` | every key has EN+AR; no missing key renders key name; plural forms |
| UT-FE-011 | hooks `useFilters`, `useServerPagination`, `useReportServerData`, `useNotifications`, `useUpdateDetector`, `useTaskProgressSave`, `useBackup*` | state, persistence (`wms.listUi.*`), reset clears persisted state, abort on unmount, retry/backoff, polling stop on unmount |
| UT-FE-012 | `lib/money.ts` (exists) | extend: AR digits, rounding parity with backend |
| UT-FE-013 | `lib/shipping-*`, `recipient-contact`, `company-filter-options` (exist) | keep; add search-clears-after-select helper if extracted |
| UT-CFE-001..008 | `client-frontend/src/lib/rbac.ts`, `billing-display.ts`, `client-billing-restriction.ts`, `client-oms-commercial-status.ts`, `client-outbound-status.ts`, `section-sub-nav.ts`, `data/syria-address.ts`, hooks `useFilters`, `useClientNotifications`, `useUpdateDetector` | mirror of admin cases; **client billing display must never expose carrier cost/margin fields even if present in payload** |

---

## 4. Execution notes (phase 2/3)

* Add `--coverage` with thresholds per folder in `jest.config`/`vitest.config` so the gate is automatic.
* Mutation testing (Stryker) on `common/money`, fee, billing, COD, ledger — raises confidence that asserts are meaningful.
* Property-based (fast-check) for money rounding, FX conversion, address folding, phone normalisation, retention buckets.
* Every defect fixed later adds a unit test first (see `06`).
