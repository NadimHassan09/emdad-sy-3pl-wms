-- OMS lifecycle: pending status, status remap backup, CodRecord, OmsReturn

-- Backup for rollback
CREATE TABLE IF NOT EXISTS oms_status_migration_backup (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL,
  outbound_order_id UUID,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO oms_status_migration_backup (id, status, outbound_order_id)
SELECT id, status::text, outbound_order_id
FROM oms_orders
ON CONFLICT (id) DO NOTHING;

-- Add enum values (PostgreSQL)
ALTER TYPE oms_order_status ADD VALUE IF NOT EXISTS 'pending';

DO $$ BEGIN
  CREATE TYPE cod_record_status AS ENUM ('pending', 'available', 'paid_out');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cod_generation_status AS ENUM ('none', 'pending', 'ok', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE oms_return_status AS ENUM ('requested', 'approved', 'rejected', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE oms_orders
  ADD COLUMN IF NOT EXISTS cod_generation_status cod_generation_status NOT NULL DEFAULT 'none';

CREATE TABLE IF NOT EXISTS cod_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  oms_order_id UUID NOT NULL UNIQUE REFERENCES oms_orders(id) ON DELETE CASCADE,
  original_amount DECIMAL(15,4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SYP',
  status cod_record_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  available_at TIMESTAMPTZ,
  paid_out_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cod_records_company_status ON cod_records(company_id, status);

CREATE TABLE IF NOT EXISTS oms_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  oms_order_id UUID NOT NULL REFERENCES oms_orders(id) ON DELETE CASCADE,
  warehouse_return_id UUID UNIQUE REFERENCES return_orders(id) ON DELETE SET NULL,
  return_number TEXT NOT NULL UNIQUE DEFAULT '',
  status oms_return_status NOT NULL DEFAULT 'requested',
  reason TEXT,
  notes TEXT,
  rejection_reason TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  rejected_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oms_returns_company_status ON oms_returns(company_id, status);
CREATE INDEX IF NOT EXISTS idx_oms_returns_order ON oms_returns(oms_order_id);

CREATE TABLE IF NOT EXISTS oms_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oms_return_id UUID NOT NULL REFERENCES oms_returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity DECIMAL(15,4) NOT NULL,
  unit_price DECIMAL(15,4),
  line_total DECIMAL(15,4),
  lot_id UUID,
  line_number INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oms_return_lines_return ON oms_return_lines(oms_return_id);

CREATE TABLE IF NOT EXISTS cod_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_record_id UUID NOT NULL REFERENCES cod_records(id) ON DELETE CASCADE,
  oms_return_id UUID UNIQUE REFERENCES oms_returns(id) ON DELETE SET NULL,
  amount DECIMAL(15,4) NOT NULL,
  reason TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cod_adjustments_record ON cod_adjustments(cod_record_id);
