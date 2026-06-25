-- BACKUP-6B: Storage routing policies, drive retry fields, drive retention support

CREATE TYPE backup_storage_policy AS ENUM ('local_only', 'drive_only', 'local_and_drive');

CREATE TABLE backup_storage_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-4000-8000-0000000000d1',
  default_policy backup_storage_policy NOT NULL DEFAULT 'local_and_drive',
  updated_by_user_id UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

INSERT INTO backup_storage_settings (id, default_policy)
VALUES ('00000000-0000-4000-8000-0000000000d1', 'local_and_drive');

ALTER TABLE backup_schedules
  ADD COLUMN storage_policy backup_storage_policy;

ALTER TABLE backup_jobs
  ADD COLUMN storage_policy backup_storage_policy NOT NULL DEFAULT 'local_and_drive',
  ADD COLUMN local_artifact_purged BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN gdrive_sync_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN gdrive_next_retry_at TIMESTAMPTZ(6);

CREATE INDEX idx_backup_jobs_gdrive_retry
  ON backup_jobs (gdrive_sync_status, gdrive_next_retry_at)
  WHERE gdrive_sync_status = 'failed' AND gdrive_next_retry_at IS NOT NULL;
