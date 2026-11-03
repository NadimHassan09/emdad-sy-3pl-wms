# EMDAD — Full System QA Master Plan (Staging)

Living plan; amended as findings change it. Decisions and evidence go to `DECISIONS_AND_EVIDENCE.md`; per-page results go to `QA_TRACKER.md`.

## 0. Guiding concept

**The system must not give any user (admin or client) a way to make an error.** Therefore every check asks two questions:

1. *Can the user reach a state that later fails?* (an option that is offered but cannot work)
2. *If the input is almost right, is it corrected instead of rejected?* (safe, unique, visible correction; never a guess)

Typical violations to hunt: a carrier offered for an address/currency/COD value/weight it cannot serve; a filter combination that yields options that then fail on send; an order accepted with an address that fails at shipping time; a button shown for an action the status does not allow; the same function behaving differently in Admin and Client.

Definition of done: an operator can create orders, receive stock, pick/pack, ship via every integrated carrier, edit/cancel, handle returns and COD, see correct client balances and admin profit, with no blocking error in any normal path.

## 1. Scope inventory (from the code)

- Admin portal: ~136 routes / 54 page files. Roles: `super_admin`, `wh_manager`, `wh_operator`.
- Client portal: ~30 routes / 28 page files. Roles: `client_admin`, `client_staff`.
- Backend modules: auth, users, clients, products, inbound, outbound, inventory, locations/warehouses, tasks, cycle-count, returns, OMS (orders, batches, COD, returns), shipping (Babel, Sila SY, Sena, Delivery Joud to be added), financial, billing (legacy), reports, backups, notifications, audit logs, forms/contracts, external API.
- External systems: Babel, Sila, Sena (sandbox), Delivery Joud portals/APIs; Google Drive (backups).

## 2. Method (every page, button, modal, field)

For each route in `QA_TRACKER.md`, in the browser through the Chrome extension, as a real user:

1. Load: layout, console errors, network errors (4xx/5xx), loading/empty/error states.
2. Every control: buttons, row actions, menus, tabs, filters, sorting, pagination, export, print.
3. Every modal/form field: empty, valid, boundary, invalid, whitespace, Arabic/English, very long, special characters, duplicate, paste.
4. Status-dependent behaviour: each action in each order status (allowed and disallowed).
5. Permissions: each role sees/does only what it should; tenant isolation (a client never sees another client's data; try direct URLs and API calls).
6. Consistency: Admin vs Client for the same function; colour semantics (red = cancel/delete, green = success/approve/complete, amber = warning); font, spacing, alignment, table padding; icons; wording; RTL/LTR.
7. Responsive: desktop, tablet, phone widths; touch targets; tables on small screens.
8. Defect found → log (ID, severity, steps, evidence) → minimal fix → rebuild staging → re-test in the browser → commit and push → update tracker.

Code-level tests (Jest/Vitest/Playwright) are secondary: used to lock in fixes and to run regression, never as a substitute for the browser pass.

## 3. Phases

| # | Phase | Content | Exit |
|---|---|---|---|
| 0 | Baseline | Route/control inventory into tracker; backend unit-test baseline in batches; test accounts and sessions; test data set-up (Test company, recipient Nadim Hassan, "TEST ORDER") | tracker complete; baseline recorded |
| 1 | Carrier capability matrix | For Babel, Sila, Sena, Delivery Joud: coverage (governorates/areas), currencies, COD min/max and currency, weight/dimension limits, payer options, cancel/edit support, webhook/tracking model, price rules. Source: API docs + portal + live read-only lookups | matrix in docs; rules identified for "offer only what can succeed" |
| 2 | Preventive validation | Implement/verify: carrier offered only if address, currency, COD value, weight, payer, delivery/pickup type are all supported; filters (currency, COD) cannot produce unsendable options; address validated and safely corrected at order creation and import; import tolerance (phone prefix, Arabic letter variants, dates) with visible corrections and clear row errors | no path where an offered option fails on send |
| 3 | Admin portal pass | Auth/RBAC, dashboard, clients, products, locations/warehouses, inbound (ASN, receive, putaway, GRN), outbound (reserve, pick, pack, dispatch), inventory/ledger/adjustments, cycle count, tasks, returns, OMS orders (create, import, edit, cancel, approve, bulk, waybills, batches, pick lists), OMS COD, OMS returns, shipping companies/fee rates, finance (accounts, transactions, COD, payouts, policies, carrier costs, statements), billing (legacy), reports, users, audit logs, notifications, backups, forms/contracts | every route/control checked and tracked |
| 4 | Client portal pass | Same functions as the client sees them: products, inbound, outbound, e-commerce orders (create/import/returns), COD reports, finances, invoices, profits, profile, notifications, APIs; compare with Admin for consistency | every route/control checked |
| 5 | Carrier end-to-end | Quote vs create payload vs carrier portal (data, COD, address, weight, price); tracking and webhooks both directions; cancel/edit/supersede; carrier switch; failure paths. **Sena sandbox first.** | each carrier verified in its own portal |
| 6 | Money reconciliation | Quantities, shipping fee vs carrier cost, COD eligibility policy, client balance, admin profit; append-only ledger and reversals; payout request; statements | numbers reconcile order by order |
| 7 | UI/UX consistency | Colour semantics, typography, spacing, table density, alignment, component reuse, Admin/Client parity, RTL | consistency checklist green |
| 8 | Responsive and mobile | Key flows on phone/tablet widths and touch | no blocked flow on mobile |
| 9 | Security and robustness | RBAC matrix, tenant isolation, IDOR on direct URLs/APIs, input injection, file upload limits, rate/duplicate submission, session expiry, export formula injection, webhook signature checks | no critical finding |
| 10 | Regression and report | Re-run critical paths, update documentation (requests answered, decisions, diagrams), acceptance report | zero blockers |

## 4. Carrier safety (non-negotiable)

- Babel, Sila (and probably Delivery Joud) are live accounts with real orders; only Sena has a sandbox.
- Test shipments use only the "Test company" client, recipient "Nadim Hassan", notes "TEST ORDER"; never touch other orders in EMDAD or in carrier portals.
- Before the **first** live shipment, one batched approval of the exact test-order list; after that, proceed within that list.
- Sila: never test with real parcels; check `GET /cargos?reference=` before any resend; show carrier error messages and `request_id` unchanged.
- Passwords are never typed by the agent; portal sessions are opened by the project owner.

## 5. Decision gates (the only reasons to stop and ask)

Business policy and rules: pricing/fees and who bears carrier cost variance; COD eligibility trigger; edit/cancel rules after processing or after a carrier shipment exists; shipment deletion; return rollback limits; fulfilment-service tariffs; free-text/general cargo in imports; anything changing client balances or inventory policy; the first live carrier dispatch; secrets rotation/history clean-up; database migrations.

Everything else (fixes, UI, validation logic, tests, commits, pushes) proceeds without asking.

## 6. Tooling

- Chrome extension (primary, real browser), Playwright (installed in `frontend/`) for regression of fixed flows, Vitest for pure logic, Jest for backend units, Graphify for navigation, read-only SQL against `wms_db_staging` for state checks.
- Needed from the project owner: open Chrome sessions for the Sila, Sena and Delivery Joud portals and for a client-portal user of "Test company"; Delivery Joud API collection export if the Postman page cannot be read.

## 7. Known risks to resolve along the way

- Staging carries live carrier credentials; guard against any code path that auto-sends.
- `backend/.env` and `.deploy-backup/.env` appear in pushed git history (secrets exposure) — owner decision on rotation.
- Backend unit suite crashes on memory in one run; run in batches.
