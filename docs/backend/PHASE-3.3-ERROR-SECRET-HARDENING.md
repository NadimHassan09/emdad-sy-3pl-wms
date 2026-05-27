# Phase 3.3 — Error & Secret Hardening

**Status:** Implemented (security hardening only)  
**Date:** 2026-05-27  
**Scope:** Backend error handling, environment validation, safer config usage, and production-safe logging.

---

## Goal

Harden backend runtime behavior to prevent:

- stack trace leakage
- sensitive info exposure in API errors
- unsafe logging output
- secret/config exposure due to weak environment setup

Without changing business workflows or domain behavior.

---

## Implemented Changes

### 1) Sanitized error responses

**What changed**
- Refactored global exception handling in `AllExceptionsFilter`:
  - central message sanitization with environment-aware behavior
  - production mode now returns generic message for 5xx errors (`Internal server error.`)
  - response details are included only outside production
  - added optional response `requestId` propagation from `x-request-id` / `x-correlation-id`
- Added redaction for sensitive fragments in messages:
  - `password=...`
  - `token=...`
  - `secret=...`
  - `authorization=...`
  - bearer token strings

**Why it matters**
- prevents leaking internals, credentials, token material, and stack-derived sensitive values to API clients

**File**
- `backend/src/common/filters/all-exceptions.filter.ts`

---

### 2) Safer exception logging

**What changed**
- Exception filter logging now includes method/path context.
- In production:
  - logs only sanitized error name/message for server errors
  - avoids full stack trace logging
- In non-production:
  - stack traces are still available to support debugging.

**Why it matters**
- reduces accidental secret disclosure in production logs while preserving useful diagnostics in development.

**File**
- `backend/src/common/filters/all-exceptions.filter.ts`

---

### 3) Environment validation (fail-fast security checks)

**What changed**
- Added env validation module using Zod:
  - validates core runtime env values (`NODE_ENV`, `PORT`, `CORS_ORIGINS`, JWT secrets, optional limits/domain)
  - requires sufficiently long secrets
- Production-specific guardrails:
  - rejects default dev JWT secret in production
  - requires `JWT_REFRESH_SECRET` in production
  - enforces `JWT_REFRESH_SECRET !== JWT_SECRET` in production

**Why it matters**
- prevents insecure startup configuration from silently entering production.

**Files**
- `backend/src/common/config/env.validation.ts`
- `backend/src/app.module.ts` (wired via `ConfigModule.forRoot({ validate, cache, expandVariables })`)

---

### 4) Safer config handling

**What changed**
- `ConfigModule` now uses:
  - `validate: validateEnv`
  - `cache: true`
  - `expandVariables: true`

**Why it matters**
- ensures typed/validated config and consistent safe reads at runtime.

**File**
- `backend/src/app.module.ts`

---

### 5) Production-safe startup logging

**What changed**
- Replaced direct `console.log` startup output with Nest `Logger`.
- Production startup log now avoids explicit localhost URL details.
- Non-production retains convenient local URL output.

**Why it matters**
- avoids overly verbose runtime exposure in production logs and aligns with structured Nest logging.

**File**
- `backend/src/main.ts`

---

## Security Outcomes

This phase improves:

- **stack trace leakage prevention** (sanitized prod error handling)
- **sensitive info protection** (error/message redaction + generic 5xx output)
- **safer logging posture** (prod-safe logs without raw stacks/tokens)
- **secret hygiene enforcement** (startup fails on insecure production secret config)

---

## Validation

Post-change checks:

- `npx tsc --noEmit` ✅
- lint diagnostics on changed hardening files ✅

No business module/workflow/inventory behavior was changed in this phase.

