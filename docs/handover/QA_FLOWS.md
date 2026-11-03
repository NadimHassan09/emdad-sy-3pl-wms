# EMDAD QA Flows and Cross-cutting Checks

Layer 2 (F = business flow) and layer 3 (X = cross-cutting check) of the coverage model; layer 1 is the route tables in `QA_TRACKER.md`.
Status: ⬜ not started · 🔄 partly done (counts 0.5) · ✅ passed (1) · ❌ tested, defect open (1, see ID) · ⛔ blocked (0) · ➖ not applicable (excluded).
A flow counts as ✅ only when it was run in the real UI or against the real carrier, including its reasonable edge cases and the failure path. `python3 docs/handover/qa_progress.py` recomputes the percentages and rewrites `QA_COVERAGE.md`.

## Business flows

| ID | Area | Flow | Status | Evidence / what is missing |
|---|---|---|---|---|
| F01 | Orders | Create an OMS order in the admin UI (all fields, validation, Arabic and English, duplicates) | 🔄 | Orders created through the API for E2E; the form itself is not exercised field by field |
| F02 | Orders | Create an order in the client portal (e-commerce order) | ⬜ | |
| F03 | Orders | Import orders (validate, import, tolerant phone/Arabic letters/dates, row errors) | ⬜ | |
| F04 | Orders | Confirm then approve (shipping-fee group coverage, stock gate, reservation) | ❌ | Works for Aleppo; other governorates blocked by missing fee groups (D-012) |
| F05 | Outbound | Execution by admin: plan, approve, pick, pack, shipping method, send, details complete, dispatch | ✅ | OUT-2026-04463 (Sena) and OUT-2026-04464 (Babel, Sila up to send) |
| F06 | Outbound | Execution by workers (tasks) | ⬜ | |
| F07 | Shipping | Bulk shipping modal on a batch of orders | 🔄 | Opened on one order; D-009 open |
| F08 | Orders | Batches (create, detail, instruction sheet, waybills PDF/Excel) | ⬜ | |
| F09 | Orders | Edit order data and edit shipping fee (before and after shipment) | ⬜ | Client request still open |
| F10 | Orders | Cancel an order with no shipment, and with a live shipment | ✅ | OMS-2026-03721 cancelled after Babel (manual) and Sila (API) |
| F11 | Shipping | Change carrier on the same order | ✅ | Babel to Sila on OMS-2026-03721 |
| F12 | Shipping | Delivered through carrier webhook | ✅ | Sena sandbox, ~8 s |
| F13 | Shipping | Failed delivery and returned-to-sender through carrier updates | ⬜ | |
| F14 | Returns | OMS returns and WMS returns (plan, receive, restock, rollback rules) | ⬜ | Rollback limits are an owner decision |
| F15 | COD | COD record generated on delivery | ✅ | Sena E2E |
| F16 | COD | COD collection, remittance and reconciliation with the client balance | ⬜ | |
| F17 | Carriers | Sena sandbox: create, status simulation, cancel, return, label, edit | 🔄 | Create/ship/deliver done; cancel, return, label, edit not done |
| F18 | Carriers | Babel live: create, price vs portal, cancel | ✅ | 3 Nov; D-020, D-021 open; tracking poll not tested |
| F19 | Carriers | Sila live: create, price vs portal, cancel | ✅ | 3 Nov; D-023 open; tracking/webhook not tested |
| F20 | Carriers | Delivery Joud | ⛔ | No adapter yet |
| F21 | Carriers | Webhooks in both directions (valid, invalid signature, duplicate, out-of-order) | ⬜ | |
| F22 | Carriers | Coverage per governorate and the carrier eligibility rules (weight, COD currency, zone) | 🔄 | Rules built and unit-tested; Babel 10 governorates confirmed; others not probed |
| F23 | Currency | Per-carrier Syrian-pound unit and USD conversion (quotes, COD) | 🔄 | Babel new pound proven from its ledger; Sena unit unconfirmed; FX page not browser-tested |
| F24 | Inbound | Inbound order: create, ASN, receive, quality, putaway, GRN | ⬜ | |
| F25 | Inventory | Stock views, lots, expiry, reservation, ledger | ⬜ | |
| F26 | Inventory | Adjustments, internal transfer, cycle count | ⬜ | |
| F27 | Master data | Products (create, edit, images, lot tracking, dimensions) | 🔄 | D-005 missing images; no CRUD pass |
| F28 | Master data | Clients (create, edit, suspend, contract) and client users | 🔄 | Required-field messages only |
| F29 | Master data | Warehouses and locations hierarchy (zones, racks, shelves, packing and dock) | 🔄 | Loads; D-003 dirty data |
| F30 | Master data | Shipping companies, fee groups and fee rates per governorate | ⬜ | D-012 |
| F31 | Finance | Accounts, transactions (append-only), policies, carrier costs, payouts, statements | ⬜ | |
| F32 | Finance | Optional "Fulfillment Services" billing, invoices, plans (legacy billing) | ⬜ | Client request |
| F33 | Reports | The ~25 admin reports (filters, totals vs source data, export) | ⬜ | |
| F34 | Admin | Users and roles (create, deactivate, role change, password reset) | ⬜ | |
| F35 | Admin | Audit logs, notifications | ⬜ | |
| F36 | Admin | Backups: schedules, run now, Google Drive, restore, retention, factory reset guard | 🔄 | Earlier certification reports in `docs/evidence/backup-*`; not re-run in this QA |
| F37 | Admin | Forms and contracts | ⬜ | |
| F38 | Auth | Login, logout, refresh, session expiry, account inactive, wrong password, lockout | 🔄 | Sessions and refresh used daily; negative paths not run |
| F39 | Client portal | Dashboard, products, inbound requests, outbound requests | ⬜ | |
| F40 | Client portal | E-commerce orders (create, import, returns, status), COD reports, my profits | ⬜ | |
| F41 | Client portal | Finances, invoices, API keys (external API), notifications, profile | ⬜ | |
| F42 | External API | Client API keys: create order, status, rate limits, signature | ⬜ | |

## Cross-cutting checks

| ID | Area | Check | Status | Evidence / what is missing |
|---|---|---|---|---|
| X01 | Security | RBAC matrix: every route and action for super_admin, wh_manager, wh_operator, client_admin, client_staff | ⬜ | |
| X02 | Security | Tenant isolation: a client never reads or writes another client's data (UI, direct URL, API) | ⬜ | |
| X03 | Security | Input handling: injection, XSS, CSV/Excel formula injection, file upload limits | ⬜ | |
| X04 | Security | Secrets and configuration (committed `.env` history, key rotation, webhook signatures) | ⛔ | Owner decision on rotation |
| X05 | Validation | Field sweep on every form: empty, boundary, long, whitespace, Arabic/English, special characters, paste, duplicate submit | 🔄 | One form so far |
| X06 | Errors | Functional errors: any path that blocks work, wrong totals, wrong state transitions, buttons shown for impossible actions | 🔄 | Found and fixed D-001..D-023 on the order and shipping path |
| X07 | Errors | Semantic errors: wrong units/currency, wrong labels or wording, misleading messages, Arabic/English parity | 🔄 | Carrier messages and currency unit reviewed |
| X08 | Errors | Visual errors: colour meaning (red cancel/delete, green success), spacing, alignment, overflow, RTL, dark mode | 🔄 | Notes D-006, D-007, D-010, D-011, D-016, D-018 |
| X09 | UX | Responsive and mobile on key flows (touch targets, tables) | ⬜ | |
| X10 | Quality | Performance: N+1 calls, slow pages, large lists | 🔄 | Outbound list N+1 noted |
| X11 | Quality | Accessibility basics: focus order, labels, contrast, keyboard | ⬜ | |
| X12 | Data | Data integrity: stock never negative, ledgers append-only, reservations released on cancel, COD totals | 🔄 | Unit tests exist; cancel releases the reservation (seen on test order); no full ledger audit |
| X13 | Tests | Backend unit suite baseline (all suites, in batches) | 🔄 | Shipping area 46 suites / 362 tests pass; full run not done (D-004) |
| X14 | Tests | Frontend unit suite and Playwright regression of fixed flows | 🔄 | Vitest lib 104 pass; Playwright not re-run |
| X15 | Release | Handover pack: client documentation, decision log, known limitations, runbook | 🔄 | `DECISIONS_AND_EVIDENCE.md` and QA files exist; client-facing documents not written |
