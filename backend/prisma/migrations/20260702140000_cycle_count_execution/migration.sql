-- Phase 7.2 — cycle count task execution (blind count + worker claim)

ALTER TABLE cycle_counts
  ADD COLUMN blind_count BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN executing_worker_id UUID REFERENCES workers(id);

CREATE INDEX idx_cycle_counts_executing_worker
  ON cycle_counts (executing_worker_id)
  WHERE executing_worker_id IS NOT NULL;

CREATE INDEX idx_cycle_counts_worker_status
  ON cycle_counts (assigned_worker_id, status);

CREATE INDEX idx_cycle_count_lines_worker_status
  ON cycle_count_lines (assigned_worker_id, status);
