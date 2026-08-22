-- Final warehouse contracts table + reference-based document uniqueness.

CREATE TABLE IF NOT EXISTS "final_contracts" (
  "id"                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id"                UUID NOT NULL,
  "contract_number"           TEXT NOT NULL,
  "issue_date"                DATE NOT NULL,
  "client_company_name"       TEXT NOT NULL,
  "client_company_type"       TEXT,
  "client_address"            TEXT,
  "client_phone"              TEXT,
  "client_email"              TEXT,
  "client_tax_id"             TEXT,
  "client_signatory_name"     TEXT,
  "client_signatory_title"    TEXT,
  "rate_storage"              DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "rate_inbound_handling"     DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "rate_outbound_handling"    DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "rate_value_added_services" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "rate_return_processing"    DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "created_by"                UUID,
  "created_at"                TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"                TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "final_contracts_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "final_contracts_contract_number_key"
  ON "final_contracts" ("contract_number");

CREATE INDEX IF NOT EXISTS "idx_final_contracts_company"
  ON "final_contracts" ("company_id");

CREATE INDEX IF NOT EXISTS "idx_final_contracts_issue_date"
  ON "final_contracts" ("issue_date");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_document_final_contract_lang"
  ON "documents" ("type", "reference_id", "language")
  WHERE "type" = 'final_contract';

CREATE SEQUENCE IF NOT EXISTS "final_contract_document_seq" START WITH 1 INCREMENT BY 1;
