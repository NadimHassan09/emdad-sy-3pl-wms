-- OMS returns staged admin execution (plan → approve → receiving → putaway).
-- Store the same execution plan shape as inbound (warehouse, receiving dock, putaway splits).

ALTER TABLE oms_returns
  ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(16),
  ADD COLUMN IF NOT EXISTS execution_plan JSONB;
