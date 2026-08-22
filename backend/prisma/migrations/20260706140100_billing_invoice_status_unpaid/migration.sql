-- Migrate legacy invoice statuses to unpaid (separate migration so enum value is committed).

UPDATE "invoices" SET "status" = 'unpaid' WHERE "status" IN ('open', 'overdue');
