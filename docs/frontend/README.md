# Frontend Architecture & UI/UX Documentation

Complete reverse-engineering documentation for both WMS frontend applications. **No redesign or code changes** — this is a blueprint for rebuild, refactor, or handoff.

## Repository folder names

| User-facing name | Actual folder | Package name |
|------------------|---------------|--------------|
| Employee / Admin Dashboard | `frontend/` | `frontend` |
| Client Portal | `client-frontend/` | `client-frontend` |

> **Note:** There is **no** `client-dash-front-end` folder in this repo. All client portal documentation refers to **`client-frontend/`**.

## Shared assets

Both apps import styling from:

- `shared/design-system/globals.css` — CSS variables, badges, client semantic classes
- `shared/design-system/tailwind.preset.cjs` — Tailwind theme extension

## Documentation index

| Document | Contents |
|----------|----------|
| [00-overview.md](./00-overview.md) | Dual-app comparison, stack, data flow diagrams |
| [admin/01-architecture.md](./admin/01-architecture.md) | Internal WMS: structure, routing, auth, state, realtime |
| [admin/02-page-inventory.md](./admin/02-page-inventory.md) | Every admin route: UI, logic, API mapping |
| [admin/03-components-and-api.md](./admin/03-components-and-api.md) | Component inventory, API modules, hooks |
| [admin/04-styling-and-realtime.md](./admin/04-styling-and-realtime.md) | Visual system, Tailwind, realtime events |
| [client/01-architecture.md](./client/01-architecture.md) | Client portal: structure, auth, services |
| [client/02-pages-and-ui.md](./client/02-pages-and-ui.md) | Client routes, UI, API mapping |
| [09-ux-analysis-rebuild-readiness.md](./09-ux-analysis-rebuild-readiness.md) | UX issues, inconsistencies, rebuild checklist |

## Quick stats

| | Admin (`frontend`) | Client (`client-frontend`) |
|--|-------------------|---------------------------|
| Framework | React 18 + Vite 6 | React 19 + Vite 8 |
| Router | React Router 6 (data router) | React Router 7 |
| Routed pages | 23 (+ 1 orphan) | 8 |
| Shared components | 18 | 1 (`PortalLayout`) |
| API modules | 15 (`src/api/*`) | 6 (`src/services/*`) |
| Realtime | Socket.IO (broad invalidation) | Socket.IO (stock only) |
| Primary users | `ADMIN`, `OPERATOR` | `client_admin`, `client_staff` |

## How to use this documentation

1. **Rebuild another stack:** Start with `00-overview.md` + per-app architecture, then `02-page-inventory` / `02-pages-and-ui` for feature parity.
2. **Backend compatibility:** Use API tables in page docs; REST paths match NestJS modules under `backend/src/modules/`.
3. **Redesign:** Read styling docs + `09-ux-analysis-rebuild-readiness.md` for known problems — do not treat current UX as intentional product design everywhere.

*Generated from codebase analysis. Verify against latest `router.tsx` / `App.tsx` when upgrading.*
