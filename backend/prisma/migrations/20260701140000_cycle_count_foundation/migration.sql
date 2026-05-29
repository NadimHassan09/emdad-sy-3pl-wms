-- Phase 7.1 — cycle count backend foundation

CREATE TYPE cycle_count_status AS ENUM (
  'scheduled',
  'in_progress',
  'pending_review',
  'completed',
  'cancelled'
);

CREATE TYPE cycle_count_line_status AS ENUM (
  'pending',
  'counted',
  'skipped'
);

CREATE TYPE cycle_count_source AS ENUM (
  'scheduled',
  'manual'
);

CREATE TABLE cycle_count_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  interval_days INT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  include_zero_on_hand BOOLEAN NOT NULL DEFAULT FALSE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cycle_count_schedules_interval_days_chk CHECK (interval_days IN (7, 30, 90))
);

CREATE UNIQUE INDEX cycle_count_schedules_company_warehouse_uidx
  ON cycle_count_schedules (company_id, warehouse_id);

CREATE INDEX idx_cycle_count_schedules_due
  ON cycle_count_schedules (enabled, next_run_at)
  WHERE enabled = TRUE;

CREATE TABLE cycle_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES cycle_count_schedules(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  status cycle_count_status NOT NULL DEFAULT 'scheduled',
  source cycle_count_source NOT NULL,
  snapshot_at TIMESTAMPTZ,
  assigned_worker_id UUID REFERENCES workers(id),
  created_by UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cycle_counts_company_wh_status
  ON cycle_counts (company_id, warehouse_id, status);

CREATE INDEX cycle_counts_schedule_id_idx ON cycle_counts (schedule_id);

CREATE TABLE cycle_count_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id UUID NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  lot_id UUID REFERENCES lots(id),
  expected_quantity DECIMAL(15, 4) NOT NULL,
  actual_quantity DECIMAL(15, 4),
  discrepancy_quantity DECIMAL(15, 4),
  status cycle_count_line_status NOT NULL DEFAULT 'pending',
  assigned_worker_id UUID REFERENCES workers(id),
  counted_by UUID REFERENCES users(id),
  counted_at TIMESTAMPTZ,
  count_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX cycle_count_lines_cycle_count_id_idx ON cycle_count_lines (cycle_count_id);
CREATE INDEX cycle_count_lines_product_id_idx ON cycle_count_lines (product_id);

CREATE UNIQUE INDEX cycle_count_lines_grain_uidx ON cycle_count_lines (
  cycle_count_id,
  product_id,
  location_id,
  COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE TABLE cycle_count_product_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  last_counted_at TIMESTAMPTZ NOT NULL,
  last_cycle_count_id UUID,
  next_due_at TIMESTAMPTZ,
  completion_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX cycle_count_product_history_uidx
  ON cycle_count_product_history (company_id, warehouse_id, product_id);

CREATE INDEX idx_cycle_count_product_history_due
  ON cycle_count_product_history (company_id, warehouse_id, next_due_at);
