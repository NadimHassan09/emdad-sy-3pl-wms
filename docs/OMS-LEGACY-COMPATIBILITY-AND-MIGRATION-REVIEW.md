# OMS Legacy Compatibility and Migration Review

**Status:** STAGING IMPLEMENTATION COMPLETE — **PRODUCTION = NO-GO**  
**Generated:** 2026-08-14  
**Scope:** Staging-only code + migrations + read-only production dry-run  
**Production DB:** `wms_db` — **NOT mutated**  
**Staging DB:** `wms_db_staging` — checksum repair + new canonicalize migration applied  

---

## Executive answers (required)

| # | Question | Answer |
|---|----------|--------|
| 1 | What does every affected legacy state mean? | See §2–§7 |
| 2 | NEW canonical representation? | See mapping table §8 |
| 3 | Why? | Evidence from OMS+Outbound+tasks+events+reservations+ledger |
| 4 | Any order regress? | **No** — OFD never maps to processing |
| 5 | Legacy code required? | **No** — one NEW workflow |
| 6 | Existing orders continue on NEW workflow? | **Yes** after one-time normalization |
| 7 | New orders same workflow? | **Yes** (`recordExternalFulfillment` + warehouse path) |
| 8 | Task execute twice? | Migration creates **0** tasks; completed WF blocks bootstrap |
| 9 | Inventory twice? | Migration moves **0** inventory; allocate skips active reservations |
| 10 | Carrier shipment twice? | Migration creates **0** AWBs; claim + OMS/outbound guards |
| 11 | Migration call external API? | **No** — SQL data normalization only |
| 12 | Staging affect production? | **No** — separate trees/DB/PM2/nginx |
| 13 | Rollback? | App rollback + verified prod dump; enum not reverse-safe without restore |
| 14 | B7b semantically correct? | OMS `shipped` + outbound `externally_fulfilled` |
| 15 | Delivered+draft correct? | OMS `delivered` + outbound `externally_fulfilled` |
| 16 | Historical events preserved? | **Yes** |
| 17 | Fake operational history? | **No** — only `system.migration.canonicalized` |
| 18 | Orphan state? | **No** — `externally_fulfilled` is first-class NEW |

---

## 1. Commercial vs physical semantics

### OMS commercial `shipped`
Customer-facing “in transit / left fulfillment.” Does **not** alone prove pick, pack, carrier AWB, or dispatch.

### Outbound warehouse `shipped`
Dispatch completed; inventory movement for that outbound already happened.

### Outbound `externally_fulfilled` (NEW)
Warehouse will **not** execute. Fulfillment recorded outside WMS. Valid for new orders via `POST /oms/orders/:id/external-fulfillment` and for historical commercial-only rows.

### Legacy OMS `out_for_delivery` split
| Bucket | Evidence | Meaning |
|--------|----------|---------|
| B5 (663) | outbound `shipped` + completed pick/dispatch + fulfilled reservations + ledger | Physical warehouse dispatch (old name for commercial shipped after WMS ship) |
| B7b (5) | outbound `draft` + no tasks/reservations/ledger/AWB | Commercial shortcut only |

---

## 2–7. Bucket analysis

### B3 — 1185 `pending_approval` (no outbound)
Old “awaiting admin” ≡ NEW `confirmed_waiting_for_admin_approval`. Must **not** become `waiting_for_confirmation`.

### B5 — 663 OFD + outbound shipped
OMS → `shipped`. Warehouse already done. No tasks/shipments/inventory changes.

### B7a — 27 `pending` + outbound `allocated`
OMS → `processing`. Confirm starts NEW pick once; reservations reused.

### B7b — 5 OFD + draft (FORBIDDEN: → processing)
Orders: OMS-2026-00006, 00012, 00015, 00029, 00115.  
→ OMS `shipped` + outbound `externally_fulfilled`. No inventory/carrier/tasks.

### Delivered + draft — 4
OMS stays `delivered`; outbound → `externally_fulfilled`. Terminal commercially.

### Cancelled + shipped — 5
Preserve. Display-only. No remap.

### Completed full returns — 12
OMS `delivered` → `returned` when completed return lines cover all ordered qty (same rule as `maybeMarkOmsFullyReturned`).

### Requested returns
Stay on `delivered`; NEW return flow continues.

### COD
`returned` only when OMS is/will be `returned`. **Not** from `net <= 0` alone. Predicted: **12** COD rows after OMS returned update in same migration.

### 76 cancelled+cancelled active reservations
**Out of scope** — do not auto-release.

### Standalone outbound / inbound
Outside OMS remap; NEW workflow continues. Inbound needs no status remap.

---

## 8. Canonical mapping (production dry-run — read-only)

| Category | Before count | After OMS | After outbound | Safe? |
|----------|-------------:|-----------|----------------|-------|
| B1 rejected | 1 | cancelled | — | YES |
| B3 pending_approval | 1185 | confirmed_waiting_for_admin_approval | — | YES |
| B5 OFD+shipped | 663 | shipped | shipped (unchanged) | YES |
| B7a pending+allocated | 27 | processing | allocated (unchanged) | YES |
| B7b OFD+draft | 5 | shipped | externally_fulfilled | YES |
| delivered+draft | 4 | delivered | externally_fulfilled | YES |
| completed full returns | 12 | returned | unchanged | YES |
| COD (after OMS returned) | 12 | — | COD status returned | YES |
| cancelled+shipped | 5 | unchanged | unchanged | YES |

**Predicted OMS status updates:** ~1893  
**Predicted outbound status updates:** 9 (5 B7b + 4 delivered-draft)  
**Task inserts:** 0  
**Inventory movements:** 0  
**Carrier API / AWB:** 0  

Production proof (2026-08-14): `externally_fulfilled` enum **absent**; `system.migration.canonicalized` events **0**.

---

## 9. Task migration

Migration does not INSERT/UPDATE/DELETE tasks.  
Completed workflows block a second bootstrap (`findFinishedWorkflowForReference`).  
`shipping_details` spawn only when outbound is `picking` / `packing` / `waiting_for_shipping_details`.

---

## 10. Inventory safety

No reservation release, allocate, or ledger writes in migration.  
`tryAllocateOnConfirm` skips when active reservations exist.  
76 cancelled active reservations documented as out of scope.

---

## 11. Carrier / shipment safety

Owner: outbound `ensureShipmentForOutbound` only.  
Partial unique index on in-flight/created rows.  
Guards skip: outbound `externally_fulfilled|shipped|cancelled|delivered|returned`; OMS commercial closed/shipped.  
Migration creates **0** `carrier_shipments` (table does not exist on prod yet).

---

## 12. OMS ↔ Outbound consistency (allowed after normalization)

- `confirmed_waiting_for_admin_approval` + no outbound  
- `processing` + allocated/picking/packing/waiting_for_shipping_details  
- `ready_to_ship` + ready_to_ship  
- `shipped` + shipped  
- `shipped` + externally_fulfilled  
- `delivered` + shipped  
- `delivered` + externally_fulfilled  
- `cancelled` + none/cancelled/shipped  
- `returned` + shipped  

Forbidden live: `shipped`+`draft`, `delivered`+`draft`, primary writes of `out_for_delivery`.

---

## 13. Required NEW-version code (staging)

| Area | Change |
|------|--------|
| Schema | `OutboundOrderStatus.externally_fulfilled` |
| OMS | `recordExternalFulfillment`; transition `record_external_fulfillment` |
| Guards | `oms-warehouse-guards.ts`; confirm gate; workflow bootstrap; shipping_details spawn; carrier ensure |
| COD | `syncReturnedStatusIfNeeded` ignores net≤0 alone |
| UI | OMS “Fulfilled outside warehouse”; outbound status label/filter |
| Migrations | Patched remap (no OFD→processing); COD backfill; canonicalize |

**No** `if (legacyOrder) useOldWorkflow()`.

---

## 14–15. Schema + data migrations

1. `20261112120100_oms_workflow_evidence_status_remap` — **patched**: warehouse-prep UPDATE excludes OMS `out_for_delivery`; ready_to_ship UPDATE excludes OFD.  
2. `20261212140100_cod_record_status_returned_backfill` — **patched**: OMS `returned` only.  
3. `20261214120000_outbound_status_externally_fulfilled` — enum ADD.  
4. `20261214120100_oms_external_fulfillment_canonicalize` — B7b, delivered+draft, full returns, COD, audit events.

Staging: checksums repaired for (1)(2); (4) applied to `wms_db_staging` only.

---

## 16. Dry-run SQL results (production `wms_db`, SELECT only)

See section 8 counts. B7b samples:

- OMS-2026-00006, 00012, 00015, 00029, 00115 — all `out_for_delivery` + `draft` + `out_for_delivery_at` set.

---

## 17. Rollback

| Failure | Action |
|---------|--------|
| App only | Redeploy prod commit `0b82d370` |
| Migrations applied | Restore verified `wms_db` dump — **never** staging dump |
| Enum used | App rollback alone insufficient until reverse SQL or restore |

---

## 18. Testing strategy / results (staging)

Focused Jest suites (2026-08-14):

- **8 suites, 38 tests, all passed**
- Guards, transitions, mapper `externally_fulfilled`, COD lifecycle, outbound stages, shipping skips, same-code-path

---

## 19. Proof: no legacy workflow

- Single `OmsOrdersService` / `OutboundService` / `WorkflowEngineService`
- Same-path unit test asserts no `legacy-oms.service` / `legacy-outbound.service`
- Leftover enum transition keys are thin aliases in the same allow-list

---

## 20. Proof: existing orders use NEW workflow

After normalization, B7b ≡ new `recordExternalFulfillment`; B5 ≡ finished dispatch path; B3 ≡ confirmed waiting; B7a ≡ processing awaiting Confirm.

---

## 21. Proof: new orders use same workflow

Admin CTA “Fulfilled outside warehouse” → same `recordExternalFulfillment`. Warehouse path unchanged: approve → confirm → pick → … → dispatch.

---

## 22. GO / NO-GO

### PRODUCTION = **NO-GO**

Do not backup/migrate/deploy/restart production until a separate explicit GO.

Staging phase is complete for implementation, tests, and read-only dry-run.

---

## Files changed (staging)

### Backend
- `prisma/schema.prisma`
- `prisma/migrations/20261112120100_oms_workflow_evidence_status_remap/migration.sql`
- `prisma/migrations/20261212140100_cod_record_status_returned_backfill/migration.sql`
- `prisma/migrations/20261214120000_outbound_status_externally_fulfilled/migration.sql` (pre-existing)
- `prisma/migrations/20261214120100_oms_external_fulfillment_canonicalize/migration.sql` (**new**)
- `src/modules/oms/oms-warehouse-guards.ts` (**new**)
- `src/modules/oms/oms-order-transitions.ts`
- `src/modules/oms/oms-order.mapper.ts`
- `src/modules/oms/oms-orders.service.ts`
- `src/modules/oms/oms.controller.ts`
- `src/modules/outbound/outbound.service.ts`
- `src/modules/warehouse-workflow/workflow-active.util.ts`
- `src/modules/warehouse-workflow/workflow-engine.service.ts`
- `src/modules/warehouse-workflow/workflow-orchestration.service.ts`
- `src/modules/shipping/shipping.service.ts`
- `src/modules/cod/cod-records.service.ts`
- Unit specs: guards, transitions, COD lifecycle, external fulfillment, shipping, same-path

### Frontend / shared
- `frontend/src/api/oms.ts`, `outbound.ts`
- `frontend/src/pages/OmsOrderDetailPage.tsx`, `OutboundListPage.tsx`
- `frontend/src/components/orders/AdminOutboundOrderSummary.tsx`
- `shared/design-system-next/lib/statusMeta.ts`

### Docs
- `docs/OMS-LEGACY-COMPATIBILITY-AND-MIGRATION-REVIEW.md` (this file)
