-- Phase 7.3 — cycle count variance & adjustment workflow

CREATE TYPE variance_reason_code AS ENUM (
  'damaged',
  'lost',
  'misplaced',
  'theft_suspected',
  'counting_mistake',
  'operational_correction',
  'unknown'
);

CREATE TYPE cycle_count_variance_status AS ENUM (
  'pending_review',
  'approved',
  'rejected',
  'posted'
);

CREATE TABLE cycle_count_variances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id UUID NOT NULL REFERENCES cycle_counts(id),
  cycle_count_line_id UUID NOT NULL UNIQUE REFERENCES cycle_count_lines(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  lot_id UUID REFERENCES lots(id),
  expected_quantity DECIMAL(15, 4) NOT NULL,
  actual_quantity DECIMAL(15, 4) NOT NULL,
  discrepancy_quantity DECIMAL(15, 4) NOT NULL,
  reason_code variance_reason_code,
  status cycle_count_variance_status NOT NULL DEFAULT 'pending_review',
  review_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  stock_adjustment_id UUID REFERENCES stock_adjustments(id),
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cycle_count_variances_count_status
  ON cycle_count_variances (cycle_count_id, status);

CREATE INDEX idx_cycle_count_variances_company_status
  ON cycle_count_variances (company_id, status);

ALTER TABLE stock_adjustments
  ADD COLUMN cycle_count_id UUID REFERENCES cycle_counts(id);

CREATE INDEX stock_adjustments_cycle_count_id_idx ON stock_adjustments (cycle_count_id);

ALTER TABLE stock_adjustment_lines
  ADD COLUMN cycle_count_variance_id UUID UNIQUE REFERENCES cycle_count_variances(id);
