# 20 — Remaining capture backlog (what is NOT yet photographed or inspected)

Status at 14 Nov 2026 (commit after `6340d4090`). Done so far: admin pages 001–088 (4 devices), admin states 089–104 (modals, empty, error, Arabic ×2, dark ×2), client pages 001–030 (4 devices). Everything below is still open. The executor (Cursor, browser extension) works through it, then reports back; only after that do we write the test code.

**Why this exists:** the plan files (`01`–`19`) already contain test cases for these pages/states, but the *visual baseline and element inventory* is missing, and several UX/visual defects can only be found by looking. Each item below ends with: screenshots filed (4 devices unless marked), element inventory noted, and defects logged.

## 0. Rules for every item
1. Staging only (`staging-admin.emdadsy.com`, `staging-client.emdadsy.com`). Never production. Never disable TLS checks (the IP vhost has a self-signed cert → do not use it).
2. **Look, don't change.** Open modals/forms and screenshot, then Cancel/close. Do not submit, save, delete, approve, cancel or send anything. Exception list = none in this file. Items needing a mutation are in §8 (owner-approval gate) and are NOT to be done.
3. Do not type passwords. If a login is needed, ask the owner to log in/out in the shared Chrome profile.
4. If you change language/theme (localStorage `wms-ui-language`, `admin-ui-theme`, client equivalents) restore them to EN/light at the end. If you apply list filters, press Reset.
5. If a carrier/portal page appears, do not touch it.
6. Record only what you see; mark guesses as "(guess)".

## 1. Admin pages with dynamic routes not yet captured (use real ids from the lists; list the id used in the notes)
| # | Route | How to reach | Notes to capture |
|---|---|---|---|
| A1 | `/orders/inbound/:id/edit` | inbound list → a **draft/pending** order → Edit | form prefill, locked fields |
| A2 | `/orders/outbound/:id/edit` | outbound list → draft/pending order → Edit | same |
| A3 | `/oms/cod/:id` | OMS COD list → row | status controls (do not click) |
| A4 | `/oms/returns/:id/edit` | OMS returns list → a pending return → Edit | return plan editor |
| A5 | `/tasks/:id/execute` | tasks list → an open task → Execute (only view; do not press Start/Complete) | pick/pack/putaway/receiving UI variants (one screenshot per task type available) |
| A6 | `/cycle-count/:id` and `/cycle-count/:id/execute` | cycle count list → session | detail + execution screens |
| A7 | `/returns/:id` and `/returns/:id/process` | WMS returns list (may need a company selector — note how) | |
| A8 | `/inventory/product/:productId` | inventory stock → product | |
| A9 | `/inventory/ledger/line/:ledgerId/:createdAt` and `/inventory/ledger/:referenceType/:referenceId` | ledger list → row | |
| A10 | `/billing/plans/:clientId` and `/billing/plans/:clientId/edit` | billing plans → row → detail/edit | |
| A11 | `/users/client_users/:id` | client users → row | |
| A12 | `/users/warehouse_users/:id` (valid warehouse user) | warehouse users → row | role, status, worker profile, activity, edit/deactivate buttons |
| A13 | `/billing/invoices/:id` for a **non-cancelled** invoice (draft and finalised if present) | invoices list | storage/incentive/grand-total blocks below the fold (scroll + screenshot each part), lock/edit state, "Edit invoice" |
| A14 | `/orders/oms/:id` for orders in different states | pick one each: delivered, cancelled, out for delivery, failed delivery, returned, waiting for confirmation | button sets per status (record which buttons exist) |
| A15 | `/orders/outbound/:id`, `/orders/inbound/:id` | pick different statuses | same |
| A16 | `/oms/batches/:id` with ≥2 orders if exists | | |
| A17 | `/contracts/final-contract` → a row's PDF open | open the PDF viewer/tab only | |
| A18 | Waybill / picking / packing list / GRN / DN PDFs | open (do not generate new ones except via "Open PDF" buttons) | one screenshot of each rendered document (A4/10×15), EN + AR if toggle exists |

## 2. Authentication pages (need a logged-out state — ask the owner to log out of BOTH portals or use a private window with the owner)
| # | Page | Capture |
|---|---|---|
| L1 | Admin `/login` | default, with empty submit error, with wrong credentials error (use a fake email + wrong password; this is allowed), show-password eye, remember-me toggle, language switch, mobile |
| L2 | Admin forgot-password flow screens (`Forgot password?` link → request code → enter code → new password). Only the first screen (request) may be submitted, with a fake email, to see the generic message | |
| L3 | Admin `/account-inactive` or equivalent if a suspended test user exists (do not suspend anyone) | |
| L4 | Client `/login` states: empty submit, wrong credentials, forgot password screens | |
| L5 | Client `/account-inactive` | via URL while logged in as active user (see what it shows) |
| L6 | Session-expired behaviour: delete the access token cookie/storage in dev tools then click any link — screenshot the redirect target | both portals |

## 3. Admin modals / dialogs / drawers not yet photographed (open → screenshot → Cancel)
List page → control → what to photograph:
- `/locations/:warehouseId`: "+ New location" modal; row ⋯ menu (edit/deactivate/delete) and each resulting dialog (do not confirm).
- `/warehouses`: row Edit modal; Deactivate confirm.
- `/inventory/adjustments`: "+ New adjustment" form/modal; row actions menu.
- `/internal`: "Create Internal Transfer" modal.
- `/cycle-count`: create session modal; "Product schedule" tab; row actions.
- `/orders/inbound` and `/orders/outbound`: Import modal (template download button visible; do not upload), row ⋯ menu per status, advanced filtering panel open, page-size dropdown open, `Bulk Shipping Processing` (if enabled: **do not open**, see §8).
- `/orders/oms`: Import modal, "Export CSV" menu, advanced filtering open, group-by dropdown open (each group option list), row ⋯ menu (for 3 different statuses), QR mode modals for each of the 6 modes (Confirm/Approve/Ready/Handover/Delivered/Failed — open the scan modal only), column/visibility controls if any.
- `/oms/batches/:id`: every dropdown/menu on the bulk bar (open only).
- `/oms/cod`: "Set (n selected)" with 1 selected (open dialog, cancel), Export PDF menu, each "by QR" modal.
- `/oms/returns`: Create Return modal/page, Express Return modal, Confirm by Scan modal, Rollback/Confirm row dialogs (cancel).
- `/returns`: "+ New return" (note whether it works without tenant).
- `/contracts/*`: "Create PDF", "+ Create final contract" modal.
- `/tasks`: advanced filtering open; worker assignment select on a task detail (open dropdown only).
- `/forms`: Delete confirm (cancel).
- `/finance/*`: Statement modal (accounts row), "Adjust" modal (row), COD "Confirm Collect"/"Confirm Remit" dialogs (open with 1 row selected if possible; cancel), payouts row actions (approve/reject dialogs; cancel), carrier-costs "Mark Paid" dialog (cancel), float page "Run reconciliation" with a pasted sample (**do not run**; just photograph the filled textarea with `AWB123 12.50 USD`), policies page: each radio card selected state (do not change; screenshot as is), prep fee toggle area.
- `/users/*`: row Edit dialogs, Deactivate/Reset-password confirms, custom role creation form with a few chips toggled (do not press Create).
- `/billing/*`: plan create form filled with obviously fake values (do not submit), template create modal, charge-rules page for a selected client (read-only look), on-demand invoice page: choose a client + period, click **Preview**, **Calculate storage**, **Check incentive** — these are read-only previews; screenshot the results (they must not create anything; if a button says "Create/Add to invoice" do not press it).
- `/backups`: Upload modal (do not choose a file), Restore dialog (open, cancel), schedule "Create schedule" modal, retention "Run cleanup" confirm (cancel), health "Evaluate alerts now" (**do not press**).
- `/shipping/companies`: each carrier card expanded view, "Test connection" button (**do not press**), "Register webhook"/"Configure Webhook Secret" dialogs (open, cancel, never type secrets), pickup address form, FX panel: switch tabs/radio only visually (do not save).
- `/shipping/fee-rates`: "Add rate group" modal/page (do not save), edit ✎ on a group, "Test a delivery price" tool with sample values (read-only calculation is allowed), global weight/currency settings panel.
- Global: user menu dropdown, notifications bell dropdown, language toggle open, Ctrl+K quick-jump with results typed (e.g. "ord"), sidebar collapsed state, sidebar mobile drawer open.

## 4. Admin states per page type (one representative page each is enough unless a page behaves differently)
- **Empty list** (search with no match) on: inbound, outbound, products, inventory stock, ledger, adjustments, clients, invoices, finance transactions, audit logs, notifications (filter "Read" if empty), warehouse users. (OMS already done.)
- **Loading** skeleton (throttle network to Slow 3G for one reload) on a list, a detail, a report.
- **Error** states: API failure (block one request in dev tools → reload), 403 page (see §6 roles), 404 for unknown ids on: inbound, outbound, products, clients, invoices, returns.
- **Validation errors**: open each create form from §3 and press the submit button **with empty fields only if the submit button is enabled and the form is a modal with client-side validation** — otherwise skip (never submit a form that could create data with valid values; empty-submit that fails validation is allowed, but if in doubt do not click).
- **Toasts**: only those triggered by harmless actions (copy buttons → "copied" toast; export CSV on a small list → toast/download; mark notification read is **not** harmless — skip).

## 5. Arabic (RTL) and dark theme baselines
Admin pages (EN-light already captured). Capture **Arabic-light** and **EN-dark** (desktop + mobile only, i.e. 2 devices) for this P0 set: `/dashboard/overview` (done), `/orders/oms` (done), `/orders/outbound`, `/orders/inbound`, `/orders/oms/:id`, `/orders/oms/new`, `/oms/batches/:id`, `/inventory/stock`, `/products`, `/finance/overview`, `/finance/accounts` (dark: white-island defect V-070 — re-capture all 4 devices), `/finance/policies`, `/billing/invoices`, `/billing/invoices/on-demand`, `/billing/invoices/:id`, `/shipping/companies`, `/shipping/fee-rates`, `/users/warehouse_users`, `/backups`, `/reports/warehouse-analysis`, `/profile`, `/notifications`, `/audit-logs`. For the rest of the pages one desktop screenshot each in Arabic is enough. Record untranslated strings, mirrored-layout errors, truncated Arabic text.
Client portal: same for `/dashboard`, `/ecommerce-orders`, `/ecommerce-orders/new`, `/ecommerce-orders/:id`, `/finances`, `/my-profits`, `/invoices`, `/invoices/:id`, `/sheets`, `/apis`, `/products`, `/inbound-orders`, `/outbound-orders`, `/login` (AR + dark if available).

## 6. Roles (needs the owner to log in as each user or provide a session; never type passwords)
For each role capture: sidebar (what items are visible), 3 pages it can open, and **3 pages it must NOT open by typing the URL** (record: redirect/403/blank/data-leak).
| Role | Account | Pages to try (allowed) | Pages to try by URL (forbidden) |
|---|---|---|---|
| wh_operator | QA-operator | `/tasks`, `/orders/inbound`, `/inventory/stock` | `/finance/overview`, `/users/warehouse_users`, `/backups` |
| finance (accountant) | QA-accountant | `/finance/overview`, `/billing/invoices`, `/reports/receivables-aging` | `/users/custom-roles`, `/backups`, `/shipping/companies` |
| viewer | QA-viewer | `/dashboard/overview`, `/orders/oms`, `/finance/overview` | any create page (`/orders/oms/new`), `/users/*` |
| inventory_controller | QA-inventory | `/inventory/stock`, `/inventory/adjustments`, `/cycle-count` | `/billing/*`, `/finance/*` |
| wh_manager | manager account | most pages | `/users/custom-roles`, `/finance/policies` |
| custom role | QA custom | whatever the role allows | everything else |
| client_staff | QA-client-staff-A | `/ecommerce-orders`, `/products`, `/dashboard` | `/apis`, `/billing`, `/invoices` |
| second tenant | QA-client-admin-B | own dashboard | URLs/ids of Acme records copied from Acme's session (IDOR check: open `/ecommerce-orders/<Acme order id>`) |
If these accounts do not exist, list "ACCOUNT MISSING" and stop that row; do not create users.

## 7. Client portal remaining
- Pages: `/outbound-orders/returns/:id` (if any return exists), `/account-inactive`, `/returns`, `/returns/new`, `/returns/:id`, `/cod-reports`, `/billing/invoices/:id` (aliases: screenshot the landing page), `/billing`, `/finances` tabs (Payout Requests, COD Movements, Account Statement) each as a separate screenshot, `/ecommerce-orders` filters (advanced filtering open), status chips per tab, `/sheets` tabs Inbound and Outbound, `/products` row ⋯ menu, `/apis` Create API modal (open → cancel; never create), webhooks add field.
- Modals: Order import modal (open only), export modal (columns), barcode image modal, confirm dialogs (cancel order — open only, regenerate secret / revoke — open only, never confirm), wizard steps if any, `/ecommerce-orders/new` map interaction (click map once only to see the pin dialog — do not confirm), phone country picker open, governorate/city/town dropdown open (show list) and typing a fake town to see "Did you mean".
- States: empty states (search no match on each list), 404 (done), loading, API error (block request), session expired.

## 8. Owner-approval gate (do NOT do; only list what is needed so the owner can approve later)
1. Bulk shipping modals (`Confirm Shipping`, `Complete Dispatch`, `Cancel Shipments`) — opening fires `PATCH …/shipping-details` and requests carrier quotes (D-009). Need: one disposable "Test company / Nadim Hassan / TEST ORDER" OMS order id and owner's yes.
2. Carrier "Test connection", "Register webhook", any live Babel/Sila/Delivery Joud/Fatih action.
3. Sheets Google connect (blocked by Google 403).
4. Any submit of create/edit forms; approvals; COD collect/remit; payout actions; backups create/restore/cleanup; factory reset.
5. Role accounts creation.
6. Logging out the owner (only with the owner's explicit say-so).

## 9. Deliverables from the executor
1. Screenshots filed with the same convention as before: `docs/testing/screenshots/staging-admin-frontend-screenshots/<device>/<NNN>_<slug>.png` continuing at **105** (admin) and `staging-client-frontend-screenshots/...` continuing at **031** (client); devices desktop/laptop/tablet/mobile; keep `index.json` updated (route/state per number). Items marked "desktop + mobile only" go in the same numbering with only those two devices.
2. New defect candidates appended to `docs/testing/16-observed-issues-during-capture.md` as **V-077…** in the same table format (page, observation, devices, severity guess, confirming test id).
3. Raw notes appended to `docs/testing/screenshots/visual-notes.md`.
4. Updated `docs/testing/14-coverage-matrix.md` §9/§10: tick what is now captured, list what is still not (with the reason).
5. A short `docs/testing/21-capture-round4-report.md`: what was captured (ids), what was skipped and why, which owner approvals are still needed, total new defects by severity.
6. Commit with message `docs(testing): capture round 4 …` and push to `staging` (docs only; stage files by name; never commit dist/node_modules/graphify files).

## 10. Done when
Every row in §1–§7 is either captured, or marked `SKIPPED(reason)` / `BLOCKED(owner approval)` in `21-capture-round4-report.md`.
