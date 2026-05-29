-- Phase 6.5 — refresh token family tracking + replay detection

CREATE TABLE auth_refresh_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_jti UUID NOT NULL UNIQUE,
    token_version INT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX auth_refresh_sessions_user_id_idx ON auth_refresh_sessions(user_id);
CREATE INDEX auth_refresh_sessions_user_revoked_idx ON auth_refresh_sessions(user_id, revoked_at);

CREATE TABLE auth_refresh_rotations (
    session_id UUID NOT NULL REFERENCES auth_refresh_sessions(id) ON DELETE CASCADE,
    from_jti UUID NOT NULL,
    to_jti UUID NOT NULL,
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, from_jti)
);
