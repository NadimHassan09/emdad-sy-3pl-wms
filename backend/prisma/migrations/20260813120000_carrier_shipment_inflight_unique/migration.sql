-- Gate B: deferred unique index.
-- This migration historically sorted BEFORE shipping_babel_express which creates
-- carrier_shipments. On fresh databases the original SQL would fail.
-- The real unique-index DDL lives in 20261213120100_carrier_shipment_inflight_unique
-- (after Babel creates the table). This file is intentionally a no-op for history stability.
SELECT 1;
