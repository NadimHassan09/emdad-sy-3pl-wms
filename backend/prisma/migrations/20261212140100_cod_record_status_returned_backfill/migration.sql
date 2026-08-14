-- Backfill COD records already zeroed by returns / linked to returned OMS orders.
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
