CREATE TABLE IF NOT EXISTS "document_slot_overrides" (
  "task_id"           UUID PRIMARY KEY,
  "client_reference"  TEXT,
  "notes"             TEXT,
  "supplier"          TEXT,
  "po_number"         TEXT,
  "operator_name"     TEXT,
  "destination"       TEXT,
  "carrier"           TEXT,
  "tracking_number"   TEXT,
  "vehicle"           TEXT,
  "driver"            TEXT,
  "updated_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
