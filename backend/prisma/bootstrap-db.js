/**
 * Phase-1 DB bootstrap.
 *
 * Run once after `prisma db push` against an empty schema to install pieces
 * that the Prisma schema can't express but Phase 1 depends on:
 *   - sequence_counters table + next_seq_number()
 *   - fn_inbound_order_number / fn_outbound_order_number triggers
 *   - quantity_available as a generated column on current_stock
 *   - partial unique indexes on current_stock (uq_stock_lot_position / uq_stock_bare_position)
 *   - DB-level gen_random_uuid() defaults on UUID PK columns (so raw INSERTs work)
 *   - inventory_ledger.quantity_before / quantity_after (nullable; new writes populate)
 *   - stock_adjustments / stock_adjustment_lines (+ triggers) if absent
 *   - back-fills any existing empty order_numbers
 *
 * Idempotent — every CREATE / ALTER uses IF NOT EXISTS / OR REPLACE / DROP+CREATE.
 *
 * Usage:
 *   node prisma/bootstrap-db.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STATEMENTS = [
  // -------------------------------------------------------------------------
  // crypto extension (gen_random_uuid)
  // -------------------------------------------------------------------------
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,

  // -------------------------------------------------------------------------
  // location_type: ISS (internal storage section — parent-only, non-storage)
  // -------------------------------------------------------------------------
  `ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'iss'`,

  // -------------------------------------------------------------------------
  // sequence_counters + next_seq_number
  // -------------------------------------------------------------------------
  `CREATE TABLE IF NOT EXISTS sequence_counters (
       name        TEXT    NOT NULL,
       year        INTEGER NOT NULL,
       last_value  BIGINT  NOT NULL DEFAULT 0,
       PRIMARY KEY (name, year)
   )`,
  `CREATE OR REPLACE FUNCTION next_seq_number(p_prefix TEXT, p_pad INT DEFAULT 5)
   RETURNS TEXT LANGUAGE plpgsql AS $fn$
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
   $fn$`,

  // -------------------------------------------------------------------------
  // Order-number triggers
  // -------------------------------------------------------------------------
  `CREATE OR REPLACE FUNCTION fn_inbound_order_number()
   RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
   BEGIN
       IF NEW.order_number = '' OR NEW.order_number IS NULL THEN
           NEW.order_number := next_seq_number('INB');
       END IF;
       RETURN NEW;
   END;
   $fn$`,
  `DROP TRIGGER IF EXISTS trg_inbound_order_number ON inbound_orders`,
  `CREATE TRIGGER trg_inbound_order_number BEFORE INSERT ON inbound_orders
       FOR EACH ROW EXECUTE FUNCTION fn_inbound_order_number()`,

  `CREATE OR REPLACE FUNCTION fn_outbound_order_number()
   RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
   BEGIN
       IF NEW.order_number = '' OR NEW.order_number IS NULL THEN
           NEW.order_number := next_seq_number('OUT');
       END IF;
       RETURN NEW;
   END;
   $fn$`,
  `DROP TRIGGER IF EXISTS trg_outbound_order_number ON outbound_orders`,
  `CREATE TRIGGER trg_outbound_order_number BEFORE INSERT ON outbound_orders
       FOR EACH ROW EXECUTE FUNCTION fn_outbound_order_number()`,

  // -------------------------------------------------------------------------
  // current_stock: generated column + partial unique indexes
  // -------------------------------------------------------------------------
  // Ensure quantity_available is the expected STORED generated column. Skip the
  // DROP+ADD when a matching generated column already exists (dependent views
  // such as v_stock_summary in later migrations would otherwise block the DROP).
  `DO $qa$
   DECLARE
       v_is_generated TEXT;
   BEGIN
       SELECT is_generated INTO v_is_generated
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = 'current_stock'
         AND column_name  = 'quantity_available';
       IF v_is_generated IS DISTINCT FROM 'ALWAYS' THEN
           ALTER TABLE current_stock DROP COLUMN IF EXISTS quantity_available;
           ALTER TABLE current_stock
               ADD COLUMN quantity_available DECIMAL(15,4)
               GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED;
       END IF;
   END
   $qa$`,

  `DROP INDEX IF EXISTS uq_stock_lot_position`,
  `DROP INDEX IF EXISTS uq_stock_bare_position`,
  `CREATE UNIQUE INDEX uq_stock_lot_position
       ON current_stock (company_id, product_id, location_id, lot_id)
       WHERE lot_id IS NOT NULL AND package_id IS NULL`,
  `CREATE UNIQUE INDEX uq_stock_bare_position
       ON current_stock (company_id, product_id, location_id)
       WHERE lot_id IS NULL AND package_id IS NULL`,

  `DROP INDEX IF EXISTS idx_stock_company_product`,
  `CREATE INDEX idx_stock_company_product ON current_stock (company_id, product_id)
       WHERE quantity_on_hand > 0`,

  // -------------------------------------------------------------------------
  // inventory_ledger: audit columns (nullable for legacy rows)
  // -------------------------------------------------------------------------
  `ALTER TABLE inventory_ledger ADD COLUMN IF NOT EXISTS quantity_before DECIMAL(15,4)`,
  `ALTER TABLE inventory_ledger ADD COLUMN IF NOT EXISTS quantity_after DECIMAL(15,4)`,

  // -------------------------------------------------------------------------
  // stock_adjustments (+ lines): required by Adjustments API; absent if schema
  // was created via partial migrate/db push vs full 0_init migration.sql
  // -------------------------------------------------------------------------
  `DO $$
   BEGIN
     CREATE TYPE adjustment_status AS ENUM ('draft','approved','cancelled');
   EXCEPTION
     WHEN duplicate_object THEN NULL;
   END $$`,

  `CREATE OR REPLACE FUNCTION fn_set_updated_at()
   RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
   BEGIN
       NEW.updated_at = NOW();
       RETURN NEW;
   END;
   $fn$`,

  `CREATE TABLE IF NOT EXISTS stock_adjustments (
       id           UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
       company_id   UUID              NOT NULL REFERENCES companies (id),
       warehouse_id UUID              NOT NULL REFERENCES warehouses (id),
       reason       TEXT              NOT NULL,
       status       adjustment_status NOT NULL DEFAULT 'draft',
       approved_by  UUID              REFERENCES users (id),
       approved_at  TIMESTAMPTZ,
       created_by   UUID              NOT NULL REFERENCES users (id),
       created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
       updated_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
       CONSTRAINT chk_approved_fields CHECK (
           status <> 'approved'::adjustment_status
           OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
       )
   )`,

  `CREATE TABLE IF NOT EXISTS stock_adjustment_lines (
       id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
       adjustment_id   UUID          NOT NULL REFERENCES stock_adjustments (id) ON DELETE CASCADE,
       product_id      UUID          NOT NULL REFERENCES products (id),
       location_id     UUID          NOT NULL REFERENCES locations (id),
       lot_id          UUID          REFERENCES lots (id),
       quantity_before DECIMAL(15,4) NOT NULL,
       quantity_after  DECIMAL(15,4) NOT NULL CHECK (quantity_after >= 0),
       quantity_change DECIMAL(15,4) GENERATED ALWAYS AS (quantity_after - quantity_before) STORED,
       reason_note     TEXT
   )`,

  `DROP TRIGGER IF EXISTS trg_stock_adjustments_updated_at ON stock_adjustments`,
  `CREATE TRIGGER trg_stock_adjustments_updated_at
       BEFORE UPDATE ON stock_adjustments
       FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()`,

  `CREATE OR REPLACE FUNCTION fn_validate_adjustment_qty()
   RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
   DECLARE
       v_actual DECIMAL(15,4);
       v_line   RECORD;
   BEGIN
       IF NEW.status = 'approved'::adjustment_status
          AND OLD.status <> 'approved'::adjustment_status THEN
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
   $fn$`,
  `DROP TRIGGER IF EXISTS trg_validate_adjustment_qty ON stock_adjustments`,
  `CREATE TRIGGER trg_validate_adjustment_qty
       BEFORE UPDATE OF status ON stock_adjustments
       FOR EACH ROW EXECUTE FUNCTION fn_validate_adjustment_qty()`,
];

const PK_TABLES = [
  'current_stock',
  'inventory_ledger',
  'lots',
  'inbound_orders',
  'inbound_order_lines',
  'outbound_orders',
  'outbound_order_lines',
  'companies',
  'users',
  'warehouses',
  'locations',
  'products',
  'stock_adjustments',
  'stock_adjustment_lines',
];

(async () => {
  try {
    for (const sql of STATEMENTS) {
      const head = sql.split('\n')[0].trim();
      console.log('· ' + head + (sql.length > head.length ? ' …' : ''));
      await prisma.$executeRawUnsafe(sql);
    }

    for (const table of PK_TABLES) {
      const sql = `ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT gen_random_uuid()`;
      try {
        await prisma.$executeRawUnsafe(sql);
        console.log('· ' + sql);
      } catch (err) {
        console.log(`  skip ${table}: ${(err.message || '').split('\n')[0]}`);
      }
    }

    console.log('\nBack-filling empty order_numbers…');
    await prisma.$executeRawUnsafe(
      `UPDATE inbound_orders SET order_number = next_seq_number('INB')
        WHERE order_number = '' OR order_number IS NULL`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE outbound_orders SET order_number = next_seq_number('OUT')
        WHERE order_number = '' OR order_number IS NULL`,
    );

    console.log('\nDone. Phase 1 DB bootstrap complete.');
  } finally {
    await prisma.$disconnect();
  }
})();
