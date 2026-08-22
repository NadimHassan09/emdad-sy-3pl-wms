# Security QA Audit

**Phase:** Phase 7 — Security Audit  
**Audit date:** 2026-06-12  
**Auditor:** Independent QA (FINAL-QA-CERTIFICATION)

---

## Summary

| Metric | Value |
|--------|------:|
| **Security score** | **85/100** |
| Live security checks | 10/10 PASS |
| Global auth guard | JwtAuthGuard on all non-@Public routes |
| Rate limiting | 120 req/min (ThrottlerGuard) |
| Brute force protection | LoginBruteForceService (5 fails / 60s per IP) |

## Live Security Verification (Production)

| Test | HTTP | Result |
|------|------|--------|
| no-auth-products | 401 | PASS |
| no-auth-backups | 401 | PASS |
| client-on-admin | 401 | PASS |
| operator-backups-deny | 403 | PASS |
| operator-audit-deny | 403 | PASS |
| operator-reports-deny | 403 | PASS |
| operator-tasks-allow | 200 | PASS |
| operator-billing-read | 200 | PASS |
| tenant-spoof-company | 404 | PASS |
| malformed-jwt | 401 | PASS |

## JWT Security

| Control | Internal | Client |
|---------|----------|--------|
| Access token TTL | 15m default | 8h default |
| Refresh rotation | ✓ Server-side families + replay detection | ✗ Access-only |
| HttpOnly cookies | ✓ access + refresh | ✓ client_access_token |
| Secret separation | JWT_SECRET + JWT_REFRESH_SECRET | CLIENT_JWT_SECRET (falls back to JWT_SECRET) |
| Cross-auth block | Internal rejects typ=client | Client rejects non-client roles |
| tokenVersion invalidation | ✓ On password change / replay | ✗ Not implemented |

## RBAC & Tenant Isolation

- **Frontend:** Layout-level route guards (admin); per-route (client)
- **Backend:** Opt-in RolesGuard + CompanyAccessService tenant resolution
- **Tenant spoof test:** Invalid X-Company-Id → 404 (PASS)
- **Operator deny tests:** Backups, audit, reports → 403 (PASS)

## Backup Security

- AES encryption on backup files (`BackupFileEncryptionService`)
- Download tokens: 300s TTL, super_admin only
- Factory reset gated by `FACTORY_RESET_ENABLED=false`
- Maintenance mode 503 during restore

## Findings

| ID | Severity | Finding |
|----|----------|---------|
| S-01 | Medium | CLIENT_JWT_SECRET defaults to JWT_SECRET if unset |
| S-02 | Medium | Client portal no refresh rotation / session revocation |
| S-03 | Medium | LoginBruteForceService in-memory — not cluster-safe |
| S-04 | Medium | Maintenance middleware allows `/liveness` but endpoint is `/live` |
| S-05 | Low | Socket.IO CORS accepts any origin |
| S-06 | Low | CORS allows missing Origin header |
| S-07 | Info | wh_operator can read billing summary API (UI nav restricted) |

## Security Score: 85/100

Strong foundation with global JWT, refresh rotation (internal), tiered backup RBAC, and 10/10 live checks. Deductions for client auth hardening, cluster-safe brute force, and maintenance probe path bug.
