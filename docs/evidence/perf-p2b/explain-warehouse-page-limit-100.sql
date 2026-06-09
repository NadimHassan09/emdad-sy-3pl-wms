EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
WITH filtered AS (
  SELECT il.id, il.created_at,
    CASE
      WHEN il.idempotency_key IS NOT NULL
           AND split_part(il.idempotency_key, ':', 1) = 'bm'
           AND cardinality(string_to_array(il.idempotency_key, ':')) >= 4
      THEN split_part(il.idempotency_key, ':', 1) || ':' ||
           split_part(il.idempotency_key, ':', 2) || ':' ||
           split_part(il.idempotency_key, ':', 3) || ':' ||
           split_part(il.idempotency_key, ':', 4)
      ELSE il.reference_type::text || ':' || il.reference_id::text || ':' ||
           il.product_id::text || ':' ||
           CASE il.movement_type
             WHEN 'inbound_receive' THEN 'inbound'
             WHEN 'outbound_pick' THEN 'outbound'
             ELSE 'adjustment'
           END || ':' || il.id::text
    END AS group_key
  FROM inventory_ledger il
  WHERE il.company_id = '00000000-0000-4000-8000-000000000001'::uuid
    AND il.movement_type IN (
      'inbound_receive'::movement_type,
      'outbound_pick'::movement_type,
      'adjustment_positive'::movement_type,
      'adjustment_negative'::movement_type
    )
    AND (
      il.from_location_id IN (
        SELECT id FROM locations
         WHERE warehouse_id = '00000000-0000-4000-8000-000000000010'::uuid AND status = 'active'
      )
      OR il.to_location_id IN (
        SELECT id FROM locations
         WHERE warehouse_id = '00000000-0000-4000-8000-000000000010'::uuid AND status = 'active'
      )
    )
),
groups AS (
  SELECT group_key, MIN(created_at) AS created_at
    FROM filtered
   GROUP BY group_key
)
SELECT * FROM groups ORDER BY created_at DESC LIMIT 100
