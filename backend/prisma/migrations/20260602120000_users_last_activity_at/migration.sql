-- Track recent authenticated activity for internal users (online/offline in Users UI).

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;
