-- Shipping providers (code-seeded) + encrypted connections + carrier shipments
-- OMS/Outbound shipping method + Babel minimum readiness fields

CREATE TYPE shipping_method AS ENUM ('manual', 'carrier');
CREATE TYPE shipping_provider_connection_status AS ENUM ('disconnected', 'connected');
CREATE TYPE carrier_shipment_status AS ENUM ('pending', 'created', 'failed');
CREATE TYPE shipping_package_type AS ENUM ('box', 'envelope');
CREATE TYPE shipping_delivery_type AS ENUM ('address', 'hub');
CREATE TYPE shipping_pickup_type AS ENUM ('address', 'hub');
CREATE TYPE shipping_payer AS ENUM ('sender', 'receiver', 'reseller');

CREATE TABLE shipping_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO shipping_providers (code, name, enabled)
VALUES ('BABEL_EXPRESS', 'Babel Express', TRUE);

CREATE TABLE shipping_provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL UNIQUE REFERENCES shipping_providers(id) ON DELETE CASCADE,
  status shipping_provider_connection_status NOT NULL DEFAULT 'disconnected',
  encrypted_username TEXT,
  encrypted_password TEXT,
  connected_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  last_tested_at TIMESTAMPTZ,
  last_test_status TEXT,
  last_error_safe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE carrier_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_order_id UUID NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES shipping_providers(id),
  provider_code TEXT NOT NULL,
  external_awb TEXT,
  tracking_number TEXT,
  status carrier_shipment_status NOT NULL DEFAULT 'pending',
  shipping_cost DECIMAL(15, 4),
  currency TEXT,
  last_error_safe TEXT,
  raw_result_meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_carrier_shipments_outbound_created
  ON carrier_shipments (outbound_order_id)
  WHERE status = 'created';

CREATE INDEX idx_carrier_shipments_outbound ON carrier_shipments (outbound_order_id);
CREATE INDEX idx_carrier_shipments_provider ON carrier_shipments (provider_id, status);

-- OMS shipping config
ALTER TABLE oms_orders
  ADD COLUMN shipping_method shipping_method NOT NULL DEFAULT 'manual',
  ADD COLUMN shipping_provider_code TEXT,
  ADD COLUMN shipping_receiver_lat DECIMAL(12, 8),
  ADD COLUMN shipping_receiver_lng DECIMAL(12, 8),
  ADD COLUMN shipping_package_type shipping_package_type,
  ADD COLUMN shipping_contents TEXT,
  ADD COLUMN shipping_delivery_type shipping_delivery_type,
  ADD COLUMN shipping_pickup_type shipping_pickup_type,
  ADD COLUMN shipping_payer shipping_payer,
  ADD COLUMN shipping_weight_kg DECIMAL(12, 4),
  ADD COLUMN shipping_phone_country TEXT;

-- Outbound shipping config (mirrored)
ALTER TABLE outbound_orders
  ADD COLUMN shipping_method shipping_method NOT NULL DEFAULT 'manual',
  ADD COLUMN shipping_provider_code TEXT,
  ADD COLUMN shipping_receiver_lat DECIMAL(12, 8),
  ADD COLUMN shipping_receiver_lng DECIMAL(12, 8),
  ADD COLUMN shipping_package_type shipping_package_type,
  ADD COLUMN shipping_contents TEXT,
  ADD COLUMN shipping_delivery_type shipping_delivery_type,
  ADD COLUMN shipping_pickup_type shipping_pickup_type,
  ADD COLUMN shipping_payer shipping_payer,
  ADD COLUMN shipping_weight_kg DECIMAL(12, 4),
  ADD COLUMN shipping_phone_country TEXT;
