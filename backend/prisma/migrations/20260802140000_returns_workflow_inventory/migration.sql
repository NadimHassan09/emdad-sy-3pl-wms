-- Phase 8.2 — returns workflow execution and inventory handling

ALTER TYPE return_order_status ADD VALUE IF NOT EXISTS 'inspecting';

ALTER TYPE return_item_disposition ADD VALUE IF NOT EXISTS 'damaged';
ALTER TYPE return_item_disposition ADD VALUE IF NOT EXISTS 'discard';
ALTER TYPE return_item_disposition ADD VALUE IF NOT EXISTS 'inspection_required';

CREATE TYPE return_line_status AS ENUM (
  'pending',
  'received',
  'inspected',
  'posted'
);

ALTER TABLE return_orders
  ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses (id),
  ADD COLUMN IF NOT EXISTS inspecting_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_return_orders_warehouse
  ON return_orders (warehouse_id)
  WHERE warehouse_id IS NOT NULL;

ALTER TABLE return_order_lines
  ADD COLUMN IF NOT EXISTS line_status return_line_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS inspected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspected_by UUID REFERENCES users (id),
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_quantity DECIMAL(15,4) NOT NULL DEFAULT 0
    CHECK (posted_quantity >= 0),
  ADD COLUMN IF NOT EXISTS target_location_id UUID REFERENCES locations (id),
  ADD COLUMN IF NOT EXISTS inspection_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_return_lines_status
  ON return_order_lines (return_order_id, line_status);
