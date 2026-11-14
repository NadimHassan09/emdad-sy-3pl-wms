#!/usr/bin/env python3
"""Generates docs/testing/04b-e2e-page-catalogue-client.md from client-frontend/src/App.tsx + rbac.ts knowledge.
Screenshots are linked when present in docs/testing/screenshots/staging-client-frontend-screenshots/index.json."""
import json, os

BOTH = 'client_admin, client_staff'
ADM = 'client_admin only'
IDX = {}
ip = 'docs/testing/screenshots/staging-client-frontend-screenshots/index.json'
if os.path.exists(ip):
    for e in json.load(open(ip))['entries']:
        IDX[e['route']] = e['n']
        IDX[e['route'].replace('/ID', '/:id')] = e['n']
IDX['*'] = IDX.get('/NOT-FOUND')

P = []
def page(route, title, kind, roles, elements, cases):
    P.append(dict(route=route, title=title, kind=kind, roles=roles, el=elements, cases=cases))

page('/login', 'Client login', 'auth', 'anonymous', 'Email, password (eye), "Remember me for 30 days" toggle, Sign in, language chip (العربية), forgot-password link/flow, (Google button hidden)',
     [('Login valid → dashboard; wrong password; unknown email; inactive account → /account-inactive', 'Same generic error for wrong/unknown; inactive page with explanation'),
      ('Remember-me OFF: closing browser ends session; ON: persists 30 days; logout clears both', 'Back button after logout shows login only'),
      ('Forgot password: emailed code → set new password; old password rejected; code single-use', 'AUTH-10/11'),
      ('Mobile 390: login card must fit the viewport (currently clipped on the right, language chip clipped — V-048)', 'Card within 16 px gutters'),
      ('Browser autofill prefilled credentials do not break layout/validation', 'ok'), ('Enter key submits; double submit once', 'one request'),
      ('Arabic UI + RTL', 'mirrored')])
page('/account-inactive', 'Account inactive / restricted', 'detail', 'authenticated but inactive', 'Message, contact support, logout', [('Suspended client tries every route', 'Always redirected here; API 403'), ('Reactivated by admin', 'Next login works')])
page('/dashboard', 'Client dashboard', 'dashboard', BOTH, 'Metric cards, recent orders, recent invoices card, storage panel, billing restriction banner, role-access banner (client_staff)',
     [('Every KPI equals own data (SQL on own company)', 'Equal; no other tenant data'), ('client_staff view hides admin-only cards', 'Per A-25'), ('Billing restriction banner appears only when restricted; no "billing cycle" wording (D-042)', 'ok'), ('Currency shown USD only', 'No SYP (S owner)')])
page('/products', 'Inventory (products) list', 'list', BOTH, 'Search, filters, + create, export, row actions (edit/detail), stock columns',
     [('Create product with image (types/size), edit, archive', 'Own company only; SKU unique per company'), ('Stock numbers equal admin view for same product', 'Equal'), ('Barcode image modal', 'Prints/zooms')])
page('/products/new', 'Create product', 'form', BOTH, 'Name, SKU, barcode, UoM, tracking (lot/expiry), dimensions L×W×H, weight, min stock, description, image upload', [('Dimensions optional but explained (needed for storage fee)', 'Hint visible (A-10)'), ('Duplicate SKU', 'Field error'), ('Image upload edge cases', 'FB-17')])
page('/products/:id', 'Product detail', 'detail', BOTH, 'Info grid, stock by lot/location (client view), image, actions', [('Client sees own stock only; no internal location codes beyond what is allowed', 'A-xx'), ('Edit/Archive buttons per role', 'client_staff allowed? (A-25)')])
page('/products/:id/edit', 'Edit product', 'form', BOTH, 'Same as create, prefilled', [('Changing SKU after stock exists', 'Blocked/warned'), ('Edit while an order uses it', 'Allowed fields only')])
page('/inbound-orders', 'Inbound requests list', 'list', BOTH, 'Import, Export, + New, status filters, search, row actions (edit/delete before approval)', [('Status = admin status; locked after EMDAD approval (B8)', 'Edit/Delete hidden after lock'), ('Import template (CSV/xlsx) with instructions', 'S B16'), ('Export columns picker', 'Matches')])
page('/inbound-orders/new', 'New inbound request', 'form', BOTH, 'Expected arrival, lines (product, qty), notes ≤ 500, reference ≤ 100, wizard steps', [('Far-future/past dates, notes limits (D-031)', 'Validation'), ('Submit → admin notification "Inbound order needs approval"', 'Delivered')])
page('/inbound-orders/:id', 'Inbound request detail', 'detail', BOTH, 'Status timeline, lines (expected/received), GRN download (EN/AR) when complete, edit/cancel while pending', [('Cancel pending request', 'Status cancelled; admin sees'), ('GRN PDF opens EN+AR', 'Numbers equal admin')])
page('/outbound-orders', 'Outbound requests list', 'list', BOTH, 'Export, + New, status filters, search', [('Own orders only; columns', 'tenant'), ('Create → admin approval flow', 'status moves')])
page('/outbound-orders/new', 'New outbound request', 'form', BOTH, 'Lines from own stock, destination, shipping method, notes', [('Qty > available', 'Blocked with available qty'), ('Destination address cascade (governorate → city → town) tolerant matching (B11)', 'ok')])
page('/outbound-orders/:id', 'Outbound request detail', 'detail', BOTH, 'Status, lines, tracking panel, DN PDF', [('Tracking panel shows carrier statuses (Arabic detail like Babel; Sila detailed — A2)', 'No carrier cost/price breakdown'), ('DN EN/AR', 'ok')])
page('/outbound-orders/returns', 'Outbound returns list', 'list', BOTH, 'Create return, status filters', [('Return only for shipped/delivered quantities', 'Validation')])
page('/outbound-orders/returns/new', 'New outbound return', 'form', BOTH, 'Select order/lines, reason, qty', [('Qty ≤ delivered − returned', 'Rule D-… return-quantity.validation')])
page('/outbound-orders/returns/:id', 'Outbound return detail', 'detail', BOTH, 'Stages, lines', [('Stage progression visible', 'Matches admin')])
page('/ecommerce-orders', 'Online (OMS) orders list', 'list', BOTH, 'Import, Export (modal with columns), + Create, status nav (ClientOmsOrdersStatusNav), filters (store name, dates), search, copy buttons, tracking', [('Status chips counts equal list', 'LB-08'), ('Filter by store name + dates (B4)', 'AND'), ('Import messy file (B22) + template with dropdown governorate→city→area (B23)', 'Tolerant; row errors'), ('Edit/Cancel only before EMDAD confirmation (B8); after: disabled with reason', 'Server also refuses'), ('Client never sees carrier cost/margin', 'DTO scan')])
page('/ecommerce-orders/new', 'Create online order', 'form', BOTH, 'Recipient, phone (+963), governorate/city/town cascade + map, address, payment COD/prepaid, COD amount, products lines, notes, wizard', [('Company/client selector not applicable (own company) — no "Acme" default bug (B18)', 'n/a'), ('Shipping fee preview in USD; destination without fee group → message', 'S #24'), ('Raqqa/Hasakah etc. accepted (B10)', 'ok'), ('Double submit', 'one order')])
page('/ecommerce-orders/:id', 'Online order detail', 'detail', BOTH, 'Status, recipient, lines, tracking panel + shipment movement panel (carrier detailed statuses), edit/cancel (before confirmation), waybill/print?', [('Timeline shows detailed statuses (Sila/Babel) in order', 'A2'), ('Cancel before confirmation → admin sees', 'sync'), ('Amounts: COD, shipping fee (USD), no carrier cost', 'Equals admin')])
page('/ecommerce-orders/returns', 'Online returns list', 'list', BOTH, 'Create, filters', [('Returns of own orders only', 'tenant')])
page('/ecommerce-orders/returns/new', 'New online return', 'form', BOTH, 'Order select, lines, reason', [('Return for delivered order only', 'Rule')])
page('/ecommerce-orders/returns/:id', 'Online return detail', 'detail', BOTH, 'Stages (plan/receive/put away), lines', [('Received/put-away counts shown (admin page lacks them — V-034)', 'Counts present')])
page('/my-profits', 'Cash on delivery / my profits (COD report)', 'report', BOTH, 'Summary cards (pending, available, paid out), table, export, filters', [('Numbers equal admin COD for the same client; USD only', 'Equal'), ('Policy-dependent availability visible (A-03)', 'Explained text'), ('Client shield hides in-transit gaps (B12)', 'Hidden')])
page('/finances', 'Financial account', 'dashboard', BOTH, 'Current/available/pending balance, transactions, statement download, payout request (admin only?)', [('Balance = Σ transactions; statement opening+movements=closing', 'Equal'), ('Payout request minimum 10 USD, ≤ available', 'Validation (S)'), ('Raw category keys not shown', 'Human labels (V-022 pattern)')])
page('/billing', 'Billing (client view)', 'dashboard', ADM, 'Billing summary, plan, restriction status', [('No cycle wording; on-demand model', 'D-042'), ('client_staff cannot open', '403/redirect')])
page('/invoices', 'Invoices list', 'list', ADM, 'Table, export, filters, row → detail', [('Only own invoices; statuses', 'tenant'), ('Export equals list', 'ok')])
page('/invoices/:id', 'Invoice detail (client)', 'detail', ADM, 'Lines: fulfilment (inbound/outbound/OMS), shipping fee, storage, incentive discount, total; PDF', [('NO carrier cost, NO margin, NO internal notes (invoice redesign §3)', 'Absent from DOM and API'), ('Totals equal admin client-total', 'Equal'), ('PDF EN/AR', 'ok')])
page('/billing/invoices/:id', 'Invoice detail (alias)', 'redirect', ADM, 'Alias route', [('Alias renders same as /invoices/:id', 'Same content')])
page('/sheets', 'Sheets (OMS/inbound/outbound sheets)', 'form', BOTH, 'Fixed dropdown-only fields with search, row grid, submit, "Open in Google Sheets" (hidden/blocked), status, built-in API credentials hidden', [('Fields restricted to dropdown values; invalid value impossible even via paste', 'Server validation'), ('Rows editable only before admin approval; after approval locked (UI + API + Google Sheet)', 'S #12/#13'), ('Google connect: shows Google 403 until owner adds Test users — BLOCKED(owner)', 'Documented'), ('Credentials not visible/deletable by client', 'Absent in DOM')])
page('/apis', 'APIs (keys + webhooks + docs)', 'settings', ADM, 'API keys list, create, regenerate, revoke, enable/disable, docs link, WebhooksSection (endpoints, secrets, events, test)', [('Create key: shown once; regenerate invalidates old; revoke immediate', 'Works with /v1 endpoints'), ('Webhook endpoint https only; signature; test delivery; retries', 'S #14'), ('client_staff cannot see page', 'RBAC'), ('Docs page per scope renders examples with correct base URL', 'ok')])
page('/notifications', 'Notifications (client)', 'list', BOTH, 'All/unread/read, mark read', [('Notifications about own orders only', 'tenant'), ('No legacy billing-cycle notices', 'A-07')])
page('/profile', 'Profile (client)', 'form', BOTH, 'Photo, name, password change, language/theme, (Google link hidden)', [('Change password rules', 'FB'), ('Avatar upload/remove', 'FB-17')])
page('/cod-reports', 'Alias → /my-profits', 'redirect', BOTH, 'Redirect', [('Lands on /my-profits', 'RD-01')])
page('/returns', 'Alias → /ecommerce-orders/returns', 'redirect', BOTH, 'Redirect', [('Lands correctly; /returns/new, /returns/:id too', 'RD-01')])
page('/returns/new', 'Alias → /ecommerce-orders/returns/new', 'redirect', BOTH, 'Redirect', [('Lands on the new online return form', 'RD-01')])
page('/returns/:id', 'Legacy return redirect (LegacyReturnRedirect)', 'redirect', BOTH, 'Redirect decides online vs outbound return by id', [('Id of an online return and of an outbound return each land on the right detail page; unknown id → 404', 'RD-01')])
page('*', 'Not found page', 'detail', BOTH, 'NotFoundPage', [('Unknown URL shows branded 404 with link home (and unauthenticated → /login)', 'No blank page')])

BATT = {'list': 'LB-01…LB-24', 'form': 'FB-01…FB-25', 'detail': 'DB-01…DB-12', 'report': 'RB-01…RB-14', 'settings': 'SB-01…SB-10', 'dashboard': 'DASH-01…DASH-08', 'redirect': 'RD-01…RD-02', 'auth': 'AUTH-01…AUTH-20'}
out = ['# 04b — Client portal page catalogue', '',
       'Same rules as `04a`. Roles: `client_admin`, `client_staff` (A-25 defines the difference). Routes from `client-frontend/src/App.tsx`; nav from `client-frontend/src/lib/rbac.ts`.',
       'Screenshots: `docs/testing/screenshots/staging-client-frontend-screenshots/<device>/<NNN>_<route>.png`. **Status of capture:** 30 screens × 4 devices captured on 14 Nov 2026 in the owner's logged-in session (client_admin "Eng Nadim", Acme Imports). Not captured: `/outbound-orders/returns/:id` (no data), `/inbound-orders` states beyond defaults, aliases, `/account-inactive`, and the client_staff view.', '',
       '| Route | Kind | Battery | Roles | Screenshot | Cases |', '|---|---|---|---|---|---|']
for p in P:
    n = IDX.get(p['route'])
    out.append(f"| `{p['route']}` | {p['kind']} | {BATT[p['kind']]} | {p['roles']} | {'`%03d`' % n if n else 'pending (login)'} | {len(p['cases'])} |")
out += ['', '---', '']
for i, p in enumerate(P, 1):
    n = IDX.get(p['route'])
    out += [f"## PC{i:03d} — `{p['route']}` — {p['title']}", '', f"- **Kind:** {p['kind']} → battery **{BATT[p['kind']]}**", f"- **Roles:** {p['roles']}; others refused",
            f"- **Screenshots:** {'`%03d_*.png` ×4 devices' % n if n else 'pending (needs client session)'}", f"- **Elements expected (from source/requirements; verify against screenshots):** {p['el']}", '',
            '| ID | Page-specific case | Expected | Pri |', '|---|---|---|---|']
    for j, (t, e) in enumerate(p['cases'], 1):
        out.append(f"| PC{i:03d}.{j} | {t} | {e} | {'P0' if j == 1 else 'P1'} |")
    out.append('')
out += ['---', '', '## Client states/modals to capture', '', '- Order import modal (`ClientOrderImportModal`): choose file, errors list, success summary', '- Export modal (`ClientOmsOrdersExportModal`): column picker', '- Barcode image modal', '- Confirm dialogs: cancel order, delete inbound, revoke API key, regenerate key, delete webhook',
        '- Wizard steps (`ClientWizardSteps`) of each create form', '- Empty states for every list; error 403/404/500; session-expired; billing-restricted banner on every page; app-update modal', '- Role switch: same pages as `client_staff` (hidden nav items: APIs, Billing, Invoices)', '']
open('docs/testing/04b-e2e-page-catalogue-client.md', 'w').write('\n'.join(out) + '\n')
print(len(P), 'client pages', sum(len(p['cases']) for p in P), 'cases')
