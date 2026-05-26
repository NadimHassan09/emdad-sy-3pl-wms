-- Phase 1.1: explicit internal user ↔ company membership (tenant grants).
CREATE TABLE IF NOT EXISTS user_company_access (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_company_access_company
    ON user_company_access (company_id);
