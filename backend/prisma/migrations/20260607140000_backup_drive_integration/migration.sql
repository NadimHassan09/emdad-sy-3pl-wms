-- BACKUP-6A: Google Drive integration credentials + backup storage destination

CREATE TYPE backup_storage_destination AS ENUM ('local', 'google_drive');
CREATE TYPE backup_drive_sync_status AS ENUM ('pending', 'synced', 'failed');

CREATE TABLE backup_drive_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encrypted_refresh_token TEXT NOT NULL,
  encrypted_folder_id TEXT NOT NULL,
  connected_by_user_id UUID NOT NULL REFERENCES users(id),
  connected_at TIMESTAMPTZ(6) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

ALTER TABLE backup_jobs
  ADD COLUMN storage_destination backup_storage_destination NOT NULL DEFAULT 'local',
  ADD COLUMN gdrive_file_id TEXT,
  ADD COLUMN gdrive_synced_at TIMESTAMPTZ(6),
  ADD COLUMN gdrive_sync_status backup_drive_sync_status,
  ADD COLUMN gdrive_sync_error TEXT;

CREATE INDEX idx_backup_jobs_gdrive_sync_status
  ON backup_jobs (gdrive_sync_status, created_at DESC)
  WHERE gdrive_sync_status IS NOT NULL;
