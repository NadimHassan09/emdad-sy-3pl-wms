-- OMS return numbers must be globally unique (return_number UNIQUE).
-- App previously used per-company count → OR-000001 collisions across companies.
-- Align with OMS/INB/OUT/RTN: populate via next_seq_number on insert when blank.

CREATE OR REPLACE FUNCTION fn_oms_return_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.return_number = '' OR NEW.return_number IS NULL THEN
        NEW.return_number := next_seq_number('OR');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_oms_return_number ON oms_returns;
CREATE TRIGGER trg_oms_return_number
  BEFORE INSERT ON oms_returns
  FOR EACH ROW
  EXECUTE FUNCTION fn_oms_return_number();
