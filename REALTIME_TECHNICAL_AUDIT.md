# Realtime Technical Audit

**Product expectation source (only):** [`REALTIME_PRODUCT_MATRIX.md`](./REALTIME_PRODUCT_MATRIX.md)  
**Audit subject:** Staging implementation under `/var/www/emdad-sy-3pl-wms-staging`  
**Date:** 2026-08-04  
**Constraint:** Implementation does **not** define expected behavior. Gaps = Matrix − Implementation.  
**No code was modified.**

---

## 1. Method & Scope

### 1.1 How each feature was scored

For every Matrix Business Event (§2) and Consistency Rule (§3):

1. Locate the backend mutation path.
2. Check for `RealtimeService.emit*` (or equivalent).
3. Record wire event + room.
4. Check admin + client `RealtimeProvider` listeners and React Query cache modules.
5. Answer pipeline questions Q1–Q20.
6. Score **Complete / Partial / Missing** using Matrix Consistency Rules (sibling screens must update).
7. Polling as primary live path = gap vs Matrix §0.3 No Polling.

### 1.2 Scoring

| Score | Meaning |
|-------|---------|
| **Complete** | Emit + correct room for required Matrix scopes + required FE listeners + cache/UI update; Consistency siblings covered; no polling-primary |
| **Partial** | Some of emit/listen/cache exist but scope, portal, dashboard, session force-logout, stock fan-out, or push-vs-poll incomplete |
| **Missing** | No emit and/or no listen for a Matrix-required live feature |
| **N/A — Out of Scope** | Matrix §0.5 explicitly excludes (not a gap) |

### 1.3 Frozen Matrix checklist (in scope)

**Business event families:** §2.1 Auth/Session/Company · §2.2 Inbound · §2.3 Outbound · §2.4 OMS/COD · §2.5 Returns · §2.6 Products/Stock · §2.7 Tasks/Cycle Count · §2.8 Notifications/Documents/Billing/Forms/Backups  

**Consistency rules:** §3.1–§3.10  

**Excluded from gaps:** Presence product requirement, historical reports mid-session, theme/language, settings forms (except backup job progress), archived browse, frozen PDFs.

---

## 2. Architecture Inventory (as implemented)

### 2.1 Backend spine

| Component | Path |
|-----------|------|
| Event catalog | `backend/src/modules/realtime/realtime.events.ts` (42 wire events) |
| Emit API | `backend/src/modules/realtime/realtime.service.ts` |
| Gateway | `backend/src/modules/realtime/realtime.gateway.ts` — namespace `/realtime` |
| Auth / rooms | `backend/src/modules/realtime/realtime-socket-auth.ts` |
| Presence | `backend/src/modules/realtime/presence.service.ts` |
| Dashboard debounce | `backend/src/modules/dashboard/dashboard-realtime.service.ts` |
| Redis adapter | `backend/src/common/redis/redis-io.adapter.ts` (PM2 fan-out only) |

**No** domain EventBus / CQRS / EventEmitter2 for realtime. Domain services call `RealtimeService` directly after mutations.

### 2.2 Rooms (actual)

| Room | Who joins | Used for |
|------|-----------|----------|
| `tenant:company:{uuid}` | Admin (selected company) + Client (token company) | Orders, tasks, inventory, products, returns, cycle counts, adjustments, transfers, OMS |
| `room:user:{userId}` | Same user | Notifications, `auth.session.changed` |
| `room:internal:master-data` | Internal admin only | Warehouses, locations, users, dashboard.*, presence.*, audit_log, auth.session (also) |

**Missing vs Matrix scopes:** No `SameWarehouse` rooms. `AdminDashboard` events go to master-data only (not company room). Client never receives dashboard.* or presence.*.

### 2.3 Wire events actually defined

`order.inbound.created/updated`, `order.outbound.created/updated`, `oms.order.event`, `task.updated`, `inventory.changed`, `product.*`, `user.*`, `warehouse.*`, `location.*`, `return.*`, `cycle_count.*`, `adjustment.*`, `transfer.*`, `audit_log.created`, `notification.*`, `dashboard.kpi/inventory/orders/tasks.updated`, `presence.online/offline`, `auth.session.changed`.

**No wire events for:** company lifecycle, billing restrict/plans/invoices, COD collect/remit/settle, OMS returns, documents/GRN/DN, forms, backup jobs, dedicated reservation events.

### 2.4 Frontend

| App | Provider | Listeners | Cache strategy |
|-----|----------|-----------|----------------|
| Admin | `frontend/src/realtime/RealtimeProvider.tsx` | 42 | Prefer `setQueryData` patches; OMS uses `invalidateQueries` |
| Client | `client-frontend/src/realtime/RealtimeProvider.tsx` | 12 | Patch inbound/outbound/products/stock/notifications; OMS invalidate |

**No** Zustand/Redux. **No** per-page socket hooks. Auth session CustomEvent `wms:session-changed` is dispatched on admin but **no `addEventListener` consumer exists** in `frontend/src`.

### 2.5 Polling inventory (vs Matrix No Polling)

| Location | Interval | Matrix expectation |
|----------|----------|-------------------|
| `OmsDashboardPage.tsx` | 60s | Push (OMS dashboard live) — **gap** |
| Backup pages / `useBackupRunningStatusPoll` / maintenance | 2–60s | Push for running job progress — **gap** |
| Engine.IO `transports: ['websocket','polling']` | transport fallback | Not app-level polling (OK) |

Client portal: no `refetchInterval` for domain data.

### 2.6 Domain modules that emit (call sites)

| Module | Emits |
|--------|-------|
| `inbound.service.ts` | inbound created/updated, inventory.changed (receive) |
| `outbound.service.ts` | outbound created/updated, inventory.changed (ship/deduct) |
| `oms-orders.service.ts` / `oms-outbound-sync.service.ts` | `oms.order.event`, sometimes outbound created/updated |
| `warehouse-tasks.service.ts` | task.updated (+ inventory on complete/cancel/fail) |
| `inventory.service.ts` | transfer.*, inventory.changed |
| `adjustments.service.ts` | adjustment.*, inventory.changed on approve |
| `products.service.ts` | product.* |
| `returns.service.ts` | return.* **only** (no inventory.changed on post) |
| `cycle-count.service.ts` | cycle_count.* **only** (no inventory.changed on post) |
| `users.service.ts` | user.* (master-data ± company for client users) |
| `warehouses.service.ts` / `locations.service.ts` | warehouse/location.* → master-data |
| `notifications.service.ts` / `client-notifications.service.ts` / `billing-notifications.service.ts` | notification.* |
| `auth.service.ts` | auth.session.changed |
| `audit-log.service.ts` | audit_log.created |
| `dashboard-realtime.service.ts` | dashboard.* |
| `presence.service.ts` | presence.* |

### 2.7 Silent modules (Matrix-required, no RealtimeService)

| Module | Matrix events affected |
|--------|------------------------|
| `companies/customer-lifecycle.service.ts` | CompanySuspended/Activated/Archived/Restored |
| `billing/*` (plans/cycles/invoices/access) except notification side-effects | Invoice*, Plan*, BillingRestricted*, CapacityChanged |
| `cod/cod-records.service.ts` | CodCollected/Remitted/Settled |
| `oms-returns/oms-returns.service.ts` | OmsReturn* |
| `documents/*`, final-contracts | DocumentGenerated, FinalContractCreated |
| `forms/*` | FormSubmitted |
| `backups/*` | BackupJob* |
| Return inventory post path (`return-workflow.service.ts`) | StockChanged on return post |
| Cycle count variance reconcile / complete | StockChanged on CycleCountPosted |

---

## 3. Pipeline Audit by Matrix Business Event Family

Legend for Q10–Q14: Yes / Partial / No / N/A.

### 3.1 Auth / Session / Company (§2.1)

#### `UserLoggedIn` / `UserLoggedOut` / `UserSessionExpired` / forced logout

| # | Question | Answer |
|---|----------|--------|
| 1 | Backend action | Login, logout, refresh replay, token version mismatch |
| 2 | Service | `auth.service.ts` |
| 3 | Matrix event | UserLoggedIn / LoggedOut / SessionExpired (+ forced) |
| 4 | Actually emitted? | **Yes** — `emitAuthSessionChanged` (`login`, `logout`, `expired`, `forced_logout`, `refresh`) |
| 5 | Websocket event | `auth.session.changed` |
| 6 | Room | `room:user:{id}` + master-data |
| 7 | FE pages | Should force logout / session gate |
| 8 | Hook | Admin `RealtimeProvider.onAuthSessionChanged` only |
| 9 | Cache/store | Dispatches `wms:session-changed` CustomEvent — **no AuthContext listener** |
| 10 | UI without refresh? | **No** |
| 11 | Other tab? | **No** (event unused) |
| 12 | Other user? | N/A (SameUser) |
| 13 | Client Portal? | **No** — client has no auth.session listener |
| 14 | Admin Dashboard? | N/A |
| 15 | Duplicate? | No |
| 16 | Polling instead? | No |
| 17 | RQ invalidation sufficient? | N/A — needs auth logout |
| 18 | Missing listener? | **Yes** — no consumer of `wms:session-changed`; client missing entirely |
| 19 | Missing emitter? | Partial — company suspend does not emit session revoke |
| 20 | Stale UI? | **Yes** — user can keep acting until next API 401 |
| **Works** | **Partial** |

#### `UserRoleChanged` / `UserDeactivated`

| # | Answer summary |
|---|----------------|
| Emit | `user.updated` / `user.deleted` to master-data (+ company for client users). **No** `auth.session.changed` on deactivate/role change from `users.service.ts` |
| FE | Admin patches user lists; does **not** force logout target user |
| Client | No user.* listeners |
| **Works** | **Partial** (list updates) / **Missing** (session revoke for target) |

#### `CompanySuspended` / `Activated` / `Archived` / `Restored` / `BillingRestricted` / `BillingRestrictionLifted`

| # | Answer summary |
|---|----------------|
| Backend | `customer-lifecycle.service.ts`, billing cycle processor / access |
| Emit | **None** for company/billing domain sockets. Billing may create **notifications** only via `billing-notifications.service.ts` |
| FE | No company.* / billing.* listeners. Client restriction uses HTTP `useClientOperationalAccess` — stale until refetch |
| **Works** | **Missing** (domain realtime); notifications Partial if created |

---

### 3.2 Inbound (§2.2)

#### `InboundCreated` / `InboundSubmittedForApproval` / `InboundPlanned` / `InboundConfirmed` / `InboundInProgress` / `InboundPartiallyReceived` / `InboundCompleted` / `InboundCancelled`

| # | Question | Answer |
|---|----------|--------|
| 1–2 | Action / service | CRUD/confirm/cancel/receive in `inbound.service.ts` |
| 3 | Matrix events | Inbound* |
| 4 | Emitted? | **Yes** — created + updated (status transitions collapse into `order.inbound.updated`) |
| 5 | Wire | `order.inbound.created` / `order.inbound.updated` |
| 6 | Room | `tenant:company:{id}` |
| 7 | Pages | Admin inbound list/detail; Client inbound list/detail |
| 8 | Hook | Admin + Client `RealtimeProvider` |
| 9 | Cache | `orders-cache` / client `orders-cache` patches |
| 10 | UI no refresh? | **Yes** (list/detail when queries active) |
| 11 | Other tab? | **Yes** (same company room) |
| 12 | Other user? | **Yes** (same company) |
| 13 | Client Portal? | **Yes** (same company events) |
| 14 | Admin Dashboard? | **Partial** — `scheduleDashboard('orders')` → dashboard.orders.updated to **master-data**; admin overview patches if connected |
| 15 | Duplicate? | No |
| 16 | Polling? | No |
| 17 | RQ? | Patch preferred; sufficient for order rows |
| 18–19 | Missing listen/emit? | Fine-grained Matrix names not separate wire events (OK if updated payload carries status). Client dashboard keys `['client','dashboard',…]` **not** invalidated |
| 20 | Stale UI? | Client dashboard inbound-related widgets stale; notifications depend on separate notification emits |
| **Works** | **Partial** |

---

### 3.3 Outbound (§2.3)

Same pattern as inbound via `outbound.service.ts` → `order.outbound.*` → admin+client patches; dashboard schedule; **no dedicated reservation wire event** (`StockReserved` covered only when `inventory.changed` / OMS allocate side-effects fire).

| Works | **Partial** — order path good; reservation/available qty consistency incomplete unless inventory.changed fired; client dashboard keys not updated |

---

### 3.4 OMS / COD (§2.4)

#### OMS order lifecycle (`OmsCreated` … `OmsCompleted`, allocate, fulfillment)

| # | Answer |
|---|--------|
| Service | `oms-orders.service.ts`, `oms-outbound-sync.service.ts` |
| Emit | **Yes** — single `oms.order.event` with payload `{ orderId, status, event }` (e.g. `oms.approved`, `oms.delivered`) |
| Room | company |
| Admin FE | **invalidate** OMS list/detail, OMS dashboard, outbound, admin overview |
| Client FE | **invalidate** ecommerce-orders, outbound, cod-report — **not** `['client','dashboard',…]` |
| UI | Yes after refetch from invalidation |
| Other tab/user | Yes (company room) |
| Admin OMS Dashboard | Partial push via invalidate + **60s polling** |
| Client Portal | Partial (order pages yes; dashboard no) |
| Polling | **Yes** — OMS dashboard 60s |
| **Works** | **Partial** |

#### `CodCollected` / `CodRemitted` / `CodSettled`

| # | Answer |
|---|--------|
| Service | `cod-records.service.ts` (+ OMS status updates) |
| Emit | **No dedicated COD socket.** OMS may emit `oms.order.event` if COD tied to order status update; COD service itself has **no RealtimeService** |
| Client `/my-profits` | Only refreshed if `oms.order.event` invalidates `cod-report` — not on all COD transitions |
| Admin `/oms/cod` | No dedicated listener |
| **Works** | **Missing** / **Partial** at best via OMS side-effect |

---

### 3.5 Returns (§2.5)

#### WMS returns (`WmsReturn*`)

| # | Answer |
|---|--------|
| Service | `returns.service.ts` |
| Emit | `return.created/updated/confirmed/completed` to company room |
| Admin FE | Yes — `ops-cache` patches |
| Client FE | **No** return.* listeners; client uses `['client','returns']` / `oms-returns` — **stale** |
| Inventory on post | `return-workflow.service.ts` posts stock **without** `emitInventoryChanged` |
| **Works** | **Partial** (admin return UI) / **Missing** (client + stock fan-out) |

#### OMS returns (`OmsReturn*`)

| # | Answer |
|---|--------|
| Service | `oms-returns.service.ts` |
| Emit | **None** |
| FE | Admin OMS returns + client ecommerce returns — no socket path |
| **Works** | **Missing** |

---

### 3.6 Products / Stock (§2.6)

#### `ProductCreated/Updated/Deleted/Archived`

| Emit | product.* company room |
| Admin | Yes patches |
| Client | created/updated/archived yes; **deleted** not listened on client |
| **Works** | **Partial** (admin Complete-ish; client missing deleted) |

#### `StockChanged` / `StockReserved` / `StockReleased` / `StockAdjusted` / `InternalTransferCompleted` / `LedgerLinePosted`

| Path | Emit inventory.changed? |
|------|-------------------------|
| Inbound receive | Yes |
| Outbound ship / task complete | Yes |
| Adjustment approve | Yes |
| Internal transfer | Yes |
| Return inventory post | **No** |
| Cycle count post/reconcile | **No** |
| OMS allocate/release | Via `oms.order.event` + sometimes outbound; **no** dedicated reservation payload always |

| Admin FE | `patchInventoryChanged` |
| Client FE | stock row patch + invalidate products |
| Client dashboard stock widget | **Not** invalidated (`['client','dashboard','stock']`) |
| **Works** | **Partial** |

---

### 3.7 Tasks / Workflow / Cycle Count (§2.7)

#### Task*

| Emit | `task.updated` (+ inventory on some completions) |
| Admin | `tasks-cache` patches queues/detail/workflows |
| Client | Treats `task.updated` as inventory-only (stock) — does **not** need task UI; order stage relies on inbound/outbound/OMS updates |
| Dashboard tasks | scheduleDashboard → master-data |
| **Works** | **Partial** (admin task floor strong; client order stage depends on order emits) |

#### CycleCount*

| Emit | cycle_count.* only |
| Admin | ops-cache + my-tasks patches |
| Stock after post | **Missing** inventory.changed |
| Client | N/A for execute UI; stock should update — **doesn't** |
| **Works** | **Partial** |

---

### 3.8 Notifications / Documents / Billing / Platform (§2.8)

#### Notification*

| Emit | Yes to user room (and company fan-out patterns for some creates) |
| Admin + Client | Listen created/read; client **missing** `notification.deleted` |
| Badge/inbox | Yes when connected |
| **Works** | **Partial** (deleted on client; billing-driven notifications exist but domain billing UI still stale) |

#### DocumentGenerated / DocumentSlotOverride / FinalContractCreated

| Emit | **None** |
| **Works** | **Missing** |

#### Invoice* / Plan* / CapacityChanged

| Emit | **None** (notifications only for some billing emails/alerts) |
| Admin billing pages / Client billing | Stale until navigation |
| **Works** | **Missing** |

#### FormSubmitted

| Emit | **None** |
| **Works** | **Missing** |

#### BackupJob*

| Emit | **None** |
| FE | **Polling** primary |
| **Works** | **Missing** (push) — polling substitute |

#### AuditLogCreated

| Emit | Yes → master-data |
| Admin | activity-cache patch |
| Matrix priority | Low–Medium optional live tail |
| **Works** | **Complete** for admin live-tail (optional) |

#### Presence* 

| Matrix | **Out of Scope** |
| Impl | Emits + admin listeners exist |
| Score | **N/A — Out of Scope** (over-implementation) |

---

## 4. Consistency Rule Verification (§3)

| Rule | Result | Notes |
|------|--------|-------|
| §3.1 Company / Billing Restrict | **Fail** | No company/billing domain emits; session gate not forced |
| §3.2 Inbound Confirm→Complete | **Partial** | Orders + admin dashboard partial; client dashboard stale; docs not live |
| §3.3 Outbound Release→Ship | **Partial** | Orders good; reservations/stock sometimes; client dashboard stale |
| §3.4 OMS→Delivered/COD | **Partial** | OMS invalidate works; COD dedicated missing; polling on OMS dashboard; client dashboard stale |
| §3.5 Stock Changed all paths | **Fail** | Return post + cycle count post silent on inventory |
| §3.6 Task Assign/Start/Complete | **Partial** | Admin strong; client stage depends on order events |
| §3.7 Notification Created/Read | **Partial** | Core works; client deleted missing |
| §3.8 Return→Inventory Posted | **Fail** | Admin return status yes; client no; stock emit missing |
| §3.9 Invoice/Plan Suspend | **Fail** | Notifications only |
| §3.10 Adjustment Approve | **Partial→Near Complete** | adjustment + inventory.changed + admin caches; client stock yes; client dashboard keys no |

---

## 5. Coverage Table

Works values: **Complete** | **Partial** | **Missing** | **N/A**

| Feature | Expected Realtime | Backend Event (Matrix) | Socket Emit | Frontend Listen | Cache Update | UI Updates | Works | Gap |
|---------|-------------------|------------------------|-------------|-----------------|--------------|------------|-------|-----|
| Session force logout / expiry | Critical push SameUser | UserSessionExpired / Logout | `auth.session.changed` | Admin listens; CustomEvent unused; Client none | No AuthContext update | No | Partial | G-AUTH-01 |
| User deactivate / role revoke session | Critical | UserDeactivated / RoleChanged | user.* only; no session revoke | Admin user list only | User list patch | List yes; session no | Partial | G-AUTH-02 |
| Company suspend/activate/archive | Critical | Company* | None | None | None | No | Missing | G-CO-01 |
| Billing restrict / lift | Critical | BillingRestricted* | None (notif only) | Notif only | Notif only | Banner stale | Missing | G-BILL-01 |
| Inbound list/detail admin | Critical | Inbound* | order.inbound.* | Yes | Patch | Yes | Partial | G-IN-01 |
| Inbound list/detail client | Critical | Inbound* | order.inbound.* | Yes | Patch | Yes | Partial | G-IN-01 |
| Inbound → Admin dashboard | High | Inbound* | dashboard.orders.* | Yes (master-data) | Patch overview | Yes if admin socket on tenant | Partial | G-DASH-01 |
| Inbound → Client dashboard | High | Inbound* | (order events) | No dashboard key invalidate | No | Stale | Missing | G-CL-DASH-01 |
| Outbound list/detail admin+client | Critical | Outbound* | order.outbound.* | Yes both | Patch | Yes | Partial | G-OUT-01 |
| Stock reserved/released | Critical | StockReserved/Released | Often missing dedicated; sometimes inventory/OMS | Partial | Partial | Partial | Partial | G-STOCK-01 |
| OMS orders admin | Critical | Oms* | oms.order.event | Invalidate | Invalidate | Yes | Partial | G-OMS-01 |
| OMS orders client | Critical | Oms* | oms.order.event | Invalidate ecommerce | Invalidate | Yes | Partial | G-OMS-01 |
| OMS admin dashboard | High | Oms* | oms.order.event + poll 60s | Invalidate + poll | Invalidate | Yes (poll) | Partial | G-OMS-02 |
| Client OMS dashboard widgets | High | Oms* | — | No | No | Stale | Missing | G-CL-DASH-01 |
| COD collect/remit/settle | High | Cod* | None dedicated | Client cod-report only via OMS invalidate | Partial | Partial | Missing | G-COD-01 |
| WMS returns admin | High | WmsReturn* | return.* | Yes | Patch | Yes | Partial | G-RET-01 |
| WMS/OMS returns client | High | Return* | WMS return.* unused; OMS none | None | None | Stale | Missing | G-RET-02 |
| OMS returns admin | High | OmsReturn* | None | None | None | Stale | Missing | G-RET-03 |
| Return inventory post → stock | Critical | StockChanged | None | N/A | N/A | Stale stock | Missing | G-STOCK-02 |
| Products admin | Medium | Product* | product.* | Yes | Patch | Yes | Complete | — |
| Products client | Medium/Critical stock | Product* | product.* (no deleted listen) | Partial | Partial | Partial | Partial | G-PROD-01 |
| Inventory admin | Critical | StockChanged | inventory.changed | Yes | Patch | Yes when emitted | Partial | G-STOCK-02/03 |
| Inventory client products/stock | Critical | StockChanged | inventory.changed | Yes | Patch + invalidate products | Yes when emitted | Partial | G-STOCK-02 |
| Adjustments approve | Critical | StockAdjusted | adjustment.approved + inventory.changed | Yes admin | Patch | Yes | Partial | G-CL-DASH-01 |
| Internal transfer | Critical | InternalTransferCompleted | transfer.* + inventory.changed | Admin yes; transfer.created no-op | Completed patch | Yes | Partial | G-TR-01 |
| Tasks admin queues/detail | Critical | Task* | task.updated | Yes | Patch | Yes | Partial | G-TASK-01 |
| Cycle count admin | High/Critical | CycleCount* | cycle_count.* | Yes | Patch | Yes | Partial | G-CC-01 |
| Cycle count → stock | Critical | CycleCountPosted→Stock | No inventory.changed | N/A | N/A | Stale | Missing | G-STOCK-03 |
| Notifications admin | High | Notification* | notification.* | Yes | Patch | Yes | Complete | — |
| Notifications client | High | Notification* | created/read; no deleted | Partial | Partial | Partial | Partial | G-NOTIF-01 |
| Documents GRN/DN | High | DocumentGenerated | None | None | None | Stale | Missing | G-DOC-01 |
| Final contracts | Medium | FinalContractCreated | None | None | None | Stale | Missing | G-DOC-02 |
| Invoices / plans UI | High/Critical | Invoice*/Plan* | None | None | None | Stale | Missing | G-BILL-02 |
| Forms inbox | Medium | FormSubmitted | None | None | None | Stale | Missing | G-FORM-01 |
| Backup job progress | High | BackupJob* | None | Polling | Poll | Poll only | Missing | G-BAK-01 |
| Audit log live tail | Low–Medium | (append) | audit_log.created | Yes admin | Patch | Yes | Complete | — |
| Warehouses/locations | Low | (master) | warehouse/location.* | Yes admin | Patch/invalidate | Yes | Complete | — |
| Users list admin | Medium/Critical session | User* | user.* | Yes | Patch | List yes | Partial | G-AUTH-02 |
| Presence indicators | Out of Scope | — | presence.* | Yes admin | Patch | Yes | N/A | Over-impl |
| Reports mid-session | Out of Scope | — | None | None | — | — | N/A | — |
| Client billing/invoices pages | Critical–High | Invoice*/Plan*/Restrict | None | None | None | Stale | Missing | G-BILL-01/02 |
| Client account-inactive gate | Critical | Company*/Billing* | None | None | None | Stale until API fail | Missing | G-CO-01 |

---

## 6. Realtime Gap Report

### G-AUTH-01 — Session force-logout UI dead

- **Why:** Backend emits `auth.session.changed`; admin dispatches `wms:session-changed`; **no listener** clears auth / redirects. Client has **zero** session socket handling.
- **Backend:** `backend/src/modules/auth/auth.service.ts`
- **Frontend:** `frontend/src/realtime/RealtimeProvider.tsx` (emitter of CustomEvent); missing consumer in `AuthContext` / layout. Client: `client-frontend/src/realtime/RealtimeProvider.tsx`
- **Missing socket event:** None (exists); missing **consumption**
- **Missing listener:** Auth logout handler on both apps
- **Missing cache:** Session/auth state clear

### G-AUTH-02 — User deactivate / role change does not revoke live session

- **Why:** `users.service.ts` emits `user.updated/deleted` for lists only; does not emit `auth.session.changed` with `forced_logout` to target user room.
- **Backend:** `backend/src/modules/users/users.service.ts`
- **Frontend:** Would need G-AUTH-01 consumer
- **Missing socket event:** `auth.session.changed` on deactivate/role change
- **Missing listener:** Same as G-AUTH-01
- **Missing cache:** Auth clear

### G-CO-01 — Company lifecycle silent

- **Why:** `customer-lifecycle.service.ts` has no `RealtimeService` inject/emit. Matrix §3.1 requires portal gate + admin client badges + dashboards.
- **Backend:** `backend/src/modules/companies/customer-lifecycle.service.ts`
- **Frontend:** Admin clients pages; client `account-inactive` / operational access hooks — no socket invalidation
- **Missing socket event:** e.g. `company.lifecycle.changed` (or Matrix-equivalent)
- **Missing listener:** Admin clients + Client portal gate
- **Missing cache:** Clients list/detail; client access/billing banners; dashboard billing widgets

### G-BILL-01 — Billing restriction not push

- **Why:** Restriction happens in billing cycle processor / access; only optional notifications. No domain billing socket; client banner uses HTTP fetch.
- **Backend:** `billing-cycle-processor.service.ts`, `billing-access.service.ts`, `billing-notifications.service.ts`
- **Frontend:** Client `useClientOperationalAccess`, BillingRestrictionBanner; admin billing dashboard
- **Missing socket event:** `billing.restriction.changed` / company status
- **Missing listener:** Client portal + admin billing widgets
- **Missing cache:** Operational access queries; billing dashboard; company badges

### G-BILL-02 — Invoices / plans not realtime

- **Why:** `billing-invoices.service.ts` / plans / cycles never call RealtimeService (except unrelated notif helper).
- **Backend:** `billing-invoices.service.ts`, `billing-plans.service.ts`, `billing-cycles.service.ts`
- **Frontend:** Admin `/billing/*`; Client `/billing`, `/invoices`
- **Missing socket event:** `invoice.*`, `plan.*`
- **Missing listener:** Both apps billing query keys
- **Missing cache:** Invoice/plan lists/details; dashboards

### G-IN-01 / G-OUT-01 — Order path Partial (consistency)

- **Why:** Core list/detail push works; Matrix Consistency still requires client dashboard, notifications (when product requires), documents — incomplete siblings.
- **Backend:** inbound/outbound services OK for order emits
- **Frontend:** Client dashboard keys not wired; documents missing
- **Gap siblings:** G-CL-DASH-01, G-DOC-01, G-NOTIF (when not emitted)

### G-OMS-01 — OMS uses invalidate-only + coarse event

- **Why:** Single `oms.order.event`; admin/client invalidate. Works but no patch; easy to miss query keys (client dashboard missed).
- **Backend:** `oms-orders.service.ts`
- **Frontend:** both RealtimeProviders OMS handlers
- **Missing:** Broader invalidation set; optional richer payload patches
- **Missing cache keys:** `['client','dashboard',…]`, admin billing widgets if affected

### G-OMS-02 — OMS dashboard polling-primary

- **Why:** `OmsDashboardPage.tsx` `refetchInterval: 60_000` violates Matrix No Polling as primary.
- **Backend:** emits exist via OMS + dashboard schedule (overview, not OMS-specific KPIs)
- **Frontend:** `frontend/src/pages/OmsDashboardPage.tsx`
- **Missing socket event:** OMS-dashboard-specific push (or rely fully on oms.order.event without poll)
- **Missing listener:** Push-only refresh path
- **Missing cache:** Replace poll with invalidate/patch only

### G-COD-01 — COD domain silent

- **Why:** `cod-records.service.ts` has no RealtimeService. Admin COD + client my-profits stale unless incidental OMS event.
- **Backend:** `backend/src/modules/cod/cod-records.service.ts`
- **Frontend:** Admin OMS COD page; client `CodReportsPage` / dashboard COD cards
- **Missing socket event:** `cod.updated` (or Matrix Cod*)
- **Missing listener:** Both COD UIs + client dashboard COD keys
- **Missing cache:** `cod-report`, dashboard COD queries, OMS COD workspace

### G-RET-01 — Return admin without stock fan-out

- **Why:** return.* emitted; inventory.changed not on post.
- **Backend:** `returns.service.ts`, `return-workflow.service.ts`
- **Frontend:** Admin ops-cache OK for return entity
- **Missing socket event:** `inventory.changed` on post
- **Missing listener:** N/A if emit added
- **Missing cache:** Stock/product/client inventory

### G-RET-02 — Client returns not listening

- **Why:** Client RealtimeProvider has no `return.*` handlers; query keys `['client','returns']`, `oms-returns` never patched.
- **Backend:** WMS return emits exist but unused by client
- **Frontend:** `client-frontend/src/realtime/RealtimeProvider.tsx`
- **Missing socket event:** Consumption of `return.*`; OMS return emits (G-RET-03)
- **Missing listener:** return.* on client
- **Missing cache:** client returns lists/details + dashboard returns

### G-RET-03 — OMS returns fully silent

- **Why:** `oms-returns.service.ts` never emits.
- **Backend:** `backend/src/modules/oms-returns/oms-returns.service.ts`
- **Frontend:** Admin `/oms/returns`; client ecommerce returns
- **Missing socket event:** `oms.return.*` or reuse return/OMS event
- **Missing listener:** Admin + client
- **Missing cache:** OMS returns queries

### G-STOCK-01 — Reservations not first-class

- **Why:** Matrix StockReserved/Released; implementation folds into OMS/outbound/inventory irregularly.
- **Backend:** allocate/release in OMS/outbound
- **Frontend:** available/reserved displays may stay stale
- **Missing socket event:** Explicit reservation payload or guaranteed inventory.changed with reserved fields
- **Missing listener/cache:** Stock available vs reserved on admin+client

### G-STOCK-02 — Return post stock silent

- See G-RET-01. Critical Matrix §3.5 / §3.8 failure.

### G-STOCK-03 — Cycle count post stock silent

- **Why:** `cycle-count.service.ts` emits cycle_count.* only; variance reconcile does not call `emitInventoryChanged`.
- **Backend:** `cycle-count.service.ts` (+ variance services if separate)
- **Frontend:** Admin cycle UI OK; stock pages stale
- **Missing socket event:** `inventory.changed`
- **Missing listener:** N/A
- **Missing cache:** inventory/product/client stock

### G-PROD-01 — Client product.deleted

- **Why:** Client listens archived not deleted.
- **Frontend:** `client-frontend/src/realtime/RealtimeProvider.tsx`
- **Missing listener:** `product.deleted`
- **Missing cache:** product list removal

### G-TASK-01 — Task→client order stage coupling

- **Why:** Client ignores task payloads for stage; depends on order updated/OMS events. Usually OK if those always emit with stage; risk if task completes without order emit.
- **Backend:** `warehouse-tasks.service.ts` emits task; parent order emit not always paired
- **Frontend:** Client order caches
- **Gap:** Ensure order/OMS emit on every stage-advancing task completion (consistency)

### G-CC-01 — Cycle count Partial

- Admin entity live; stock fan-out missing (G-STOCK-03); no client need for execute UI.

### G-TR-01 — transfer.created no-op on admin FE

- **Why:** Listener registered; `patchTransferCreated` effectively no-op per earlier inventory; completed works.
- **Frontend:** `ops-cache.ts` / RealtimeProvider
- **Low** priority vs Matrix

### G-NOTIF-01 — Client notification.deleted

- **Backend:** emit exists
- **Frontend:** client provider missing listener
- **Missing cache:** delete from inbox

### G-DOC-01 / G-DOC-02 — Documents & contracts silent

- **Backend:** documents / final-contracts modules — no RealtimeService
- **Frontend:** contracts pages, order document panels
- **Missing socket event:** `document.generated`, `final_contract.created`
- **Missing listener/cache:** contracts lists; order detail document panels

### G-FORM-01 — Forms inbox silent

- **Backend:** forms module — no emit
- **Frontend:** `/forms`
- **Missing:** `form.submitted` + admin listener + forms query patch

### G-BAK-01 — Backups polling-only

- **Why:** No backup socket events; FE polls status endpoints.
- **Backend:** `backups/*`
- **Frontend:** `useBackupRunningStatusPoll.ts`, Backup* pages
- **Missing socket event:** `backup.job.progress/completed/failed`
- **Missing listener:** settings backup pages
- **Missing cache:** Replace refetchInterval with push patches

### G-CL-DASH-01 — Client dashboard query island

- **Why:** Dashboard uses distinct keys `['client','dashboard',…]` never invalidated by OMS/inventory/notification handlers.
- **Frontend:** `DashboardPage.tsx` + `RealtimeProvider.tsx`
- **Missing cache invalidation:** All client dashboard keys on Oms*, Stock*, Notification*, Return*, Cod*, Billing*

### G-DASH-01 — Admin dashboard scope / billing widgets

- **Why:** Operational dashboard.* patches via master-data work for overview orders/tasks/inventory; **billing widgets** on overview not driven by company/billing emits (silent).
- **Missing:** Company/billing events → dashboard billing widget invalidation/patch

---

## 7. Duplicate Implementation Notes

| Area | Note |
|------|------|
| OMS live data | Socket invalidate **and** 60s poll on OMS dashboard (duplicate + poll gap) |
| Presence | Fully implemented though Matrix Out of Scope |
| Notifications | Three producers (admin, client, billing) share same wire events — OK, not harmful duplicate |
| Transport polling | Engine.IO polling fallback ≠ app refetchInterval |

---

## 8. Completeness Affidavit

| Checklist | Status |
|-----------|--------|
| All Matrix §2.1–§2.8 event families traced | Yes |
| All Matrix §3.1–§3.10 consistency rules scored | Yes |
| Out of Scope items excluded from Missing | Yes (Presence, Reports, theme, etc.) |
| Admin + Client pipelines inspected | Yes |
| Polling vs No Polling called out | Yes |
| Silent modules listed | Yes |
| Every Coverage Table row has Works + Gap id or N/A | Yes |

**Verdict (historical, pre-remediation):** Realtime coverage was **strongest** for admin inbound/outbound/tasks/products/notifications/adjustments/inventory (when emit fires). It was **incomplete** vs Product Matrix for sessions, company/billing gates, COD, OMS/client returns, document generation, forms, backups push, return/cycle-count stock fan-out, and client dashboard consistency.

---

## 9. Remediation status (2026-08-04)

Staging implementation closed all Gap IDs in §6. Authoritative closure evidence: [`REALTIME_VERIFICATION_REPORT.md`](./REALTIME_VERIFICATION_REPORT.md).

| Gap ID | Status |
|--------|--------|
| G-AUTH-01, G-AUTH-02 | **Closed** |
| G-CO-01, G-BILL-01, G-BILL-02 | **Closed** |
| G-IN-01, G-OUT-01, G-DASH-01, G-CL-DASH-01 | **Closed** |
| G-OMS-01, G-OMS-02, G-COD-01 | **Closed** |
| G-RET-01, G-RET-02, G-RET-03 | **Closed** |
| G-STOCK-01, G-STOCK-02, G-STOCK-03 | **Closed** |
| G-PROD-01, G-NOTIF-01, G-TASK-01, G-CC-01 | **Closed** |
| G-DOC-01, G-DOC-02, G-FORM-01, G-BAK-01, G-TR-01 | **Closed** |

§7 note: OMS 60s poll removed; BackupJob* is push-primary with documented slow fallback.

---

## Document control

| Field | Value |
|-------|-------|
| Output | `REALTIME_TECHNICAL_AUDIT.md` |
| Companion plan | `REALTIME_IMPLEMENTATION_PLAN.md` |
| Expectation source | `REALTIME_PRODUCT_MATRIX.md` only |
| Remediation proof | `REALTIME_VERIFICATION_REPORT.md` |
