-- OMS undo-cancel snapshots. Written only when entering cancelled; cleared on revert.
ALTER TABLE oms_orders
  ADD COLUMN IF NOT EXISTS cancelled_from_status oms_order_status;

ALTER TABLE oms_orders
  ADD COLUMN IF NOT EXISTS cancelled_from_outbound_status outbound_order_status;
