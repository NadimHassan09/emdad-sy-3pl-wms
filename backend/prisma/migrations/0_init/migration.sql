-- =============================================================================
-- EMDAD 3PL WMS — Improved Production Schema v2
-- PostgreSQL 16
--
-- PART 1  : Improved OLTP Schema  (all 7 critical issues fixed)
-- PART 2  : Analytics Schema      (Star Schema / Data Warehouse)
--
-- Issues addressed
-- ────────────────────────────────────────────────────────────────────────────
-- ISSUE 1  Reservation inconsistency      → fn_sync_quantity_reserved trigger
-- ISSUE 2  Ledger duplication risk        → inventory_ledger_dedup + trigger
-- ISSUE 3  Missing critical constraints   → picked ≤ allocated CHECK added
-- ISSUE 4  RLS context leakage            → SET LOCAL pattern + documentation
-- ISSUE 5  Deadlock risk                  → fn_lock_stock_rows_ordered helper
-- ISSUE 6  Billing precision              → DECIMAL(10,4) rates / ROUND(,2)
-- ISSUE 7  Partition reliability          → DEFAULT partitions + auto-create
-- =============================================================================

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- exclusion constraints
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- trigram search on products

-- =============================================================================
-- APPLICATION USER (run once by DBA outside migrations)
-- =============================================================================
-- OLTP application role
-- CREATE ROLE wms_app      LOGIN PASSWORD 'change_me_oltp';
-- Analytics read-only role (BI tools / Metabase / Grafana)
-- CREATE ROLE wms_analytics LOGIN PASSWORD 'change_me_analytics';
--
-- GRANT CONNECT ON DATABASE wms_db TO wms_app, wms_analytics;
-- GRANT USAGE  ON SCHEMA public    TO wms_app;
-- GRANT USAGE  ON SCHEMA analytics TO wms_analytics;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public    TO wms_app;
-- GRANT SELECT                          ON ALL TABLES IN SCHEMA analytics TO wms_analytics;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public    TO wms_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA analytics TO wms_analytics;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES   TO wms_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public    GRANT USAGE, SELECT                 ON SEQUENCES TO wms_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT                        ON TABLES    TO wms_analytics;

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE company_status          AS ENUM ('active','paused','offboarding','closed');
CREATE TYPE billing_cycle_type      AS ENUM ('monthly','quarterly');
CREATE TYPE user_role               AS ENUM ('super_admin','wh_manager','wh_operator','finance','client_admin','client_staff');
CREATE TYPE worker_role             AS ENUM ('receiving_worker','qa_worker','picker','packer');
CREATE TYPE user_status             AS ENUM ('active','inactive');
CREATE TYPE warehouse_status        AS ENUM ('active','inactive');
CREATE TYPE location_type           AS ENUM ('warehouse','view','input','qc','internal','packing','output','quarantine','scrap','transit');
CREATE TYPE location_status         AS ENUM ('active','blocked','archived');
CREATE TYPE product_uom             AS ENUM ('piece','kg','litre','carton','pallet','box','roll');
CREATE TYPE product_tracking_type   AS ENUM ('none','lot','package');
CREATE TYPE product_status          AS ENUM ('active','archived');
CREATE TYPE package_status          AS ENUM ('in_warehouse','shipped','returned','scrapped');
CREATE TYPE stock_status            AS ENUM ('available','quarantined');
CREATE TYPE movement_type           AS ENUM ('inbound_receive','outbound_pick','putaway','qc_quarantine','qc_release','adjustment_positive','adjustment_negative','scrap','internal_transfer','return_receive','transit_out','transit_in');
CREATE TYPE ledger_ref_type         AS ENUM ('inbound_order','outbound_order','adjustment','transfer','qc_alert','return_order','cycle_count');
CREATE TYPE inbound_order_status    AS ENUM ('draft','confirmed','in_progress','partially_received','completed','cancelled');
CREATE TYPE discrepancy_type        AS ENUM ('none','short','over','wrong_item');
CREATE TYPE inbound_qc_status       AS ENUM ('not_required','pending','passed','failed');
CREATE TYPE outbound_order_status   AS ENUM ('draft','pending_stock','confirmed','picking','packing','ready_to_ship','shipped','cancelled');
CREATE TYPE outbound_line_status    AS ENUM ('pending','picking','done','short','cancelled');
CREATE TYPE allocation_status       AS ENUM ('allocated','picked','short');
CREATE TYPE reservation_status      AS ENUM ('active','fulfilled','released');
CREATE TYPE task_type               AS ENUM ('receiving','qc_check','putaway','picking','packing','shipping','counting','transfer');
CREATE TYPE task_ref_type           AS ENUM ('inbound_order','outbound_order','adjustment','transfer','qc_check','cycle_count');
CREATE TYPE task_priority           AS ENUM ('low','medium','high','urgent');
CREATE TYPE task_status             AS ENUM ('pending','assigned','in_progress','completed','blocked','cancelled');
CREATE TYPE step_type               AS ENUM ('scan_product','scan_location','scan_lot','enter_quantity','confirm','flag_issue','photo_taken');
CREATE TYPE step_result             AS ENUM ('success','error','override');
CREATE TYPE qc_applies_to           AS ENUM ('all_products','product','category');
CREATE TYPE qc_check_type           AS ENUM ('pass_fail','measure','photo','instructions');
CREATE TYPE qc_frequency_type       AS ENUM ('every_operation','percentage','periodic');
CREATE TYPE qc_operation_type       AS ENUM ('inbound','outbound','return');
CREATE TYPE qc_check_result         AS ENUM ('pending','passed','failed');
CREATE TYPE qc_alert_stage          AS ENUM ('open','in_progress','resolved');
CREATE TYPE qc_alert_resolution     AS ENUM ('accepted','returned','scrapped');
CREATE TYPE billing_storage_basis   AS ENUM ('per_pallet','per_cbm');
CREATE TYPE billing_inbound_basis   AS ENUM ('per_line','per_pallet');
CREATE TYPE billing_plan_status     AS ENUM ('active','archived');
CREATE TYPE client_plan_status      AS ENUM ('active','expired','cancelled');
CREATE TYPE charge_type             AS ENUM ('storage','inbound_handling','outbound_handling','vas','minimum_fee','subscription_fixed','returns_handling','adjustment_charge');
CREATE TYPE invoice_status          AS ENUM ('draft','posted','sent','paid','partial','overdue','void');
CREATE TYPE payment_method          AS ENUM ('bank_transfer','cheque','credit_card','cash','other');
CREATE TYPE barcode_entity_type     AS ENUM ('product','location','lot','package','inbound_order','outbound_order');
CREATE TYPE barcode_format          AS ENUM ('code128','qr','ean13','upc_a','gs1_128','datamatrix');
CREATE TYPE return_order_status     AS ENUM ('draft','confirmed','receiving','completed','cancelled');
CREATE TYPE return_item_condition   AS ENUM ('new','good','damaged','unusable');
CREATE TYPE return_item_disposition AS ENUM ('restock','quarantine','scrap');
CREATE TYPE notification_channel    AS ENUM ('in_app','email','both');
CREATE TYPE putaway_applies_to      AS ENUM ('product','category','all');
CREATE TYPE adjustment_status       AS ENUM ('draft','approved','cancelled');
CREATE TYPE putaway_rule_status     AS ENUM ('active','inactive');
CREATE TYPE qc_rule_status          AS ENUM ('active','inactive');
CREATE TYPE report_job_status       AS ENUM ('pending','processing','completed','failed');

-- =============================================================================
-- UTILITY: updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE PROCEDURE attach_updated_at(p_table TEXT)
LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format(
        'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()',
        p_table, p_table
    );
END;
$$;

-- =============================================================================
-- SEQUENCE COUNTER (per-year, per-prefix order numbers)
-- =============================================================================

CREATE TABLE sequence_counters (
    name        TEXT    NOT NULL,
    year        INTEGER NOT NULL,
    last_value  BIGINT  NOT NULL DEFAULT 0,
    PRIMARY KEY (name, year)
);

CREATE OR REPLACE FUNCTION next_seq_number(p_prefix TEXT, p_pad INT DEFAULT 5)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
    v_seq  BIGINT;
BEGIN
    INSERT INTO sequence_counters (name, year, last_value)
    VALUES (p_prefix, v_year, 1)
    ON CONFLICT (name, year)
    DO UPDATE SET last_value = sequence_counters.last_value + 1
    RETURNING last_value INTO v_seq;
    RETURN p_prefix || '-' || v_year::TEXT || '-' || LPAD(v_seq::TEXT, p_pad, '0');
END;
$$;

-- =============================================================================
-- PART 1 — OLTP SCHEMA
-- =============================================================================

-- -----------------------------------------------------------------------------
-- COMPANIES
-- -----------------------------------------------------------------------------

CREATE TABLE companies (
    id                  UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT               NOT NULL,
    trade_name          TEXT,
    contact_email       TEXT               NOT NULL,
    contact_phone       TEXT,
    address             TEXT,
    city                TEXT,
    country             TEXT               NOT NULL DEFAULT 'SA',
    vat_number          TEXT,
    billing_cycle       billing_cycle_type NOT NULL DEFAULT 'monthly',
    payment_terms_days  INTEGER            NOT NULL DEFAULT 30
                                           CHECK (payment_terms_days IN (7,15,30,60,90)),
    status              company_status     NOT NULL DEFAULT 'active',
    notes               TEXT,
    created_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_companies_status ON companies (status);

CALL attach_updated_at('companies');

-- -----------------------------------------------------------------------------
-- USERS
-- -----------------------------------------------------------------------------

CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID        REFERENCES companies (id) ON DELETE RESTRICT,
    email           TEXT        NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    full_name       TEXT        NOT NULL,
    phone           TEXT,
    role            user_role   NOT NULL,
    status          user_status NOT NULL DEFAULT 'active',
    token_version   INTEGER     NOT NULL DEFAULT 0,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_company_role CHECK (
        (role IN ('super_admin','wh_manager','wh_operator','finance') AND company_id IS NULL)
        OR
        (role IN ('client_admin','client_staff') AND company_id IS NOT NULL)
    )
);

CREATE INDEX idx_users_company_id      ON users (company_id);
CREATE INDEX idx_users_role            ON users (role);
CREATE INDEX idx_users_status          ON users (status);
CREATE INDEX idx_users_active_operator ON users (id) WHERE role = 'wh_operator' AND status = 'active';

CALL attach_updated_at('users');

CREATE TABLE user_worker_roles (
    user_id UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role    worker_role NOT NULL,
    PRIMARY KEY (user_id, role)
);

-- -----------------------------------------------------------------------------
-- WAREHOUSES
-- -----------------------------------------------------------------------------

CREATE TABLE warehouses (
    id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT             NOT NULL,
    code        TEXT             NOT NULL UNIQUE,
    address     TEXT,
    city        TEXT,
    country     TEXT             NOT NULL DEFAULT 'SA',
    status      warehouse_status NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CALL attach_updated_at('warehouses');

-- -----------------------------------------------------------------------------
-- LOCATIONS
-- -----------------------------------------------------------------------------

CREATE TABLE locations (
    id                   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id         UUID            NOT NULL REFERENCES warehouses (id) ON DELETE RESTRICT,
    parent_id            UUID            REFERENCES locations (id) ON DELETE RESTRICT,
    name                 TEXT            NOT NULL,
    full_path            TEXT            NOT NULL,
    type                 location_type   NOT NULL DEFAULT 'internal',
    barcode              TEXT            NOT NULL UNIQUE,
    sort_order           INTEGER         NOT NULL DEFAULT 0,
    status               location_status NOT NULL DEFAULT 'active',
    max_weight_kg        DECIMAL(10,2),
    max_cbm              DECIMAL(10,4),
    max_pallet_positions INTEGER,
    created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_locations_warehouse ON locations (warehouse_id);
CREATE INDEX idx_locations_parent    ON locations (parent_id);
CREATE INDEX idx_locations_barcode   ON locations (barcode);
CREATE INDEX idx_locations_type      ON locations (type);
CREATE INDEX idx_locations_sort      ON locations (warehouse_id, sort_order);

CALL attach_updated_at('locations');

-- -----------------------------------------------------------------------------
-- PRODUCT CATEGORIES
-- -----------------------------------------------------------------------------

CREATE TABLE product_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    parent_id   UUID REFERENCES product_categories (id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CALL attach_updated_at('product_categories');

-- -----------------------------------------------------------------------------
-- PRODUCTS
-- -----------------------------------------------------------------------------

CREATE TABLE products (
    id                  UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID                  NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
    category_id         UUID                  REFERENCES product_categories (id) ON DELETE SET NULL,
    name                TEXT                  NOT NULL,
    sku                 TEXT                  NOT NULL,
    barcode             TEXT,
    description         TEXT,
    tracking_type       product_tracking_type NOT NULL DEFAULT 'none',
    uom                 product_uom           NOT NULL DEFAULT 'piece',
    weight_kg           DECIMAL(10,4),
    volume_cbm          DECIMAL(10,6),
    length_cm           DECIMAL(8,2),
    width_cm            DECIMAL(8,2),
    height_cm           DECIMAL(8,2),
    expiry_tracking     BOOLEAN               NOT NULL DEFAULT FALSE,
    min_stock_threshold INTEGER               NOT NULL DEFAULT 0,
    status              product_status        NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_sku_per_company  UNIQUE (company_id, sku),
    CONSTRAINT chk_expiry_requires_lot     CHECK (expiry_tracking = FALSE OR tracking_type = 'lot')
);

CREATE INDEX idx_products_company_id      ON products (company_id);
CREATE INDEX idx_products_company_status  ON products (company_id, status);
CREATE INDEX idx_products_company_barcode ON products (company_id, barcode) WHERE barcode IS NOT NULL AND status = 'active';
CREATE INDEX idx_products_name_trgm       ON products USING gin (name gin_trgm_ops);
CREATE INDEX idx_products_sku_trgm        ON products USING gin (sku  gin_trgm_ops);

CALL attach_updated_at('products');

-- -----------------------------------------------------------------------------
-- LOTS
-- -----------------------------------------------------------------------------

CREATE TABLE lots (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
    lot_number       TEXT NOT NULL,
    expiry_date      DATE,
    manufacture_date DATE,
    received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_lot_per_product UNIQUE (product_id, lot_number)
);

CREATE INDEX idx_lots_product_id ON lots (product_id);
CREATE INDEX idx_lots_fefo        ON lots (product_id, expiry_date ASC NULLS LAST) WHERE expiry_date IS NOT NULL;

-- -----------------------------------------------------------------------------
-- PACKAGES
-- -----------------------------------------------------------------------------

CREATE TABLE packages (
    id           UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   UUID           NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
    lot_id       UUID           REFERENCES lots (id) ON DELETE RESTRICT,
    location_id  UUID           REFERENCES locations (id),
    package_code TEXT           NOT NULL UNIQUE,
    status       package_status NOT NULL DEFAULT 'in_warehouse',
    received_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_packages_product  ON packages (product_id);
CREATE INDEX idx_packages_location ON packages (location_id) WHERE location_id IS NOT NULL;

CALL attach_updated_at('packages');

-- -----------------------------------------------------------------------------
-- PUTAWAY RULES
-- -----------------------------------------------------------------------------

CREATE TABLE putaway_rules (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id            UUID                NOT NULL REFERENCES warehouses (id) ON DELETE CASCADE,
    company_id              UUID                REFERENCES companies (id) ON DELETE CASCADE,
    applies_to              putaway_applies_to  NOT NULL DEFAULT 'all',
    product_id              UUID                REFERENCES products (id) ON DELETE CASCADE,
    category_id             UUID                REFERENCES product_categories (id) ON DELETE CASCADE,
    destination_location_id UUID                NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
    priority                INTEGER             NOT NULL DEFAULT 100 CHECK (priority >= 0),
    status                  putaway_rule_status NOT NULL DEFAULT 'active',
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_putaway_applies_to CHECK (
        (applies_to = 'all'      AND product_id IS NULL  AND category_id IS NULL)
     OR (applies_to = 'product'  AND product_id IS NOT NULL AND category_id IS NULL)
     OR (applies_to = 'category' AND category_id IS NOT NULL AND product_id IS NULL)
    )
);

CREATE INDEX idx_putaway_warehouse_priority ON putaway_rules (warehouse_id, priority)            WHERE status = 'active';
CREATE INDEX idx_putaway_company            ON putaway_rules (warehouse_id, company_id, priority) WHERE company_id IS NOT NULL AND status = 'active';

CALL attach_updated_at('putaway_rules');

-- -----------------------------------------------------------------------------
-- CURRENT STOCK
-- The authoritative real-time stock position. Maintained via atomic UPSERT.
-- quantity_reserved is kept in sync by trigger on stock_reservations.
-- quantity_available is a generated column (no storage divergence possible).
--
-- ISSUE 5 — DEADLOCK PREVENTION
-- When updating multiple current_stock rows in a single transaction (e.g.
-- multi-line outbound allocation), always acquire row locks in consistent
-- order: ORDER BY (company_id, product_id, location_id) before FOR UPDATE.
-- Use fn_lock_stock_rows_ordered() defined below.
-- -----------------------------------------------------------------------------

CREATE TABLE current_stock (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID          NOT NULL REFERENCES companies  (id) ON DELETE RESTRICT,
    product_id          UUID          NOT NULL REFERENCES products   (id) ON DELETE RESTRICT,
    location_id         UUID          NOT NULL REFERENCES locations  (id) ON DELETE RESTRICT,
    warehouse_id        UUID          NOT NULL REFERENCES warehouses (id) ON DELETE RESTRICT,
    lot_id              UUID          REFERENCES lots     (id) ON DELETE RESTRICT,
    package_id          UUID          REFERENCES packages (id) ON DELETE RESTRICT,
    quantity_on_hand    DECIMAL(15,4) NOT NULL DEFAULT 0,
    quantity_reserved   DECIMAL(15,4) NOT NULL DEFAULT 0,
    quantity_available  DECIMAL(15,4) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    status              stock_status  NOT NULL DEFAULT 'available',
    version             INTEGER       NOT NULL DEFAULT 0,
    last_movement_at    TIMESTAMPTZ,
    CONSTRAINT chk_qty_non_negative      CHECK (quantity_on_hand >= 0),
    CONSTRAINT chk_reserved_non_negative CHECK (quantity_reserved >= 0),
    CONSTRAINT chk_reserved_lte_on_hand  CHECK (quantity_reserved <= quantity_on_hand)
);

-- Partial unique indexes cover the three tracking modes
CREATE UNIQUE INDEX uq_stock_lot_position
    ON current_stock (company_id, product_id, location_id, lot_id)
    WHERE lot_id IS NOT NULL AND package_id IS NULL;

CREATE UNIQUE INDEX uq_stock_package_position
    ON current_stock (company_id, product_id, location_id, package_id)
    WHERE package_id IS NOT NULL;

CREATE UNIQUE INDEX uq_stock_bare_position
    ON current_stock (company_id, product_id, location_id)
    WHERE lot_id IS NULL AND package_id IS NULL;

CREATE INDEX idx_stock_company      ON current_stock (company_id);
CREATE INDEX idx_stock_product      ON current_stock (product_id);
CREATE INDEX idx_stock_location     ON current_stock (location_id);
CREATE INDEX idx_stock_lot          ON current_stock (lot_id) WHERE lot_id IS NOT NULL;
CREATE INDEX idx_stock_warehouse    ON current_stock (company_id, warehouse_id) WHERE quantity_on_hand > 0;
CREATE INDEX idx_stock_availability ON current_stock (company_id, product_id, status)
    INCLUDE (location_id, lot_id, quantity_available)
    WHERE quantity_available > 0;

-- -----------------------------------------------------------------------------
-- ISSUE 5 — Consistent lock-ordering helper to prevent deadlocks
-- Call this inside a transaction before updating multiple current_stock rows.
-- Returns the rows in a deterministic order WITH ACQUIRED LOCKS.
-- Application layer must always use this function rather than ad-hoc SELECTs.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_lock_stock_rows_ordered(p_stock_ids UUID[])
RETURNS SETOF current_stock LANGUAGE sql AS $$
    SELECT *
    FROM   current_stock
    WHERE  id = ANY(p_stock_ids)
    ORDER  BY company_id, product_id, location_id
    FOR    UPDATE;
$$;

-- =============================================================================
-- INVENTORY LEDGER (APPEND-ONLY, PARTITIONED BY MONTH)
--
-- ISSUE 2 — LEDGER DEDUPLICATION
-- idempotency_key: application-generated SHA-256 of
--   (company_id || reference_type || reference_id || movement_type
--    || product_id || COALESCE(lot_id,'') || COALESCE(from_location_id,'')
--    || COALESCE(to_location_id,''))
--
-- The inventory_ledger_dedup table provides a global, non-partitioned
-- unique index on idempotency_key that the partition architecture prevents
-- being placed on the partitioned table itself.
-- =============================================================================

CREATE TABLE inventory_ledger (
    id               UUID            NOT NULL DEFAULT gen_random_uuid(),
    company_id       UUID            NOT NULL REFERENCES companies  (id),
    product_id       UUID            NOT NULL REFERENCES products   (id),
    lot_id           UUID            REFERENCES lots      (id),
    package_id       UUID            REFERENCES packages  (id),
    from_location_id UUID            REFERENCES locations (id),
    to_location_id   UUID            REFERENCES locations (id),
    movement_type    movement_type   NOT NULL,
    quantity         DECIMAL(15,4)   NOT NULL CHECK (quantity > 0),
    reference_type   ledger_ref_type NOT NULL,
    reference_id     UUID            NOT NULL,
    operator_id      UUID            NOT NULL REFERENCES users (id),
    -- ISSUE 2: generated by application before INSERT; NULL allowed for legacy rows
    idempotency_key  TEXT,
    notes            TEXT,
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

ALTER TABLE inventory_ledger ADD PRIMARY KEY (id, created_at);

CREATE INDEX idx_ledger_company    ON inventory_ledger (company_id, created_at DESC);
CREATE INDEX idx_ledger_product    ON inventory_ledger (product_id, created_at DESC);
CREATE INDEX idx_ledger_reference  ON inventory_ledger (reference_type, reference_id);
CREATE INDEX idx_ledger_lot        ON inventory_ledger (lot_id) WHERE lot_id IS NOT NULL;
CREATE INDEX idx_ledger_idem_key   ON inventory_ledger (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Append-only guard
CREATE OR REPLACE FUNCTION fn_ledger_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'inventory_ledger is append-only: % on row % is forbidden', TG_OP, OLD.id;
END;
$$;

CREATE TRIGGER trg_ledger_no_update BEFORE UPDATE ON inventory_ledger FOR EACH ROW EXECUTE FUNCTION fn_ledger_immutable();
CREATE TRIGGER trg_ledger_no_delete BEFORE DELETE ON inventory_ledger FOR EACH ROW EXECUTE FUNCTION fn_ledger_immutable();

-- ISSUE 2: Global deduplication table (non-partitioned, so UNIQUE constraint works globally)
CREATE TABLE inventory_ledger_dedup (
    idempotency_key TEXT        PRIMARY KEY,
    company_id      UUID        NOT NULL,
    ledger_id       UUID        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_dedup_company ON inventory_ledger_dedup (company_id, created_at);

-- Trigger enforces deduplication on every INSERT into inventory_ledger
CREATE OR REPLACE FUNCTION fn_ledger_dedup_check()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.idempotency_key IS NOT NULL THEN
        BEGIN
            INSERT INTO inventory_ledger_dedup (idempotency_key, company_id, ledger_id)
            VALUES (NEW.idempotency_key, NEW.company_id, NEW.id);
        EXCEPTION WHEN unique_violation THEN
            -- Raise a recognizable SQLSTATE so the application can detect and skip gracefully
            RAISE EXCEPTION
                USING MESSAGE = format('inventory_ledger duplicate: key % already recorded', NEW.idempotency_key),
                      ERRCODE = 'unique_violation',
                      DETAIL  = format('Existing ledger entry for idempotency_key=%s', NEW.idempotency_key);
        END;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ledger_dedup_check
    BEFORE INSERT ON inventory_ledger
    FOR EACH ROW EXECUTE FUNCTION fn_ledger_dedup_check();

-- Monthly partitions 2025-01 through 2027-06
DO $$
DECLARE
    v_month DATE := '2025-01-01';
    v_end   DATE := '2027-07-01';
    v_next  DATE;
    v_name  TEXT;
BEGIN
    WHILE v_month < v_end LOOP
        v_next := v_month + INTERVAL '1 month';
        v_name := 'inventory_ledger_' || TO_CHAR(v_month, 'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF inventory_ledger FOR VALUES FROM (%L) TO (%L)',
            v_name, v_month, v_next
        );
        v_month := v_next;
    END LOOP;
END;
$$;

-- ISSUE 7: DEFAULT partition catches any row outside defined ranges — prevents INSERT failure.
-- A monitoring alert MUST fire when this partition accumulates rows (signals missing partition).
CREATE TABLE inventory_ledger_default PARTITION OF inventory_ledger DEFAULT;

-- -----------------------------------------------------------------------------
-- BARCODES
-- -----------------------------------------------------------------------------

CREATE TABLE barcodes (
    id             UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type    barcode_entity_type NOT NULL,
    entity_id      UUID                NOT NULL,
    barcode_value  TEXT                NOT NULL UNIQUE,
    barcode_format barcode_format      NOT NULL DEFAULT 'code128',
    is_primary     BOOLEAN             NOT NULL DEFAULT TRUE,
    generated_at   TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_barcodes_value  ON barcodes (barcode_value);
CREATE INDEX idx_barcodes_entity ON barcodes (entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- STOCK RESERVATIONS
-- Drives current_stock.quantity_reserved via trigger (ISSUE 1 fix).
-- -----------------------------------------------------------------------------

CREATE TABLE stock_reservations (
    id                UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID               NOT NULL REFERENCES companies  (id),
    product_id        UUID               NOT NULL REFERENCES products   (id),
    location_id       UUID               NOT NULL REFERENCES locations  (id),
    lot_id            UUID               REFERENCES lots (id),
    outbound_order_id UUID               NOT NULL,
    quantity          DECIMAL(15,4)      NOT NULL CHECK (quantity > 0),
    status            reservation_status NOT NULL DEFAULT 'active',
    created_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reservations_order   ON stock_reservations (outbound_order_id);
CREATE INDEX idx_reservations_company ON stock_reservations (company_id, product_id, status);
CREATE INDEX idx_reservations_stock   ON stock_reservations (company_id, product_id, location_id, status);

CALL attach_updated_at('stock_reservations');

-- ISSUE 1: Keep quantity_reserved strictly equal to SUM(active reservations)
CREATE OR REPLACE FUNCTION fn_sync_quantity_reserved()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_cid   UUID;  v_pid  UUID;  v_lid  UUID;  v_lotid UUID;
    v_reserved DECIMAL(15,4);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_cid := OLD.company_id;  v_pid := OLD.product_id;
        v_lid := OLD.location_id; v_lotid := OLD.lot_id;
    ELSE
        v_cid := NEW.company_id;  v_pid := NEW.product_id;
        v_lid := NEW.location_id; v_lotid := NEW.lot_id;
    END IF;

    SELECT COALESCE(SUM(quantity), 0) INTO v_reserved
    FROM   stock_reservations
    WHERE  company_id  = v_cid
      AND  product_id  = v_pid
      AND  location_id = v_lid
      AND  (lot_id = v_lotid OR (lot_id IS NULL AND v_lotid IS NULL))
      AND  status = 'active';

    UPDATE current_stock
    SET    quantity_reserved = v_reserved,
           version           = version + 1
    WHERE  company_id  = v_cid
      AND  product_id  = v_pid
      AND  location_id = v_lid
      AND  (lot_id = v_lotid OR (lot_id IS NULL AND v_lotid IS NULL));

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_reserved
    AFTER INSERT OR UPDATE OF status, quantity OR DELETE ON stock_reservations
    FOR EACH ROW EXECUTE FUNCTION fn_sync_quantity_reserved();

-- Periodic reconciliation (schedule weekly via BullMQ or pg_cron)
-- Detects any drift between current_stock.quantity_reserved and sum of active reservations.
CREATE OR REPLACE FUNCTION fn_reconcile_reservations()
RETURNS TABLE(company_id UUID, product_id UUID, location_id UUID,
              lot_id UUID, stored_reserved DECIMAL(15,4),
              actual_sum DECIMAL(15,4), drift DECIMAL(15,4))
LANGUAGE sql AS $$
    SELECT
        cs.company_id, cs.product_id, cs.location_id, cs.lot_id,
        cs.quantity_reserved                        AS stored_reserved,
        COALESCE(rs.active_sum, 0)                  AS actual_sum,
        cs.quantity_reserved - COALESCE(rs.active_sum, 0) AS drift
    FROM   current_stock cs
    LEFT   JOIN (
        SELECT company_id, product_id, location_id, lot_id,
               SUM(quantity) AS active_sum
        FROM   stock_reservations
        WHERE  status = 'active'
        GROUP  BY company_id, product_id, location_id, lot_id
    ) rs USING (company_id, product_id, location_id, lot_id)
    WHERE  ABS(cs.quantity_reserved - COALESCE(rs.active_sum, 0)) > 0.001;
$$;

-- -----------------------------------------------------------------------------
-- INBOUND ORDERS
-- -----------------------------------------------------------------------------

CREATE TABLE inbound_orders (
    id                    UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID                 NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
    order_number          TEXT                 NOT NULL UNIQUE DEFAULT '',
    status                inbound_order_status NOT NULL DEFAULT 'draft',
    expected_arrival_date DATE                 NOT NULL,
    client_reference      TEXT,
    notes                 TEXT,
    confirmed_at          TIMESTAMPTZ,
    completed_at          TIMESTAMPTZ,
    cancelled_at          TIMESTAMPTZ,
    cancelled_by          UUID                 REFERENCES users (id),
    created_by            UUID                 NOT NULL REFERENCES users (id),
    created_at            TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inbound_company ON inbound_orders (company_id);
CREATE INDEX idx_inbound_status  ON inbound_orders (status);
CREATE INDEX idx_inbound_date    ON inbound_orders (expected_arrival_date);

CALL attach_updated_at('inbound_orders');

CREATE OR REPLACE FUNCTION fn_inbound_order_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.order_number = '' OR NEW.order_number IS NULL THEN
        NEW.order_number := next_seq_number('INB');
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_inbound_order_number BEFORE INSERT ON inbound_orders FOR EACH ROW EXECUTE FUNCTION fn_inbound_order_number();

CREATE TABLE inbound_order_lines (
    id                   UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    inbound_order_id     UUID              NOT NULL REFERENCES inbound_orders (id) ON DELETE CASCADE,
    product_id           UUID              NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
    expected_quantity    DECIMAL(15,4)     NOT NULL CHECK (expected_quantity > 0),
    received_quantity    DECIMAL(15,4)     NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
    expected_lot_number  TEXT,
    expected_expiry_date DATE,
    discrepancy_type     discrepancy_type  NOT NULL DEFAULT 'none',
    discrepancy_notes    TEXT,
    qc_status            inbound_qc_status NOT NULL DEFAULT 'not_required',
    line_number          INTEGER           NOT NULL,
    created_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inbound_lines_order    ON inbound_order_lines (inbound_order_id);
CREATE INDEX idx_inbound_lines_compound ON inbound_order_lines (inbound_order_id, product_id);

CALL attach_updated_at('inbound_order_lines');

-- ISSUE 3: received_quantity <= expected_quantity × 1.10 (10% tolerance, override by WH Manager only)
CREATE OR REPLACE FUNCTION fn_guard_received_quantity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.received_quantity > NEW.expected_quantity * 1.10 THEN
        RAISE EXCEPTION
            'received_quantity (%) exceeds 110%% of expected_quantity (%) on line %',
            NEW.received_quantity, NEW.expected_quantity, NEW.id;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_guard_received_qty
    BEFORE UPDATE OF received_quantity ON inbound_order_lines
    FOR EACH ROW EXECUTE FUNCTION fn_guard_received_quantity();

CREATE TABLE inbound_order_line_lots (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id                 UUID          NOT NULL REFERENCES inbound_order_lines (id) ON DELETE CASCADE,
    lot_id                  UUID          NOT NULL REFERENCES lots (id) ON DELETE RESTRICT,
    quantity                DECIMAL(15,4) NOT NULL CHECK (quantity > 0),
    destination_location_id UUID          REFERENCES locations (id),
    received_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inbound_line_lots ON inbound_order_line_lots (line_id);

-- -----------------------------------------------------------------------------
-- OUTBOUND ORDERS
-- -----------------------------------------------------------------------------

CREATE TABLE outbound_orders (
    id                  UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID                  NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
    order_number        TEXT                  NOT NULL UNIQUE DEFAULT '',
    status              outbound_order_status NOT NULL DEFAULT 'draft',
    destination_address TEXT                  NOT NULL,
    required_ship_date  DATE                  NOT NULL,
    carrier             TEXT,
    tracking_number     TEXT,
    client_reference    TEXT,
    notes               TEXT,
    confirmed_at        TIMESTAMPTZ,
    picking_started_at  TIMESTAMPTZ,
    shipped_at          TIMESTAMPTZ,
    cancelled_at        TIMESTAMPTZ,
    cancelled_by        UUID REFERENCES users (id),
    created_by          UUID NOT NULL REFERENCES users (id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbound_company   ON outbound_orders (company_id);
CREATE INDEX idx_outbound_status    ON outbound_orders (status);
CREATE INDEX idx_outbound_ship_date ON outbound_orders (required_ship_date);

CALL attach_updated_at('outbound_orders');

CREATE OR REPLACE FUNCTION fn_outbound_order_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.order_number = '' OR NEW.order_number IS NULL THEN
        NEW.order_number := next_seq_number('OUT');
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_outbound_order_number BEFORE INSERT ON outbound_orders FOR EACH ROW EXECUTE FUNCTION fn_outbound_order_number();

ALTER TABLE stock_reservations
    ADD CONSTRAINT fk_reservations_outbound
    FOREIGN KEY (outbound_order_id) REFERENCES outbound_orders (id) ON DELETE CASCADE;

CREATE TABLE outbound_order_lines (
    id                 UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
    outbound_order_id  UUID                 NOT NULL REFERENCES outbound_orders (id) ON DELETE CASCADE,
    product_id         UUID                 NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
    requested_quantity DECIMAL(15,4)        NOT NULL CHECK (requested_quantity > 0),
    picked_quantity    DECIMAL(15,4)        NOT NULL DEFAULT 0 CHECK (picked_quantity >= 0),
    specific_lot_id    UUID                 REFERENCES lots (id),
    status             outbound_line_status NOT NULL DEFAULT 'pending',
    line_number        INTEGER              NOT NULL,
    created_at         TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbound_lines_order   ON outbound_order_lines (outbound_order_id);
CREATE INDEX idx_outbound_lines_product ON outbound_order_lines (product_id);

CALL attach_updated_at('outbound_order_lines');

CREATE TABLE outbound_allocations (
    id                     UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    outbound_order_line_id UUID              NOT NULL REFERENCES outbound_order_lines (id) ON DELETE CASCADE,
    location_id            UUID              NOT NULL REFERENCES locations (id),
    lot_id                 UUID              REFERENCES lots (id),
    allocated_quantity     DECIMAL(15,4)     NOT NULL CHECK (allocated_quantity > 0),
    picked_quantity        DECIMAL(15,4)     NOT NULL DEFAULT 0 CHECK (picked_quantity >= 0),
    status                 allocation_status NOT NULL DEFAULT 'allocated',
    pick_step_number       INTEGER           NOT NULL DEFAULT 1,
    created_at             TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    -- ISSUE 3: DB-level enforcement of pick ≤ allocation
    CONSTRAINT chk_picked_lte_allocated CHECK (picked_quantity <= allocated_quantity)
);

CREATE INDEX idx_allocations_line     ON outbound_allocations (outbound_order_line_id);
CREATE INDEX idx_allocations_location ON outbound_allocations (location_id);
CREATE INDEX idx_allocations_step     ON outbound_allocations (outbound_order_line_id, pick_step_number) WHERE status = 'allocated';

CALL attach_updated_at('outbound_allocations');

-- -----------------------------------------------------------------------------
-- TASKS
-- -----------------------------------------------------------------------------

CREATE TABLE tasks (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type      task_type     NOT NULL,
    reference_type task_ref_type NOT NULL,
    reference_id   UUID          NOT NULL,
    company_id     UUID          NOT NULL REFERENCES companies  (id),
    warehouse_id   UUID          NOT NULL REFERENCES warehouses (id),
    priority       task_priority NOT NULL DEFAULT 'medium',
    status         task_status   NOT NULL DEFAULT 'pending',
    assigned_to    UUID          REFERENCES users (id),
    assigned_at    TIMESTAMPTZ,
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    completed_by   UUID          REFERENCES users (id),
    blocked_reason TEXT,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_status         ON tasks (status);
CREATE INDEX idx_tasks_assigned_to    ON tasks (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_tasks_reference      ON tasks (reference_type, reference_id);
CREATE INDEX idx_tasks_company_status ON tasks (company_id, status);
CREATE INDEX idx_tasks_dispatch       ON tasks (warehouse_id, task_type, status, priority DESC, created_at ASC) WHERE status IN ('pending','assigned');

CALL attach_updated_at('tasks');

CREATE TABLE task_step_logs (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id              UUID        NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
    step_number          INTEGER     NOT NULL,
    attempt_number       INTEGER     NOT NULL DEFAULT 1,
    step_type            step_type   NOT NULL,
    scanned_value        TEXT,
    resolved_entity_type TEXT,
    resolved_entity_id   UUID,
    quantity             DECIMAL(15,4),
    operator_id          UUID        NOT NULL REFERENCES users (id),
    result               step_result NOT NULL DEFAULT 'success',
    error_message        TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_task_step_attempt UNIQUE (task_id, step_number, attempt_number)
);

CREATE INDEX idx_step_logs_task ON task_step_logs (task_id, step_number);

-- -----------------------------------------------------------------------------
-- QC RULES
-- -----------------------------------------------------------------------------

CREATE TABLE qc_rules (
    id                UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT              NOT NULL,
    company_id        UUID              REFERENCES companies (id) ON DELETE CASCADE,
    operation_type    qc_operation_type NOT NULL DEFAULT 'inbound',
    applies_to        qc_applies_to     NOT NULL DEFAULT 'all_products',
    product_id        UUID              REFERENCES products (id) ON DELETE CASCADE,
    category_id       UUID              REFERENCES product_categories (id) ON DELETE CASCADE,
    check_type        qc_check_type     NOT NULL DEFAULT 'pass_fail',
    instructions_text TEXT              NOT NULL,
    measure_min       DECIMAL(12,4),
    measure_max       DECIMAL(12,4),
    measure_unit      TEXT,
    require_photo     BOOLEAN           NOT NULL DEFAULT FALSE,
    frequency_type    qc_frequency_type NOT NULL DEFAULT 'every_operation',
    frequency_value   DECIMAL(5,4),
    status            qc_rule_status    NOT NULL DEFAULT 'active',
    created_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_qc_applies_to CHECK (
        (applies_to = 'all_products' AND product_id IS NULL     AND category_id IS NULL)
     OR (applies_to = 'product'      AND product_id IS NOT NULL  AND category_id IS NULL)
     OR (applies_to = 'category'     AND category_id IS NOT NULL AND product_id IS NULL)
    ),
    CONSTRAINT chk_measure_fields CHECK (
        check_type <> 'measure'
        OR (measure_min IS NOT NULL AND measure_max IS NOT NULL AND measure_unit IS NOT NULL)
    ),
    CONSTRAINT chk_measure_range CHECK (measure_min IS NULL OR measure_max IS NULL OR measure_min <= measure_max)
);

CREATE INDEX idx_qc_rules_operation ON qc_rules (operation_type, status);
CREATE INDEX idx_qc_rules_company   ON qc_rules (company_id, operation_type, status) WHERE company_id IS NOT NULL;

CALL attach_updated_at('qc_rules');

CREATE TABLE qc_checks (
    id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    qc_rule_id            UUID            NOT NULL REFERENCES qc_rules (id),
    task_id               UUID            NOT NULL REFERENCES tasks (id),
    inbound_order_line_id UUID            REFERENCES inbound_order_lines (id),
    company_id            UUID            NOT NULL REFERENCES companies (id),
    product_id            UUID            NOT NULL REFERENCES products (id),
    lot_id                UUID            REFERENCES lots (id),
    quantity_checked      DECIMAL(15,4),
    result                qc_check_result NOT NULL DEFAULT 'pending',
    fail_reason           TEXT,
    measure_value         DECIMAL(12,4),
    photo_urls            TEXT[],
    operator_id           UUID            REFERENCES users (id),
    completed_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qc_checks_task    ON qc_checks (task_id);
CREATE INDEX idx_qc_checks_company ON qc_checks (company_id, result);
CREATE INDEX idx_qc_checks_product ON qc_checks (product_id);

CALL attach_updated_at('qc_checks');

CREATE TABLE qc_alerts (
    id                     UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    qc_check_id            UUID                NOT NULL REFERENCES qc_checks (id),
    company_id             UUID                NOT NULL REFERENCES companies (id),
    product_id             UUID                NOT NULL REFERENCES products (id),
    lot_id                 UUID                REFERENCES lots (id),
    quantity_affected      DECIMAL(15,4)       NOT NULL CHECK (quantity_affected > 0),
    quarantine_location_id UUID                NOT NULL REFERENCES locations (id),
    stage                  qc_alert_stage      NOT NULL DEFAULT 'open',
    resolution             qc_alert_resolution,
    resolution_notes       TEXT,
    resolved_by            UUID                REFERENCES users (id),
    resolved_at            TIMESTAMPTZ,
    client_notified        BOOLEAN             NOT NULL DEFAULT FALSE,
    created_at             TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_resolved_fields CHECK (
        stage <> 'resolved'
        OR (resolution IS NOT NULL AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
    )
);

CREATE INDEX idx_qc_alerts_company ON qc_alerts (company_id, stage);
CREATE INDEX idx_qc_alerts_stage   ON qc_alerts (stage) WHERE stage <> 'resolved';

CALL attach_updated_at('qc_alerts');

-- -----------------------------------------------------------------------------
-- BILLING PLANS
--
-- ISSUE 6 — FINANCIAL PRECISION
-- All rate columns use DECIMAL(10,4) — 4 decimal places for per-unit rates.
-- All amount columns use DECIMAL(14,2) — 2 decimal places for currency (SAR/USD).
-- Computation rule: amount = ROUND(quantity * unit_price, 2) — applied in trigger.
-- Each billing_transaction stores rate_snapshot (JSONB) for auditability.
-- Never accumulate line amounts; always recompute invoice totals from line sums.
-- -----------------------------------------------------------------------------

CREATE TABLE billing_plans (
    id                     UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   TEXT                  NOT NULL,
    storage_basis          billing_storage_basis NOT NULL DEFAULT 'per_pallet',
    storage_rate_daily     DECIMAL(10,4)         NOT NULL DEFAULT 0 CHECK (storage_rate_daily >= 0),
    inbound_basis          billing_inbound_basis NOT NULL DEFAULT 'per_line',
    inbound_rate           DECIMAL(10,4)         NOT NULL DEFAULT 0 CHECK (inbound_rate >= 0),
    outbound_shipment_rate DECIMAL(10,4)         NOT NULL DEFAULT 0 CHECK (outbound_shipment_rate >= 0),
    outbound_line_rate     DECIMAL(10,4)         NOT NULL DEFAULT 0 CHECK (outbound_line_rate >= 0),
    returns_rate           DECIMAL(10,4)         NOT NULL DEFAULT 0 CHECK (returns_rate >= 0),
    minimum_monthly_fee    DECIMAL(12,2)         NOT NULL DEFAULT 0 CHECK (minimum_monthly_fee >= 0),
    fixed_subscription_fee DECIMAL(12,2)         NOT NULL DEFAULT 0 CHECK (fixed_subscription_fee >= 0),
    status                 billing_plan_status   NOT NULL DEFAULT 'active',
    created_at             TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CALL attach_updated_at('billing_plans');

CREATE TABLE billing_plan_vas_rates (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_plan_id UUID        NOT NULL REFERENCES billing_plans (id) ON DELETE CASCADE,
    vas_name        TEXT        NOT NULL,
    description     TEXT,
    uom             TEXT        NOT NULL,
    rate            DECIMAL(10,4) NOT NULL CHECK (rate >= 0)
);
CREATE INDEX idx_vas_rates_plan ON billing_plan_vas_rates (billing_plan_id);

CREATE TABLE client_billing_plans (
    id                            UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                    UUID               NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
    billing_plan_id               UUID               NOT NULL REFERENCES billing_plans (id) ON DELETE RESTRICT,
    effective_from                DATE               NOT NULL,
    effective_until               DATE,
    custom_storage_rate_daily     DECIMAL(10,4),
    custom_inbound_rate           DECIMAL(10,4),
    custom_outbound_shipment_rate DECIMAL(10,4),
    custom_outbound_line_rate     DECIMAL(10,4),
    custom_minimum_monthly_fee    DECIMAL(12,2),
    custom_returns_rate           DECIMAL(10,4),
    custom_fixed_subscription_fee DECIMAL(12,2),
    status                        client_plan_status NOT NULL DEFAULT 'active',
    created_at                    TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at                    TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_plan_date_range CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE UNIQUE INDEX uq_one_active_plan_per_company
    ON client_billing_plans (company_id)
    WHERE status = 'active';

CREATE INDEX idx_client_plans_company ON client_billing_plans (company_id, status);

CALL attach_updated_at('client_billing_plans');

-- -----------------------------------------------------------------------------
-- BILLING TRANSACTIONS (APPEND-ONLY, PARTITIONED BY service_date)
--
-- ISSUE 6: amount is always computed as ROUND(quantity * unit_price, 2)
--          by the BEFORE INSERT trigger — application never provides amount.
--          rate_snapshot stores all rates at billing time for reproducibility.
-- ISSUE 7: DEFAULT partition catches data outside pre-created range.
-- -----------------------------------------------------------------------------

CREATE TABLE billing_transactions (
    id                   UUID          NOT NULL DEFAULT gen_random_uuid(),
    company_id           UUID          NOT NULL REFERENCES companies (id),
    invoice_id           UUID,
    billing_plan_id      UUID          REFERENCES billing_plans (id),
    charge_type          charge_type   NOT NULL,
    service_date         DATE          NOT NULL,
    service_period_start DATE,
    service_period_end   DATE,
    quantity             DECIMAL(15,4) NOT NULL CHECK (quantity > 0),
    unit_description     TEXT          NOT NULL,
    unit_price           DECIMAL(10,4) NOT NULL CHECK (unit_price >= 0),
    amount               DECIMAL(14,2) NOT NULL,
    reference_type       TEXT          NOT NULL,
    reference_id         UUID          NOT NULL,
    description          TEXT          NOT NULL,
    rate_snapshot        JSONB         NOT NULL DEFAULT '{}',
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (service_date);

ALTER TABLE billing_transactions ADD PRIMARY KEY (id, service_date);

CREATE INDEX idx_billing_company    ON billing_transactions (company_id, service_date DESC);
CREATE INDEX idx_billing_uninvoiced ON billing_transactions (company_id, invoice_id) WHERE invoice_id IS NULL;
CREATE INDEX idx_billing_service    ON billing_transactions (service_date);
CREATE INDEX idx_billing_invoice_id ON billing_transactions (invoice_id) WHERE invoice_id IS NOT NULL;

-- ISSUE 6: amount = ROUND(quantity × unit_price, 2) — enforced at insert time
CREATE OR REPLACE FUNCTION fn_billing_tx_compute_amount()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.amount := ROUND(NEW.quantity * NEW.unit_price, 2);
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_billing_compute_amount
    BEFORE INSERT ON billing_transactions
    FOR EACH ROW EXECUTE FUNCTION fn_billing_tx_compute_amount();

-- Immutability guard — only invoice_id may transition NULL→UUID after insert
CREATE OR REPLACE FUNCTION fn_billing_tx_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'billing_transactions are immutable: DELETE forbidden (id: %)', OLD.id;
    END IF;
    IF OLD.invoice_id IS NOT NULL AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
        RAISE EXCEPTION 'billing_transactions: invoice_id cannot change once set (id: %)', OLD.id;
    END IF;
    IF (NEW.company_id, NEW.charge_type, NEW.service_date, NEW.quantity,
        NEW.unit_price, NEW.amount, NEW.reference_id, NEW.description)
       IS DISTINCT FROM
       (OLD.company_id, OLD.charge_type, OLD.service_date, OLD.quantity,
        OLD.unit_price, OLD.amount, OLD.reference_id, OLD.description) THEN
        RAISE EXCEPTION 'billing_transactions core fields are immutable (id: %)', OLD.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_billing_immutable_update BEFORE UPDATE ON billing_transactions FOR EACH ROW EXECUTE FUNCTION fn_billing_tx_immutable();
CREATE TRIGGER trg_billing_immutable_delete BEFORE DELETE ON billing_transactions FOR EACH ROW EXECUTE FUNCTION fn_billing_tx_immutable();

-- Monthly partitions 2025-01 through 2027-06
DO $$
DECLARE
    v_month DATE := '2025-01-01';
    v_end   DATE := '2027-07-01';
    v_next  DATE;
    v_name  TEXT;
BEGIN
    WHILE v_month < v_end LOOP
        v_next := v_month + INTERVAL '1 month';
        v_name := 'billing_transactions_' || TO_CHAR(v_month, 'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF billing_transactions FOR VALUES FROM (%L) TO (%L)',
            v_name, v_month, v_next
        );
        v_month := v_next;
    END LOOP;
END;
$$;

-- ISSUE 7: DEFAULT partition as safety net
CREATE TABLE billing_transactions_default PARTITION OF billing_transactions DEFAULT;

-- -----------------------------------------------------------------------------
-- INVOICES
-- -----------------------------------------------------------------------------

CREATE TABLE invoices (
    id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           UUID           NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
    invoice_number       TEXT           NOT NULL UNIQUE DEFAULT '',
    billing_period_start DATE           NOT NULL,
    billing_period_end   DATE           NOT NULL,
    status               invoice_status NOT NULL DEFAULT 'draft',
    subtotal             DECIMAL(14,2)  NOT NULL DEFAULT 0,
    tax_rate             DECIMAL(5,4)   NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate < 1),
    tax_amount           DECIMAL(14,2)  NOT NULL DEFAULT 0,
    total                DECIMAL(14,2)  NOT NULL DEFAULT 0,
    issued_date          DATE,
    due_date             DATE,
    posted_at            TIMESTAMPTZ,
    sent_at              TIMESTAMPTZ,
    voided_at            TIMESTAMPTZ,
    voided_by            UUID           REFERENCES users (id),
    credit_note_for      UUID           REFERENCES invoices (id),
    created_by           UUID           NOT NULL REFERENCES users (id),
    created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_billing_period      CHECK (billing_period_end >= billing_period_start),
    CONSTRAINT chk_posted_completeness CHECK (
        status = 'draft'
        OR (issued_date IS NOT NULL AND due_date IS NOT NULL AND posted_at IS NOT NULL)
    ),
    CONSTRAINT chk_tax_amounts CHECK (
        ABS(tax_amount - ROUND(subtotal * tax_rate, 2)) < 0.01 OR status = 'draft'
    ),
    CONSTRAINT chk_total CHECK (
        ABS(total - (subtotal + tax_amount)) < 0.01 OR status = 'draft'
    )
);

CREATE INDEX idx_invoices_company  ON invoices (company_id);
CREATE INDEX idx_invoices_status   ON invoices (status);
CREATE INDEX idx_invoices_due_date ON invoices (due_date) WHERE status NOT IN ('paid','void');

CALL attach_updated_at('invoices');

CREATE OR REPLACE FUNCTION fn_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.invoice_number = '' OR NEW.invoice_number IS NULL THEN
        NEW.invoice_number := next_seq_number('INV');
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_invoice_number BEFORE INSERT ON invoices FOR EACH ROW EXECUTE FUNCTION fn_invoice_number();

CREATE OR REPLACE FUNCTION fn_recompute_invoice_totals(p_invoice_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_sub  DECIMAL(14,2);
    v_rate DECIMAL(5,4);
    v_tax  DECIMAL(14,2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_sub
    FROM   invoice_lines WHERE invoice_id = p_invoice_id;
    SELECT tax_rate INTO v_rate FROM invoices WHERE id = p_invoice_id;
    v_tax := ROUND(v_sub * v_rate, 2);
    UPDATE invoices
    SET    subtotal   = v_sub,
           tax_amount = v_tax,
           total      = v_sub + v_tax
    WHERE  id = p_invoice_id AND status = 'draft';
END;
$$;

CREATE TABLE invoice_lines (
    id                     UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id             UUID          NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
    billing_transaction_id UUID,
    charge_type            TEXT          NOT NULL,
    description            TEXT          NOT NULL,
    quantity               DECIMAL(15,4) NOT NULL,
    unit_description       TEXT          NOT NULL,
    unit_price             DECIMAL(10,4) NOT NULL,
    amount                 DECIMAL(14,2) NOT NULL,
    line_number            INTEGER       NOT NULL,
    period_start           DATE,
    period_end             DATE,
    created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_line_amount CHECK (ABS(amount - ROUND(quantity * unit_price, 2)) < 0.01)
);

CREATE INDEX idx_invoice_lines_invoice ON invoice_lines (invoice_id);

CREATE TABLE payments (
    id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id     UUID           NOT NULL REFERENCES invoices (id) ON DELETE RESTRICT,
    amount         DECIMAL(14,2)  NOT NULL CHECK (amount > 0),
    payment_date   DATE           NOT NULL,
    payment_method payment_method NOT NULL,
    reference      TEXT,
    notes          TEXT,
    recorded_by    UUID           NOT NULL REFERENCES users (id),
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON payments (invoice_id);

-- -----------------------------------------------------------------------------
-- RETURN ORDERS
-- -----------------------------------------------------------------------------

CREATE TABLE return_orders (
    id                         UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                 UUID                NOT NULL REFERENCES companies (id),
    order_number               TEXT                NOT NULL UNIQUE DEFAULT '',
    original_outbound_order_id UUID                REFERENCES outbound_orders (id),
    status                     return_order_status NOT NULL DEFAULT 'draft',
    notes                      TEXT,
    created_by                 UUID                NOT NULL REFERENCES users (id),
    created_at                 TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_return_orders_company ON return_orders (company_id);

CALL attach_updated_at('return_orders');

CREATE OR REPLACE FUNCTION fn_return_order_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.order_number = '' OR NEW.order_number IS NULL THEN
        NEW.order_number := next_seq_number('RTN');
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_return_order_number BEFORE INSERT ON return_orders FOR EACH ROW EXECUTE FUNCTION fn_return_order_number();

CREATE TABLE return_order_lines (
    id                UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
    return_order_id   UUID                   NOT NULL REFERENCES return_orders (id) ON DELETE CASCADE,
    product_id        UUID                   NOT NULL REFERENCES products (id),
    lot_id            UUID                   REFERENCES lots (id),
    expected_quantity DECIMAL(15,4)          NOT NULL CHECK (expected_quantity > 0),
    received_quantity DECIMAL(15,4)          NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
    condition         return_item_condition,
    disposition       return_item_disposition,
    created_at        TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_return_lines ON return_order_lines (return_order_id);

CALL attach_updated_at('return_order_lines');

-- -----------------------------------------------------------------------------
-- STOCK ADJUSTMENTS
-- -----------------------------------------------------------------------------

CREATE TABLE stock_adjustments (
    id           UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   UUID              NOT NULL REFERENCES companies  (id),
    warehouse_id UUID              NOT NULL REFERENCES warehouses (id),
    reason       TEXT              NOT NULL,
    status       adjustment_status NOT NULL DEFAULT 'draft',
    approved_by  UUID              REFERENCES users (id),
    approved_at  TIMESTAMPTZ,
    created_by   UUID              NOT NULL REFERENCES users (id),
    created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_approved_fields CHECK (
        status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
    )
);

CALL attach_updated_at('stock_adjustments');

CREATE TABLE stock_adjustment_lines (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id   UUID          NOT NULL REFERENCES stock_adjustments (id) ON DELETE CASCADE,
    product_id      UUID          NOT NULL REFERENCES products (id),
    location_id     UUID          NOT NULL REFERENCES locations (id),
    lot_id          UUID          REFERENCES lots (id),
    quantity_before DECIMAL(15,4) NOT NULL,
    quantity_after  DECIMAL(15,4) NOT NULL CHECK (quantity_after >= 0),
    quantity_change DECIMAL(15,4) GENERATED ALWAYS AS (quantity_after - quantity_before) STORED,
    reason_note     TEXT
);

CREATE OR REPLACE FUNCTION fn_validate_adjustment_qty()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_actual DECIMAL(15,4);
    v_line   RECORD;
BEGIN
    IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
        FOR v_line IN
            SELECT * FROM stock_adjustment_lines WHERE adjustment_id = NEW.id
        LOOP
            SELECT quantity_on_hand INTO v_actual
            FROM   current_stock
            WHERE  product_id  = v_line.product_id
              AND  location_id = v_line.location_id
              AND  (lot_id = v_line.lot_id OR (lot_id IS NULL AND v_line.lot_id IS NULL));

            v_actual := COALESCE(v_actual, 0);

            IF ABS(v_actual - v_line.quantity_before) > 0.001 THEN
                RAISE EXCEPTION
                    'Adjustment line %: quantity_before (%) does not match actual stock (%) — concurrent modification detected',
                    v_line.id, v_line.quantity_before, v_actual;
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_adjustment_qty
    BEFORE UPDATE OF status ON stock_adjustments
    FOR EACH ROW EXECUTE FUNCTION fn_validate_adjustment_qty();

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS
-- -----------------------------------------------------------------------------

CREATE TABLE notifications (
    id             UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID                 REFERENCES companies (id),
    user_id        UUID                 REFERENCES users (id),
    type           TEXT                 NOT NULL,
    title          TEXT                 NOT NULL,
    body           TEXT                 NOT NULL,
    reference_type TEXT,
    reference_id   UUID,
    channel        notification_channel NOT NULL DEFAULT 'in_app',
    is_read        BOOLEAN              NOT NULL DEFAULT FALSE,
    read_at        TIMESTAMPTZ,
    email_sent     BOOLEAN              NOT NULL DEFAULT FALSE,
    email_sent_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user    ON notifications (user_id, is_read)    WHERE user_id IS NOT NULL;
CREATE INDEX idx_notifications_company ON notifications (company_id, is_read)  WHERE company_id IS NOT NULL;
CREATE INDEX idx_notifications_cleanup ON notifications (created_at)           WHERE is_read = TRUE;

-- -----------------------------------------------------------------------------
-- IDEMPOTENCY KEYS
-- Redis is a fast-path cache; this table is the authoritative record.
-- -----------------------------------------------------------------------------

CREATE TABLE idempotency_keys (
    key             TEXT        PRIMARY KEY,
    user_id         UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    endpoint        TEXT        NOT NULL,
    response_status SMALLINT,
    response_body   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
    CONSTRAINT chk_key_length CHECK (LENGTH(key) BETWEEN 32 AND 128)
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys (expires_at);
CREATE INDEX idx_idempotency_user    ON idempotency_keys (user_id);

-- -----------------------------------------------------------------------------
-- REPORT JOBS
-- -----------------------------------------------------------------------------

CREATE TABLE report_jobs (
    id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID              REFERENCES companies (id),
    requested_by  UUID              NOT NULL REFERENCES users (id),
    report_type   TEXT              NOT NULL,
    parameters    JSONB             NOT NULL DEFAULT '{}',
    status        report_job_status NOT NULL DEFAULT 'pending',
    file_url      TEXT,
    error_message TEXT,
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_jobs_user   ON report_jobs (requested_by, created_at DESC);
CREATE INDEX idx_report_jobs_status ON report_jobs (status) WHERE status IN ('pending','processing');

-- -----------------------------------------------------------------------------
-- AUDIT LOGS (APPEND-ONLY, PARTITIONED BY QUARTER)
-- -----------------------------------------------------------------------------

CREATE TABLE audit_logs (
    id             UUID        NOT NULL DEFAULT gen_random_uuid(),
    actor_id       UUID        REFERENCES users (id),
    actor_email    TEXT        NOT NULL,
    actor_name     TEXT        NOT NULL,
    actor_role     TEXT        NOT NULL,
    company_id     UUID        REFERENCES companies (id),
    action         TEXT        NOT NULL,
    resource_type  TEXT        NOT NULL,
    resource_id    UUID        NOT NULL,
    previous_state JSONB,
    new_state      JSONB,
    ip_address     TEXT,
    user_agent     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

ALTER TABLE audit_logs ADD PRIMARY KEY (id, created_at);

CREATE INDEX idx_audit_actor    ON audit_logs (actor_id,     created_at DESC) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_audit_resource ON audit_logs (resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_company  ON audit_logs (company_id,   created_at DESC) WHERE company_id IS NOT NULL;

CREATE OR REPLACE FUNCTION fn_audit_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only: % is forbidden', TG_OP;
END;
$$;
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION fn_audit_immutable();
CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION fn_audit_immutable();

-- Quarterly partitions 2025 Q1 – 2027 Q4
DO $$
DECLARE
    arr  DATE[] := ARRAY[
        '2025-01-01','2025-04-01','2025-07-01','2025-10-01',
        '2026-01-01','2026-04-01','2026-07-01','2026-10-01',
        '2027-01-01','2027-04-01','2027-07-01','2027-10-01',
        '2028-01-01'
    ];
    i    INT;
    v_name TEXT;
BEGIN
    FOR i IN 1..array_length(arr,1)-1 LOOP
        v_name := 'audit_logs_' || TO_CHAR(arr[i],'YYYY') || '_q' || TO_CHAR(arr[i],'Q');
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
            v_name, arr[i], arr[i+1]
        );
    END LOOP;
END;
$$;

-- ISSUE 7: DEFAULT partition as safety net
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;

-- =============================================================================
-- PARTITION AUTO-CREATION
-- Schedule fn_create_next_partitions() monthly via pg_cron or BullMQ cron.
-- ISSUE 7: If cron fails, DEFAULT partitions prevent INSERT errors.
--          Monitor DEFAULT partition size via fn_monitor_default_partitions().
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_create_next_partitions(p_months_ahead INT DEFAULT 3)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_month DATE;
    v_next  DATE;
    v_name  TEXT;
    v_count INT := 0;
BEGIN
    FOR i IN 1..p_months_ahead LOOP
        v_month := DATE_TRUNC('month', NOW() + (i || ' months')::INTERVAL)::DATE;
        v_next  := (v_month + INTERVAL '1 month')::DATE;

        v_name := 'inventory_ledger_' || TO_CHAR(v_month, 'YYYY_MM');
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = v_name) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF inventory_ledger FOR VALUES FROM (%L) TO (%L)',
                v_name, v_month, v_next
            );
            v_count := v_count + 1;
        END IF;

        v_name := 'billing_transactions_' || TO_CHAR(v_month, 'YYYY_MM');
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = v_name) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF billing_transactions FOR VALUES FROM (%L) TO (%L)',
                v_name, v_month, v_next
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION fn_create_next_audit_partitions(p_quarters_ahead INT DEFAULT 2)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_qstart DATE;
    v_qend   DATE;
    v_name   TEXT;
    v_count  INT := 0;
BEGIN
    FOR i IN 1..p_quarters_ahead LOOP
        v_qstart := DATE_TRUNC('quarter', NOW() + (i || ' quarter')::INTERVAL)::DATE;
        v_qend   := (v_qstart + INTERVAL '3 months')::DATE;
        v_name   := 'audit_logs_' || TO_CHAR(v_qstart,'YYYY') || '_q' || TO_CHAR(v_qstart,'Q');
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = v_name) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
                v_name, v_qstart, v_qend
            );
            v_count := v_count + 1;
        END IF;
    END LOOP;
    RETURN v_count;
END;
$$;

-- ISSUE 7: Monitor DEFAULT partitions — fire alert if non-empty
CREATE OR REPLACE FUNCTION fn_monitor_default_partitions()
RETURNS TABLE(partition_name TEXT, row_count BIGINT) LANGUAGE plpgsql AS $$
DECLARE
    v_count BIGINT;
BEGIN
    EXECUTE 'SELECT COUNT(*) FROM inventory_ledger_default'    INTO v_count; IF v_count > 0 THEN partition_name := 'inventory_ledger_default';    row_count := v_count; RETURN NEXT; END IF;
    EXECUTE 'SELECT COUNT(*) FROM billing_transactions_default' INTO v_count; IF v_count > 0 THEN partition_name := 'billing_transactions_default'; row_count := v_count; RETURN NEXT; END IF;
    EXECUTE 'SELECT COUNT(*) FROM audit_logs_default'           INTO v_count; IF v_count > 0 THEN partition_name := 'audit_logs_default';           row_count := v_count; RETURN NEXT; END IF;
END;
$$;

-- =============================================================================
-- SESSION CONTEXT & RLS
--
-- ISSUE 4 — RLS CONTEXT LEAKAGE PREVENTION
--
-- Pattern: set_config(name, value, is_local=TRUE)
--   • Inside a transaction:  setting is transaction-local (resets on COMMIT/ROLLBACK) ✓
--   • Outside a transaction: setting is session-local (persists) ✗
--
-- REQUIRED DEPLOYMENT RULES:
-- 1. Use PgBouncer in TRANSACTION pooling mode. In this mode every "session"
--    is a transaction, so is_local=TRUE is always transaction-scoped.
-- 2. In Prisma middleware, ALWAYS wrap context-setting + business queries
--    inside prisma.$transaction([...]) so they share one connection/transaction.
-- 3. NEVER call fn_set_app_context() outside a transaction block.
-- 4. For direct psql or admin connections (not via PgBouncer), use:
--    BEGIN; SELECT fn_set_app_context(...); -- queries; COMMIT;
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_set_app_context(
    p_user_id    TEXT DEFAULT '',
    p_company_id TEXT DEFAULT '',
    p_user_role  TEXT DEFAULT ''
)
RETURNS VOID LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF p_user_role NOT IN (
        '','super_admin','wh_manager','wh_operator','finance','client_admin','client_staff'
    ) THEN
        RAISE EXCEPTION 'fn_set_app_context: invalid user_role "%"', p_user_role;
    END IF;
    IF p_user_id != '' THEN
        BEGIN PERFORM p_user_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            RAISE EXCEPTION 'fn_set_app_context: invalid user_id UUID "%"', p_user_id;
        END;
    END IF;
    IF p_company_id != '' THEN
        BEGIN PERFORM p_company_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            RAISE EXCEPTION 'fn_set_app_context: invalid company_id UUID "%"', p_company_id;
        END;
    END IF;
    -- is_local=TRUE: transaction-scoped when inside a transaction (the required pattern).
    PERFORM set_config('app.current_user_id',    p_user_id,    TRUE);
    PERFORM set_config('app.current_company_id', p_company_id, TRUE);
    PERFORM set_config('app.user_role',          p_user_role,  TRUE);
END;
$$;

-- Enable RLS + FORCE RLS on all tenant-scoped tables
DO $$
DECLARE tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'products','current_stock','inventory_ledger',
        'inbound_orders','outbound_orders',
        'billing_transactions','invoices','invoice_lines','payments',
        'qc_checks','qc_alerts','tasks','notifications',
        'return_orders','stock_adjustments'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',  tbl);
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION fn_is_internal_role()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
    SELECT current_setting('app.user_role', TRUE) IN
        ('super_admin','wh_manager','wh_operator','finance');
$$;

CREATE OR REPLACE FUNCTION fn_session_company_id()
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE v TEXT := NULLIF(current_setting('app.current_company_id', TRUE), '');
BEGIN
    IF v IS NULL THEN RETURN NULL; END IF;
    BEGIN RETURN v::UUID;
    EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
    END;
END;
$$;

CREATE OR REPLACE PROCEDURE apply_rls_policies(p_table TEXT)
LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format('
        CREATE POLICY pol_internal_access ON %I
        AS PERMISSIVE USING (fn_is_internal_role())', p_table);

    EXECUTE format('
        CREATE POLICY pol_client_access ON %I
        AS PERMISSIVE
        USING (company_id IS NOT NULL AND company_id = fn_session_company_id())',
        p_table);

    EXECUTE format('
        CREATE POLICY pol_client_boundary ON %I
        AS RESTRICTIVE
        USING (fn_is_internal_role() OR company_id = fn_session_company_id())',
        p_table);
END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'products','current_stock','inventory_ledger',
        'inbound_orders','outbound_orders',
        'billing_transactions','invoices',
        'qc_checks','qc_alerts','tasks','notifications',
        'return_orders','stock_adjustments'
    ] LOOP
        CALL apply_rls_policies(tbl);
    END LOOP;
END;
$$;

-- invoice_lines / payments have no company_id — tenant boundary follows invoices.company_id
CREATE POLICY pol_internal_access ON invoice_lines
AS PERMISSIVE USING (fn_is_internal_role());

CREATE POLICY pol_client_access ON invoice_lines
AS PERMISSIVE
USING (
    EXISTS (
        SELECT 1 FROM invoices inv
        WHERE inv.id = invoice_lines.invoice_id
          AND inv.company_id IS NOT NULL
          AND inv.company_id = fn_session_company_id()
    )
);

CREATE POLICY pol_client_boundary ON invoice_lines
AS RESTRICTIVE
USING (
    fn_is_internal_role()
    OR EXISTS (
        SELECT 1 FROM invoices inv
        WHERE inv.id = invoice_lines.invoice_id
          AND inv.company_id = fn_session_company_id()
    )
);

CREATE POLICY pol_internal_access ON payments
AS PERMISSIVE USING (fn_is_internal_role());

CREATE POLICY pol_client_access ON payments
AS PERMISSIVE
USING (
    EXISTS (
        SELECT 1 FROM invoices inv
        WHERE inv.id = payments.invoice_id
          AND inv.company_id IS NOT NULL
          AND inv.company_id = fn_session_company_id()
    )
);

CREATE POLICY pol_client_boundary ON payments
AS RESTRICTIVE
USING (
    fn_is_internal_role()
    OR EXISTS (
        SELECT 1 FROM invoices inv
        WHERE inv.id = payments.invoice_id
          AND inv.company_id = fn_session_company_id()
    )
);

-- =============================================================================
-- OLTP VIEWS
-- =============================================================================

CREATE VIEW v_stock_summary AS
SELECT
    cs.company_id,
    c.name                                                         AS company_name,
    cs.product_id,
    p.sku,
    p.name                                                         AS product_name,
    p.uom,
    cs.warehouse_id,
    w.code                                                         AS warehouse_code,
    SUM(cs.quantity_on_hand)                                       AS total_on_hand,
    SUM(cs.quantity_reserved)                                      AS total_reserved,
    SUM(cs.quantity_available)                                     AS total_available,
    COUNT(DISTINCT cs.lot_id) FILTER (WHERE cs.lot_id IS NOT NULL) AS lot_count,
    COUNT(DISTINCT cs.location_id)                                 AS location_count,
    MIN(l.expiry_date) FILTER (WHERE l.expiry_date IS NOT NULL)    AS earliest_expiry,
    MAX(cs.last_movement_at)                                       AS last_movement_at
FROM   current_stock cs
JOIN   companies  c ON c.id = cs.company_id
JOIN   products   p ON p.id = cs.product_id
JOIN   warehouses w ON w.id = cs.warehouse_id
LEFT   JOIN lots  l ON l.id = cs.lot_id
GROUP  BY cs.company_id, c.name, cs.product_id, p.sku, p.name, p.uom, cs.warehouse_id, w.code;

CREATE VIEW v_worker_load AS
SELECT
    u.id                                                                AS worker_id,
    u.full_name,
    u.status,
    ARRAY_AGG(DISTINCT uwr.role ORDER BY uwr.role)                      AS worker_roles,
    COUNT(t.id) FILTER (WHERE t.status = 'in_progress')                AS in_progress_count,
    COUNT(t.id) FILTER (WHERE t.status = 'assigned')                   AS assigned_pending_count,
    (COUNT(t.id) FILTER (WHERE t.status = 'in_progress') * 3
     + COUNT(t.id) FILTER (WHERE t.status = 'assigned'))::INTEGER       AS load_score
FROM   users u
LEFT   JOIN user_worker_roles uwr ON uwr.user_id = u.id
LEFT   JOIN tasks t ON t.assigned_to = u.id AND t.status IN ('assigned','in_progress')
WHERE  u.role = 'wh_operator' AND u.status = 'active'
GROUP  BY u.id, u.full_name, u.status;

CREATE VIEW v_overdue_invoices AS
SELECT
    i.id,
    i.invoice_number,
    i.company_id,
    c.name                                             AS company_name,
    c.contact_email,
    i.total,
    i.due_date,
    (CURRENT_DATE - i.due_date)::INTEGER               AS days_overdue,
    COALESCE(SUM(p.amount), 0)                         AS amount_paid,
    GREATEST(0, i.total - COALESCE(SUM(p.amount), 0)) AS amount_outstanding
FROM   invoices i
JOIN   companies c ON c.id = i.company_id
LEFT   JOIN payments p ON p.invoice_id = i.id
WHERE  i.status IN ('sent','partial','overdue') AND i.due_date < CURRENT_DATE
GROUP  BY i.id, i.invoice_number, i.company_id, c.name, c.contact_email, i.total, i.due_date;

CREATE VIEW v_uninvoiced_billing AS
SELECT
    bt.company_id,
    c.name          AS company_name,
    bt.charge_type,
    MIN(bt.service_date) AS earliest_service_date,
    MAX(bt.service_date) AS latest_service_date,
    SUM(bt.amount)  AS total_amount,
    COUNT(*)        AS transaction_count
FROM   billing_transactions bt
JOIN   companies c ON c.id = bt.company_id
WHERE  bt.invoice_id IS NULL
GROUP  BY bt.company_id, c.name, bt.charge_type;

-- =============================================================================
-- PERFORMANCE TUNING (autovacuum thresholds for high-write tables)
-- Plain tables — supported on all supported PostgreSQL versions.
-- =============================================================================

ALTER TABLE current_stock       SET (autovacuum_vacuum_scale_factor=0.02, autovacuum_analyze_scale_factor=0.01);
ALTER TABLE task_step_logs      SET (autovacuum_vacuum_scale_factor=0.05);

-- Partitioned table roots: table-level autovacuum reloptions are supported from PostgreSQL 15+
-- onward; skip silently on older servers (e.g. local PG 14).
DO $perf$
BEGIN
    BEGIN
        ALTER TABLE inventory_ledger SET (autovacuum_vacuum_scale_factor=0.01, autovacuum_analyze_scale_factor=0.005);
    EXCEPTION
        WHEN SQLSTATE '22023' THEN NULL;
    END;
    BEGIN
        ALTER TABLE billing_transactions SET (autovacuum_vacuum_scale_factor=0.01, autovacuum_analyze_scale_factor=0.005);
    EXCEPTION
        WHEN SQLSTATE '22023' THEN NULL;
    END;
    BEGIN
        ALTER TABLE audit_logs SET (autovacuum_vacuum_scale_factor=0.01, autovacuum_analyze_scale_factor=0.005);
    EXCEPTION
        WHEN SQLSTATE '22023' THEN NULL;
    END;
END;
$perf$;

-- =============================================================================
-- UTILITY CLEANUP FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_cleanup_idempotency_keys()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
    DELETE FROM idempotency_keys WHERE expires_at < NOW();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION fn_cleanup_old_notifications()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
    DELETE FROM notifications
    WHERE (is_read = TRUE  AND created_at < NOW() - INTERVAL '90 days')
       OR (is_read = FALSE AND created_at < NOW() - INTERVAL '180 days');
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Purge old ledger dedup entries (keeps table lean; safe after 30 days)
CREATE OR REPLACE FUNCTION fn_cleanup_ledger_dedup(p_days_old INT DEFAULT 30)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
    DELETE FROM inventory_ledger_dedup WHERE created_at < NOW() - (p_days_old || ' days')::INTERVAL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT INTO warehouses (name, code, city, country)
VALUES ('Main Warehouse', 'WH1', 'Riyadh', 'SA');

-- =============================================================================
-- PART 2 — ANALYTICS SCHEMA (Star Schema / Data Warehouse)
-- =============================================================================
-- Separation strategy:
--   • OLTP tables live in schema: public
--   • Analytics tables live in schema: analytics
--   • ETL functions live in schema: analytics
--   • Application role wms_app has NO access to analytics schema
--   • BI role wms_analytics has SELECT-only access to analytics schema
--   • ETL role wms_etl has INSERT/UPDATE on analytics + SELECT on public
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- Grant ETL role (run once by DBA)
-- CREATE ROLE wms_etl LOGIN PASSWORD 'change_me_etl';
-- GRANT USAGE  ON SCHEMA public    TO wms_etl;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO wms_etl;
-- GRANT USAGE  ON SCHEMA analytics TO wms_etl;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO wms_etl;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA analytics TO wms_etl;

-- =============================================================================
-- ETL WATERMARKS (tracks last successful incremental load per fact table)
-- =============================================================================

CREATE TABLE analytics.etl_watermarks (
    table_name       TEXT        PRIMARY KEY,
    last_loaded_at   TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01 00:00:00+00',
    last_run_at      TIMESTAMPTZ,
    rows_loaded      BIGINT      NOT NULL DEFAULT 0,
    last_error       TEXT,
    status           TEXT        NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','error'))
);

INSERT INTO analytics.etl_watermarks (table_name) VALUES
    ('fact_inventory_movements'),
    ('fact_stock_snapshot'),
    ('fact_inbound_operations'),
    ('fact_outbound_operations'),
    ('fact_billing_transactions'),
    ('fact_tasks'),
    ('dim_company'),
    ('dim_product'),
    ('dim_location'),
    ('dim_user');

-- =============================================================================
-- DIMENSION: dim_date
-- Fully pre-populated date spine. Run etl_populate_dim_date() once.
-- No SCD needed — dates are immutable.
-- =============================================================================

CREATE TABLE analytics.dim_date (
    date_key        INTEGER     PRIMARY KEY,          -- YYYYMMDD integer (fast join)
    full_date       DATE        NOT NULL UNIQUE,
    day_of_week     SMALLINT    NOT NULL,             -- 0=Sun … 6=Sat
    day_name        TEXT        NOT NULL,
    day_of_month    SMALLINT    NOT NULL,
    day_of_year     SMALLINT    NOT NULL,
    week_of_year    SMALLINT    NOT NULL,
    month_number    SMALLINT    NOT NULL,
    month_name      TEXT        NOT NULL,
    month_abbrev    TEXT        NOT NULL,
    quarter_number  SMALLINT    NOT NULL,
    quarter_name    TEXT        NOT NULL,             -- 'Q1 2025'
    year            SMALLINT    NOT NULL,
    is_weekend      BOOLEAN     NOT NULL,
    is_holiday      BOOLEAN     NOT NULL DEFAULT FALSE,
    fiscal_year     SMALLINT,                         -- if fiscal year differs from calendar
    fiscal_quarter  SMALLINT
);

CREATE INDEX idx_dim_date_full_date     ON analytics.dim_date (full_date);
CREATE INDEX idx_dim_date_year_month    ON analytics.dim_date (year, month_number);
CREATE INDEX idx_dim_date_year_quarter  ON analytics.dim_date (year, quarter_number);

-- Function to populate dim_date for a range of years
CREATE OR REPLACE FUNCTION analytics.etl_populate_dim_date(
    p_start_date DATE DEFAULT '2020-01-01',
    p_end_date   DATE DEFAULT '2035-12-31'
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_date   DATE := p_start_date;
    v_count  INT  := 0;
BEGIN
    WHILE v_date <= p_end_date LOOP
        INSERT INTO analytics.dim_date (
            date_key, full_date, day_of_week, day_name, day_of_month,
            day_of_year, week_of_year, month_number, month_name, month_abbrev,
            quarter_number, quarter_name, year, is_weekend
        )
        VALUES (
            TO_CHAR(v_date,'YYYYMMDD')::INTEGER,
            v_date,
            EXTRACT(DOW  FROM v_date)::SMALLINT,
            TO_CHAR(v_date,'Day'),
            EXTRACT(DAY  FROM v_date)::SMALLINT,
            EXTRACT(DOY  FROM v_date)::SMALLINT,
            EXTRACT(WEEK FROM v_date)::SMALLINT,
            EXTRACT(MONTH FROM v_date)::SMALLINT,
            TO_CHAR(v_date,'Month'),
            TO_CHAR(v_date,'Mon'),
            EXTRACT(QUARTER FROM v_date)::SMALLINT,
            'Q' || EXTRACT(QUARTER FROM v_date)::TEXT || ' ' || EXTRACT(YEAR FROM v_date)::TEXT,
            EXTRACT(YEAR FROM v_date)::SMALLINT,
            EXTRACT(DOW FROM v_date) IN (0,6)
        )
        ON CONFLICT (date_key) DO NOTHING;
        v_date  := v_date + 1;
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;

SELECT analytics.etl_populate_dim_date();

-- Helper: convert a DATE or TIMESTAMPTZ to date_key integer
CREATE OR REPLACE FUNCTION analytics.date_key(p_date DATE)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
    SELECT TO_CHAR(p_date,'YYYYMMDD')::INTEGER;
$$;

-- =============================================================================
-- DIMENSION: dim_company  (SCD Type 2)
-- Tracks company name, status, billing_cycle changes over time.
-- =============================================================================

CREATE TABLE analytics.dim_company (
    company_key    BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id     UUID        NOT NULL,
    name           TEXT        NOT NULL,
    trade_name     TEXT,
    city           TEXT,
    country        TEXT,
    vat_number     TEXT,
    status         TEXT        NOT NULL,
    billing_cycle  TEXT        NOT NULL,
    valid_from     DATE        NOT NULL,
    valid_to       DATE,
    is_current     BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_dim_company_id      ON analytics.dim_company (company_id);
CREATE INDEX idx_dim_company_current ON analytics.dim_company (company_id, is_current) WHERE is_current;

-- SCD Type 2 merge function (called nightly)
CREATE OR REPLACE FUNCTION analytics.etl_merge_dim_company()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_count INT := 0;
    v_today DATE := CURRENT_DATE;
    r       RECORD;
BEGIN
    FOR r IN
        SELECT c.id, c.name, c.trade_name, c.city, c.country, c.vat_number,
               c.status::TEXT, c.billing_cycle::TEXT
        FROM   public.companies c
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM analytics.dim_company
            WHERE  company_id = r.id AND is_current
              AND  name = r.name AND status = r.status AND billing_cycle = r.billing_cycle
        ) THEN
            -- Close existing current record
            UPDATE analytics.dim_company
            SET    valid_to = v_today - 1, is_current = FALSE
            WHERE  company_id = r.id AND is_current;

            -- Insert new version
            INSERT INTO analytics.dim_company (company_id, name, trade_name, city, country,
                vat_number, status, billing_cycle, valid_from, valid_to, is_current)
            VALUES (r.id, r.name, r.trade_name, r.city, r.country,
                r.vat_number, r.status, r.billing_cycle, v_today, NULL, TRUE);

            v_count := v_count + 1;
        END IF;
    END LOOP;

    UPDATE analytics.etl_watermarks
    SET    last_loaded_at = NOW(), last_run_at = NOW(), rows_loaded = rows_loaded + v_count
    WHERE  table_name = 'dim_company';

    RETURN v_count;
END;
$$;

-- =============================================================================
-- DIMENSION: dim_warehouse (SCD Type 1 — warehouse attributes rarely change)
-- =============================================================================

CREATE TABLE analytics.dim_warehouse (
    warehouse_key BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    warehouse_id  UUID   NOT NULL UNIQUE,
    name          TEXT   NOT NULL,
    code          TEXT   NOT NULL,
    city          TEXT,
    country       TEXT,
    status        TEXT   NOT NULL,
    loaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dim_warehouse_id ON analytics.dim_warehouse (warehouse_id);

CREATE OR REPLACE FUNCTION analytics.etl_merge_dim_warehouse()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_count INT := 0;
BEGIN
    INSERT INTO analytics.dim_warehouse (warehouse_id, name, code, city, country, status)
    SELECT id, name, code, city, country, status::TEXT
    FROM   public.warehouses
    ON     CONFLICT (warehouse_id) DO UPDATE SET
           name   = EXCLUDED.name,
           code   = EXCLUDED.code,
           city   = EXCLUDED.city,
           status = EXCLUDED.status;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- =============================================================================
-- DIMENSION: dim_category (SCD Type 1)
-- =============================================================================

CREATE TABLE analytics.dim_category (
    category_key        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id         UUID   NOT NULL UNIQUE,
    name                TEXT   NOT NULL,
    parent_category_key BIGINT REFERENCES analytics.dim_category (category_key),
    loaded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dim_category_id ON analytics.dim_category (category_id);

CREATE OR REPLACE FUNCTION analytics.etl_merge_dim_category()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_count INT := 0;
BEGIN
    -- Two-pass: first insert without parent, then update parent FK
    INSERT INTO analytics.dim_category (category_id, name)
    SELECT id, name FROM public.product_categories
    ON     CONFLICT (category_id) DO UPDATE SET name = EXCLUDED.name;
    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE analytics.dim_category dc
    SET    parent_category_key = p.category_key
    FROM   public.product_categories pc
    JOIN   analytics.dim_category p ON p.category_id = pc.parent_id
    WHERE  dc.category_id = pc.id AND pc.parent_id IS NOT NULL;

    RETURN v_count;
END;
$$;

-- =============================================================================
-- DIMENSION: dim_product  (SCD Type 2)
-- Tracks SKU renames, status changes, category re-assignments.
-- =============================================================================

CREATE TABLE analytics.dim_product (
    product_key   BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id    UUID    NOT NULL,
    company_key   BIGINT  REFERENCES analytics.dim_company (company_key),
    category_key  BIGINT  REFERENCES analytics.dim_category (category_key),
    name          TEXT    NOT NULL,
    sku           TEXT    NOT NULL,
    barcode       TEXT,
    tracking_type TEXT    NOT NULL,
    uom           TEXT    NOT NULL,
    weight_kg     DECIMAL(10,4),
    volume_cbm    DECIMAL(10,6),
    status        TEXT    NOT NULL,
    valid_from    DATE    NOT NULL,
    valid_to      DATE,
    is_current    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_dim_product_id      ON analytics.dim_product (product_id);
CREATE INDEX idx_dim_product_current ON analytics.dim_product (product_id, is_current) WHERE is_current;
CREATE INDEX idx_dim_product_sku     ON analytics.dim_product (sku);

CREATE OR REPLACE FUNCTION analytics.etl_merge_dim_product()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_count INT  := 0;
    v_today DATE := CURRENT_DATE;
    r       RECORD;
BEGIN
    FOR r IN
        SELECT p.id, p.name, p.sku, p.barcode, p.tracking_type::TEXT, p.uom::TEXT,
               p.weight_kg, p.volume_cbm, p.status::TEXT,
               dc.company_key, dcat.category_key
        FROM   public.products p
        LEFT   JOIN analytics.dim_company  dc   ON dc.company_id  = p.company_id  AND dc.is_current
        LEFT   JOIN analytics.dim_category dcat ON dcat.category_id = p.category_id
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM analytics.dim_product
            WHERE  product_id = r.id AND is_current
              AND  name = r.name AND sku = r.sku AND status = r.status
        ) THEN
            UPDATE analytics.dim_product
            SET    valid_to = v_today - 1, is_current = FALSE
            WHERE  product_id = r.id AND is_current;

            INSERT INTO analytics.dim_product
                (product_id, company_key, category_key, name, sku, barcode,
                 tracking_type, uom, weight_kg, volume_cbm, status, valid_from, valid_to, is_current)
            VALUES
                (r.id, r.company_key, r.category_key, r.name, r.sku, r.barcode,
                 r.tracking_type, r.uom, r.weight_kg, r.volume_cbm, r.status, v_today, NULL, TRUE);

            v_count := v_count + 1;
        END IF;
    END LOOP;

    UPDATE analytics.etl_watermarks
    SET    last_loaded_at = NOW(), last_run_at = NOW(), rows_loaded = rows_loaded + v_count
    WHERE  table_name = 'dim_product';

    RETURN v_count;
END;
$$;

-- =============================================================================
-- DIMENSION: dim_location  (SCD Type 2)
-- Tracks location type changes, status changes, path renames.
-- =============================================================================

CREATE TABLE analytics.dim_location (
    location_key  BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    location_id   UUID    NOT NULL,
    warehouse_key BIGINT  REFERENCES analytics.dim_warehouse (warehouse_key),
    name          TEXT    NOT NULL,
    full_path     TEXT    NOT NULL,
    type          TEXT    NOT NULL,
    barcode       TEXT,
    status        TEXT    NOT NULL,
    valid_from    DATE    NOT NULL,
    valid_to      DATE,
    is_current    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_dim_location_id      ON analytics.dim_location (location_id);
CREATE INDEX idx_dim_location_current ON analytics.dim_location (location_id, is_current) WHERE is_current;

CREATE OR REPLACE FUNCTION analytics.etl_merge_dim_location()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_count INT  := 0;
    v_today DATE := CURRENT_DATE;
    r       RECORD;
BEGIN
    FOR r IN
        SELECT l.id, l.name, l.full_path, l.type::TEXT, l.barcode, l.status::TEXT,
               dw.warehouse_key
        FROM   public.locations l
        LEFT   JOIN analytics.dim_warehouse dw ON dw.warehouse_id = l.warehouse_id
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM analytics.dim_location
            WHERE  location_id = r.id AND is_current
              AND  full_path = r.full_path AND type = r.type AND status = r.status
        ) THEN
            UPDATE analytics.dim_location
            SET    valid_to = v_today - 1, is_current = FALSE
            WHERE  location_id = r.id AND is_current;

            INSERT INTO analytics.dim_location
                (location_id, warehouse_key, name, full_path, type, barcode, status, valid_from, valid_to, is_current)
            VALUES
                (r.id, r.warehouse_key, r.name, r.full_path, r.type, r.barcode, r.status, v_today, NULL, TRUE);

            v_count := v_count + 1;
        END IF;
    END LOOP;

    UPDATE analytics.etl_watermarks
    SET    last_loaded_at = NOW(), last_run_at = NOW(), rows_loaded = rows_loaded + v_count
    WHERE  table_name = 'dim_location';

    RETURN v_count;
END;
$$;

-- =============================================================================
-- DIMENSION: dim_user  (SCD Type 2)
-- Tracks role changes, status changes, worker role assignments.
-- =============================================================================

CREATE TABLE analytics.dim_user (
    user_key     BIGINT   GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      UUID     NOT NULL,
    full_name    TEXT     NOT NULL,
    email        TEXT     NOT NULL,
    role         TEXT     NOT NULL,
    worker_roles TEXT[]   NOT NULL DEFAULT '{}',
    status       TEXT     NOT NULL,
    company_key  BIGINT   REFERENCES analytics.dim_company (company_key),
    valid_from   DATE     NOT NULL,
    valid_to     DATE,
    is_current   BOOLEAN  NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_dim_user_id      ON analytics.dim_user (user_id);
CREATE INDEX idx_dim_user_current ON analytics.dim_user (user_id, is_current) WHERE is_current;

CREATE OR REPLACE FUNCTION analytics.etl_merge_dim_user()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_count INT  := 0;
    v_today DATE := CURRENT_DATE;
    r       RECORD;
BEGIN
    FOR r IN
        SELECT u.id, u.full_name, u.email, u.role::TEXT, u.status::TEXT,
               dc.company_key,
               ARRAY_AGG(uwr.role::TEXT ORDER BY uwr.role::TEXT) FILTER (WHERE uwr.role IS NOT NULL)
                   AS worker_roles
        FROM   public.users u
        LEFT   JOIN analytics.dim_company  dc  ON dc.company_id = u.company_id AND dc.is_current
        LEFT   JOIN public.user_worker_roles uwr ON uwr.user_id = u.id
        GROUP  BY u.id, u.full_name, u.email, u.role, u.status, dc.company_key
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM analytics.dim_user
            WHERE  user_id = r.id AND is_current
              AND  role = r.role AND status = r.status
        ) THEN
            UPDATE analytics.dim_user
            SET    valid_to = v_today - 1, is_current = FALSE
            WHERE  user_id = r.id AND is_current;

            INSERT INTO analytics.dim_user
                (user_id, full_name, email, role, worker_roles, status, company_key, valid_from, valid_to, is_current)
            VALUES
                (r.id, r.full_name, r.email, r.role,
                 COALESCE(r.worker_roles, '{}'), r.status, r.company_key, v_today, NULL, TRUE);

            v_count := v_count + 1;
        END IF;
    END LOOP;

    UPDATE analytics.etl_watermarks
    SET    last_loaded_at = NOW(), last_run_at = NOW(), rows_loaded = rows_loaded + v_count
    WHERE  table_name = 'dim_user';

    RETURN v_count;
END;
$$;

-- =============================================================================
-- DIMENSION: dim_lot  (SCD Type 1 — expiry date is a factual, immutable attribute)
-- =============================================================================

CREATE TABLE analytics.dim_lot (
    lot_key          BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lot_id           UUID    NOT NULL UNIQUE,
    product_key      BIGINT  REFERENCES analytics.dim_product (product_key),
    lot_number       TEXT    NOT NULL,
    expiry_date      DATE,
    manufacture_date DATE,
    -- PG rejects STORED GENERATED using CURRENT_DATE (not immutable); refreshed by ETL.
    is_expired       BOOLEAN NOT NULL DEFAULT FALSE,
    loaded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dim_lot_id         ON analytics.dim_lot (lot_id);
CREATE INDEX idx_dim_lot_expiry     ON analytics.dim_lot (expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_dim_lot_product    ON analytics.dim_lot (product_key);

CREATE OR REPLACE FUNCTION analytics.etl_merge_dim_lot()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_count INT := 0;
BEGIN
    INSERT INTO analytics.dim_lot (lot_id, product_key, lot_number, expiry_date, manufacture_date, is_expired)
    SELECT l.id,
           dp.product_key,
           l.lot_number,
           l.expiry_date,
           l.manufacture_date,
           (l.expiry_date IS NOT NULL AND l.expiry_date < CURRENT_DATE)
    FROM   public.lots l
    LEFT   JOIN analytics.dim_product dp ON dp.product_id = l.product_id AND dp.is_current
    ON     CONFLICT (lot_id) DO UPDATE SET
           expiry_date      = EXCLUDED.expiry_date,
           manufacture_date = EXCLUDED.manufacture_date,
           is_expired       = (EXCLUDED.expiry_date IS NOT NULL AND EXCLUDED.expiry_date < CURRENT_DATE);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- =============================================================================
-- DIMENSION: dim_task_type  (static — populated from ENUM values)
-- =============================================================================

CREATE TABLE analytics.dim_task_type (
    task_type_key  SMALLINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_type_name TEXT        NOT NULL UNIQUE,
    task_category  TEXT        NOT NULL  -- 'inbound', 'outbound', 'storage', 'quality', 'admin'
);

INSERT INTO analytics.dim_task_type (task_type_name, task_category) VALUES
    ('receiving',  'inbound'),
    ('qc_check',   'quality'),
    ('putaway',    'storage'),
    ('picking',    'outbound'),
    ('packing',    'outbound'),
    ('shipping',   'outbound'),
    ('counting',   'admin'),
    ('transfer',   'storage');

-- =============================================================================
-- DIMENSION: dim_order  (degenerate dimension — minimal attributes)
-- =============================================================================

CREATE TABLE analytics.dim_order (
    order_key    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id     UUID   NOT NULL UNIQUE,
    order_type   TEXT   NOT NULL CHECK (order_type IN ('inbound','outbound','return','adjustment')),
    order_number TEXT   NOT NULL,
    loaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dim_order_id ON analytics.dim_order (order_id);

CREATE OR REPLACE FUNCTION analytics.etl_merge_dim_order()
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_count INT := 0;
BEGIN
    INSERT INTO analytics.dim_order (order_id, order_type, order_number)
    SELECT id, 'inbound',  order_number FROM public.inbound_orders
    UNION ALL
    SELECT id, 'outbound', order_number FROM public.outbound_orders
    UNION ALL
    SELECT id, 'return',   order_number FROM public.return_orders
    ON     CONFLICT (order_id) DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- =============================================================================
-- FACT: fact_inventory_movements
-- Source: public.inventory_ledger
-- Grain: one row per ledger entry
-- Partitioned by month (mirrors inventory_ledger partitioning)
-- =============================================================================

CREATE TABLE analytics.fact_inventory_movements (
    movement_key         BIGINT        GENERATED ALWAYS AS IDENTITY,
    event_date           DATE          NOT NULL,
    date_key             INTEGER       NOT NULL REFERENCES analytics.dim_date (date_key),
    company_key          BIGINT        NOT NULL REFERENCES analytics.dim_company (company_key),
    product_key          BIGINT        NOT NULL REFERENCES analytics.dim_product (product_key),
    lot_key              BIGINT        REFERENCES analytics.dim_lot (lot_key),
    from_location_key    BIGINT        REFERENCES analytics.dim_location (location_key),
    to_location_key      BIGINT        REFERENCES analytics.dim_location (location_key),
    operator_key         BIGINT        REFERENCES analytics.dim_user (user_key),
    order_key            BIGINT        REFERENCES analytics.dim_order (order_key),
    movement_type        TEXT          NOT NULL,
    reference_type       TEXT          NOT NULL,
    reference_id         UUID          NOT NULL,
    quantity             DECIMAL(15,4) NOT NULL,
    oltp_ledger_id       UUID          NOT NULL,
    created_at           TIMESTAMPTZ   NOT NULL,
    PRIMARY KEY (movement_key, event_date)
) PARTITION BY RANGE (event_date);

CREATE INDEX idx_fim_date_key     ON analytics.fact_inventory_movements (date_key);
CREATE INDEX idx_fim_company      ON analytics.fact_inventory_movements (company_key, event_date DESC);
CREATE INDEX idx_fim_product      ON analytics.fact_inventory_movements (product_key, event_date DESC);
CREATE INDEX idx_fim_oltp_id      ON analytics.fact_inventory_movements (oltp_ledger_id);
CREATE INDEX idx_fim_movement_type ON analytics.fact_inventory_movements (movement_type, event_date DESC);

-- Monthly partitions 2025-01 through 2027-06
DO $$
DECLARE
    v_month DATE := '2025-01-01';
    v_end   DATE := '2027-07-01';
    v_next  DATE;
    v_name  TEXT;
BEGIN
    WHILE v_month < v_end LOOP
        v_next := v_month + INTERVAL '1 month';
        v_name := 'fact_inventory_movements_' || TO_CHAR(v_month,'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE analytics.%I PARTITION OF analytics.fact_inventory_movements FOR VALUES FROM (%L) TO (%L)',
            v_name, v_month, v_next
        );
        v_month := v_next;
    END LOOP;
END;
$$;

CREATE TABLE analytics.fact_inventory_movements_default PARTITION OF analytics.fact_inventory_movements DEFAULT;

-- Incremental ETL for fact_inventory_movements
CREATE OR REPLACE FUNCTION analytics.etl_load_fact_inventory_movements(
    p_watermark TIMESTAMPTZ DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_wm    TIMESTAMPTZ;
    v_count INT := 0;
BEGIN
    IF p_watermark IS NULL THEN
        SELECT last_loaded_at INTO v_wm FROM analytics.etl_watermarks WHERE table_name = 'fact_inventory_movements';
    ELSE
        v_wm := p_watermark;
    END IF;

    INSERT INTO analytics.fact_inventory_movements (
        event_date, date_key, company_key, product_key, lot_key,
        from_location_key, to_location_key, operator_key, order_key,
        movement_type, reference_type, reference_id, quantity, oltp_ledger_id, created_at
    )
    SELECT
        il.created_at::DATE                                              AS event_date,
        analytics.date_key(il.created_at::DATE)                         AS date_key,
        dc.company_key,
        dp.product_key,
        dl.lot_key,
        dfl.location_key                                                 AS from_location_key,
        dtl.location_key                                                 AS to_location_key,
        du.user_key                                                      AS operator_key,
        dord.order_key,
        il.movement_type::TEXT,
        il.reference_type::TEXT,
        il.reference_id,
        il.quantity,
        il.id                                                            AS oltp_ledger_id,
        il.created_at
    FROM   public.inventory_ledger il
    JOIN   analytics.dim_company  dc   ON dc.company_id  = il.company_id  AND dc.is_current
    JOIN   analytics.dim_product  dp   ON dp.product_id  = il.product_id  AND dp.is_current
    LEFT   JOIN analytics.dim_lot     dl   ON dl.lot_id      = il.lot_id
    LEFT   JOIN analytics.dim_location dfl ON dfl.location_id = il.from_location_id AND dfl.is_current
    LEFT   JOIN analytics.dim_location dtl ON dtl.location_id = il.to_location_id   AND dtl.is_current
    LEFT   JOIN analytics.dim_user    du   ON du.user_id      = il.operator_id       AND du.is_current
    LEFT   JOIN analytics.dim_order   dord ON dord.order_id   = il.reference_id
    WHERE  il.created_at > v_wm
    ON     CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE analytics.etl_watermarks
    SET    last_loaded_at = NOW(), last_run_at = NOW(), rows_loaded = rows_loaded + v_count, status = 'idle'
    WHERE  table_name = 'fact_inventory_movements';

    RETURN v_count;
END;
$$;

-- =============================================================================
-- FACT: fact_stock_snapshot
-- Source: public.current_stock (daily snapshot)
-- Grain: one row per (company, product, location, lot, snapshot_date)
-- Run daily at 00:00 UTC to capture end-of-day positions.
-- =============================================================================

CREATE TABLE analytics.fact_stock_snapshot (
    snapshot_key      BIGINT        GENERATED ALWAYS AS IDENTITY,
    snapshot_date     DATE          NOT NULL,
    date_key          INTEGER       NOT NULL REFERENCES analytics.dim_date (date_key),
    company_key       BIGINT        NOT NULL REFERENCES analytics.dim_company (company_key),
    product_key       BIGINT        NOT NULL REFERENCES analytics.dim_product (product_key),
    warehouse_key     BIGINT        NOT NULL REFERENCES analytics.dim_warehouse (warehouse_key),
    location_key      BIGINT        NOT NULL REFERENCES analytics.dim_location (location_key),
    lot_key           BIGINT        REFERENCES analytics.dim_lot (lot_key),
    quantity_on_hand  DECIMAL(15,4) NOT NULL,
    quantity_reserved DECIMAL(15,4) NOT NULL,
    quantity_available DECIMAL(15,4) NOT NULL,
    stock_status      TEXT          NOT NULL,
    snapshot_taken_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    PRIMARY KEY (snapshot_key, snapshot_date)
) PARTITION BY RANGE (snapshot_date);

CREATE INDEX idx_fss_date_key  ON analytics.fact_stock_snapshot (date_key);
CREATE INDEX idx_fss_company   ON analytics.fact_stock_snapshot (company_key, snapshot_date DESC);
CREATE INDEX idx_fss_product   ON analytics.fact_stock_snapshot (product_key, snapshot_date DESC);
CREATE INDEX idx_fss_warehouse ON analytics.fact_stock_snapshot (warehouse_key, snapshot_date DESC);

DO $$
DECLARE
    v_month DATE := '2025-01-01';
    v_end   DATE := '2027-07-01';
    v_next  DATE;
    v_name  TEXT;
BEGIN
    WHILE v_month < v_end LOOP
        v_next := v_month + INTERVAL '1 month';
        v_name := 'fact_stock_snapshot_' || TO_CHAR(v_month,'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE analytics.%I PARTITION OF analytics.fact_stock_snapshot FOR VALUES FROM (%L) TO (%L)',
            v_name, v_month, v_next
        );
        v_month := v_next;
    END LOOP;
END;
$$;

CREATE TABLE analytics.fact_stock_snapshot_default PARTITION OF analytics.fact_stock_snapshot DEFAULT;

-- Daily snapshot ETL (idempotent — upsert by snapshot_date + position keys)
CREATE OR REPLACE FUNCTION analytics.etl_load_fact_stock_snapshot(
    p_snapshot_date DATE DEFAULT CURRENT_DATE
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_count INT := 0;
BEGIN
    -- Delete any existing snapshot for this date (re-runnable)
    DELETE FROM analytics.fact_stock_snapshot WHERE snapshot_date = p_snapshot_date;

    INSERT INTO analytics.fact_stock_snapshot (
        snapshot_date, date_key, company_key, product_key, warehouse_key,
        location_key, lot_key, quantity_on_hand, quantity_reserved, quantity_available, stock_status
    )
    SELECT
        p_snapshot_date,
        analytics.date_key(p_snapshot_date),
        dc.company_key,
        dp.product_key,
        dw.warehouse_key,
        dl.location_key,
        dlot.lot_key,
        cs.quantity_on_hand,
        cs.quantity_reserved,
        cs.quantity_available,
        cs.status::TEXT
    FROM   public.current_stock cs
    JOIN   analytics.dim_company   dc   ON dc.company_id  = cs.company_id  AND dc.is_current
    JOIN   analytics.dim_product   dp   ON dp.product_id  = cs.product_id  AND dp.is_current
    JOIN   analytics.dim_warehouse dw   ON dw.warehouse_id = cs.warehouse_id
    JOIN   analytics.dim_location  dl   ON dl.location_id = cs.location_id AND dl.is_current
    LEFT   JOIN analytics.dim_lot  dlot ON dlot.lot_id    = cs.lot_id
    WHERE  cs.quantity_on_hand > 0;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE analytics.etl_watermarks
    SET    last_loaded_at = p_snapshot_date::TIMESTAMPTZ, last_run_at = NOW(),
           rows_loaded = rows_loaded + v_count, status = 'idle'
    WHERE  table_name = 'fact_stock_snapshot';

    RETURN v_count;
END;
$$;

-- =============================================================================
-- FACT: fact_inbound_operations
-- Source: public.inbound_orders + inbound_order_lines
-- Grain: one row per completed/cancelled inbound order
-- =============================================================================

CREATE TABLE analytics.fact_inbound_operations (
    inbound_op_key          BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    confirmed_date_key      INTEGER       REFERENCES analytics.dim_date (date_key),
    completed_date_key      INTEGER       REFERENCES analytics.dim_date (date_key),
    arrival_date_key        INTEGER       REFERENCES analytics.dim_date (date_key),
    company_key             BIGINT        NOT NULL REFERENCES analytics.dim_company (company_key),
    warehouse_key           BIGINT        REFERENCES analytics.dim_warehouse (warehouse_key),
    order_key               BIGINT        REFERENCES analytics.dim_order (order_key),
    status                  TEXT          NOT NULL,
    total_lines             INTEGER       NOT NULL DEFAULT 0,
    total_expected_qty      DECIMAL(15,4) NOT NULL DEFAULT 0,
    total_received_qty      DECIMAL(15,4) NOT NULL DEFAULT 0,
    discrepancy_lines       INTEGER       NOT NULL DEFAULT 0,
    fill_rate_pct           DECIMAL(7,4)  GENERATED ALWAYS AS (
        CASE WHEN total_expected_qty > 0
             THEN ROUND(total_received_qty / total_expected_qty * 100, 4)
             ELSE NULL END
    ) STORED,
    days_to_complete        DECIMAL(10,2),
    is_on_time              BOOLEAN,
    oltp_inbound_order_id   UUID          NOT NULL UNIQUE,
    completed_at            TIMESTAMPTZ,
    loaded_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fio_company        ON analytics.fact_inbound_operations (company_key);
CREATE INDEX idx_fio_confirmed_date ON analytics.fact_inbound_operations (confirmed_date_key);
CREATE INDEX idx_fio_oltp_id        ON analytics.fact_inbound_operations (oltp_inbound_order_id);

CREATE OR REPLACE FUNCTION analytics.etl_load_fact_inbound_operations(
    p_watermark TIMESTAMPTZ DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_wm    TIMESTAMPTZ;
    v_count INT := 0;
BEGIN
    SELECT COALESCE(p_watermark,
        (SELECT last_loaded_at FROM analytics.etl_watermarks WHERE table_name = 'fact_inbound_operations'))
    INTO   v_wm;

    INSERT INTO analytics.fact_inbound_operations (
        confirmed_date_key, completed_date_key, arrival_date_key, company_key, warehouse_key,
        order_key, status, total_lines, total_expected_qty, total_received_qty,
        discrepancy_lines, days_to_complete, is_on_time,
        oltp_inbound_order_id, completed_at
    )
    SELECT
        analytics.date_key(io.confirmed_at::DATE),
        analytics.date_key(io.completed_at::DATE),
        analytics.date_key(io.expected_arrival_date),
        dc.company_key,
        dw.warehouse_key,
        dord.order_key,
        io.status::TEXT,
        COUNT(iol.id)                               AS total_lines,
        COALESCE(SUM(iol.expected_quantity), 0)     AS total_expected_qty,
        COALESCE(SUM(iol.received_quantity), 0)     AS total_received_qty,
        COUNT(iol.id) FILTER (WHERE iol.discrepancy_type <> 'none') AS discrepancy_lines,
        EXTRACT(EPOCH FROM (io.completed_at - io.confirmed_at)) / 86400.0 AS days_to_complete,
        (io.completed_at::DATE <= io.expected_arrival_date)          AS is_on_time,
        io.id,
        io.completed_at
    FROM   public.inbound_orders io
    LEFT   JOIN public.inbound_order_lines iol  ON iol.inbound_order_id = io.id
    JOIN   analytics.dim_company  dc            ON dc.company_id = io.company_id AND dc.is_current
    LEFT   JOIN analytics.dim_warehouse dw      ON dw.warehouse_id = (
                SELECT w.id FROM public.locations l JOIN public.warehouses w ON w.id=l.warehouse_id LIMIT 1)
    LEFT   JOIN analytics.dim_order dord        ON dord.order_id = io.id
    WHERE  io.updated_at > v_wm
      AND  io.status IN ('completed','cancelled','partially_received')
    GROUP  BY io.id, io.status, io.confirmed_at, io.completed_at, io.expected_arrival_date,
              dc.company_key, dw.warehouse_key, dord.order_key
    ON     CONFLICT (oltp_inbound_order_id) DO UPDATE SET
        status             = EXCLUDED.status,
        total_received_qty = EXCLUDED.total_received_qty,
        discrepancy_lines  = EXCLUDED.discrepancy_lines,
        days_to_complete   = EXCLUDED.days_to_complete,
        loaded_at          = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE analytics.etl_watermarks
    SET    last_loaded_at = NOW(), last_run_at = NOW(), rows_loaded = rows_loaded + v_count, status = 'idle'
    WHERE  table_name = 'fact_inbound_operations';

    RETURN v_count;
END;
$$;

-- =============================================================================
-- FACT: fact_outbound_operations
-- Source: public.outbound_orders + outbound_order_lines
-- Grain: one row per outbound order
-- =============================================================================

CREATE TABLE analytics.fact_outbound_operations (
    outbound_op_key         BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_date_key          INTEGER       REFERENCES analytics.dim_date (date_key),
    ship_date_key           INTEGER       REFERENCES analytics.dim_date (date_key),
    required_ship_date_key  INTEGER       REFERENCES analytics.dim_date (date_key),
    company_key             BIGINT        NOT NULL REFERENCES analytics.dim_company (company_key),
    warehouse_key           BIGINT        REFERENCES analytics.dim_warehouse (warehouse_key),
    order_key               BIGINT        REFERENCES analytics.dim_order (order_key),
    status                  TEXT          NOT NULL,
    total_lines             INTEGER       NOT NULL DEFAULT 0,
    total_requested_qty     DECIMAL(15,4) NOT NULL DEFAULT 0,
    total_picked_qty        DECIMAL(15,4) NOT NULL DEFAULT 0,
    short_pick_lines        INTEGER       NOT NULL DEFAULT 0,
    carrier                 TEXT,
    days_to_ship            DECIMAL(10,2),
    is_on_time              BOOLEAN,
    oltp_outbound_order_id  UUID          NOT NULL UNIQUE,
    shipped_at              TIMESTAMPTZ,
    loaded_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_foo_company   ON analytics.fact_outbound_operations (company_key);
CREATE INDEX idx_foo_ship_date ON analytics.fact_outbound_operations (ship_date_key);
CREATE INDEX idx_foo_oltp_id   ON analytics.fact_outbound_operations (oltp_outbound_order_id);

CREATE OR REPLACE FUNCTION analytics.etl_load_fact_outbound_operations(
    p_watermark TIMESTAMPTZ DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_wm    TIMESTAMPTZ;
    v_count INT := 0;
BEGIN
    SELECT COALESCE(p_watermark,
        (SELECT last_loaded_at FROM analytics.etl_watermarks WHERE table_name = 'fact_outbound_operations'))
    INTO   v_wm;

    INSERT INTO analytics.fact_outbound_operations (
        order_date_key, ship_date_key, required_ship_date_key, company_key, warehouse_key,
        order_key, status, total_lines, total_requested_qty, total_picked_qty,
        short_pick_lines, carrier, days_to_ship, is_on_time,
        oltp_outbound_order_id, shipped_at
    )
    SELECT
        analytics.date_key(oo.confirmed_at::DATE),
        analytics.date_key(oo.shipped_at::DATE),
        analytics.date_key(oo.required_ship_date),
        dc.company_key,
        dw.warehouse_key,
        dord.order_key,
        oo.status::TEXT,
        COUNT(ool.id)                                                AS total_lines,
        COALESCE(SUM(ool.requested_quantity), 0)                     AS total_requested_qty,
        COALESCE(SUM(ool.picked_quantity), 0)                        AS total_picked_qty,
        COUNT(ool.id) FILTER (WHERE ool.status = 'short')            AS short_pick_lines,
        oo.carrier,
        EXTRACT(EPOCH FROM (oo.shipped_at - oo.confirmed_at))/86400.0 AS days_to_ship,
        (oo.shipped_at::DATE <= oo.required_ship_date)               AS is_on_time,
        oo.id,
        oo.shipped_at
    FROM   public.outbound_orders oo
    LEFT   JOIN public.outbound_order_lines ool ON ool.outbound_order_id = oo.id
    JOIN   analytics.dim_company  dc            ON dc.company_id = oo.company_id AND dc.is_current
    LEFT   JOIN analytics.dim_warehouse dw      ON dw.warehouse_id = (
                SELECT w.id FROM public.locations l JOIN public.warehouses w ON w.id=l.warehouse_id LIMIT 1)
    LEFT   JOIN analytics.dim_order dord        ON dord.order_id = oo.id
    WHERE  oo.updated_at > v_wm
      AND  oo.status IN ('shipped','cancelled')
    GROUP  BY oo.id, oo.status, oo.confirmed_at, oo.shipped_at, oo.required_ship_date,
              oo.carrier, dc.company_key, dw.warehouse_key, dord.order_key
    ON     CONFLICT (oltp_outbound_order_id) DO UPDATE SET
        status          = EXCLUDED.status,
        total_picked_qty= EXCLUDED.total_picked_qty,
        short_pick_lines= EXCLUDED.short_pick_lines,
        days_to_ship    = EXCLUDED.days_to_ship,
        is_on_time      = EXCLUDED.is_on_time,
        shipped_at      = EXCLUDED.shipped_at,
        loaded_at       = NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE analytics.etl_watermarks
    SET    last_loaded_at = NOW(), last_run_at = NOW(), rows_loaded = rows_loaded + v_count, status = 'idle'
    WHERE  table_name = 'fact_outbound_operations';

    RETURN v_count;
END;
$$;

-- =============================================================================
-- FACT: fact_billing_transactions
-- Source: public.billing_transactions (partitioned)
-- Grain: one row per billing transaction
-- Append-only in OLTP; analytics allows updates for invoice_id linkage.
-- =============================================================================

CREATE TABLE analytics.fact_billing_transactions (
    billing_key           BIGINT        GENERATED ALWAYS AS IDENTITY,
    service_date          DATE          NOT NULL,
    date_key              INTEGER       NOT NULL REFERENCES analytics.dim_date (date_key),
    company_key           BIGINT        NOT NULL REFERENCES analytics.dim_company (company_key),
    order_key             BIGINT        REFERENCES analytics.dim_order (order_key),
    charge_type           TEXT          NOT NULL,
    quantity              DECIMAL(15,4) NOT NULL,
    unit_price            DECIMAL(10,4) NOT NULL,
    amount                DECIMAL(14,2) NOT NULL,
    invoice_id            UUID,
    is_invoiced           BOOLEAN       NOT NULL DEFAULT FALSE,
    oltp_billing_tx_id    UUID          NOT NULL,
    oltp_billing_tx_date  DATE          NOT NULL,
    loaded_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    PRIMARY KEY (billing_key, service_date)
) PARTITION BY RANGE (service_date);

CREATE INDEX idx_fbt_date_key  ON analytics.fact_billing_transactions (date_key);
CREATE INDEX idx_fbt_company   ON analytics.fact_billing_transactions (company_key, service_date DESC);
CREATE INDEX idx_fbt_oltp_id   ON analytics.fact_billing_transactions (oltp_billing_tx_id);
CREATE INDEX idx_fbt_invoiced  ON analytics.fact_billing_transactions (is_invoiced, company_key) WHERE NOT is_invoiced;

DO $$
DECLARE
    v_month DATE := '2025-01-01';
    v_end   DATE := '2027-07-01';
    v_next  DATE;
    v_name  TEXT;
BEGIN
    WHILE v_month < v_end LOOP
        v_next := v_month + INTERVAL '1 month';
        v_name := 'fact_billing_transactions_' || TO_CHAR(v_month,'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE analytics.%I PARTITION OF analytics.fact_billing_transactions FOR VALUES FROM (%L) TO (%L)',
            v_name, v_month, v_next
        );
        v_month := v_next;
    END LOOP;
END;
$$;

CREATE TABLE analytics.fact_billing_transactions_default PARTITION OF analytics.fact_billing_transactions DEFAULT;

CREATE OR REPLACE FUNCTION analytics.etl_load_fact_billing_transactions(
    p_watermark DATE DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_wm    DATE;
    v_count INT := 0;
BEGIN
    SELECT COALESCE(p_watermark,
        (SELECT last_loaded_at::DATE FROM analytics.etl_watermarks WHERE table_name = 'fact_billing_transactions'))
    INTO   v_wm;

    INSERT INTO analytics.fact_billing_transactions (
        service_date, date_key, company_key, order_key,
        charge_type, quantity, unit_price, amount,
        invoice_id, is_invoiced, oltp_billing_tx_id, oltp_billing_tx_date
    )
    SELECT
        bt.service_date,
        analytics.date_key(bt.service_date),
        dc.company_key,
        dord.order_key,
        bt.charge_type::TEXT,
        bt.quantity,
        bt.unit_price,
        bt.amount,
        bt.invoice_id,
        bt.invoice_id IS NOT NULL,
        bt.id,
        bt.service_date
    FROM   public.billing_transactions bt
    JOIN   analytics.dim_company dc   ON dc.company_id = bt.company_id AND dc.is_current
    LEFT   JOIN analytics.dim_order dord ON dord.order_id = bt.reference_id
    WHERE  bt.service_date >= v_wm
    ON     CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE analytics.etl_watermarks
    SET    last_loaded_at = NOW(), last_run_at = NOW(), rows_loaded = rows_loaded + v_count, status = 'idle'
    WHERE  table_name = 'fact_billing_transactions';

    RETURN v_count;
END;
$$;

-- =============================================================================
-- FACT: fact_tasks  (worker productivity)
-- Source: public.tasks + task_step_logs
-- Grain: one row per completed/cancelled task
-- =============================================================================

CREATE TABLE analytics.fact_tasks (
    task_fact_key       BIGINT        GENERATED ALWAYS AS IDENTITY,
    created_date        DATE          NOT NULL,
    date_key            INTEGER       NOT NULL REFERENCES analytics.dim_date (date_key),
    completed_date_key  INTEGER       REFERENCES analytics.dim_date (date_key),
    company_key         BIGINT        NOT NULL REFERENCES analytics.dim_company (company_key),
    warehouse_key       BIGINT        NOT NULL REFERENCES analytics.dim_warehouse (warehouse_key),
    worker_key          BIGINT        REFERENCES analytics.dim_user (user_key),
    task_type_key       SMALLINT      NOT NULL REFERENCES analytics.dim_task_type (task_type_key),
    order_key           BIGINT        REFERENCES analytics.dim_order (order_key),
    status              TEXT          NOT NULL,
    priority            TEXT          NOT NULL,
    duration_minutes    DECIMAL(10,2),
    step_count          INTEGER       NOT NULL DEFAULT 0,
    error_step_count    INTEGER       NOT NULL DEFAULT 0,
    oltp_task_id        UUID          NOT NULL,
    created_at          TIMESTAMPTZ   NOT NULL,
    PRIMARY KEY (task_fact_key, created_date)
) PARTITION BY RANGE (created_date);

CREATE INDEX idx_ft_date_key  ON analytics.fact_tasks (date_key);
CREATE INDEX idx_ft_company   ON analytics.fact_tasks (company_key, created_date DESC);
CREATE INDEX idx_ft_worker    ON analytics.fact_tasks (worker_key, created_date DESC) WHERE worker_key IS NOT NULL;
CREATE INDEX idx_ft_type      ON analytics.fact_tasks (task_type_key, created_date DESC);
CREATE INDEX idx_ft_oltp_id   ON analytics.fact_tasks (oltp_task_id);

DO $$
DECLARE
    v_month DATE := '2025-01-01';
    v_end   DATE := '2027-07-01';
    v_next  DATE;
    v_name  TEXT;
BEGIN
    WHILE v_month < v_end LOOP
        v_next := v_month + INTERVAL '1 month';
        v_name := 'fact_tasks_' || TO_CHAR(v_month,'YYYY_MM');
        EXECUTE format(
            'CREATE TABLE analytics.%I PARTITION OF analytics.fact_tasks FOR VALUES FROM (%L) TO (%L)',
            v_name, v_month, v_next
        );
        v_month := v_next;
    END LOOP;
END;
$$;

CREATE TABLE analytics.fact_tasks_default PARTITION OF analytics.fact_tasks DEFAULT;

CREATE OR REPLACE FUNCTION analytics.etl_load_fact_tasks(
    p_watermark TIMESTAMPTZ DEFAULT NULL
)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_wm    TIMESTAMPTZ;
    v_count INT := 0;
BEGIN
    SELECT COALESCE(p_watermark,
        (SELECT last_loaded_at FROM analytics.etl_watermarks WHERE table_name = 'fact_tasks'))
    INTO   v_wm;

    INSERT INTO analytics.fact_tasks (
        created_date, date_key, completed_date_key, company_key, warehouse_key,
        worker_key, task_type_key, order_key, status, priority,
        duration_minutes, step_count, error_step_count, oltp_task_id, created_at
    )
    SELECT
        t.created_at::DATE,
        analytics.date_key(t.created_at::DATE),
        analytics.date_key(t.completed_at::DATE),
        dc.company_key,
        dw.warehouse_key,
        du.user_key                                                      AS worker_key,
        dtt.task_type_key,
        dord.order_key,
        t.status::TEXT,
        t.priority::TEXT,
        EXTRACT(EPOCH FROM (t.completed_at - t.started_at)) / 60.0     AS duration_minutes,
        COUNT(tsl.id)                                                    AS step_count,
        COUNT(tsl.id) FILTER (WHERE tsl.result = 'error')               AS error_step_count,
        t.id,
        t.created_at
    FROM   public.tasks t
    JOIN   analytics.dim_company   dc   ON dc.company_id   = t.company_id   AND dc.is_current
    JOIN   analytics.dim_warehouse dw   ON dw.warehouse_id = t.warehouse_id
    LEFT   JOIN analytics.dim_user     du   ON du.user_id  = t.assigned_to  AND du.is_current
    JOIN   analytics.dim_task_type dtt  ON dtt.task_type_name = t.task_type::TEXT
    LEFT   JOIN analytics.dim_order dord ON dord.order_id  = t.reference_id
    LEFT   JOIN public.task_step_logs tsl ON tsl.task_id   = t.id
    WHERE  t.updated_at > v_wm
      AND  t.status IN ('completed','cancelled')
    GROUP  BY t.id, t.status, t.priority, t.created_at, t.completed_at, t.started_at,
              dc.company_key, dw.warehouse_key, du.user_key, dtt.task_type_key, dord.order_key
    ON     CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE analytics.etl_watermarks
    SET    last_loaded_at = NOW(), last_run_at = NOW(), rows_loaded = rows_loaded + v_count, status = 'idle'
    WHERE  table_name = 'fact_tasks';

    RETURN v_count;
END;
$$;

-- =============================================================================
-- MASTER ETL RUNNER
-- Call analytics.etl_run_all() from BullMQ cron job.
-- Dimensions run first (no dependency cycle), then facts.
-- =============================================================================

CREATE OR REPLACE FUNCTION analytics.etl_run_all()
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_result JSONB := '{}';
    v_n      INT;
BEGIN
    -- Dimensions (order matters: company/warehouse before product/location/user)
    PERFORM analytics.etl_merge_dim_warehouse();
    PERFORM analytics.etl_merge_dim_category();
    PERFORM analytics.etl_merge_dim_company();
    PERFORM analytics.etl_merge_dim_product();
    PERFORM analytics.etl_merge_dim_location();
    PERFORM analytics.etl_merge_dim_user();
    PERFORM analytics.etl_merge_dim_lot();
    PERFORM analytics.etl_merge_dim_order();

    -- Facts (incremental — use stored watermarks)
    SELECT analytics.etl_load_fact_inventory_movements() INTO v_n;
    v_result := v_result || jsonb_build_object('fact_inventory_movements', v_n);

    SELECT analytics.etl_load_fact_inbound_operations() INTO v_n;
    v_result := v_result || jsonb_build_object('fact_inbound_operations', v_n);

    SELECT analytics.etl_load_fact_outbound_operations() INTO v_n;
    v_result := v_result || jsonb_build_object('fact_outbound_operations', v_n);

    SELECT analytics.etl_load_fact_billing_transactions() INTO v_n;
    v_result := v_result || jsonb_build_object('fact_billing_transactions', v_n);

    SELECT analytics.etl_load_fact_tasks() INTO v_n;
    v_result := v_result || jsonb_build_object('fact_tasks', v_n);

    -- Daily snapshot (only if not already taken today)
    IF NOT EXISTS (
        SELECT 1 FROM analytics.fact_stock_snapshot WHERE snapshot_date = CURRENT_DATE LIMIT 1
    ) THEN
        SELECT analytics.etl_load_fact_stock_snapshot() INTO v_n;
        v_result := v_result || jsonb_build_object('fact_stock_snapshot', v_n);
    END IF;

    RETURN v_result;
END;
$$;

-- =============================================================================
-- ANALYTICS VIEWS (common analytical queries pre-built as views)
-- =============================================================================

-- Revenue by company per month
CREATE VIEW analytics.v_revenue_by_company_month AS
SELECT
    dd.year,
    dd.month_number,
    dd.month_name,
    dc.name                         AS company_name,
    fbt.charge_type,
    SUM(fbt.amount)                 AS total_amount,
    COUNT(*)                        AS transaction_count
FROM   analytics.fact_billing_transactions fbt
JOIN   analytics.dim_date    dd ON dd.date_key   = fbt.date_key
JOIN   analytics.dim_company dc ON dc.company_key = fbt.company_key
GROUP  BY dd.year, dd.month_number, dd.month_name, dc.name, fbt.charge_type;

-- Inventory on-hand trend by product per day
CREATE VIEW analytics.v_stock_trend AS
SELECT
    fss.snapshot_date,
    dc.name                         AS company_name,
    dp.sku,
    dp.name                         AS product_name,
    dw.code                         AS warehouse_code,
    SUM(fss.quantity_on_hand)       AS total_on_hand,
    SUM(fss.quantity_available)     AS total_available
FROM   analytics.fact_stock_snapshot fss
JOIN   analytics.dim_company   dc ON dc.company_key  = fss.company_key
JOIN   analytics.dim_product   dp ON dp.product_key  = fss.product_key
JOIN   analytics.dim_warehouse dw ON dw.warehouse_key= fss.warehouse_key
GROUP  BY fss.snapshot_date, dc.name, dp.sku, dp.name, dw.code;

-- Worker productivity per month
CREATE VIEW analytics.v_worker_productivity AS
SELECT
    dd.year,
    dd.month_number,
    du.full_name                        AS worker_name,
    dtt.task_type_name,
    COUNT(*)                            AS tasks_completed,
    AVG(ft.duration_minutes)            AS avg_duration_minutes,
    AVG(ft.step_count)                  AS avg_steps,
    SUM(ft.error_step_count)::BIGINT    AS total_errors
FROM   analytics.fact_tasks ft
JOIN   analytics.dim_date      dd  ON dd.date_key       = ft.date_key
JOIN   analytics.dim_user      du  ON du.user_key       = ft.worker_key
JOIN   analytics.dim_task_type dtt ON dtt.task_type_key = ft.task_type_key
WHERE  ft.status = 'completed'
GROUP  BY dd.year, dd.month_number, du.full_name, dtt.task_type_name;

-- Inbound fill rate by company per month
CREATE VIEW analytics.v_inbound_fill_rate AS
SELECT
    dd.year,
    dd.month_number,
    dc.name                             AS company_name,
    COUNT(*)                            AS total_orders,
    AVG(fio.fill_rate_pct)              AS avg_fill_rate_pct,
    AVG(fio.days_to_complete)           AS avg_days_to_complete,
    SUM(fio.discrepancy_lines)          AS total_discrepancy_lines,
    COUNT(*) FILTER (WHERE fio.is_on_time) AS on_time_orders
FROM   analytics.fact_inbound_operations fio
JOIN   analytics.dim_date    dd ON dd.date_key    = fio.confirmed_date_key
JOIN   analytics.dim_company dc ON dc.company_key = fio.company_key
WHERE  fio.status = 'completed'
GROUP  BY dd.year, dd.month_number, dc.name;

-- =============================================================================
-- ANALYTICS PARTITION AUTO-CREATION
-- =============================================================================

CREATE OR REPLACE FUNCTION analytics.etl_create_next_fact_partitions(p_months_ahead INT DEFAULT 3)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_month DATE;
    v_next  DATE;
    v_name  TEXT;
    v_count INT := 0;
    v_tables TEXT[] := ARRAY[
        'fact_inventory_movements',
        'fact_stock_snapshot',
        'fact_billing_transactions',
        'fact_tasks'
    ];
    tbl TEXT;
BEGIN
    FOR i IN 1..p_months_ahead LOOP
        v_month := DATE_TRUNC('month', NOW() + (i || ' months')::INTERVAL)::DATE;
        v_next  := (v_month + INTERVAL '1 month')::DATE;
        FOREACH tbl IN ARRAY v_tables LOOP
            v_name := tbl || '_' || TO_CHAR(v_month,'YYYY_MM');
            IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='analytics' AND tablename=v_name) THEN
                EXECUTE format(
                    'CREATE TABLE analytics.%I PARTITION OF analytics.%I FOR VALUES FROM (%L) TO (%L)',
                    v_name, tbl, v_month, v_next
                );
                v_count := v_count + 1;
            END IF;
        END LOOP;
    END LOOP;
    RETURN v_count;
END;
$$;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
