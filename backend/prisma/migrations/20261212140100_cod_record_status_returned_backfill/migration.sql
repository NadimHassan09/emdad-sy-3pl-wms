-- COD status follows OMS return lifecycle only — never financial net alone.
UPDATE cod_records cr
SET status = 'returned',
    updated_at = NOW()
FROM oms_orders oo
WHERE oo.id = cr.oms_order_id
  AND cr.status::text <> 'returned'
  AND oo.status = 'returned';
