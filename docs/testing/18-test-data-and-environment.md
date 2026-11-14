# 18 — Test data, accounts, environment and safe-mutation rules

## 1. Environments

| Item | Value |
|---|---|
| Admin UI | `https://staging-admin.emdadsy.com` (nginx `emdad-wms-staging-admin`; also IP vhost `187.124.19.162:443`) |
| Client UI | `https://staging-client.emdadsy.com` (also `:8443` by IP) |
| API (from VPS, no TLS problem) | `http://127.0.0.1:3001/api` (PM2 id 1 `emdad-wms-backend-staging`) |
| DB | `wms_db_staging` (never `wms_db`) |
| Production | `/var/www/emdad-sy-3pl-wms` PM2 id 0 — **forbidden** |
| TLS | self-signed cert on the VPS → browser tests run in the owner's Chrome (Claude-in-Chrome tab group / Browser MCP). Never disable TLS verification. |
| Build | backend `NODE_OPTIONS=--max-old-space-size=4096 npm run build && pm2 restart 1 --update-env`; admin `cd frontend && npm run build`; client `cd client-frontend && npm run build` |
| Time | server UTC; business zone Asia/Damascus (A-23) |

## 2. Accounts (create missing ones with prefix `QA-`; passwords are set by the owner, never typed by the test agent)

| Account | Role | Used for |
|---|---|---|
| superadmin@… (owner "Nadim Hassan") | super_admin | admin UI sessions (owner already logged in) |
| QA-manager | wh_manager | RBAC |
| QA-operator | wh_operator (+ worker profile) | task execution |
| QA-accountant | finance | finance/billing read-write |
| QA-viewer | viewer | read-only |
| QA-inventory | inventory_controller | inventory only |
| QA-custom-1 | custom role "QA Ops lead" | O-11 |
| client "Eng Nadim" (client@acme…) | client_admin of Acme Imports | client portal sessions |
| QA-client-staff-A | client_staff of Acme | role split |
| QA-client-admin-B | client_admin of a second company | tenant isolation |
| API keys | created from client portal APIs page | external API tests |

Note (security finding, see `09`): `tests/helpers/constants.ts` contains a committed literal password for demo accounts; Phase 2 must replace it with env vars (`QA_PASSWORD`) and the owner should rotate it if it is valid on staging.

## 3. Data used and its protection

| Data | Name / code | Rule |
|---|---|---|
| Client | **Test company** (primary), Acme Imports (client portal), Madino/Acme for COD remittance tests the owner approved | Real clients (Mr Jad, Glow Mart, Noviara, al hadara, Mohammed Plaza, عبد الملك شيخ, Valid Co Check ×2, WorkerTest Co) are **read-only** — no mutation tests on them |
| Recipient | **Nadim Hassan**, phone `+963999000111`, address "TEST ORDER – Aleppo test street building 5 floor 2" | every carrier/OMS test order |
| Notes | **TEST ORDER** | every test order |
| Products | `QA-…` SKUs created per test + existing "test product 1" | |
| Warehouse | WH-001 Emdad Logistics Warehouse; QA warehouse `QA-WH-<ts>` for CRUD | do not deactivate WH-001 |
| Volume data | 4,320 OMS / 3,608 outbound / 58 inbound / 806 COD / 477 returns / 337 carrier shipments / 51 products / 12 accounts | used by performance & report tests — **do not delete** |
| Seed for 499/500/501 incentive boundary | helper creates N delivered OMS orders for client `QA-Incentive-<ts>` directly in DB (owner approval for SQL) | cleaned afterwards |

Guard (existing `qa-scripts/lib/guard.mjs`): any cancel/edit/delete in a script must first assert the order is a test order (client, recipient, note) — keep and reuse for Playwright.

## 4. Carrier rules

* **Sena:** sandbox, free.
* **Babel, Sila, Delivery Joud, Fatih:** live, no sandbox → per-shipment owner approval stating order code. After creation, verify in the carrier portal by typing the exact code; stop unless exactly **one** row matches; cancel only that row (Babel has no cancel API → manual in portal, with owner present).
* Carrier credentials are never copied to files or logs. Webhook secret rotation is the owner's call.

## 5. Mutating-test hygiene

1. Create → assert → clean up in the same test (use `try/finally`).
2. Prefix everything `QA-`; the nightly janitor deletes `QA-*` older than 24 h **only** for entities that have no finance/ledger impact (finance rows are append-only and stay).
3. Tests that need finance effects use dedicated client `QA-Finance-<ts>` created for the test.
4. DB reset is **never** done on staging; for destructive scenarios use a scratch database restored from a backup (`wms_db_qa_scratch`).
5. Randomised ids/time to allow parallel runs; no shared mutable data except read-only volume data.

## 6. Tooling to be created in phase 2 (not now)

* `tests/api/endpoint-battery.spec.ts` — generated from `generated/ENDPOINT_CATALOGUE.md`.
* `tests/e2e/pages/*.spec.ts` — one file per page in `04a/04b`, device matrix via Playwright projects (desktop/laptop/tablet/mobile) + `rtl` project.
* `tests/helpers/qa-data.ts` — create/cleanup helpers with the guard.
* k6 scripts in `tests/perf/`.
* Visual baseline storage `tests/visual/__screenshots__/<device>/`.

## 7. Screenshot convention (already used for the baseline set)

`docs/testing/screenshots/staging-<admin|client>-frontend-screenshots/<device>/<NNN>_<route-slug>[_<state>].png`
Devices: `desktop` (1920 css px), `laptop` (1366), `tablet` (820), `mobile` (390). `index.json` maps NNN → route. Each baseline image was captured with the app in an iframe at the device width so the **responsive layout** (not just a scaled picture) is what is shown. Baselines were taken as super_admin in English, light theme. Arabic/dark/other roles are separate baselines to add during execution.
