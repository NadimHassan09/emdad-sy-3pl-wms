-- Lead Management — public landing-page form submissions.
-- Additive only: creates a brand-new table. Existing data is untouched.

CREATE TABLE IF NOT EXISTS lead_form_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  message       TEXT,
  created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_form_submissions_created_at_desc
  ON lead_form_submissions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_form_submissions_activity_type
  ON lead_form_submissions (activity_type);
