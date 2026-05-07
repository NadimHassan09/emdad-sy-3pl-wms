-- Suspend catalogue items without archiving (still visible; blocked on new inbound/outbound usage).
DO $e$
BEGIN
    ALTER TYPE product_status ADD VALUE 'suspended';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END;
$e$;
