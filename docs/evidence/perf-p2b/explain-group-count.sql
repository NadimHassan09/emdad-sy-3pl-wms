EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT COUNT(*)::int AS total
  FROM (
    SELECT CASE
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
    GROUP BY 1
  ) g
