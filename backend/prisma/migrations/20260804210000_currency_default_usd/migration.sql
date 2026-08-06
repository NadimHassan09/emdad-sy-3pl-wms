-- Switch system currency default from SYP to USD.
ALTER TABLE "oms_orders" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "outbound_orders" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "cod_records" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "order_invoices" ALTER COLUMN "currency" SET DEFAULT 'USD';

UPDATE "oms_orders" SET "currency" = 'USD' WHERE "currency" IS NULL OR upper("currency") IN ('SYP', 'USD');
UPDATE "outbound_orders" SET "currency" = 'USD' WHERE "currency" IS NULL OR upper("currency") IN ('SYP', 'USD');
UPDATE "cod_records" SET "currency" = 'USD' WHERE upper("currency") IN ('SYP', 'USD');
UPDATE "order_invoices" SET "currency" = 'USD' WHERE upper("currency") IN ('SYP', 'USD');
