# Phase 3.1 — JWT & Session Hardening

**Status:** Implemented (authentication hardening only)  
**Date:** 2026-05-27  
**Scope:** Internal auth flow hardening for JWT/session lifecycle, refresh handling, and cookie safety.

---

## Goal

Reduce authentication risk by hardening:

- token invalidation (`tokenVersion`)
- refresh token flow
- JWT payload validation
- session revocation behavior
- cookie security defaults

Without redesigning application workflows or business modules.

---

## Implemented Changes

### 1) Token version invalidation (stale session kill switch)

**What changed**
- Internal access tokens now include `ver` (snapshot of `users.token_version`).
- `JwtStrategy` now compares `payload.ver` against DB `user.tokenVersion`.
- Mismatch causes immediate `UnauthorizedException` (session invalidated).

**Why it matters**
- Enables server-side revocation of previously issued tokens.
- Prevents stale sessions from surviving account/session invalidation events.

**Files**
- `backend/src/modules/auth/strategies/jwt.strategy.ts`
- `backend/src/modules/auth/auth.service.ts`

---

### 2) Secure refresh flow (cookie-bound, rotating refresh)

**What changed**
- Added `POST /api/auth/refresh`.
- Refresh token stored in HttpOnly cookie `refresh_token` (not required in response body).
- Refresh token payload includes:
  - `typ: 'internal'`
  - `kind: 'refresh'`
  - `ver` (tokenVersion binding)
  - `jti` (rotation uniqueness)
- Refresh verifies:
  - signature + expiration
  - token type/kind
  - current user active/internal
  - `payload.ver === user.tokenVersion`
- On successful refresh:
  - new short-lived access token is issued
  - refresh token is rotated and re-set

**Why it matters**
- Reduces token replay window.
- Prevents unsafe refresh from bypassing invalidation.
- Ensures refresh grants are tied to current server-side session state.

**Files**
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`

---

### 3) Stronger access token validation

**What changed**
- Internal JWT strategy now rejects tokens with:
  - missing core claims (`sub`, `email`, `role`)
  - invalid `typ`
  - missing `ver`
  - tokenVersion mismatch
- Existing client/internal boundary protection remains in place.

**Why it matters**
- Tightens acceptance criteria for bearer/cookie tokens.
- Reduces risk from malformed or context-mismatched tokens.

**File**
- `backend/src/modules/auth/strategies/jwt.strategy.ts`

---

### 4) Safer logout/session handling

**What changed**
- `POST /api/auth/logout` now:
  - attempts to verify refresh token from cookie
  - increments `users.token_version` for that user when valid
  - clears both access + refresh cookies

**Why it matters**
- Explicit logout revokes currently bound token family.
- Removes browser-held credentials even if caller does not manually clear storage.

**Files**
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`

---

### 5) Secure cookie configuration defaults

**What changed**
- Centralized cookie option generation in auth service.
- Internal auth cookies now use:
  - `httpOnly: true`
  - `sameSite: 'strict'`
  - `secure: NODE_ENV === 'production'`
  - optional `domain` from `AUTH_COOKIE_DOMAIN`
- Path scoping:
  - access token cookie path: `/`
  - refresh token cookie path: `/api/auth/refresh`

**Why it matters**
- Reduces CSRF/cross-site cookie exposure.
- Limits refresh token surface area by endpoint path.

**File**
- `backend/src/modules/auth/auth.service.ts`

---

## API Impact

### New endpoint
- `POST /api/auth/refresh`

### Updated behavior
- `POST /api/auth/login` now sets both `access_token` and `refresh_token` cookies.
- `POST /api/auth/logout` now clears both cookies and performs tokenVersion invalidation when possible.

### Backward compatibility note
- Access token response shape remains compatible.
- Refresh token handling is now primarily cookie-based for safer session handling.

---

## Configuration

Recommended environment variables:

- `JWT_ACCESS_EXPIRES_IN` (default: `15m`)
- `JWT_REFRESH_EXPIRES_IN` (default: `7d`)
- `JWT_REFRESH_SECRET` (recommended; falls back to `JWT_SECRET`)
- `AUTH_COOKIE_DOMAIN` (optional)

---

## Security Outcomes

This patch directly improves:

- **stale session prevention** via `tokenVersion` checks
- **token replay resistance** via rotating refresh and shorter access lifetime
- **unsafe refresh mitigation** via strict refresh payload/type/version checks
- **session revocation safety** via logout-triggered invalidation + cookie clearing

---

## Validation

Executed after implementation:

- `npx tsc --noEmit` ✅
- lint diagnostics on touched auth files ✅

No workflow/task/inventory logic was modified in this phase; changes were scoped to authentication hardening.

