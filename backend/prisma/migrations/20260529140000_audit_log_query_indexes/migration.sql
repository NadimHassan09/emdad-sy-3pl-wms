-- Phase 5.1 — audit log query indexes (list/filter/search support on partitioned audit_logs)

CREATE INDEX IF NOT EXISTS idx_audit_created_at
  ON audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_action
  ON audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_actor_email
  ON audit_logs (lower(actor_email), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_actor_role
  ON audit_logs (actor_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_company_action
  ON audit_logs (company_id, action, created_at DESC)
  WHERE company_id IS NOT NULL;
