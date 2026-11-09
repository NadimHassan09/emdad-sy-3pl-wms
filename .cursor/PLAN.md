# EMDAD — Cursor execution plan (from 6 Nov 2026)

Goal: finish the remaining implementation and test the whole system on **staging** so it can be handed to the client. Target date given by the owner: 7 Nov 2026.

Read before doing anything:
1. `docs/HANDOVER.md` — full context (environments, carriers, currency, finance, what is built, owner rules).
2. `docs/handover/CLIENT_WHATSAPP_REQUESTS.md` — client requests checklist.
3. `docs/handover/OWNER_CHANGE_REQUESTS.md` — owner requests checklist and open decisions.
4. `docs/handover/QA_TRACKER.md` + `QA_FLOWS.md` — test status per route / flow / defect.
5. `.cursor/rules/*.mdc` — always-on rules (staging only, safety, human-in-the-loop, browser testing, progress reporting).

Order of work: §1 sanity → §2 implementation gaps → §3 human-in-the-loop questions (ask early, keep working meanwhile) → §4–§6 testing → §7 handover pack.
After every unit of work: rebuild what changed, re-test it in the browser, commit, push to `staging`, run `python3 docs/handover/qa_progress.py`, post the progress block (§8).

---

## 1. Sanity check (first 15 minutes)

- `git status` on `/var/www/emdad-sy-3pl-wms-staging`, branch `staging`. Many tracked build artefacts (`backend/dist`, `node_modules/.prisma`, `frontend/tsconfig.tsbuildinfo`, `graphify-out/*`, `storage/documents/*.pdf`, `playwright-report`) show as modified — they are generated; do not commit them by accident. Stage files by name.
- Backend build needs a 4 GB heap: `cd backend && NODE_OPTIONS='--max-old-space-size=4096' npm run build && pm2 restart 1 --update-env` (the default 2 GB runs out of memory).
- Admin UI: `cd frontend && npm run build`. Client UI: `cd client-frontend && npm run build`.
- Unit tests: `cd backend && npm run test:unit` (expect 158 suites / 990 tests green). Frontend: `cd frontend && npx vitest run`.
- Open both portals in the browser (§4) and confirm you are logged in as the owner's accounts. If not, ask the owner to log in — never type a password.

## 2. Remaining implementation (do these, in this order)

Each item: build it, unit-test the logic, verify in the browser, update the checklist row (status + date + evidence), commit.

| # | Item | Source | Notes / acceptance |
|---|---|---|---|
| I-1 | **Import template with drop-down lists + instructions sheet** for OMS (and inbound/outbound/products imports that exist) | Client B16, B22, B23; owner #20 | ✅ Done 6 Nov — xlsx with Instructions + Lists/Areas dropdowns; tolerant phone/date/Arabic fold; CSV via `?format=csv`. Evidence: client xlsx download; OMS-2026-03727 tolerant import. |
| I-2 | **Filters + exports on every list** | Client B4; owner #19 | For each list (admin and client): COD, inventory/stock, inbound, outbound, OMS, products, returns, finance transactions, invoices, reports: store/client filter + date range filter + CSV + branded Excel (`buildExcelBuffer`, logo + meta + small analytics block above the table). Make a table of lists → what was missing → fixed. Client side must only export its own data. **Status 9 Nov: 🔍 code done for admin inventory/ledger/finance/invoices/products/COD CSV + client inbound/outbound dates (see `docs/handover/I2_LIST_EXPORT_AUDIT.md`); needs browser verification; client stock/finance/invoice CSV and reports registry still open.** |
| I-3 | **Super admin edits everything at any stage** | Client B9, B14 | Check `PATCH /oms/orders/:id` per status: recipient, address, phone, lines/quantities, COD amount, shipping fee, notes. Before shipment: allowed with stock re-reservation. After a carrier shipment exists: allowed locally with a clear warning that carriers (Babel/Sila/Sena) have no edit API and an offer to cancel + resend; record in timeline/audit log. Quantity edits must keep inventory correct (ledger). Money edits must flow to COD record/finance correctly. **If a rule here is unclear (e.g. editing after delivery), ask the owner (§3).** |
| I-4 | **Delivery Joud (Olivery) carrier adapter** | Client B21; F20 | ✅ Live TEST 9 Nov — OMS-2026-03728 → portal Sequence **3960023822** (exactly 1 row). GET→POST + Sequence mapper + payer map fixed (fd132eba8 / d5b2647f7 / 3c54d530b). Fatih adapter also live-tested earlier. SYP unit evidence still open for both. |
| I-5 | **Sila detailed tracking statuses visible** | Client A2 | Confirm Sila sub-statuses (courier statuses) appear in OMS list "last carrier status" and order timeline in Arabic, like Babel. Fix mapping/display if only top-level status shows. |
| I-6 | **Sila integration guidance audit** | Client A4 | Check the 9 points in code: leaf `area_id`, COD = recipient total incl. shipping in the stated currency, `GET /cargos?reference=` before resend, cancel path, courier code from `GET /cargos/{id}` / webhook, show Sila `error.message` + keep `request_id`. Fix gaps. |
| I-7 | **New warehouse → add locations** | Client B5 | Reproduce in browser; fix if it fails; receive one inbound into the new warehouse's bin. |
| I-8 | **Company selector resets to "Acme Import" on phone** | Client B18 | Re-test at 390 px width on products/new, inbound/new, outbound/new, stock forms; fix if it still resets. |
| I-9 | **Tolerant address input** | Client B11 | Client API + import + Sheets: wrong governorate or unknown neighbourhood must give a clear message with a suggestion (fuzzy match within the hierarchy), never a raw `VALIDATION_ERROR`. |
| I-10 | **Server-side group-by** (optional, after the rest) | Client B20 | Current group-by works on the visible page only. Only do this if time allows; say so in the report otherwise. |
| I-11 | **Make the backend build script use 4 GB** | infra | ✅ Done — `backend/package.json` build/test already use `NODE_OPTIONS=--max-old-space-size=4096`. |

Items that need an owner answer before building (do not build on a guess): inbound↔OMS link (B3), custom roles / editable permissions (needs a migration), carrier reconciliation + in-transit float (B12), COD due / liquidity / prep fee (B15), return fee rule. See §3.

## 3. Human-in-the-loop — stop and ask the owner

Ask in Egyptian Arabic, one short message, with your recommendation and the options. Keep working on other items while waiting.

Always ask before:
- **Any DB migration** (show the SQL/plan first). Never run `prisma migrate dev/deploy` or `db push` without an explicit yes in this conversation.
- **Any live carrier action**: creating, editing, cancelling a shipment on Babel, Sila, or Delivery Joud (no sandbox). Sena sandbox is free to use. When approved: Test company / Nadim Hassan / TEST ORDER only.
- **Touching any order inside a carrier portal** (Babel, Sila, Sena, Delivery Joud): first say which order code and what you will do. Search by the exact order code and stop unless exactly one row matches.
- **Deleting data** (DB rows, files, branches) beyond your own test records.
- **Business rules / policy**: anything that changes money calculations, inventory rules, carrier choice rules, what the client sees, invoice rules, COD rules, roles/permissions.
- **Anything about production** (`/var/www/emdad-sy-3pl-wms`, PM2 id 0, DB `wms_db`): never touch it.
- **Secrets**: never print or log Google credentials, API keys, carrier keys, `.env` contents. Rotation of the leaked `.env` history is the owner's decision.

Questions already known to be open (put them to the owner on day one, in one message):
1. Inbound ↔ OMS link (client B3): what should be linked?
2. Custom roles: approve the design (permission sets per module × action) and the migration?
3. Carrier reconciliation + in-transit float: build now behind a disabled setting, or leave out?
4. Defaults for COD due moment, return fee rule, prep fee (until the company owner decides).
5. Approval for one live Delivery Joud test shipment after the adapter is built.
6. Visual approval of the new picking list / packing list PDFs (send screenshots).
7. Sila webhook: owner clicks "Register webhook" in Shipping Companies → Sila (D-040), or approves you to click it.
8. Edit rules after shipment / after delivery (I-3).

Do NOT ask about: commits, pushes, rebuilds, restarts of staging (PM2 id 1), small technical choices, wording, refactors inside the task. Decide and report.

## 4. Browser testing setup (mandatory for all UI testing)

Testing means **using the real UI in a browser**: open the page, scroll, look at it, click every control, fill every field, read the result. Writing code or calling the API is not a substitute for UI testing.

Constraint: the VPS cannot open the staging HTTPS sites (certificate error from the server). Never disable TLS verification to get around it. So the browser runs on the **owner's computer**:
- **The tool: Browser MCP** (`browsermcp` in the user-level `~/.cursor/mcp.json`, package `@browsermcp/mcp`). The owner has the Browser MCP extension in Chrome and in Edge on his own computer; it drives his real, already-logged-in tabs.
- Cursor is attached to the VPS over Remote-SSH, so the Browser MCP server runs **on the VPS** (listens on `127.0.0.1:9010`), while the extension looks for it on the owner's own `localhost`. The two are joined by **port forwarding 9010** (Cursor → Ports panel → Forward a Port → `9010`, or `ssh -L 9010:127.0.0.1:9010 root@<vps>`). Without it the extension shows "Waiting for the Browser MCP server".
- Only one browser connects at a time. Chrome is the main browser; use Edge only if a session exists only there (Sila was once open in Edge) — or ask the owner to log in to that site in Chrome.
- Do not use Playwright MCP on the VPS for staging UI: it runs on the server, which cannot reach the staging HTTPS sites and has none of the owner's sessions.
- **Scripted passes:** `qa-scripts/` (Playwright scripts that run on the owner's machine with his profile; see `qa-scripts/README.md`). Use them for repetitive sweeps; still look at the screenshots.
- Accounts: staging admin (super admin "Nadim Hassan"), staging client portal ("Eng Nadim", client admin). For role tests (viewer, inventory, accountant, wh_operator, client_staff) create test users in the admin UI with names starting "QA-" and ask the owner to log in as them or to set a password (you never type passwords).
- Carrier portals (read/verify only unless approved): Babel `https://www.babel-express.com/admin/`, Sena `https://syria.sena-express.com`, Sila `https://sila-sy.com/merchant`, Delivery Joud `https://deliveroojoud.olivery.io`. The owner logs in.
- Take a screenshot as evidence for each passed or failed check; name it `<route-or-flow>_<what>_<date>.png` under `qa-scripts/out/` (git-ignored) and mention it in the tracker row.

## 5. Testing layers (all three are required)

### Layer A — code / API tests (automated)
- Backend unit suite must stay green (`npm run test:unit`). Add unit tests for every new pure function (import parsing, fee rules, mappers).
- Frontend vitest (`cd frontend && npx vitest run`).
- Playwright **API smoke** (fast): every list endpoint returns 200 for an allowed role and 401/403 for a disallowed one; create/confirm/cancel happy paths for orders. Run against `http://127.0.0.1:3001/api` on the VPS (no TLS issue). Keep these in `backend/test/` or `qa-scripts/api/`.
- This layer proves the API works. It does **not** count as UI coverage.

### Layer B — workflow tests in the browser (flows F01–F42 in `QA_FLOWS.md`)
Run each business flow end to end in the UI, including reasonable edge cases and the failure path. Priority order:
1. F04 confirm/approve across governorates (after shipping fee templates), F03 import, F01/F02 order create (admin + client).
2. F06 worker task execution (pick/pack/putaway as `wh_operator`), F24 inbound incl. client-submitted, F26 cycle count, F25 lot/expiry/reservation.
3. F09 edit order/shipping fee before and after shipment (I-3), F13 failed delivery + returned (Sena sandbox), F14 returns OMS/WMS, F17 Sena cancel/return/label/edit.
4. F16 COD collection → remittance → client balance, F31 finance pages, F32 billing UI forms (charge rules, on-demand invoice, settle, cancel), check numbers by hand.
5. F07/F08 bulk shipping + batches + waybills, F21 webhooks (valid/invalid signature/duplicate/out-of-order — Sena sandbox; Sila after D-040), F22 carrier coverage per governorate, F23 currency display.
6. F27–F30 master data CRUD, F34–F38 admin + auth negatives (wrong password, inactive account, session expiry, password reset by email code, Google sign-in incl. suspended account), F39–F42 client portal incl. Sheets, Google Sheet (post-approval edit must be refused), API keys + outgoing webhooks.
7. F18/F19/F20 live carriers — only with owner approval per shipment.
Cross-check carrier portals for every carrier shipment you create: same recipient/address/COD/price, cancel reflected, tracking visible to the client in the client portal.

### Layer C — page sweep (every route in `QA_TRACKER.md`, admin 102 + client 30)
For each route, fill the five columns:
- **Functional:** page loads; every button, link, tab, modal, menu works; lists paginate, sort, filter, search; empty state; detail pages open from the list.
- **Validation/edge:** every field: empty, whitespace, too long, boundary numbers, negative/zero, Arabic and English text, special characters, paste, double-submit, back button mid-flow.
- **Roles:** what each role sees and can do (super_admin, wh_manager, wh_operator, finance, accountant, inventory, viewer; client_admin, client_staff). Direct URL to a forbidden page must be refused. Tenant isolation: a client never sees another client's data.
- **Consistency:** admin vs client look the same for the same control; colours (red = delete/cancel, green = approve/success); labels and Arabic/English parity; currency shown correctly (client USD only; carriers in their unit); no raw technical errors.
- **Mobile:** 390 px width; tables scroll, buttons reachable, no overflow, RTL correct.
Also the cross-cutting checks X01–X16 (RBAC matrix, tenant isolation, injection/CSV formula injection/uploads, validation sweep, functional/semantic/visual errors, responsive, performance N+1, accessibility basics, data integrity: stock never negative, ledger = stock, reservations released on cancel, COD totals, append-only finance).

Defects: log each in the QA_TRACKER defect log (next id D-041…), severity S1–S4, evidence, fix commit. Fix S1/S2 immediately; S3/S4 in batches.

## 6. Coverage tracking

- `python3 docs/handover/qa_progress.py` recomputes and rewrites `QA_COVERAGE.md` from the status marks in QA_TRACKER and QA_FLOWS (✅ = 1, 🔄 = 0.5, ❌ = 1 with defect id, ⛔ = 0, ➖ excluded). Update the marks honestly; ✅ only after a real UI check with edge cases.
- Implementation % = rows ✅ in the two request checklists ÷ all non-❓ rows (state the formula in the report).
- "Ready for the client" = implementation 100% of agreed items + testing 100% of the inventory + no open S1/S2 + handover pack done.

## 7. Handover pack (last)

- Update `docs/handover/DECISIONS_AND_EVIDENCE.md`: every client request → what was done → evidence (and why some were not defects, e.g. Babel's 4 governorates).
- Client-facing user guide (Arabic): admin portal, client portal, Sheets/Google Sheet, import template, invoices/finance, shipping fee rates. Can be generated from the checklists + screenshots.
- Known limitations list: COD settlement not sent by carriers; carriers without edit API; Babel without cancel API; group-by page-only (if I-10 skipped); anything else left.
- Runbook: build/restart commands, FX settings, Google credentials page, carrier credentials page, webhook registration, backups.

## 8. Progress report format (every round)

Post this block, exactly in this shape, at the end of each round (in Egyptian Arabic around it if you like):

```
╔══════════ EMDAD PROGRESS ══════════╗
  Implementation : 96% done · 4% left  (I-1, I-2, I-4 open)
  Testing        : 31% done · 69% left (routes 12% · flows 45% · cross 42%)
  Overall ready  : 63%
  Open S1/S2     : 0 / 1 (D-0xx)
  Waiting on owner: Q1, Q5
╚════════════════════════════════════╝
```
