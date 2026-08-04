# Realtime Implementation Plan

**Derived from:** [`REALTIME_TECHNICAL_AUDIT.md`](./REALTIME_TECHNICAL_AUDIT.md) Gap Report only  
**Expectation source:** [`REALTIME_PRODUCT_MATRIX.md`](./REALTIME_PRODUCT_MATRIX.md)  
**Rule:** Do not invent features outside the Matrix. Fix gaps in architectural priority order.  
**No Polling:** Push is required; replace polling-primary paths listed below.

---

## Priority bands

1. **P0 — Critical security / stock integrity / approval gates**  
2. **P1 — Critical ops collaboration (orders, tasks, OMS)**  
3. **P2 — High commercial / COD / returns / documents / backups**  
4. **P3 — Medium awareness (forms, charts polish, product.deleted)**  
5. **P4 — Low / cleanup (transfer.created no-op, presence not required)**

Within each band: emit + rooms first, then listeners + cache, then remove polling duplicates.

---

## P0 — Critical

### P0.1 Session force-logout (G-AUTH-01, G-AUTH-02)

| Field | Detail |
|-------|--------|
| Matrix | UserLoggedOut, UserSessionExpired, UserDeactivated, UserRoleChanged — Critical |
| Backend | Ensure deactivate/role/token bump emits `auth.session.changed` `{ type: 'forced_logout' }` to `room:user:{id}` (`users.service.ts` + existing `auth.service.ts`) |
| Rooms | `SameUser` → `room:user:*` (already) |
| Admin FE | Consume `wms:session-changed` (or handle socket directly) in AuthContext → clear token → `/login` |
| Client FE | Listen `auth.session.changed` in `RealtimeProvider` → same logout path |
| Consistency siblings | All tabs SameBrowser/SameUser; account-inactive if company-driven (see P0.2) |
| Done when | Forced logout updates UI without refresh on admin + client; multi-tab |

### P0.2 Company lifecycle + billing restriction gate (G-CO-01, G-BILL-01)

| Field | Detail |
|-------|--------|
| Matrix | CompanySuspended/Activated/Archived/Restored, BillingRestricted/Lifted — §3.1 |
| Backend | Emit domain event from `customer-lifecycle.service.ts` and billing restrict/lift paths (cycle processor / access). Optionally also emit session revoke to all company client users |
| Rooms | `SameCompany` + `ClientPortal` → `tenant:company:{id}`; per-user session → `room:user:*` |
| Admin FE | Patch/invalidate `/clients`, client detail, dashboard billing widgets |
| Client FE | Invalidate operational access + force `/account-inactive` or clear restriction banner |
| Consistency | Admin list/detail + portal gate + banners + dashboard widgets + notifications (existing notif path may remain) |
| Done when | Suspend/restrict closes portal ops without refresh |

### P0.3 StockChanged on return post + cycle count post (G-STOCK-02, G-STOCK-03, G-RET-01)

| Field | Detail |
|-------|--------|
| Matrix | StockChanged, §3.5, §3.8, CycleCountPosted |
| Backend | Call `emitInventoryChanged` from `return-workflow.service.ts` (post lines) and cycle-count variance reconcile / complete when stock posts |
| Rooms | Company room (existing) |
| FE | Existing admin `inventory.changed` + client stock/product listeners |
| Also | Invalidate/patch client dashboard stock keys (P0.4) |
| Done when | Post-return and post-count stock visible admin + client without refresh |

### P0.4 Client dashboard query island (G-CL-DASH-01)

| Field | Detail |
|-------|--------|
| Matrix | Client `/dashboard` live KPIs, attention, inventory, COD, activity — §6.2 |
| Backend | No new emits required if domain emits exist; ensure COD/company/billing emits from P0/P2 |
| Client FE | On OMS, inventory, notification, return, COD, billing/company events: invalidate all `['client','dashboard',…]` keys (or patch) |
| Consistency | Matrix §3.2–§3.5 client dashboard siblings |
| Done when | Dashboard widgets move with ops without refresh |

### P0.5 Reservations guaranteed (G-STOCK-01)

| Field | Detail |
|-------|--------|
| Matrix | StockReserved, StockReleased — Critical |
| Backend | On OMS/outbound allocate & release, always emit `inventory.changed` (or dedicated reservation payload) including available/reserved |
| FE | Ensure admin product stock + client available/reserved update |
| Done when | Allocate/release never leaves available qty stale |

---

## P1 — Critical ops collaboration

### P1.1 OMS pipeline completeness (G-OMS-01, G-OMS-02, G-TASK-01)

| Field | Detail |
|-------|--------|
| Matrix | Oms* + §3.4 + task stage coupling |
| Backend | Keep `oms.order.event`; ensure every fulfillment stage / task completion that changes client-visible status emits OMS or outbound updated |
| Admin FE | Expand invalidate set if needed; **remove 60s refetchInterval** on `OmsDashboardPage.tsx` once push covers KPIs |
| Client FE | Ecommerce + tracking keys (done) + dashboard (P0.4) |
| Done when | OMS pages + dashboards push-only; no poll primary |

### P1.2 Inbound/Outbound consistency siblings (G-IN-01, G-OUT-01, G-DASH-01)

| Field | Detail |
|-------|--------|
| Matrix | §3.2, §3.3 |
| Backend | Order emits already exist; ensure notifications created on submit/confirm when Matrix expects |
| FE | Client dashboard (P0.4); admin overview already via dashboard.*; billing widgets via P0.2 |
| Documents | Handled in P2.3 |
| Done when | Confirm/complete/cancel updates list+detail+dashboard+portal together |

### P1.3 Task floor (G-TASK-01 remainder)

| Field | Detail |
|-------|--------|
| Matrix | Task* Critical — admin already strong |
| Backend | Pair stage-advancing task completion with parent order/OMS emit if not already |
| Admin FE | Existing task.updated patches — verify blocked/failed notification path |
| Done when | No task completion leaves order stage stale on any open viewer |

---

## P2 — High

### P2.1 COD realtime (G-COD-01)

| Field | Detail |
|-------|--------|
| Matrix | CodCollected/Remitted/Settled — High; §3.4 |
| Backend | Emit from `cod-records.service.ts` on status transitions (company room) |
| Admin FE | Listen → invalidate/patch `/oms/cod` + OMS dashboard COD widgets |
| Client FE | Listen → `cod-report` + dashboard COD keys |
| Done when | COD pages update without OMS side-effect luck |

### P2.2 Returns — client + OMS (G-RET-02, G-RET-03)

| Field | Detail |
|-------|--------|
| Matrix | WmsReturn*, OmsReturn* — High/Critical on post |
| Backend | Emit from `oms-returns.service.ts`; WMS return.* already emitted |
| Client FE | Listen `return.*` + OMS return events → patch `['client','returns']`, `oms-returns`, dashboard returns |
| Admin FE | Listen OMS return events → `/oms/returns` |
| Depends | P0.3 stock on WMS post |
| Done when | Both portals see return status live |

### P2.3 Documents & contracts (G-DOC-01, G-DOC-02)

| Field | Detail |
|-------|--------|
| Matrix | DocumentGenerated High; FinalContractCreated Medium |
| Backend | Emit on GRN/DN/final-contract generation |
| Admin FE | Order/task document panels + `/contracts/*` |
| Done when | Document availability appears without refresh |

### P2.4 Billing invoices & plans UI (G-BILL-02)

| Field | Detail |
|-------|--------|
| Matrix | Invoice*, Plan*, CapacityChanged — §3.9 |
| Backend | Emit on issue/pay/cancel/suspend/renew/capacity material change |
| Admin FE | Billing dashboards, plans, invoices |
| Client FE | `/billing`, `/invoices` (+ P0.2 restriction) |
| Done when | Finance + client_admin see status live |

### P2.5 Backup job push (G-BAK-01)

| Field | Detail |
|-------|--------|
| Matrix | BackupJob* High while running; No Polling |
| Backend | Emit progress/completed/failed to super_admin user room (or master-data) |
| Admin FE | Replace `refetchInterval` / `useBackupRunningStatusPoll` primary path with socket patches; polling only as documented fallback if ever needed |
| Done when | Running backup UI is push-based |

### P2.6 Notification deleted on client (G-NOTIF-01)

| Field | Detail |
|-------|--------|
| Matrix | Notification* High |
| Client FE | Listen `notification.deleted` → inbox/badge cache |
| Done when | Delete syncs SameUser on client |

---

## P3 — Medium

### P3.1 Forms inbox (G-FORM-01)

| Field | Detail |
|-------|--------|
| Matrix | FormSubmitted Medium |
| Backend | Emit on public form submit → admin |
| Admin FE | `/forms` list patch/invalidate |
| Room | `SystemWide` / master-data or dedicated admin room |
| Done when | New lead appears without refresh |

### P3.2 Client product.deleted (G-PROD-01)

| Field | Detail |
|-------|--------|
| Client FE | Listen `product.deleted` → remove from lists |
| Done when | Parity with admin |

### P3.3 Internal transfer.created FE (G-TR-01)

| Field | Detail |
|-------|--------|
| Admin FE | Implement or remove dead `transfer.created` handler; completed path already OK |
| Priority | Low-Medium cleanup |

### P3.4 OMS invalidate → patch upgrade (optional hardening of G-OMS-01)

| Field | Detail |
|-------|--------|
| After P1.1 | Prefer payload patches for OMS list/detail to reduce refetch storms; still must cover all Consistency siblings |

---

## P4 — Low / explicit non-work

| Item | Action |
|------|--------|
| Presence (implemented, Matrix Out of Scope) | Do **not** prioritize; leave as-is unless Matrix changes |
| Reports mid-session | Out of Scope — no work |
| Theme/language/settings forms | Out of Scope — no work |
| Audit live-tail | Already Complete — no work |
| Warehouses/locations/products admin | Already Complete — no work |
| Notifications admin | Already Complete — no work |

---

## Suggested implementation sequence (sprints)

| Sprint | Items | Why this order |
|--------|-------|----------------|
| 1 | P0.1 → P0.2 → P0.3 → P0.5 → P0.4 | Security + stock integrity + portal gate + dashboard consistency |
| 2 | P1.1 → P1.2 → P1.3 | OMS/orders/tasks floor without polling |
| 3 | P2.1 → P2.2 → P2.3 → P2.4 | COD, returns, documents, billing UI |
| 4 | P2.5 → P2.6 → P3.* | Backups push, notif polish, forms, leftovers |

---

## Room strategy (Matrix scope → implementation)

| Matrix scope | Implementation target |
|--------------|----------------------|
| SamePage / SameCompany / ClientPortal / AllWarehouseOperators | `tenant:company:{id}` (current) — ensure admin socket always joins correct company |
| SameUser / SameBrowser | `room:user:{id}` + FE multi-tab via same user room |
| AdminDashboard | Today master-data `dashboard.*`; also invalidate company-scoped widgets when billing/company events fire |
| SameWarehouse | **Not implemented** — either add warehouse rooms later or continue company-room broadcast (acceptable if all operators share company tenant socket). Record as known scope gap; company room satisfies multi-operator if all join that company |
| SystemWide | `room:internal:master-data` for admin-only (forms, audit, warehouses) |

---

## Acceptance criteria (100% Matrix coverage)

An engineer is done when:

1. Every Gap ID in `REALTIME_TECHNICAL_AUDIT.md` §6 is Closed or explicitly waived as Matrix Out of Scope.  
2. No Matrix-required feature uses polling as primary (G-OMS-02, G-BAK-01 closed).  
3. Every §3 Consistency Rule fan-out updates all listed siblings without refresh.  
4. Client portal and admin both verified for: session revoke, company restrict, stock post paths, OMS, returns, COD, notifications.  
5. Re-run this audit checklist; Coverage Table Works column is **Complete** or **N/A** for every in-scope row.

> **Status (2026-08-04):** Staging acceptance met — see [`REALTIME_VERIFICATION_REPORT.md`](./REALTIME_VERIFICATION_REPORT.md) and Technical Audit §9.

---

## Document control

| Field | Value |
|-------|-------|
| File | `REALTIME_IMPLEMENTATION_PLAN.md` |
| Input | Technical Audit Gap Report only |
| Expectation | Product Matrix only |
| Code changes in this task | None |
| Remediation proof | `REALTIME_VERIFICATION_REPORT.md` |
