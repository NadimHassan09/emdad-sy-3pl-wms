-- Fix backup_storage_settings singleton id to audit-safe UUID

UPDATE backup_storage_settings SET id = '00000000-0000-4000-8000-0000000000d1' WHERE id = 'default';

ALTER TABLE backup_storage_settings ALTER COLUMN id DROP DEFAULT;
ALTER TABLE backup_storage_settings
  ALTER COLUMN id TYPE UUID USING id::uuid;
ALTER TABLE backup_storage_settings
  ALTER COLUMN id SET DEFAULT '00000000-0000-4000-8000-0000000000d1'::uuid;
