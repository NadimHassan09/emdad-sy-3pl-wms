-- Backup job history (manual backup engine — BACKUP-2)

CREATE TYPE backup_job_type AS ENUM (
  'manual',
  'scheduled',
  'upload',
  'restore',
  'factory_reset',
  'pre_snapshot'
);

CREATE TYPE backup_job_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TABLE backup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type backup_job_type NOT NULL,
  status backup_job_status NOT NULL DEFAULT 'pending',
  label TEXT,
  triggered_by_user_id UUID NOT NULL REFERENCES users (id),
  artifact_path TEXT,
  dump_filename TEXT,
  manifest JSONB,
  progress_percent SMALLINT NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  bytes_written BIGINT NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ(6),
  completed_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backup_jobs_status_created ON backup_jobs (status, created_at DESC);
CREATE INDEX idx_backup_jobs_triggered_by ON backup_jobs (triggered_by_user_id, created_at DESC);
