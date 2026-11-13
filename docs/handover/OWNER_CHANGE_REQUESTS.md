# Owner change requests (from the AI work sessions, 2–6 Nov 2026)

Everything the owner (Nadim) asked for directly, beyond the client's WhatsApp list. Status: ✅ built · 🔍 built, verify in browser · ⬜ not built · ❓ owner decision.
Commit hashes are on branch `staging`.

## A. Concepts the owner insisted on (apply everywhere)
1. **No avoidable user error.** Never offer an option that fails later: carrier that does not serve the address, carrier that does not accept the COD currency, COD below a carrier's minimum, address not covered by a shipping fee rate. Validate at entry, explain clearly.
2. **Client never sees carriers** (names, prices, existence). Carrier is chosen by EMDAD staff at `ready_to_ship`.
3. **Carrier is the source of truth** for its currency and pound unit; EMDAD stores and compares in USD.
4. **Modular settings, not hard-coded rules** for anything the client has not agreed yet (reconciliation, liquidity indicator, client edit/cancel rules, return fee rule, COD due moment).
5. **UI consistency:** red = cancel/delete, green = approve/success/complete; same control looks the same in admin and client; less padding around tables; responsive; consistent fonts and alignment. Do not redesign the UI; tidy it.
6. **Documentation for the client** at the end: each request, what was done, and proof when a request was not a defect (`DECISIONS_AND_EVIDENCE.md`).
7. **Progress reporting** each round in a distinct block: implementation %, testing %, overall to handover.

## B. Requests

| # | Request (owner's words, summarised) | Status | Commit / where |
|---|---|---|---|
| 1 | Address hierarchy must let each carrier accept shared areas without errors; carrier-exclusive areas must map correctly; do not delete governorates a carrier does not serve; warn early (not at send) when a chosen carrier cannot serve an area | ✅ / 🔍 | Courier eligibility rules (2f6853056), Babel neighbourhood sync. Verify per carrier (F22). |
| 2 | Full-system QA like a real user: every page, button, modal, field, edge case; admin + client; cross-check carrier portals (data arrived, cancel reflected, edits reflected both ways, same price, tracking visible to client) | 🔄 | 27.5% (see QA_COVERAGE). Main remaining work. |
| 3 | Coverage inventory with % done / remaining every round; 100% only when the inventory is fully covered with reasonable edge cases | ✅ | `qa_progress.py`, QA_TRACKER, QA_FLOWS |
| 4 | Currency: USD inside; carrier prices in the carrier's own currency/unit; best price by converted value | ✅ | c173d0c07, 208f89384 |
| 5 | Distinguish USD, old SYP, new SYP; then (5 Nov) client side USD only, new SYP only with carriers, old SYP retired | ✅ | c607bfdc3 |
| 6 | Finance + billing: on-demand invoices any day, optional charge items per client, dynamic fulfillment price (lines, weight), EMDAD shipping fee, client vs internal invoice, netting against COD balance | ✅ | 68a105b81 — UI forms not yet clicked through (F32) |
| 7 | OMS fulfillment covers its own outbound order — never bill that outbound twice | ✅ | Built; browser verify in testing sprint (invoice preview OMS + outbound). |
| 8 | Admin can edit carrier price and invoice lines on the internal invoice | ✅ | Built; browser verify in testing sprint. |
| 9 | FX: manual rate or automatic source, with refresh interval, stale limit, minimum-change threshold | ✅ | Browser 9 Nov — custom HTTPS Test OK; invalid http rejected; built-in restored (I-12). |
| 10 | FX source: Syrian Central Bank first, else a reliable free API (6 Nov) | ✅ | Browser 13 Nov `/shipping/companies`: `http://` rejected (“must use HTTPS”); `https://cdn.jsdelivr.net/.../usd.json` Test source → 201; built-in fawazahmed0 active (1 USD = 130.01 new SYP). |
| 11 | Roles: viewer, accountant, inventory…; editable permissions; super admin creates custom roles; RBAC review | ✅ | Built-ins + **custom roles** (migration `20261114120000`, API + UI `/users/custom-roles`). RBAC matrix X01 still for testing. | 14 Nov |
| 12 | Sheets page in client portal for inbound, outbound, OMS: dropdown-only fixed fields with search, editable only before admin approval; built-in hidden API credentials (client cannot see/delete); separate from client API keys | ✅ | e115b5b53, c360973e4, e20c94893 |
| 13 | Real Google Sheet: client signs in with Google, "Open in Google Sheets" button, same rules (no edit after approval; server-side validation blocks bypass via scripts) | 🔍 | Code ✅. Owner 14 Nov hit **Google 403 access_denied** (app in Testing — need Test users / publish). See `docs/handover/O13_GOOGLE_SHEETS_403.md`. |
| 14 | Client API keys for clients with their own site + outgoing webhooks | ✅ | 3ad027d7a |
| 15 | Google OAuth credentials entered from a super-admin Settings page (not .env), with a Test button | ✅ | 25eac26ad |
| 16 | Profile (admin + client): link Google account, sign in with Google; a suspended account must be refused even via Google | ✅ / 🔍 | 7f0372b79. Verify the suspended case. |
| 17 | Forgot password: emailed verification code → enter code → set new password | ✅ / 🔍 | 286463056. Verify email actually arrives (SMTP config on staging). |
| 18 | Searchable drop-downs everywhere; colour-coded action buttons | ✅ / 🔍 | e20c94893. Audit all pages. |
| 19 | Export: CSV **and** branded Excel (EMDAD identity, styled table, analytics/overview block above the table, e.g. top SKUs) on every list | ✅ | Admin + client lists via `tabular-export` / `I2_LIST_EXPORT_AUDIT.md` (9 Nov). Browser verify in testing sprint. |
| 20 | Import template + sheets with drop-down lists (country code, governorate, city, area) | ✅ | Backend xlsx builder; client download verified 6 Nov (OMS-2026-03727). |
| 21 | Sidebar collapse; less table padding; full-width pages | ✅ | 9345798d2 and earlier |
| 22 | Real-browser QA scripts (Playwright) that drive the UI like a user, run on the owner's machine with his logged-in browser; carrier-portal lookups guarded (type order code, stop unless exactly one row) | ✅ | 523a6745f, `qa-scripts/` |
| 23 | Picking list and packing list: same data, simpler layout like the reference image, EMDAD identity | ✅ / ❓ | 45828e197. Owner must approve visually. |
| 24 | Shipping fee rates (6 Nov): order confirmation blocked when a destination has no rate is correct; add sidebar link, warning when governorates are uncovered, ready templates | ✅ / 🔍 | 98400f638. Verify in browser after the 6 Nov rebuild. |
| 25 | FX source decision, Sila webhook retry (last), delete benchmark orders, Babel dimensions check, putaway ledger | ✅ except Sila | 939a09819, DB cleanup 6 Nov; D-040 owner clicks Register webhook |
| 26 | Progress messages in a distinct markup block | ✅ (process) | See `.cursor/rules/30-progress-reporting.mdc` |
| 27 | Hand over to Cursor: consolidated docs, plan, browser MCP testing | ✅ | This handover (6 Nov) |

## C. Decisions still open (ask the owner; do not guess)
- COD due moment (delivered / carrier confirms collection / carrier remits), liquidity approach, order preparation fee (client chat B15).
- Return shipping fee rule (round trip vs return only).
- Whether to enable carrier reconciliation + in-transit float (built behind settings or not built — verify, then ask).
- Meaning of "link inbound order to OMS" (client B3).
- Custom roles / editable permission sets design + migration approval.
- Secret rotation for the `.env` files in git history (X04).
- Return/rollback limits for OMS returns (F14).
- First live shipment on Delivery Joud, and any further live Babel/Sila shipments.
