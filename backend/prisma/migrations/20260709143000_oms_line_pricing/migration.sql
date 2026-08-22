-- Line-level commerce pricing for OMS orders.

ALTER TABLE outbound_order_lines
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(15, 4);

ALTER TABLE outbound_order_lines
  ADD COLUMN IF NOT EXISTS line_total DECIMAL(15, 4);

ALTER TABLE outbound_order_lines
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(15, 4);
