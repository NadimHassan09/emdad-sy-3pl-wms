-- Prisma LocationType enum includes `iss`; 0_init did not. Keeps DB in sync for updates/creates using type iss.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'location_type'
      AND e.enumlabel = 'iss'
  ) THEN
    ALTER TYPE location_type ADD VALUE 'iss';
  END IF;
END
$migration$;
