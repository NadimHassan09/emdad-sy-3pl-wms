# Phase 6.4 — Diagnostics Protection

**Status:** Implemented  
**Date:** 2026-05-29  
**Scope:** Operational `/api/ops/*` health, readiness, and diagnostics endpoints only.

---

## Summary

| Endpoint | Production default | Protection |
|----------|-------------------|------------|
| `GET /api/ops/health/live` | Public, minimal body | Kill switch `OPS_LIVENESS_ENABLED` |
| `GET /api/ops/health/ready` | Public, **sanitized** checks only | Optional `OPS_PROBE_SECRET` + `X-Ops-Probe-Key`; verbose off |
| `GET /api/ops/diagnostics` | **Disabled** (404) | `OPS_DIAGNOSTICS_ENABLED=true` + internal-admin JWT |
| `GET /api/ops/policy` | Internal-admin JWT | Non-sensitive policy snapshot |

Builds on Phase 6.3 (`InternalAdminGuard` on diagnostics) with environment-aware exposure and production-safe payloads.

---

## Exposed endpoints found (audit)

| Route | Pre–Phase 6.4 | Risk |
|-------|---------------|------|
| `GET /api/ops/health/live` | `@Public()`, minimal | Low — acceptable for LB |
| `GET /api/ops/health/ready` | `@Public()`, full `details` (PID, memory bytes, queue counts, websocket snapshot) | **Medium** — topology/scale/memory leak |
| `GET /api/ops/diagnostics` | Was fully public; Phase 6.3 → JWT + internal admin | **High** when enabled without env gate |
| `GET /api/ops/policy` | Did not exist | — |

No other `/health` aliases outside `/api/ops/*`. Global API prefix remains `/api`.

---

## Protections added

### 1) `OpsPolicyConfig` — environment-aware policy

**File:** `backend/src/modules/observability/ops-policy.config.ts`

| Variable | Default (production) | Purpose |
|----------|-------------------|---------|
| `OPS_LIVENESS_ENABLED` | `true` | Return 404 when `false` |
| `OPS_READINESS_ENABLED` | `true` | Return 404 when `false` |
| `OPS_READY_VERBOSE` | `false` | Include queue/memory/PID details in ready |
| `OPS_PROBE_SECRET` | unset | When set (≥16 chars), ready requires probe header or internal-admin JWT |
| `OPS_DIAGNOSTICS_ENABLED` | `false` | Return 404 on diagnostics when `false` |

Non-production: `OPS_READY_VERBOSE` defaults **on**; `OPS_DIAGNOSTICS_ENABLED` defaults **on**.

### 2) `OpsProbeGuard` — internal readiness access

When `NODE_ENV=production` and `OPS_PROBE_SECRET` is configured:

- `GET /api/ops/health/ready` requires **`X-Ops-Probe-Key`** matching the secret (timing-safe compare), **or**
- Authenticated **`super_admin` / `wh_manager`** JWT

Load balancers / k8s probes should send the header from a sealed secret (not exposed to browsers).

### 3) Production-safe readiness responses

**Verbose off (production default):**

```json
{
  "status": "ok",
  "checks": { "db": "ok", "redis": "ok", "websocket": "ok", "process": "ok", "queues": "ok" },
  "timestamp": "..."
}
```

**Not included:** PID, raw memory bytes, per-queue counts, websocket client counts, internal attachment objects.

**503 failures** also omit verbose `details` unless `OPS_READY_VERBOSE=true`.

**Verbose on** (`OPS_READY_VERBOSE=true`): same shape as pre-6.4 (for internal troubleshooting).

### 4) Diagnostics gating + sanitized production body

- Endpoint removed from `@Public()` — requires global JWT.
- `InternalAdminGuard` — operators/finance denied.
- `OPS_DIAGNOSTICS_ENABLED` must be `true` or endpoint returns **404** (reduces fingerprinting vs 403).
- Production response (when enabled): rounded MB memory + uptime only — no `pid`, `nodeVersion`, or `env`.

### 5) `GET /api/ops/policy`

Internal-admin only; returns enabled flags (no secrets, no process stats).

### 6) Refactor

- `ObservabilityService` — check logic + response shaping
- `ObservabilityModule` — registers policy, probe guard, imports `AuthModule`

---

## Production behavior (recommended deploy)

```env
NODE_ENV=production
OPS_PROBE_SECRET=<random-min-16-chars>   # required for locked-down readiness
OPS_READY_VERBOSE=false
OPS_DIAGNOSTICS_ENABLED=false            # or true only on break-glass ops
OPS_LIVENESS_ENABLED=true
OPS_READINESS_ENABLED=true
```

**Kubernetes / LB probe example:**

```http
GET /api/ops/health/ready HTTP/1.1
X-Ops-Probe-Key: <same-as-OPS_PROBE_SECRET>
```

**Liveness (no secret required):**

```http
GET /api/ops/health/live
```

---

## Development behavior

| Endpoint | Behavior |
|----------|----------|
| Live | `{ status, timestamp }` |
| Ready | Full `details` (queues, memory, PID, websocket) |
| Diagnostics | Enabled; full payload + policy snapshot |
| Policy | Internal-admin JWT |

---

## Remaining operational exposure

| Exposure | Severity | Notes |
|----------|----------|-------|
| Public liveness | Low | By design for orchestrators |
| Public ready without `OPS_PROBE_SECRET` | Low–Med | Sanitized checks only; set probe secret in prod |
| Ready reveals aggregate check status | Low | `queues: warn/error` does not expose counts when verbose off |
| Diagnostics when explicitly enabled | Low | Internal-admin only; still avoid on internet-facing ingress |
| `GET /api/ops/policy` | Low | Admin-only flags |
| No IP allowlist middleware | Info | Rely on network policy + probe secret |
| Dashboard / other APIs | Out of scope | Not operational diagnostics |

---

## Validation

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | Pass |

**Manual checks:**

1. Production + no verbose: `GET /ready` → no `details`, no `pid`
2. Production + `OPS_PROBE_SECRET` set, no header → `403`
3. Production + valid `X-Ops-Probe-Key` → `200`
4. Production + `OPS_DIAGNOSTICS_ENABLED=false` → `GET /diagnostics` → `404`
5. Internal-admin JWT + diagnostics enabled → `200` with reduced production fields

---

## Files changed

| File | Change |
|------|--------|
| `ops-policy.config.ts` | **New** — env policy |
| `ops-probe.guard.ts` | **New** — probe key / internal-admin |
| `observability.service.ts` | **New** — checks + sanitized responses |
| `observability.controller.ts` | Wired policy, guards, policy route |
| `observability.module.ts` | Providers + AuthModule |
| `env.validation.ts` | OPS_* variables |
| `.env.example` | Documented OPS vars |

---

## Related

- [PHASE-4.3-PRODUCTION-HEALTH-SAFETY-CHECKS.md](./PHASE-4.3-PRODUCTION-HEALTH-SAFETY-CHECKS.md) — original readiness signals
- [PHASE-6.3-RBAC-CONSISTENCY-CLEANUP.md](./PHASE-6.3-RBAC-CONSISTENCY-CLEANUP.md) — diagnostics auth baseline
