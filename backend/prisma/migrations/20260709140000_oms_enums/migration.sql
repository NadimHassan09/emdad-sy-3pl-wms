-- OMS foundation: additive enum types and outbound lifecycle values.
-- Safe for production: no drops, no data deletion.

DO $$ BEGIN
  CREATE TYPE inbound_source_type AS ENUM ('purchase', 'return', 'transfer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE oms_payment_method AS ENUM ('COD', 'PREPAID', 'CREDIT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE oms_cod_status AS ENUM ('pending', 'collected', 'remitted', 'settled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE oms_allocation_status AS ENUM ('none', 'allocated', 'released', 'fulfilled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE outbound_order_status ADD VALUE IF NOT EXISTS 'allocated';
ALTER TYPE outbound_order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE outbound_order_status ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE outbound_order_status ADD VALUE IF NOT EXISTS 'returned';
