# Gate A — OMS Status Remap Review Pack (Production `wms_db`)

**Generated:** 2026-08-14 (read-only SELECTs against production)  
**Database:** `wms_db` (NOT staging)  
**Migration:** `20261112120100_oms_workflow_evidence_status_remap`  
**Related:** `20261212140100_cod_record_status_returned_backfill`  
**Source staging commit (for SQL):** `1969ce40`  
**Status:** AWAITING HUMAN GO / NO-GO — **no production mutation performed**

---

## 1. Executive summary

| Metric | Count |
|--------|------:|
| Total OMS orders | **2385** |
| Would be remapped by ≥1 OMS bucket | **1881** |
| Would stay on current OMS status (unchanged) | **504** |
| COD rows that would become `returned` | **12** |

This migration **does not delete** orders. It **rewrites statuses** (and some timestamps). Treat as a **business-state change**, not a schema-only migration.

### Current production OMS status distribution

| Current status | Count |
|----------------|------:|
| `pending_approval` | 1185 |
| `out_for_delivery` | 668 |
| `cancelled` | 269 |
| `delivered` | 235 |
| `pending` | 27 |
| `rejected` | 1 |

---

## 2. Full SQL (OMS remap)

From staging file  
`backend/prisma/migrations/20261112120100_oms_workflow_evidence_status_remap/migration.sql`:

```sql
-- Terminal: rejected → cancelled
UPDATE oms_orders
SET status = 'cancelled',
    cancelled_at = COALESCE(cancelled_at, rejected_at, NOW()),
    updated_at = NOW()
WHERE status = 'rejected';

-- Terminal: completed → delivered
UPDATE oms_orders
SET status = 'delivered',
    delivered_at = COALESCE(delivered_at, NOW()),
    updated_at = NOW()
WHERE status = 'completed';

-- Client submitted awaiting admin, no outbound / no fulfillment started
UPDATE oms_orders o
SET status = 'confirmed_waiting_for_admin_approval',
    updated_at = NOW()
WHERE o.status = 'pending_approval'
  AND o.outbound_order_id IS NULL
  AND o.approved_at IS NULL;

-- Client-created draft → waiting_for_confirmation
UPDATE oms_orders o
SET status = 'waiting_for_confirmation',
    updated_at = NOW()
WHERE o.status = 'draft'
  AND o.outbound_order_id IS NULL
  AND o.confirmed_at IS NULL
  AND o.approved_at IS NULL
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = o.created_by
      AND u.role IN ('client_admin', 'client_staff')
  );

-- Outbound left warehouse → shipped
UPDATE oms_orders o
SET status = 'shipped',
    out_for_delivery_at = COALESCE(o.out_for_delivery_at, NOW()),
    updated_at = NOW()
FROM outbound_orders oo
WHERE o.outbound_order_id = oo.id
  AND o.status IN ('out_for_delivery', 'pending', 'processing', 'ready_to_ship', 'picking', 'packing', 'allocated', 'approved', 'confirmed')
  AND oo.status IN ('shipped', 'out_for_delivery')
  AND o.status <> 'delivered'
  AND o.status <> 'cancelled'
  AND o.status <> 'failed_delivery'
  AND o.status <> 'returned';

-- Outbound ready_to_ship → ready_to_ship (OMS)
UPDATE oms_orders o
SET status = 'ready_to_ship',
    updated_at = NOW()
FROM outbound_orders oo
WHERE o.outbound_order_id = oo.id
  AND oo.status = 'ready_to_ship'
  AND o.status IN ('pending', 'processing', 'picking', 'packing', 'allocated', 'approved', 'confirmed', 'out_for_delivery')
  AND o.status <> 'shipped'
  AND o.status <> 'delivered';

-- Outbound in warehouse prep → processing
UPDATE oms_orders o
SET status = 'processing',
    updated_at = NOW()
FROM outbound_orders oo
WHERE o.outbound_order_id = oo.id
  AND oo.status IN (
    'draft', 'pending_approval', 'pending_stock', 'confirmed',
    'allocated', 'picking', 'packing'
  )
  AND o.status IN (
    'pending', 'approved', 'confirmed', 'allocated', 'picking', 'packing',
    'processing', 'out_for_delivery'
  );
```

### COD backfill SQL (`20261212140100`)

```sql
UPDATE cod_records cr
SET status = 'returned',
    updated_at = NOW()
FROM oms_orders oo
WHERE oo.id = cr.oms_order_id
  AND cr.status::text <> 'returned'
  AND (
    oo.status = 'returned'
    OR (
      cr.original_amount
        + COALESCE(
          (SELECT SUM(a.amount) FROM cod_adjustments a WHERE a.cod_record_id = cr.id),
          0
        )
    ) <= 0
  );
```

---

## 3. Buckets on live production (exact predicates)

| Bucket | Current → New | Reason | Count |
|--------|---------------|--------|------:|
| **B1** | `rejected` → `cancelled` | Terminal synonym cleanup | **1** |
| **B2** | `completed` → `delivered` | Terminal synonym cleanup | **0** |
| **B3** | `pending_approval` → `confirmed_waiting_for_admin_approval` | Awaiting admin; no outbound; not approved | **1185** |
| **B3b** | `pending_approval` but NOT matching B3 | Would stay `pending_approval` | **0** |
| **B4** | client `draft` → `waiting_for_confirmation` | Client draft, no confirm/approve/outbound | **0** |
| **B5** | (see breakdown) → `shipped` | Linked outbound already `shipped` / `out_for_delivery` | **663** |
| **B6** | → `ready_to_ship` | Outbound `ready_to_ship` | **0** |
| **B7** | → `processing` | Outbound still in warehouse prep | **32** |

### B5 composition (all 663)

| OMS current | Outbound current | Count | New OMS |
|-------------|------------------|------:|---------|
| `out_for_delivery` | `shipped` | **663** | `shipped` |

Interpretation: production already marked OMS as `out_for_delivery` when outbound was `shipped`. Remap renames OMS label to the new workflow status `shipped`.

### B7 composition (all 32) — **review carefully**

| OMS current | Outbound current | Count | New OMS | Risk note |
|-------------|------------------|------:|---------|-----------|
| `pending` | `allocated` | **27** | `processing` | Plausible: warehouse allocated, OMS still legacy `pending` |
| `out_for_delivery` | `draft` | **5** | `processing` | **Suspicious inconsistency** — OMS says OFD but outbound is still `draft`. Remapping OFD → `processing` looks **wrong**. Prefer exclude or fix data manually. |

---

## 4. Sample production orders

### B1 — `rejected` → `cancelled` (1/1)

| Order | Current | New | rejected_at |
|-------|---------|-----|-------------|
| OMS-2026-00272 | rejected | cancelled | 2026-08-04 |

### B3 — `pending_approval` → `confirmed_waiting_for_admin_approval` (sample 10 of 1185)

All sampled rows: `outbound_order_id IS NULL`, `approved_at IS NULL`.

| Order | Company | Current | New |
|-------|---------|---------|-----|
| OMS-2026-02403 | Mr Jad | pending_approval | confirmed_waiting_for_admin_approval |
| OMS-2026-02401 | Mr Jad | pending_approval | confirmed_waiting_for_admin_approval |
| OMS-2026-02399 | Mr Jad | pending_approval | confirmed_waiting_for_admin_approval |
| OMS-2026-02398 | Mr Jad | pending_approval | confirmed_waiting_for_admin_approval |
| OMS-2026-02397 | Mr Jad | pending_approval | confirmed_waiting_for_admin_approval |
| OMS-2026-02396 | Mr Jad | pending_approval | confirmed_waiting_for_admin_approval |
| OMS-2026-02395 | Mr Jad | pending_approval | confirmed_waiting_for_admin_approval |
| OMS-2026-02394 | Mr Jad | pending_approval | confirmed_waiting_for_admin_approval |
| OMS-2026-02393 | Mr Jad | pending_approval | confirmed_waiting_for_admin_approval |
| OMS-2026-02392 | Mr Jad | pending_approval | confirmed_waiting_for_admin_approval |

**Decision needed:** Is renaming **all 1185** waiting-admin orders to the new enum value acceptable for UI/filters/reports?

### B5 — `out_for_delivery` → `shipped` (sample 10 of 663)

| OMS order | Outbound | OMS current | Outbound current | New OMS |
|-----------|----------|-------------|------------------|---------|
| OMS-2026-02031 | OUT-2026-01050 | out_for_delivery | shipped | shipped |
| OMS-2026-02030 | OUT-2026-01049 | out_for_delivery | shipped | shipped |
| OMS-2026-02021 | OUT-2026-01048 | out_for_delivery | shipped | shipped |
| OMS-2026-02019 | OUT-2026-01047 | out_for_delivery | shipped | shipped |
| OMS-2026-02018 | OUT-2026-01046 | out_for_delivery | shipped | shipped |
| OMS-2026-02013 | OUT-2026-01044 | out_for_delivery | shipped | shipped |
| OMS-2026-02011 | OUT-2026-01043 | out_for_delivery | shipped | shipped |
| OMS-2026-02008 | OUT-2026-01042 | out_for_delivery | shipped | shipped |
| OMS-2026-02005 | OUT-2026-01041 | out_for_delivery | shipped | shipped |
| OMS-2026-02003 | OUT-2026-01040 | out_for_delivery | shipped | shipped |

**Decision needed:** Confirm that commercial “shipped” is the intended label for these already-dispatched orders (outbound `shipped`).

### B7a — `pending` + outbound `allocated` → `processing` (27)

Examples:

| OMS | Outbound | Current OMS | Current Outbound | New OMS |
|-----|----------|-------------|------------------|---------|
| OMS-2026-01677 | OUT-2026-00465 | pending | allocated | processing |
| OMS-2026-01640 | OUT-2026-00539 | pending | allocated | processing |
| OMS-2026-01634 | OUT-2026-00522 | pending | allocated | processing |
| OMS-2026-01302 | OUT-2026-00323 | pending | allocated | processing |
| OMS-2026-01291 | OUT-2026-00310 | pending | allocated | processing |

*(Full list of all 27 captured in query output; available on request.)*

### B7b — HIGH RISK — `out_for_delivery` + outbound `draft` → `processing` (5)

| OMS | Outbound | Current OMS | Current Outbound | Proposed new | Recommendation |
|-----|----------|-------------|------------------|--------------|----------------|
| OMS-2026-00115 | OUT-2026-00065 | out_for_delivery | draft | processing | **Exclude / investigate** |
| OMS-2026-00029 | OUT-2026-00040 | out_for_delivery | draft | processing | **Exclude / investigate** |
| OMS-2026-00015 | OUT-2026-00032 | out_for_delivery | draft | processing | **Exclude / investigate** |
| OMS-2026-00012 | OUT-2026-00029 | out_for_delivery | draft | processing | **Exclude / investigate** |
| OMS-2026-00006 | OUT-2026-00024 | out_for_delivery | draft | processing | **Exclude / investigate** |

These look like **data inconsistencies**. Applying B7 as written would move them **backward** in the commercial workflow (`out_for_delivery` → `processing`).

Extra timestamps (read-only):

| OMS | Outbound | OMS OFD at | OMS approved/confirmed | Outbound shipped_at |
|-----|----------|------------|------------------------|---------------------|
| OMS-2026-00006 | OUT-2026-00024 | 2026-07-30 10:10 | 2026-07-30 10:10 | null |
| OMS-2026-00012 | OUT-2026-00029 | 2026-08-02 14:40 | 2026-07-31 20:09 | null |
| OMS-2026-00015 | OUT-2026-00032 | 2026-08-02 14:41 | 2026-07-31 20:09 | null |
| OMS-2026-00029 | OUT-2026-00040 | 2026-08-02 14:42 | 2026-08-01 10:53 | null |
| OMS-2026-00115 | OUT-2026-00065 | 2026-08-02 13:41 | 2026-08-02 13:41 | null |

All five: company **Mr Jad**, outbound still `draft`, no outbound `shipped_at`. OMS already has `out_for_delivery_at`. **Investigate in admin UI before any remap GO.**

---

## 5. Orders that will NOT be remapped (unchanged) — 504

| OMS status | Outbound status | Count | Why unchanged |
|------------|-----------------|------:|---------------|
| `delivered` | `shipped` | 231 | Already terminal / not in UPDATE sources |
| `cancelled` | (none) | 168 | Terminal |
| `cancelled` | `cancelled` | 96 | Terminal |
| `cancelled` | `shipped` | 5 | Terminal OMS |
| `delivered` | `draft` | 4 | Already delivered (odd outbound; left alone) |

No remaining `out_for_delivery` rows outside B5/B7 — the 668 OFD orders are exactly **663 B5 + 5 B7b**.

---

## 6. COD rows affected (12) — all via `net_amount_leq_0`

None are `oms.status = returned`. All have adjustments that zero (or reverse) the original amount while OMS is **`delivered`**.

| COD id (short) | Current COD | New | OMS order | OMS status | original | adjustments | Reason |
|----------------|-------------|-----|-----------|------------|----------|-------------|--------|
| 64cd8e11… | available | returned | OMS-2026-00005 | delivered | 85 | -85 | net ≤ 0 |
| 59df78b7… | pending | returned | OMS-2026-00571 | delivered | 60 | -60 | net ≤ 0 |
| b3020758… | pending | returned | OMS-2026-00573 | delivered | 60 | -60 | net ≤ 0 |
| 9dd70084… | pending | returned | OMS-2026-01023 | delivered | 60 | -60 | net ≤ 0 |
| 62c516d1… | pending | returned | OMS-2026-01025 | delivered | 60 | -60 | net ≤ 0 |
| ac4a30b8… | pending | returned | OMS-2026-01027 | delivered | 60 | -60 | net ≤ 0 |
| c2b2efed… | pending | returned | OMS-2026-01029 | delivered | 60 | -60 | net ≤ 0 |
| e2e3a1b9… | pending | returned | OMS-2026-01071 | delivered | 60 | -60 | net ≤ 0 |
| cd25449d… | pending | returned | OMS-2026-01072 | delivered | 60 | -60 | net ≤ 0 |
| f1379638… | pending | returned | OMS-2026-01083 | delivered | 60 | -60 | net ≤ 0 |
| d3d2dee7… | pending | returned | OMS-2026-01096 | delivered | 60 | -60 | net ≤ 0 |
| 2ee634a6… | pending | returned | OMS-2026-01333 | delivered | 60 | -60 | net ≤ 0 |

**Decision needed:** Is `returned` the correct COD status for delivered orders whose COD was fully adjusted to zero (likely return adjustments)?

---

## 7. Suggested decision checklist (for your GO)

Reply with decisions per bucket:

1. **B1 (1):** Apply `rejected` → `cancelled`?  
2. **B3 (1185):** Apply rename to `confirmed_waiting_for_admin_approval`?  
3. **B5 (663):** Apply `out_for_delivery` → `shipped` when outbound is `shipped`?  
4. **B7a (27):** Apply `pending`+`allocated` → `processing`?  
5. **B7b (5):** Apply OFD+draft → `processing`? **Recommend NO** — investigate/fix data or exclude by tightening SQL.  
6. **COD (12):** Apply `returned` backfill for net≤0 on delivered OMS?  

Until you answer, **production must not be mutated**.

---

## 8. Scope note

This pack is **Gate A only**.  
Not done: backup, code promote, migrations, PM2 restart, CI/CD branch lock (documented in plan, not executed).
