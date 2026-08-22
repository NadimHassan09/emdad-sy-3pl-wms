ALTER TABLE backup_jobs
  ADD COLUMN parent_job_id UUID NULL REFERENCES backup_jobs (id) ON DELETE SET NULL;

CREATE INDEX idx_backup_jobs_parent_job ON backup_jobs (parent_job_id);
