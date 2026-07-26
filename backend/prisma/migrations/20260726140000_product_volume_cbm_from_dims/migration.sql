-- Backfill product CBM from centimetre dimensions.
-- Formula: volume_cbm = (length_cm × width_cm × height_cm) / 1_000_000
-- Incomplete or non-positive dimensions → 0 CBM.

UPDATE "products"
SET "volume_cbm" = ROUND(
  (("length_cm"::numeric) * ("width_cm"::numeric) * ("height_cm"::numeric)) / 1000000.0,
  6
)
WHERE "length_cm" IS NOT NULL
  AND "width_cm" IS NOT NULL
  AND "height_cm" IS NOT NULL
  AND "length_cm" > 0
  AND "width_cm" > 0
  AND "height_cm" > 0;

UPDATE "products"
SET "volume_cbm" = 0
WHERE "length_cm" IS NULL
   OR "width_cm" IS NULL
   OR "height_cm" IS NULL
   OR "length_cm" <= 0
   OR "width_cm" <= 0
   OR "height_cm" <= 0
   OR "volume_cbm" IS NULL;
