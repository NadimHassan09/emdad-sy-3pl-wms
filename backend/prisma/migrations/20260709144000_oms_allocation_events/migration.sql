-- Stock reservation line linkage + OMS order timeline events.

ALTER TABLE stock_reservations
  ADD COLUMN IF NOT EXISTS outbound_order_line_id UUID REFERENCES outbound_order_lines (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_line
  ON stock_reservations (outbound_order_line_id)
  WHERE outbound_order_line_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS oms_order_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_order_id UUID NOT NULL REFERENCES outbound_orders (id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES companies (id),
  event_type        TEXT NOT NULL,
  payload           JSONB,
  created_by        UUID REFERENCES users (id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oms_order_events_order
  ON oms_order_events (outbound_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oms_order_events_company
  ON oms_order_events (company_id, created_at DESC);
