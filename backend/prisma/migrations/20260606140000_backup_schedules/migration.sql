-- Scheduled backup configuration (BACKUP-4A)

CREATE TYPE backup_schedule_frequency AS ENUM ('daily', 'weekly', 'monthly');

CREATE TABLE backup_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT true,
  frequency backup_schedule_frequency NOT NULL,
  hour SMALLINT NOT NULL CHECK (hour >= 0 AND hour <= 23),
  minute SMALLINT NOT NULL CHECK (minute >= 0 AND minute <= 59),
  retention_days INT NOT NULL DEFAULT 7 CHECK (retention_days >= 1),
  last_run_at TIMESTAMPTZ(6),
  created_by_user_id UUID NOT NULL REFERENCES users (id),
  updated_by_user_id UUID NOT NULL REFERENCES users (id),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backup_schedules_enabled ON backup_schedules (enabled);

ALTER TABLE backup_jobs
  ADD COLUMN backup_schedule_id UUID NULL REFERENCES backup_schedules (id) ON DELETE SET NULL;

CREATE INDEX idx_backup_jobs_schedule ON backup_jobs (backup_schedule_id, created_at DESC);
