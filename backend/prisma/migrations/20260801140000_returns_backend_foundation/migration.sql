-- Phase 8.1 — returns backend foundation (linkage + lifecycle timestamps)

ALTER TABLE return_orders
  ADD COLUMN IF NOT EXISTS client_reference TEXT,
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES packages (id),
  ADD COLUMN IF NOT EXISTS shipment_reference TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receiving_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users (id);

CREATE INDEX IF NOT EXISTS idx_return_orders_outbound
  ON return_orders (original_outbound_order_id)
  WHERE original_outbound_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_return_orders_package
  ON return_orders (package_id)
  WHERE package_id IS NOT NULL;

ALTER TABLE return_order_lines
  ADD COLUMN IF NOT EXISTS outbound_order_line_id UUID REFERENCES outbound_order_lines (id),
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES packages (id),
  ADD COLUMN IF NOT EXISTS line_number INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_return_lines_outbound_line
  ON return_order_lines (outbound_order_line_id)
  WHERE outbound_order_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_return_lines_product
  ON return_order_lines (product_id);
