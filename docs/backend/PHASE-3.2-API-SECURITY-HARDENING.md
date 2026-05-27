# Phase 3.2 — API Security Hardening

**Status:** Implemented (HTTP API hardening only)  
**Date:** 2026-05-27  
**Scope:** Harden HTTP request/response surface against abuse, malformed input, and common API attack patterns.

---

## Goal

Strengthen API perimeter defenses by implementing:

- Helmet (secure headers)
- rate limiting
- tighter validation behavior
- safer CORS handling
- request sanitization
- payload size controls

Without changing domain workflows, business logic, or inventory/task processing.

---

## Implemented Changes

### 1) Secure headers via Helmet

**What changed**
- Added Helmet middleware globally in bootstrap.
- Enabled production-focused behavior:
  - HSTS in production
  - strict referrer policy
  - CSP disabled in non-prod for local dev compatibility
  - COEP relaxed (`crossOriginEmbedderPolicy: false`) to avoid breaking current app assets/workflows

**Why it matters**
- Adds baseline browser security headers against common web attack vectors.

**File**
- `backend/src/main.ts`

---

### 2) Global rate limiting

**What changed**
- Added `@nestjs/throttler`.
- Registered global throttling:
  - `ttl: 60_000`
  - `limit: 120`
- Added `ThrottlerGuard` as global `APP_GUARD` before JWT guard.

**Why it matters**
- Reduces abuse/spam risk (credential stuffing, burst scraping, brute-force API misuse).

**File**
- `backend/src/app.module.ts`

---

### 3) Validation tightening

**What changed**
- Hardened global `ValidationPipe`:
  - `whitelist: true` (already present)
  - `forbidNonWhitelisted: true` (tightened)
  - `forbidUnknownValues: true` (added)
  - `stopAtFirstError: true` (added)
  - `validationError.target = false`, `validationError.value = false` (avoid leaking raw payload details)

**Why it matters**
- Rejects malformed/unexpected fields early.
- Reduces accidental over-posting and noisy payload acceptance.

**File**
- `backend/src/main.ts`

---

### 4) Safer CORS behavior

**What changed**
- Preserved explicit allowlist (`CORS_ORIGINS`) as primary policy.
- Localhost wildcard fallback now applies **only in non-production**.
- Added explicit CORS methods and preflight tuning:
  - methods: `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`
  - `optionsSuccessStatus: 204`
  - `maxAge: 86400`

**Why it matters**
- Prevents permissive dev fallback from weakening production posture.
- Makes preflight behavior explicit and predictable.

**File**
- `backend/src/main.ts`

---

### 5) Request sanitization middleware

**What changed**
- Added recursive sanitizer for `req.body`, `req.query`, and `req.params`.
- Strips dangerous prototype-pollution keys:
  - `__proto__`
  - `prototype`
  - `constructor`

**Why it matters**
- Reduces risk of prototype-pollution style request payload attacks.

**File**
- `backend/src/main.ts`

---

### 6) Request body size limits

**What changed**
- Added explicit parser limits:
  - JSON limit from `HTTP_JSON_BODY_LIMIT` (default `100kb`)
  - URL-encoded limit from `HTTP_FORM_BODY_LIMIT` (default `100kb`, `extended: false`)

**Why it matters**
- Mitigates oversized payload abuse and unnecessary memory pressure.

**File**
- `backend/src/main.ts`

---

## Dependency Changes

Added runtime dependencies:

- `helmet`
- `@nestjs/throttler`

Updated:
- `backend/package.json`
- lockfile (via npm install)

---

## API / Runtime Impact

- No endpoint contract redesign.
- Invalid payloads that were previously tolerated may now return `400` due to stricter validation.
- High-frequency clients can now receive throttling responses when limits are exceeded.
- Production CORS is stricter by removing localhost wildcard fallback.

---

## Configuration Notes

Optional tuning via environment:

- `CORS_ORIGINS` (allowlist, comma-separated)
- `HTTP_JSON_BODY_LIMIT` (default `100kb`)
- `HTTP_FORM_BODY_LIMIT` (default `100kb`)

Rate-limit values are currently code defaults:
- `120 req / 60s` per client

---

## Security Outcomes

This phase improves protection against:

- **abuse/spam:** global request throttling
- **malformed requests:** strict validation + unknown field rejection
- **common API attacks:** secure headers + CORS hardening + request sanitization
- **resource pressure attacks:** body size constraints

---

## Validation

Post-change verification:

- `npx tsc --noEmit` ✅
- lint diagnostics on modified hardening files ✅

Changes were intentionally limited to HTTP API hardening surfaces only.

