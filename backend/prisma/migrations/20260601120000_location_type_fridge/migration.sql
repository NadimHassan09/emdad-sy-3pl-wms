-- Add `fridge` to LocationType (cold storage bins, same putaway rules as internal).
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'location_type'
      AND e.enumlabel = 'fridge'
  ) THEN
    ALTER TYPE location_type ADD VALUE 'fridge';
  END IF;
END
$migration$;
