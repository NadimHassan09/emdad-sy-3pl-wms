-- Immutable generated PDF documents (GRN / Delivery Note).
-- Additive only: creates a new enum, table, indexes and number sequences.
-- Does NOT alter or drop any existing table/column (no data loss).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
    CREATE TYPE "document_type" AS ENUM ('grn', 'delivery_note');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "documents" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id"      UUID NOT NULL,
  "type"            "document_type" NOT NULL,
  "reference_type"  TEXT NOT NULL,
  "reference_id"    UUID NOT NULL,
  "task_id"         UUID,
  "document_number" TEXT NOT NULL,
  "file_name"       TEXT NOT NULL,
  "file_path"       TEXT NOT NULL,
  "language"        TEXT NOT NULL DEFAULT 'en',
  "hash"            TEXT NOT NULL,
  "file_size"       INTEGER NOT NULL DEFAULT 0,
  "generated_by"    UUID,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "documents_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- One immutable document per (type, source task, language).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_document_task_lang"
  ON "documents" ("type", "task_id", "language");

CREATE INDEX IF NOT EXISTS "idx_documents_company_type"
  ON "documents" ("company_id", "type");

CREATE INDEX IF NOT EXISTS "idx_documents_reference"
  ON "documents" ("reference_type", "reference_id");

-- Human-friendly, monotonic document numbers (GRN-000001 / DN-000001).
CREATE SEQUENCE IF NOT EXISTS "grn_document_seq" START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS "dn_document_seq" START WITH 1 INCREMENT BY 1;
