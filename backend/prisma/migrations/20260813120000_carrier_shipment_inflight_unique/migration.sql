-- At most one in-flight or successful carrier shipment per outbound order.
-- Failed rows remain unrestricted so retries can record new failure attempts after
-- the previous pending/created claim is released (pending→failed) or completed.

DROP INDEX IF EXISTS uq_carrier_shipments_outbound_created;

-- Collapse duplicate pending rows (keep newest) before enforcing uniqueness.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY outbound_order_id
           ORDER BY created_at DESC
         ) AS rn
  FROM carrier_shipments
  WHERE status = 'pending'
)
UPDATE carrier_shipments cs
SET status = 'failed',
    last_error_safe = COALESCE(last_error_safe, 'Superseded by newer pending claim'),
    updated_at = NOW()
FROM ranked r
WHERE cs.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX uq_carrier_shipments_outbound_inflight
  ON carrier_shipments (outbound_order_id)
  WHERE status IN ('pending', 'created');
