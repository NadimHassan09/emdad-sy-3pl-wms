# EMDAD 3PL WMS — Phase 1 (Inventory Core MVP)

A working **modular monolith** implementing the first phase of the EMDAD 3PL Warehouse Management System.

- Backend: **NestJS 11 + Prisma 5 + PostgreSQL 16**
- Frontend: **React 18 + Vite + TypeScript + Tailwind + TanStack Query**
- Schema: full `improved_schema.sql` is applied as a Prisma baseline migration. `schema.prisma` only models tables Phase 1 needs.

Phase 1 covers: **Products • Warehouses • Locations • Inventory visibility • Inbound (create / confirm / receive) • Outbound (create / confirm / deduct)**.

> Tasks, QC, Billing, Invoicing, allocation engine, real JWT, Redis, BullMQ and the RLS context middleware are intentionally out of scope. See [`final_blueprint.md`](./final_blueprint.md) for the Phase 2+ roadmap.

---

## 1. Prerequisites

- **Node.js 20+** and **npm 10+**
- **PostgreSQL 16** — either via the included `docker-compose.yml` (recommended) or an existing instance with the `pgcrypto`, `btree_gist`, and `pg_trgm` extensions installable.

---

## 2. Quick Start (Docker — recommended)

```bash
# 1. Start Postgres (ships with required extensions auto-installed)
docker compose up -d

# 2. Backend
cd backend
npm install
cp .env.example .env          # values are pre-filled for the docker-compose DB
npm run db:generate
npm run db:migrate            # applies improved_schema.sql baseline
npm run db:seed               # creates demo company, user, warehouse, locations
npm run start:dev             # http://localhost:3000
# Optional (another terminal): npm run db:studio → http://localhost:5555 — Prisma Studio, same DB as DATABASE_URL

# 3. Frontend (in another terminal)
cd ../frontend
npm install
cp .env.example .env          # values are pre-filled to match the seed
npm run dev                   # http://localhost:5173
```

That's it. Open `http://localhost:5173`.

---

## 3. Quick Start (existing Postgres)

```bash
# 1. Make sure the three extensions are available on your DB:
#    CREATE EXTENSION IF NOT EXISTS pgcrypto;
#    CREATE EXTENSION IF NOT EXISTS btree_gist;
#    CREATE EXTENSION IF NOT EXISTS pg_trgm;
#
# 2. Use a SUPERUSER (or BYPASSRLS) connection. Phase 1 ships with the schema's
#    FORCE ROW LEVEL SECURITY policies but no RlsMiddleware (final_blueprint.md
#    §1.4) — Phase 2 will add it. The Postgres superuser bypasses RLS.

cd backend
npm install
cp .env.example .env
# edit .env → DATABASE_URL=postgresql://<user>:<pass>@<host>:<port>/<db>
npm run db:generate
npm run db:migrate
npm run db:seed
npm run start:dev

cd ../frontend
npm install
cp .env.example .env          # if your backend listens on a non-default port,
                              # update VITE_API_URL
npm run dev
```

---

## 4. Demo data and mock auth

`npm run db:seed` is idempotent and creates:

| Object        | Identifier                                |
| ------------- | ----------------------------------------- |
| Company       | `Acme Imports` — `00000000-…-001`         |
| User          | `manager@emdad.example` (`wh_manager`) — `00000000-…-002` |
| Warehouse     | `WH1` — Main Warehouse                    |
| Locations     | `WH1/A`, `WH1/A/A-01`                     |

The frontend always sends `X-User-Id` / `X-Company-Id` headers (taken from `VITE_MOCK_USER_ID` / `VITE_MOCK_COMPANY_ID`). The backend `MockAuthMiddleware` falls back to `MOCK_USER_ID` / `MOCK_COMPANY_ID` from `.env` when those headers are missing.

To act as a different tenant, change either the headers (e.g. via a browser dev-tools override) or the env values.

---

## 5. End-to-End Happy Path

1. Open `http://localhost:5173`. The sidebar lands on **Inventory** by default.
2. **Products** → `+ New product` → name `Widget`, sku `SKU-001`, tracking `none`, uom `piece`.
3. **Warehouses** is already populated by the seed (`WH1`). You can add more if you like.
4. **Locations** → pick `WH1` → tree shows `WH1/A` and `WH1/A/A-01` from the seed.
5. **Inbound orders** → `+ New inbound` → expected arrival = today, line: `SKU-001` × `100`. Save → opens the detail page.
6. Click **Confirm order** → status flips to `confirmed`.
7. Click **Receive** on the line → quantity `100`, location `WH1/A/A-01`. Order auto-completes.
8. **Inventory** → confirm `100` on hand at `WH1/A/A-01`.
9. **Outbound orders** → `+ New outbound` → destination `Riyadh demo`, line: `SKU-001` × `30`. Save → opens detail.
10. Click **Confirm & deduct stock** → status flips to `shipped`.
11. **Inventory** → on hand drops to `70`. Done.

Try the unhappy path too:
- Receive more than `110%` of the expected quantity → 422 `QUANTITY_EXCEEDS_LIMIT` (DB trigger `fn_guard_received_quantity`).
- Confirm an outbound order requesting more than is available → 422 `INSUFFICIENT_STOCK`, transaction rolls back, no partial deduction.

---

## 6. Project Structure

```
inventory module/
├── docker-compose.yml             # Postgres 16 with extensions
├── docker/postgres-init.sql       # extension bootstrap
├── improved_schema.sql            # source of truth (read-only)
├── final_blueprint.md             # architecture (read-only)
├── backend/                       # NestJS app
│   ├── prisma/
│   │   ├── schema.prisma          # Phase 1 tables only
│   │   ├── migrations/0_init/     # full SQL baseline (verbatim improved_schema.sql)
│   │   └── seed.ts
│   └── src/
│       ├── common/                # prisma, auth, filters, interceptors, errors
│       └── modules/
│           ├── products/
│           ├── warehouses/
│           ├── locations/
│           ├── inventory/         # stock.helpers.ts (atomic UPSERT + decrement)
│           ├── inbound/
│           └── outbound/          # FEFO greedy walk + atomic deduction
└── frontend/                      # Vite + React app
    └── src/
        ├── api/                   # axios client + per-resource modules
        ├── components/            # primitives (Button, Modal, DataTable…)
        └── pages/                 # 8 pages, one per route
```

---

## 7. API Quick Reference

All responses are wrapped:
- success → `{ "success": true, "data": ... }`
- error   → `{ "success": false, "error": { "code": "...", "message": "..." } }`

| Resource         | Endpoints                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Products         | `GET / POST /api/products`                                                                                               |
| Warehouses       | `GET / POST /api/warehouses`                                                                                             |
| Locations        | `GET / POST /api/locations`, `GET /api/locations/tree?warehouseId=`                                                      |
| Inventory        | `GET /api/inventory/stock`, `GET /api/inventory/ledger`                                                                  |
| Inbound orders   | `GET / POST /api/inbound-orders`, `GET /api/inbound-orders/:id`, `POST /api/inbound-orders/:id/confirm`, `…/cancel`, `…/lines/:lineId/receive` |
| Outbound orders  | `GET / POST /api/outbound-orders`, `GET /api/outbound-orders/:id`, `POST /api/outbound-orders/:id/confirm`, `…/cancel`   |

Notable error codes:

| Code                       | When                                                              |
| -------------------------- | ----------------------------------------------------------------- |
| `INSUFFICIENT_STOCK` (422) | Outbound confirm short on stock; or stock decrement would underflow |
| `QUANTITY_EXCEEDS_LIMIT` (422) | Receive > 110% of expected (DB trigger)                       |
| `LOT_REQUIRED` (400)       | Receive omitted lot number for a lot-tracked product             |
| `INVALID_STATE` (409)      | Tried a transition the state machine forbids                     |
| `UNIQUE_VIOLATION` (409)   | E.g. duplicate SKU within company, duplicate warehouse code     |

---

## 8. Phase 2 Hooks

The code is structured so the following Phase 2 work plugs in cleanly without restructuring:

- **Real JWT auth.** Replace `MockAuthMiddleware` with a `JwtAuthGuard`; `@CurrentUser()` consumers continue to work unchanged.
- **RLS context.** Add a Prisma `$extends` middleware that runs `SELECT fn_set_app_context($userId, $companyId, $role)` inside each transaction (see `final_blueprint.md` §1.4 / §8.3). Then drop the superuser requirement.
- **Tasks engine.** Subscribe to inbound/outbound state transitions via an `EventBusService` wrapping `EventEmitter2`; create RECEIVING / PUTAWAY / PICKING / PACKING tasks instead of collapsing the outbound flow.
- **Allocation engine.** Replace the simplified `outbound.confirm` deduction in `outbound.service.ts` with allocation creation + reservation + picking-task chain.
- **Idempotency.** The `inventory_ledger` already accepts an `idempotency_key` (and the `fn_ledger_dedup_check` trigger is wired); just start populating it in the inbound/outbound services.
- **Partition cron.** `fn_create_next_partitions` is in the SQL — wire it to a BullMQ monthly cron in Phase 9.

---

## 9. Useful Scripts

Browse or edit rows locally with **Prisma Studio** (uses `DATABASE_URL` from `backend/.env`; no separate DB client needed):

```bash
cd backend
npm run db:studio             # opens http://localhost:5555 — equivalent to npx prisma studio
```

```bash
# Backend
npm run db:reset              # drop + reapply baseline + reseed
npm run db:migrate            # apply pending migrations
npm run db:seed               # idempotent seed
npm run db:studio             # Prisma Studio GUI for the configured database
npm run build                 # production build → dist/

# Frontend
npm run build                 # production build → dist/
npm run preview               # serve the production build locally
```
