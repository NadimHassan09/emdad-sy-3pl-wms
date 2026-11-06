# Repository QA Audit

**Phase:** Phase 1 — Repository Audit  
**Audit date:** 2026-06-12  
**Auditor:** Independent QA (FINAL-QA-CERTIFICATION)  
**Scope:** Production system at `/var/www/emdad-sy-3pl-wms` — evidence-based, no prior cert trust  
**Production domains:** https://admin.emdadsy.com · https://client.emdadsy.com  
**Method:** Source code review + live production API verification

---

## Executive Summary

| Metric | Value |
|--------|------:|
| **Phase score** | **89/100** |
| NestJS modules (app.module) | 32 |
| HTTP controllers | 37 |
| HTTP endpoints | 229 |
| Admin SPA routes | 77 |
| Client portal routes | 12 |
| Prisma models | 44 |
| Shared packages | `packages/wms-task-execution`, `shared/design-system` |

## Repository Layout

```
emdad-sy-3pl-wms/
├── backend/           NestJS 11 API (Prisma, PostgreSQL)
├── frontend/          Admin SPA (React 18, Vite, TanStack Query)
├── client-frontend/   Client portal SPA (React 19, Vite)
├── shared/design-system/  Shared UI components (@ds alias)
├── packages/wms-task-execution/  Task payload schemas (canonical)
├── deploy/nginx/      Production nginx templates
├── scripts/           Certification & benchmark scripts
├── ecosystem.config.js  PM2 production config
└── prisma/            Schema + 28 migrations
```

## Backend Architecture

- **Pattern:** Modular monolith — single NestJS process, domain modules, in-process cron
- **Entry:** `backend/src/main.ts` — helmet, ValidationPipe, global JwtAuthGuard + ThrottlerGuard
- **Modules:** 29 domain modules + infrastructure (Prisma, Redis, Auth, CronLeader, Crypto)
- **Realtime:** Socket.IO namespace `/realtime` with JWT auth and tenant rooms
- **Cron:** 11 scheduled jobs, all gated by `CronLeaderService` (Redis lock or PM2 instance 0)

## Frontend Architecture

| App | React | Router | API modules |
|-----|-------|--------|-------------|
| Admin | 18.3.1 | React Router 6 | 21 (20 in `api/` + notifications service) |
| Client | 19.2.5 | React Router 7 | 8 services |

- Admin: `createBrowserRouter`, lazy pages, layout-level `RequireRouteAccess`
- Design system: `@ds` alias → `shared/design-system/ui/index.ts`
- State: TanStack Query + Axios; RealtimeProvider patches cache

## Client Portal Architecture

- Separate SPA build (`client-frontend/dist`) on `client.emdadsy.com`
- Separate API prefix `/api/client/*` with `JwtClientAuthGuard`
- Per-route `RequireRouteAccess` (no layout-level RBAC wrapper)

## Infrastructure Configuration

| Component | Evidence | Production state |
|-----------|----------|------------------|
| PM2 | `ecosystem.config.js` | `emdad-wms-backend` online, 1 instance, cwd `/var/www/emdad-sy-3pl-wms/backend` |
| Nginx | `deploy/nginx/sites-available/` | admin + client vhosts, TLS, same-origin `/api` proxy |
| SSL | `/etc/nginx/ssl/emdad-wms/` | HTTPS on admin.emdadsy.com, client.emdadsy.com |
| Logs | PM2 + nginx paths | `/var/log/emdad-wms/backend-*.log` |
| Redis | `.env.example` | **Disabled in production** (readiness check confirms) |
| Backups FS | config | `/var/lib/emdad-wms/backups/production` |

## Build Configuration

- **Backend:** `nest build` → `dist/src/main.js`
- **Frontends:** Vite production builds → `frontend/dist`, `client-frontend/dist`
- **Env reference:** `backend/.env.example` (Zod validation at startup via `env.validation.ts`)

## Findings

| ID | Severity | Finding |
|----|----------|---------|
| R-01 | Medium | React 18 (admin) vs React 19 (client) — shared design system compatibility risk |
| R-02 | Medium | `@emdad/wms-task-execution` triplicated in packages/, frontend/vendor/, backend/vendor/ |
| R-03 | Low | `README.md` outdated (mock auth, "8 pages") |
| R-04 | Medium | No containerization — bare VPS + PM2 deployment |
| R-05 | Info | Staging path references remain in docs; staging decommissioned |

## Phase Score Justification

**89/100** — Strong modular monolith with clear admin/client separation, documented nginx/PM2 deploy, and comprehensive domain module split. Deductions for version divergence, package triplication, and single-server topology.
