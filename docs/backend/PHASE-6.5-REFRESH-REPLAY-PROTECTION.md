# Phase 6.5 — Refresh Replay Protection Completion

**Status:** Implemented  
**Date:** 2026-05-29  
**Scope:** Internal auth (`/api/auth/*`) refresh token families, rotation, replay detection, and session invalidation. Client portal auth unchanged (no refresh flow).

---

## Summary

| Capability | Implementation |
|------------|----------------|
| Refresh families | `auth_refresh_sessions` — one row per login/device session |
| One-time rotation | `current_jti` updated atomically on each refresh |
| Replay detection | Reuse of consumed JTI → revoke all families + `tokenVersion++` |
| Parallel refresh | `auth_refresh_rotations` idempotency ledger |
| Logout | Revoke all families + bump `tokenVersion` |
| User suspend | Revoke all families (version bumped by user update) |

Builds on Phase 3.1 (`tokenVersion`, rotating JWT refresh cookies).

---

## Replay risks found (pre–Phase 6.5)

### R1 — JTI not persisted (critical)

**Before:** Refresh JWT included random `jti` but the server never stored or validated it.

**Impact:** After a legitimate refresh rotated the cookie, a **stolen copy of the old refresh JWT** remained valid until JWT expiry. `tokenVersion` alone does not detect reuse of a previously valid refresh within the same version.

### R2 — No refresh family binding

**Before:** No `fid` (family id) linking refresh tokens to a server-side session row.

**Impact:** Could not distinguish devices or enforce per-session rotation.

### R3 — Logout incomplete for refresh rows

**Before:** Logout incremented `tokenVersion` but did not mark server-side refresh state revoked.

**Impact:** Orphan session metadata; reliance solely on JWT `ver` mismatch after logout.

### R4 — Parallel refresh race

**Before:** Concurrent `POST /auth/refresh` with the same cookie could both succeed.

**Impact:** Duplicate rotation ambiguity; no idempotent handling for legitimate multi-tab refresh.

### R5 — User suspend gap

**Before:** `tokenVersion` incremented on suspend without revoking refresh session rows.

**Impact:** Minor — refresh already failed on `ver` mismatch; inconsistent session table state.

---

## Fixes implemented

### 1) Database schema

**Migration:** `20260630140000_auth_refresh_replay_protection`

**`auth_refresh_sessions`**

| Column | Purpose |
|--------|---------|
| `id` | Family id (`fid` in JWT) |
| `user_id` | Owner |
| `current_jti` | Active refresh JTI (unique) |
| `token_version` | Bound to `users.token_version` at issue |
| `expires_at` | Server-side session expiry |
| `revoked_at` | Logout / replay / admin invalidation |
| `rotated_at` | Last successful rotation |

**`auth_refresh_rotations`**

| Column | Purpose |
|--------|---------|
| `(session_id, from_jti)` PK | Idempotency for parallel refresh |
| `to_jti` | JTI issued when `from_jti` was consumed |

### 2) `RefreshSessionService`

**File:** `backend/src/modules/auth/refresh-session.service.ts`

| Method | Behavior |
|--------|----------|
| `createSession` | New family on login |
| `rotateSession` | Row lock → CAS rotate → or idempotent replay → or family-wide revoke |
| `invalidateUserSessions` | Logout: revoke all + `tokenVersion++` |
| `revokeAllSessionsForUser` | Revoke rows without version bump (if already bumped) |

**Replay path:** presented `jti` ≠ `current_jti` and no idempotency row → `revokeAllSessionsForUser` + `tokenVersion++` → `401` with clear message.

### 3) `AuthService` integration

**Refresh JWT payload (required claims):**

```json
{
  "sub": "<userId>",
  "typ": "internal",
  "kind": "refresh",
  "ver": <tokenVersion>,
  "fid": "<familyId>",
  "jti": "<currentJti>"
}
```

| Event | Actions |
|-------|---------|
| **Login** | `createSession` → sign refresh with `fid` + `jti` |
| **Refresh** | `rotateSession` → new access + refresh cookies; audit `AUTH_REFRESH_SUCCESS` or `AUTH_REFRESH_REPLAY_IDEMPOTENT` |
| **Replay detected** | Audit `AUTH_REFRESH_REPLAY_DETECTED` |
| **Logout** | `invalidateUserSessions` → all families revoked + version bump → clear cookies |

### 4) User suspend

**File:** `users.service.ts` — on `status → inactive`, revoke all `auth_refresh_sessions` for user (with `tokenVersion` increment already applied).

---

## Invalidation behavior

| Trigger | `tokenVersion` | Refresh families | Access tokens |
|---------|----------------|------------------|---------------|
| Logout | +1 | All revoked | Invalid (`ver` mismatch) |
| Refresh replay detected | +1 | All revoked | Invalid |
| User suspended | +1 | All revoked | Invalid |
| Password change (future) | Not in scope | — | — |
| New login | Unchanged | **New** family row | New access token |

**Multi-session:** Each login creates a **separate family**. Logout and replay detection invalidate **all** families for the user (`tokenVersion` bump).

---

## Session protections

1. **HttpOnly + Strict cookies** (Phase 3.1) — refresh scoped to `/api/auth/refresh`
2. **Short-lived access token** — default `15m`
3. **Separate refresh secret** — `JWT_REFRESH_SECRET` in production
4. **Server-side one-time refresh** — consumed JTIs cannot be reused without detection
5. **Row-level lock** — `SELECT … FOR UPDATE` on refresh session during rotation
6. **Idempotent parallel refresh** — rotation ledger prevents false replay on concurrent identical requests
7. **Audit trail** — login, refresh, idempotent refresh, replay, logout events

---

## Production behavior

1. Deploy migration `20260630140000_auth_refresh_replay_protection`
2. Restart API (run `npx prisma generate` if client was locked during deploy)
3. **Existing refresh cookies without `fid` will fail** — users must log in again (one-time break for in-flight sessions)
4. Normal flow: login → refresh rotates family → logout invalidates all

**Recommended:** keep `JWT_REFRESH_EXPIRES_IN` at `7d` or lower; access at `15m`.

---

## Validation

| Check | Result |
|-------|--------|
| `npx prisma migrate deploy` | Applied |
| `npx tsc --noEmit` | Pass |

**Manual test plan:**

1. Login → refresh → success; new cookie set
2. Replay **old** refresh cookie (save pre-refresh) → `401`, all sessions dead, must re-login
3. Logout → refresh fails; access fails
4. Two parallel refresh with same cookie → both succeed (idempotent) or one succeeds without false replay lockout
5. Suspend user → refresh fails

---

## Remaining limitations

| Limitation | Notes |
|------------|-------|
| Client portal has no refresh flow | Long-lived client JWT only; out of scope |
| No refresh token binding to IP/UA | Cookie theft still works until replay or expiry |
| Replay triggers **global** invalidation | All devices logged out — correct for stolen-token scenario; aggressive for shared misuse |
| No periodic cleanup of expired session rows | Rows remain until manual/scheduled purge; low risk |
| Access token not JTI-tracked | Relies on short TTL + `tokenVersion` |
| WebSocket auth | Uses access JWT; inherits `tokenVersion` check (Phase 1.3) |

---

## Files changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `AuthRefreshSession`, `AuthRefreshRotation` models |
| `prisma/migrations/20260630140000_auth_refresh_replay_protection/` | **New** |
| `refresh-session.service.ts` | **New** — rotation + replay logic |
| `auth.service.ts` | Family-aware refresh + logout invalidation |
| `auth.module.ts` | Register/export `RefreshSessionService` |
| `users.service.ts` | Revoke refresh rows on suspend |

---

## Related

- [PHASE-3.1-JWT-SESSION-HARDENING.md](./PHASE-3.1-JWT-SESSION-HARDENING.md)
- [PHASE-6.3-RBAC-CONSISTENCY-CLEANUP.md](./PHASE-6.3-RBAC-CONSISTENCY-CLEANUP.md)
- [ENTERPRISE-WMS-COMPLETE-AUDIT-AND-TEST-ANALYSIS.md](./ENTERPRISE-WMS-COMPLETE-AUDIT-AND-TEST-ANALYSIS.md) — H3 refresh replay
