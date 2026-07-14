-- Independent OMS orders layer (optional link to outbound_orders)

CREATE TYPE oms_order_status AS ENUM (
  'draft',
  'confirmed',
  'processing',
  'allocated',
  'ready_to_ship',
  'out_for_delivery',
  'shipped',
  'delivered',
  'returned',
  'cancelled'
);

CREATE TABLE oms_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id),
  outbound_order_id     UUID UNIQUE REFERENCES outbound_orders(id) ON DELETE SET NULL,
  order_number          TEXT NOT NULL UNIQUE DEFAULT '',
  status                oms_order_status NOT NULL DEFAULT 'draft',
  destination_address   TEXT NOT NULL DEFAULT '',
  required_ship_date    DATE NOT NULL,
  carrier               TEXT,
  tracking_number       TEXT,
  client_reference      TEXT,
  notes                 TEXT,
  requires_packing      BOOLEAN NOT NULL DEFAULT TRUE,
  recipient_name        TEXT,
  recipient_phone       TEXT,
  city                  TEXT,
  district              TEXT,
  address_line1         TEXT,
  address_line2         TEXT,
  delivery_instructions TEXT,
  payment_method        oms_payment_method,
  subtotal              NUMERIC(15, 4),
  shipping_fee          NUMERIC(15, 4),
  cod_amount            NUMERIC(15, 4),
  currency              TEXT DEFAULT 'SYP',
  cod_collected_at      TIMESTAMPTZ,
  cod_remitted_at       TIMESTAMPTZ,
  cod_status            oms_cod_status,
  allocation_status     oms_allocation_status NOT NULL DEFAULT 'none',
  allocated_at          TIMESTAMPTZ,
  out_for_delivery_at   TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  returned_at           TIMESTAMPTZ,
  store_channel         TEXT,
  external_reference    TEXT,
  confirmed_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancelled_by          UUID REFERENCES users(id),
  created_by            UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oms_orders_company ON oms_orders(company_id);
CREATE INDEX idx_oms_orders_outbound ON oms_orders(outbound_order_id) WHERE outbound_order_id IS NOT NULL;
CREATE INDEX idx_oms_orders_created ON oms_orders(company_id, created_at DESC);

CREATE OR REPLACE FUNCTION fn_oms_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number = '' OR NEW.order_number IS NULL THEN
        NEW.order_number := next_seq_number('OMS');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_oms_order_number
  BEFORE INSERT ON oms_orders
  FOR EACH ROW
  EXECUTE FUNCTION fn_oms_order_number();

CREATE TABLE oms_order_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oms_order_id        UUID NOT NULL REFERENCES oms_orders(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id),
  requested_quantity  NUMERIC(15, 4) NOT NULL,
  specific_lot_id     UUID REFERENCES lots(id),
  line_number         INT NOT NULL,
  unit_price          NUMERIC(15, 4),
  line_total          NUMERIC(15, 4),
  discount_amount     NUMERIC(15, 4),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oms_order_lines_order ON oms_order_lines(oms_order_id);

ALTER TABLE oms_order_events
  ADD COLUMN oms_order_id UUID REFERENCES oms_orders(id) ON DELETE CASCADE;

ALTER TABLE oms_order_events
  ALTER COLUMN outbound_order_id DROP NOT NULL;

CREATE INDEX idx_oms_order_events_oms ON oms_order_events(oms_order_id, created_at DESC);

-- Backfill OMS orders from outbound rows that already carry OMS data or events
INSERT INTO oms_orders (
  id,
  company_id,
  outbound_order_id,
  order_number,
  status,
  destination_address,
  required_ship_date,
  carrier,
  tracking_number,
  client_reference,
  notes,
  requires_packing,
  recipient_name,
  recipient_phone,
  city,
  district,
  address_line1,
  address_line2,
  delivery_instructions,
  payment_method,
  subtotal,
  shipping_fee,
  cod_amount,
  currency,
  cod_collected_at,
  cod_remitted_at,
  cod_status,
  allocation_status,
  allocated_at,
  out_for_delivery_at,
  delivered_at,
  returned_at,
  store_channel,
  external_reference,
  confirmed_at,
  cancelled_at,
  cancelled_by,
  created_by,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  o.company_id,
  o.id,
  'OMS-BF-' || o.order_number,
  CASE o.status::text
    WHEN 'draft' THEN 'draft'::oms_order_status
    WHEN 'pending_approval' THEN 'draft'::oms_order_status
    WHEN 'pending_stock' THEN 'draft'::oms_order_status
    WHEN 'confirmed' THEN 'confirmed'::oms_order_status
    WHEN 'allocated' THEN 'allocated'::oms_order_status
    WHEN 'picking' THEN 'processing'::oms_order_status
    WHEN 'packing' THEN 'processing'::oms_order_status
    WHEN 'ready_to_ship' THEN 'ready_to_ship'::oms_order_status
    WHEN 'out_for_delivery' THEN 'out_for_delivery'::oms_order_status
    WHEN 'shipped' THEN 'shipped'::oms_order_status
    WHEN 'delivered' THEN 'delivered'::oms_order_status
    WHEN 'returned' THEN 'returned'::oms_order_status
    WHEN 'cancelled' THEN 'cancelled'::oms_order_status
    ELSE 'draft'::oms_order_status
  END,
  o.destination_address,
  o.required_ship_date,
  o.carrier,
  o.tracking_number,
  o.client_reference,
  o.notes,
  o.requires_packing,
  o.recipient_name,
  o.recipient_phone,
  o.city,
  o.district,
  o.address_line1,
  o.address_line2,
  o.delivery_instructions,
  o.payment_method,
  o.subtotal,
  o.shipping_fee,
  o.cod_amount,
  o.currency,
  o.cod_collected_at,
  o.cod_remitted_at,
  o.cod_status,
  o.allocation_status,
  o.allocated_at,
  o.out_for_delivery_at,
  o.delivered_at,
  o.returned_at,
  o.store_channel,
  o.external_reference,
  o.confirmed_at,
  o.cancelled_at,
  o.cancelled_by,
  o.created_by,
  o.created_at,
  o.updated_at
FROM outbound_orders o
WHERE o.payment_method IS NOT NULL
   OR o.recipient_name IS NOT NULL
   OR o.store_channel IS NOT NULL
   OR o.allocation_status <> 'none'
   OR EXISTS (
     SELECT 1 FROM oms_order_events e WHERE e.outbound_order_id = o.id
   );

INSERT INTO oms_order_lines (
  oms_order_id,
  product_id,
  requested_quantity,
  specific_lot_id,
  line_number,
  unit_price,
  line_total,
  discount_amount,
  created_at,
  updated_at
)
SELECT
  om.id,
  ol.product_id,
  ol.requested_quantity,
  ol.specific_lot_id,
  ol.line_number,
  ol.unit_price,
  ol.line_total,
  ol.discount_amount,
  ol.created_at,
  ol.updated_at
FROM outbound_order_lines ol
JOIN oms_orders om ON om.outbound_order_id = ol.outbound_order_id;

UPDATE oms_order_events e
SET oms_order_id = om.id
FROM oms_orders om
WHERE e.outbound_order_id = om.outbound_order_id
  AND e.oms_order_id IS NULL;
