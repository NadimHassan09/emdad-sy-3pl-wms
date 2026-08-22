-- Canonical OMS + Outbound normalization (data only).
-- Requires enum outbound_order_status.externally_fulfilled (prior migration).
-- Idempotent. No task / inventory / carrier side effects. No fake operational events.

-- B7b: commercial OFD + draft outbound + no warehouse evidence → OMS shipped + outbound externally_fulfilled
WITH b7b AS (
  SELECT o.id AS oms_id, o.status::text AS oms_from, oo.id AS outbound_id, oo.status::text AS outbound_from
  FROM oms_orders o
  JOIN outbound_orders oo ON oo.id = o.outbound_order_id
  WHERE o.status = 'out_for_delivery'
    AND oo.status = 'draft'
    AND NOT EXISTS (
      SELECT 1 FROM workflow_instances wi
      WHERE wi.reference_id = oo.id AND wi.reference_type = 'outbound_order'
    )
    AND NOT EXISTS (
      SELECT 1 FROM stock_reservations sr WHERE sr.outbound_order_id = oo.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM inventory_ledger il WHERE il.reference_id = oo.id
    )
)
UPDATE oms_orders o
SET status = 'shipped',
    out_for_delivery_at = COALESCE(o.out_for_delivery_at, NOW()),
    updated_at = NOW()
FROM b7b
WHERE o.id = b7b.oms_id;

WITH b7b AS (
  SELECT o.id AS oms_id, oo.id AS outbound_id
  FROM oms_orders o
  JOIN outbound_orders oo ON oo.id = o.outbound_order_id
  WHERE o.status = 'shipped'
    AND oo.status = 'draft'
    AND o.out_for_delivery_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM workflow_instances wi
      WHERE wi.reference_id = oo.id AND wi.reference_type = 'outbound_order'
    )
    AND NOT EXISTS (
      SELECT 1 FROM stock_reservations sr WHERE sr.outbound_order_id = oo.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM inventory_ledger il WHERE il.reference_id = oo.id
    )
)
UPDATE outbound_orders oo
SET status = 'externally_fulfilled',
    updated_at = NOW()
FROM b7b
WHERE oo.id = b7b.outbound_id;

INSERT INTO oms_order_events (id, oms_order_id, outbound_order_id, company_id, event_type, payload, created_at)
SELECT gen_random_uuid(),
       o.id,
       o.outbound_order_id,
       o.company_id,
       'system.migration.canonicalized',
       jsonb_build_object(
         'migration', '20261214120100_oms_external_fulfillment_canonicalize',
         'category', 'b7b_commercial_ofd_without_warehouse',
         'omsFrom', 'out_for_delivery',
         'omsTo', 'shipped',
         'outboundFrom', 'draft',
         'outboundTo', 'externally_fulfilled'
       ),
       NOW()
FROM oms_orders o
JOIN outbound_orders oo ON oo.id = o.outbound_order_id
WHERE o.status = 'shipped'
  AND oo.status = 'externally_fulfilled'
  AND NOT EXISTS (
    SELECT 1 FROM oms_order_events e
    WHERE e.oms_order_id = o.id
      AND e.event_type = 'system.migration.canonicalized'
      AND e.payload->>'category' = 'b7b_commercial_ofd_without_warehouse'
  );

-- Delivered + draft (warehouse never ran): freeze outbound as externally_fulfilled
UPDATE outbound_orders oo
SET status = 'externally_fulfilled',
    updated_at = NOW()
FROM oms_orders o
WHERE o.outbound_order_id = oo.id
  AND o.status = 'delivered'
  AND oo.status = 'draft'
  AND NOT EXISTS (
    SELECT 1 FROM workflow_instances wi
    WHERE wi.reference_id = oo.id AND wi.reference_type = 'outbound_order'
  )
  AND NOT EXISTS (
    SELECT 1 FROM stock_reservations sr WHERE sr.outbound_order_id = oo.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM inventory_ledger il WHERE il.reference_id = oo.id
  );

INSERT INTO oms_order_events (id, oms_order_id, outbound_order_id, company_id, event_type, payload, created_at)
SELECT gen_random_uuid(),
       o.id,
       o.outbound_order_id,
       o.company_id,
       'system.migration.canonicalized',
       jsonb_build_object(
         'migration', '20261214120100_oms_external_fulfillment_canonicalize',
         'category', 'delivered_draft_without_warehouse',
         'omsFrom', 'delivered',
         'omsTo', 'delivered',
         'outboundFrom', 'draft',
         'outboundTo', 'externally_fulfilled'
       ),
       NOW()
FROM oms_orders o
JOIN outbound_orders oo ON oo.id = o.outbound_order_id
WHERE o.status = 'delivered'
  AND oo.status = 'externally_fulfilled'
  AND NOT EXISTS (
    SELECT 1 FROM oms_order_events e
    WHERE e.oms_order_id = o.id
      AND e.event_type = 'system.migration.canonicalized'
      AND e.payload->>'category' = 'delivered_draft_without_warehouse'
  );

-- Full completed returns (same rule as maybeMarkOmsFullyReturned): OMS delivered
UPDATE oms_orders o
SET status = 'returned',
    returned_at = COALESCE(o.returned_at, NOW()),
    updated_at = NOW()
WHERE o.status = 'delivered'
  AND EXISTS (
    SELECT 1 FROM oms_returns r
    WHERE r.oms_order_id = o.id AND r.status = 'completed'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM oms_order_lines ol
    WHERE ol.oms_order_id = o.id
      AND COALESCE(
        (
          SELECT SUM(rl.quantity)
          FROM oms_return_lines rl
          JOIN oms_returns r2 ON r2.id = rl.oms_return_id
          WHERE r2.oms_order_id = o.id
            AND r2.status = 'completed'
            AND rl.product_id = ol.product_id
        ),
        0
      ) < ol.requested_quantity
  );

INSERT INTO oms_order_events (id, oms_order_id, outbound_order_id, company_id, event_type, payload, created_at)
SELECT gen_random_uuid(),
       o.id,
       o.outbound_order_id,
       o.company_id,
       'system.migration.canonicalized',
       jsonb_build_object(
         'migration', '20261214120100_oms_external_fulfillment_canonicalize',
         'category', 'completed_full_return',
         'omsFrom', 'delivered',
         'omsTo', 'returned'
       ),
       NOW()
FROM oms_orders o
WHERE o.status = 'returned'
  AND o.returned_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM oms_order_events e
    WHERE e.oms_order_id = o.id
      AND e.event_type = 'system.migration.canonicalized'
      AND e.payload->>'category' = 'completed_full_return'
  )
  AND EXISTS (
    SELECT 1 FROM oms_returns r
    WHERE r.oms_order_id = o.id AND r.status = 'completed'
  );

-- COD returned only when OMS is returned (return lifecycle), not financial net alone
UPDATE cod_records cr
SET status = 'returned',
    updated_at = NOW()
FROM oms_orders oo
WHERE oo.id = cr.oms_order_id
  AND cr.status::text <> 'returned'
  AND oo.status = 'returned';
