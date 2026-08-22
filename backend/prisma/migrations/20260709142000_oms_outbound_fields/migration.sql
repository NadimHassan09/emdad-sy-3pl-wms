-- Outbound order OMS: end-customer, financials, allocation metadata.
-- All nullable / defaulted — existing orders unchanged.

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS recipient_name TEXT;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS district TEXT;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS address_line1 TEXT;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS address_line2 TEXT;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS payment_method oms_payment_method;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(15, 4);

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(15, 4);

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS cod_amount DECIMAL(15, 4);

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'SYP';

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS cod_collected_at TIMESTAMPTZ;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS cod_remitted_at TIMESTAMPTZ;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS cod_status oms_cod_status;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS allocation_status oms_allocation_status NOT NULL DEFAULT 'none';

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS allocated_at TIMESTAMPTZ;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMPTZ;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_outbound_orders_cod_status
  ON outbound_orders (company_id, cod_status)
  WHERE cod_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outbound_orders_allocation_status
  ON outbound_orders (company_id, allocation_status);
