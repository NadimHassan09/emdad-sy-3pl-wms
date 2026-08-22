-- Evidence-based OMS status remap (staging).
-- Do NOT blind-map pending/picking/packing → processing.
-- Only unambiguous rows are updated; ambiguous rows stay on legacy status.
-- A CSV report of ambiguous rows is produced by scripts/oms-workflow-migration-report.ts.

-- Terminal: rejected → cancelled (unused as live status; clearly terminal)
UPDATE oms_orders
SET status = 'cancelled',
    cancelled_at = COALESCE(cancelled_at, rejected_at, NOW()),
    updated_at = NOW()
WHERE status = 'rejected';

-- Terminal: completed → delivered (unused as live status)
UPDATE oms_orders
SET status = 'delivered',
    delivered_at = COALESCE(delivered_at, NOW()),
    updated_at = NOW()
WHERE status = 'completed';

-- Client submitted awaiting admin, no outbound / no fulfillment started
-- → confirmed_waiting_for_admin_approval
UPDATE oms_orders o
SET status = 'confirmed_waiting_for_admin_approval',
    updated_at = NOW()
WHERE o.status = 'pending_approval'
  AND o.outbound_order_id IS NULL
  AND o.approved_at IS NULL;

-- Client-created draft: no confirm/approve, no outbound, no fulfillment
-- → waiting_for_confirmation
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

-- Outbound left warehouse (shipped/out_for_delivery) and OMS not delivered
-- → shipped
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

-- Outbound prep complete (ready_to_ship), dispatch not done → ready_to_ship
-- Do NOT pull OMS out_for_delivery / shipped into ready_to_ship (commercial regression).
UPDATE oms_orders o
SET status = 'ready_to_ship',
    updated_at = NOW()
FROM outbound_orders oo
WHERE o.outbound_order_id = oo.id
  AND oo.status = 'ready_to_ship'
  AND o.status IN ('pending', 'processing', 'picking', 'packing', 'allocated', 'approved', 'confirmed')
  AND o.status <> 'shipped'
  AND o.status <> 'delivered';

-- Outbound in warehouse prep (draft/allocated/picking/packing/confirmed/pending_*) → processing
-- CRITICAL: do NOT include OMS out_for_delivery here (B7b commercial-only OFD + draft outbound).
-- That bucket is handled by the externally_fulfilled canonicalization migration.
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
    'processing'
  );
