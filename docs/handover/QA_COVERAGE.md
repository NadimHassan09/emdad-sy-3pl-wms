# EMDAD QA Coverage (generated)

Generated 2026-11-09 by `qa_progress.py` from `QA_TRACKER.md` and `QA_FLOWS.md`. Do not edit by hand.

## Overall: 28.5% tested, 71.5% remaining

| Layer | Weight | Done | Items |
|---|---|---|---|
| Route checks (functional, validation, roles, consistency, mobile) | 40% | 8.0% | 665 checks on 133 routes |
| Business flows | 40% | 42.9% | 42 flows |
| Cross-cutting (security, errors, responsive, data, tests, release) | 20% | 40.6% | 16 checks |

## Routes by module

### Admin portal

| Module | Routes | Done | Remaining |
|---|---|---|---|
| orders | 12 | 14% | 86% |
| audit-logs | 1 | 10% | 90% |
| backups | 4 | 10% | 90% |
| clients | 2 | 10% | 90% |
| contracts | 3 | 10% | 90% |
| dashboard | 1 | 10% | 90% |
| finance | 7 | 10% | 90% |
| forms | 1 | 10% | 90% |
| internal | 1 | 10% | 90% |
| notifications | 1 | 10% | 90% |
| profile | 1 | 10% | 90% |
| shipping | 2 | 10% | 90% |
| warehouses | 1 | 10% | 90% |
| inventory | 6 | 8% | 92% |
| reports | 23 | 8% | 92% |
| billing | 8 | 6% | 94% |
| cycle-count | 4 | 5% | 95% |
| locations | 2 | 5% | 95% |
| products | 2 | 5% | 95% |
| users | 4 | 5% | 95% |
| oms | 10 | 4% | 96% |
| returns | 3 | 3% | 97% |
| tasks | 3 | 3% | 97% |
| **Total** | 102 | **8.1%** | **91.9%** |

### Client portal

| Module | Routes | Done | Remaining |
|---|---|---|---|
| apis | 1 | 10% | 90% |
| billing | 1 | 10% | 90% |
| dashboard | 1 | 10% | 90% |
| ecommerce-orders | 6 | 10% | 90% |
| finances | 1 | 10% | 90% |
| my-profits | 1 | 10% | 90% |
| notifications | 1 | 10% | 90% |
| profile | 1 | 10% | 90% |
| sheets | 1 | 10% | 90% |
| inbound-orders | 3 | 7% | 93% |
| outbound-orders | 6 | 7% | 93% |
| invoices | 2 | 5% | 95% |
| products | 4 | 5% | 95% |
| account-inactive | 1 | 0% | 100% |
| login | 1 | 0% | 100% |
| **Total** | 31 | **7.4%** | **92.6%** |

## Flows and cross-cutting checks

| ID | Area | Item | Status |
|---|---|---|---|
| F01 | Orders | Create an OMS order in the admin UI (all fields, validation, Arabic and English, duplicates) | 🔄 |
| F02 | Orders | Create an order in the client portal (e-commerce order) | 🔄 |
| F03 | Orders | Import orders (validate, import, tolerant phone/Arabic letters/dates, row errors) | ⬜ |
| F04 | Orders | Confirm then approve (shipping-fee group coverage, stock gate, reservation) | 🔄 |
| F05 | Outbound | Execution by admin: plan, approve, pick, pack, shipping method, send, details complete, dispatch | ✅ |
| F06 | Outbound | Execution by workers (tasks) | ⬜ |
| F07 | Shipping | Bulk shipping modal on a batch of orders | 🔄 |
| F08 | Orders | Batches (create, detail, instruction sheet, waybills PDF/Excel) | ⬜ |
| F09 | Orders | Edit order data and edit shipping fee (before and after shipment) | ⬜ |
| F10 | Orders | Cancel an order with no shipment, and with a live shipment | ✅ |
| F11 | Shipping | Change carrier on the same order | ✅ |
| F12 | Shipping | Delivered through carrier webhook | ✅ |
| F13 | Shipping | Failed delivery and returned-to-sender through carrier updates | ⬜ |
| F14 | Returns | OMS returns and WMS returns (plan, receive, restock, rollback rules) | ⬜ |
| F15 | COD | COD record generated on delivery | ✅ |
| F16 | COD | COD collection, remittance and reconciliation with the client balance | ⬜ |
| F17 | Carriers | Sena sandbox: create, status simulation, cancel, return, label, edit | 🔄 |
| F18 | Carriers | Babel live: create, price vs portal, cancel | ✅ |
| F19 | Carriers | Sila live: create, price vs portal, cancel | ✅ |
| F20 | Carriers | Delivery Joud | ✅ |
| F21 | Carriers | Webhooks in both directions (valid, invalid signature, duplicate, out-of-order) | ⬜ |
| F22 | Carriers | Coverage per governorate and the carrier eligibility rules (weight, COD currency, zone) | 🔄 |
| F23 | Currency | Three currencies (USD, old SYP, new SYP): quotes, COD, finance, display | 🔄 |
| F24 | Inbound | Inbound order: create, ASN, receive, quality, putaway, GRN | 🔄 |
| F25 | Inventory | Stock views, lots, expiry, reservation, ledger | 🔄 |
| F26 | Inventory | Adjustments, internal transfer, cycle count | 🔄 |
| F27 | Master data | Products (create, edit, images, lot tracking, dimensions) | 🔄 |
| F28 | Master data | Clients (create, edit, suspend, contract) and client users | 🔄 |
| F29 | Master data | Warehouses and locations hierarchy (zones, racks, shelves, packing and dock) | 🔄 |
| F30 | Master data | Shipping companies, fee groups and fee rates per governorate | 🔄 |
| F31 | Finance | Accounts, transactions (append-only), policies, carrier costs, payouts, statements | ⬜ |
| F32 | Finance | Optional "Fulfillment Services" billing, invoices, plans (legacy billing) | 🔄 |
| F33 | Reports | The ~25 admin reports (filters, totals vs source data, export) | 🔄 |
| F34 | Admin | Users and roles (create, deactivate, role change, password reset) | ⬜ |
| F35 | Admin | Audit logs, notifications | ⬜ |
| F36 | Admin | Backups: schedules, run now, Google Drive, restore, retention, factory reset guard | 🔄 |
| F37 | Admin | Forms and contracts | ⬜ |
| F38 | Auth | Login, logout, refresh, session expiry, account inactive, wrong password, lockout | 🔄 |
| F39 | Client portal | Dashboard, products, inbound requests, outbound requests | 🔄 |
| F40 | Client portal | E-commerce orders (create, import, returns, status), COD reports, my profits | 🔄 |
| F41 | Client portal | Finances, invoices, API keys (external API), notifications, profile | ⬜ |
| F42 | External API | Client API keys: create order, status, rate limits, signature | ⬜ |
| X01 | Security | RBAC matrix: every route and action for super_admin, wh_manager, wh_operator, client_admin, client_staff | ⬜ |
| X02 | Security | Tenant isolation: a client never reads or writes another client's data (UI, direct URL, API) | 🔄 |
| X03 | Security | Input handling: injection, XSS, CSV/Excel formula injection, file upload limits | 🔄 |
| X04 | Security | Secrets and configuration (committed `.env` history, key rotation, webhook signatures) | ⛔ |
| X05 | Validation | Field sweep on every form: empty, boundary, long, whitespace, Arabic/English, special characters, paste, duplicate submit | 🔄 |
| X06 | Errors | Functional errors: any path that blocks work, wrong totals, wrong state transitions, buttons shown for impossible actions | 🔄 |
| X07 | Errors | Semantic errors: wrong units/currency, wrong labels or wording, misleading messages, Arabic/English parity | 🔄 |
| X08 | Errors | Visual errors: colour meaning (red cancel/delete, green success), spacing, alignment, overflow, RTL, dark mode | 🔄 |
| X09 | UX | Responsive and mobile on key flows (touch targets, tables) | ⬜ |
| X10 | Quality | Performance: N+1 calls, slow pages, large lists | 🔄 |
| X11 | Quality | Accessibility basics: focus order, labels, contrast, keyboard | ⬜ |
| X12 | Data | Data integrity: stock never negative, ledgers append-only, reservations released on cancel, COD totals | 🔄 |
| X13 | Tests | Backend unit suite baseline (all suites, in batches) | ✅ |
| X14 | Tests | Frontend unit suite and Playwright regression of fixed flows | 🔄 |
| X15 | Release | Handover pack: client documentation, decision log, known limitations, runbook | 🔄 |
| X16 | Routing | Redirect-only aliases (`/dashboard`, `/outbound`, `/inbound`, `/settings/*`, `/reports/cod-report`) land on the right page for every role | 🔄 |

## Status counts (flows + cross-cutting)

⛔ 1 · ✅ 9 · ⬜ 17 · 🔄 31

## Definition of done (hand over to the client)

1. Every route, flow and cross-cutting check above is ✅ or ❌ with a triaged defect; no ⬜, 🔄 or ⛔ left.
2. No open S1 or S2 defect; every open S3 or S4 is listed as an accepted known limitation.
3. Regression pass after the last fix: backend unit suite (all, in batches), frontend unit suite, Playwright critical paths, and one live carrier smoke per integrated carrier.
4. Owner decisions closed: pricing groups per governorate, FX source, carrier pound units, COD eligibility, edit/cancel rules, deletion policy, return rollback, secrets rotation.
5. Handover pack written: client documentation, decision log, known limitations, runbook.
Only when all five hold is the system reported as fully tested.
