-- BILLING-1A — Billing Domain Foundation
-- Replaces legacy unused billing OLTP tables with the new domain model.

-- ---------------------------------------------------------------------------
-- Tear down legacy billing OLTP (never surfaced in Phase 1 application)
-- ---------------------------------------------------------------------------

DROP VIEW IF EXISTS v_uninvoiced_billing;
DROP VIEW IF EXISTS v_overdue_invoices;

DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS invoice_lines CASCADE;
DROP TABLE IF EXISTS billing_transactions CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS client_billing_plans CASCADE;
DROP TABLE IF EXISTS billing_plan_vas_rates CASCADE;
DROP TABLE IF EXISTS billing_plans CASCADE;

DROP TYPE IF EXISTS client_plan_status;
DROP TYPE IF EXISTS billing_plan_status;
DROP TYPE IF EXISTS billing_storage_basis;
DROP TYPE IF EXISTS billing_inbound_basis;
DROP TYPE IF EXISTS charge_type;

-- Legacy invoice_status enum is replaced by billing_invoice_status
DROP TYPE IF EXISTS invoice_status;

-- Analytics ETL referenced legacy billing_transactions — no-op until BILLING-2
CREATE OR REPLACE FUNCTION analytics.etl_load_fact_billing_transactions(
    p_since TIMESTAMPTZ DEFAULT NULL
) RETURNS INTEGER LANGUAGE plpgsql AS $$
BEGIN
    RETURN 0;
END;
$$;

-- ---------------------------------------------------------------------------
-- Company account restriction (billing cycle expiry)
-- ---------------------------------------------------------------------------

ALTER TYPE company_status ADD VALUE IF NOT EXISTS 'restricted';

-- ---------------------------------------------------------------------------
-- Billing domain enums
-- ---------------------------------------------------------------------------

CREATE TYPE billing_cycle_status AS ENUM ('active', 'expired', 'renewed');

CREATE TYPE billing_invoice_status AS ENUM ('draft', 'open', 'paid', 'cancelled');

CREATE TYPE billing_invoice_line_type AS ENUM (
    'subscription',
    'inbound',
    'outbound',
    'packaging',
    'quality_check',
    'excess_volume',
    'excess_weight'
);

-- ---------------------------------------------------------------------------
-- billing_plans — per-client rate card and capacity reservation
-- ---------------------------------------------------------------------------

CREATE TABLE billing_plans (
    id                       UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id               UUID             NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
    active                   BOOLEAN          NOT NULL DEFAULT TRUE,
    cycle_length_days        INTEGER          NOT NULL CHECK (cycle_length_days > 0),
    fixed_subscription_fee   DECIMAL(12, 2)   NOT NULL DEFAULT 0 CHECK (fixed_subscription_fee >= 0),
    inbound_order_fee        DECIMAL(10, 4)   NOT NULL DEFAULT 0 CHECK (inbound_order_fee >= 0),
    outbound_order_fee       DECIMAL(10, 4)   NOT NULL DEFAULT 0 CHECK (outbound_order_fee >= 0),
    packaging_fee            DECIMAL(10, 4)   NOT NULL DEFAULT 0 CHECK (packaging_fee >= 0),
    quality_check_fee        DECIMAL(10, 4)   NOT NULL DEFAULT 0 CHECK (quality_check_fee >= 0),
    excess_volume_fee_per_day DECIMAL(10, 4)  NOT NULL DEFAULT 0 CHECK (excess_volume_fee_per_day >= 0),
    excess_weight_fee_per_day DECIMAL(10, 4)  NOT NULL DEFAULT 0 CHECK (excess_weight_fee_per_day >= 0),
    reserved_volume          DECIMAL(14, 4)   NOT NULL DEFAULT 0 CHECK (reserved_volume >= 0),
    reserved_weight          DECIMAL(14, 4)   NOT NULL DEFAULT 0 CHECK (reserved_weight >= 0),
    created_at               TIMESTAMPTZ(6)   NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ(6)   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_one_active_billing_plan_per_company
    ON billing_plans (company_id)
    WHERE active = TRUE;

CREATE INDEX idx_billing_plans_company ON billing_plans (company_id);

CALL attach_updated_at('billing_plans');

-- ---------------------------------------------------------------------------
-- billing_cycles — time-bounded subscription periods
-- ---------------------------------------------------------------------------

CREATE TABLE billing_cycles (
    id               UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID                  NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
    billing_plan_id  UUID                  NOT NULL REFERENCES billing_plans (id) ON DELETE RESTRICT,
    starts_at        TIMESTAMPTZ(6)        NOT NULL,
    ends_at          TIMESTAMPTZ(6)        NOT NULL,
    status           billing_cycle_status  NOT NULL DEFAULT 'active',
    created_at       TIMESTAMPTZ(6)        NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ(6)        NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_billing_cycle_dates CHECK (ends_at > starts_at)
);

CREATE UNIQUE INDEX uq_one_current_billing_cycle_per_company
    ON billing_cycles (company_id)
    WHERE status IN ('active', 'renewed');

CREATE INDEX idx_billing_cycles_company ON billing_cycles (company_id, status);
CREATE INDEX idx_billing_cycles_expiry  ON billing_cycles (ends_at) WHERE status IN ('active', 'renewed');

CALL attach_updated_at('billing_cycles');

-- ---------------------------------------------------------------------------
-- invoices — cycle-scoped billing documents
-- ---------------------------------------------------------------------------

CREATE TABLE invoices (
    id               UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID                    NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
    billing_cycle_id UUID                    NOT NULL REFERENCES billing_cycles (id) ON DELETE RESTRICT,
    invoice_number   TEXT                    NOT NULL UNIQUE DEFAULT '',
    status           billing_invoice_status  NOT NULL DEFAULT 'draft',
    total_amount     DECIMAL(14, 2)          NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    issued_at        TIMESTAMPTZ(6),
    created_at       TIMESTAMPTZ(6)          NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ(6)          NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_company ON invoices (company_id);
CREATE INDEX idx_invoices_cycle   ON invoices (billing_cycle_id);
CREATE INDEX idx_invoices_status  ON invoices (status);

CALL attach_updated_at('invoices');

CREATE OR REPLACE FUNCTION fn_billing_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.invoice_number = '' OR NEW.invoice_number IS NULL THEN
        NEW.invoice_number := next_seq_number('INV');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_billing_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW EXECUTE FUNCTION fn_billing_invoice_number();

-- ---------------------------------------------------------------------------
-- invoice_lines — typed charge breakdown
-- ---------------------------------------------------------------------------

CREATE TABLE invoice_lines (
    id           UUID                      PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id   UUID                      NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    type         billing_invoice_line_type NOT NULL,
    quantity     DECIMAL(15, 4)            NOT NULL CHECK (quantity >= 0),
    unit_price   DECIMAL(10, 4)            NOT NULL CHECK (unit_price >= 0),
    total_price  DECIMAL(14, 2)            NOT NULL CHECK (total_price >= 0),
    created_at   TIMESTAMPTZ(6)            NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_invoice_line_total CHECK (
        ABS(total_price - ROUND(quantity * unit_price, 2)) < 0.01
    )
);

CREATE INDEX idx_invoice_lines_invoice ON invoice_lines (invoice_id);
