# 04b — Client portal page catalogue

Same rules as `04a`. Roles: `client_admin`, `client_staff` (A-25 defines the difference). Routes from `client-frontend/src/App.tsx`; nav from `client-frontend/src/lib/rbac.ts`.
Screenshots: `docs/testing/screenshots/staging-client-frontend-screenshots/<device>/<NNN>_<route>.png`. **Status of capture:** only the public pages could be captured so far — the client portal requires a logged-in session and the test agent never types passwords. The owner (or phase-3 executor with the owner) logs in once in the shared Chrome tab and the same capture procedure (`docs/testing/screenshots/assign.py`) is run for every route below.

| Route | Kind | Battery | Roles | Screenshot | Cases |
|---|---|---|---|---|---|
| `/login` | auth | AUTH-01…AUTH-20 | anonymous | `001` | 7 |
| `/account-inactive` | detail | DB-01…DB-12 | authenticated but inactive | pending (login) | 2 |
| `/dashboard` | dashboard | DASH-01…DASH-08 | client_admin, client_staff | `002` | 4 |
| `/products` | list | LB-01…LB-24 | client_admin, client_staff | `014` | 3 |
| `/products/new` | form | FB-01…FB-25 | client_admin, client_staff | `015` | 3 |
| `/products/:id` | detail | DB-01…DB-12 | client_admin, client_staff | pending (login) | 2 |
| `/products/:id/edit` | form | FB-01…FB-25 | client_admin, client_staff | pending (login) | 2 |
| `/inbound-orders` | list | LB-01…LB-24 | client_admin, client_staff | `010` | 3 |
| `/inbound-orders/new` | form | FB-01…FB-25 | client_admin, client_staff | `011` | 2 |
| `/inbound-orders/:id` | detail | DB-01…DB-12 | client_admin, client_staff | pending (login) | 2 |
| `/outbound-orders` | list | LB-01…LB-24 | client_admin, client_staff | `012` | 2 |
| `/outbound-orders/new` | form | FB-01…FB-25 | client_admin, client_staff | `013` | 2 |
| `/outbound-orders/:id` | detail | DB-01…DB-12 | client_admin, client_staff | pending (login) | 2 |
| `/outbound-orders/returns` | list | LB-01…LB-24 | client_admin, client_staff | `021` | 1 |
| `/outbound-orders/returns/new` | form | FB-01…FB-25 | client_admin, client_staff | `022` | 1 |
| `/outbound-orders/returns/:id` | detail | DB-01…DB-12 | client_admin, client_staff | pending (login) | 1 |
| `/ecommerce-orders` | list | LB-01…LB-24 | client_admin, client_staff | `003` | 5 |
| `/ecommerce-orders/new` | form | FB-01…FB-25 | client_admin, client_staff | `004` | 4 |
| `/ecommerce-orders/:id` | detail | DB-01…DB-12 | client_admin, client_staff | pending (login) | 3 |
| `/ecommerce-orders/returns` | list | LB-01…LB-24 | client_admin, client_staff | `005` | 1 |
| `/ecommerce-orders/returns/new` | form | FB-01…FB-25 | client_admin, client_staff | `023` | 1 |
| `/ecommerce-orders/returns/:id` | detail | DB-01…DB-12 | client_admin, client_staff | pending (login) | 1 |
| `/my-profits` | report | RB-01…RB-14 | client_admin, client_staff | `006` | 3 |
| `/finances` | dashboard | DASH-01…DASH-08 | client_admin, client_staff | `007` | 3 |
| `/billing` | dashboard | DASH-01…DASH-08 | client_admin only | `008` | 2 |
| `/invoices` | list | LB-01…LB-24 | client_admin only | `009` | 2 |
| `/invoices/:id` | detail | DB-01…DB-12 | client_admin only | pending (login) | 3 |
| `/billing/invoices/:id` | redirect | RD-01…RD-02 | client_admin only | pending (login) | 1 |
| `/sheets` | form | FB-01…FB-25 | client_admin, client_staff | `026` | 4 |
| `/apis` | settings | SB-01…SB-10 | client_admin only | `027` | 4 |
| `/notifications` | list | LB-01…LB-24 | client_admin, client_staff | `028` | 2 |
| `/profile` | form | FB-01…FB-25 | client_admin, client_staff | `029` | 2 |
| `/cod-reports` | redirect | RD-01…RD-02 | client_admin, client_staff | pending (login) | 1 |
| `/returns` | redirect | RD-01…RD-02 | client_admin, client_staff | pending (login) | 1 |
| `/returns/new` | redirect | RD-01…RD-02 | client_admin, client_staff | pending (login) | 1 |
| `/returns/:id` | redirect | RD-01…RD-02 | client_admin, client_staff | pending (login) | 1 |
| `*` | detail | DB-01…DB-12 | client_admin, client_staff | pending (login) | 1 |

---

## PC001 — `/login` — Client login

- **Kind:** auth → battery **AUTH-01…AUTH-20**
- **Roles:** anonymous; others refused
- **Screenshots:** `001_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Email, password (eye), "Remember me for 30 days" toggle, Sign in, language chip (العربية), forgot-password link/flow, (Google button hidden)

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC001.1 | Login valid → dashboard; wrong password; unknown email; inactive account → /account-inactive | Same generic error for wrong/unknown; inactive page with explanation | P0 |
| PC001.2 | Remember-me OFF: closing browser ends session; ON: persists 30 days; logout clears both | Back button after logout shows login only | P1 |
| PC001.3 | Forgot password: emailed code → set new password; old password rejected; code single-use | AUTH-10/11 | P1 |
| PC001.4 | Mobile 390: login card must fit the viewport (currently clipped on the right, language chip clipped — V-048) | Card within 16 px gutters | P1 |
| PC001.5 | Browser autofill prefilled credentials do not break layout/validation | ok | P1 |
| PC001.6 | Enter key submits; double submit once | one request | P1 |
| PC001.7 | Arabic UI + RTL | mirrored | P1 |

## PC002 — `/account-inactive` — Account inactive / restricted

- **Kind:** detail → battery **DB-01…DB-12**
- **Roles:** authenticated but inactive; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Message, contact support, logout

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC002.1 | Suspended client tries every route | Always redirected here; API 403 | P0 |
| PC002.2 | Reactivated by admin | Next login works | P1 |

## PC003 — `/dashboard` — Client dashboard

- **Kind:** dashboard → battery **DASH-01…DASH-08**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `002_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Metric cards, recent orders, recent invoices card, storage panel, billing restriction banner, role-access banner (client_staff)

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC003.1 | Every KPI equals own data (SQL on own company) | Equal; no other tenant data | P0 |
| PC003.2 | client_staff view hides admin-only cards | Per A-25 | P1 |
| PC003.3 | Billing restriction banner appears only when restricted; no "billing cycle" wording (D-042) | ok | P1 |
| PC003.4 | Currency shown USD only | No SYP (S owner) | P1 |

## PC004 — `/products` — Inventory (products) list

- **Kind:** list → battery **LB-01…LB-24**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `014_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Search, filters, + create, export, row actions (edit/detail), stock columns

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC004.1 | Create product with image (types/size), edit, archive | Own company only; SKU unique per company | P0 |
| PC004.2 | Stock numbers equal admin view for same product | Equal | P1 |
| PC004.3 | Barcode image modal | Prints/zooms | P1 |

## PC005 — `/products/new` — Create product

- **Kind:** form → battery **FB-01…FB-25**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `015_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Name, SKU, barcode, UoM, tracking (lot/expiry), dimensions L×W×H, weight, min stock, description, image upload

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC005.1 | Dimensions optional but explained (needed for storage fee) | Hint visible (A-10) | P0 |
| PC005.2 | Duplicate SKU | Field error | P1 |
| PC005.3 | Image upload edge cases | FB-17 | P1 |

## PC006 — `/products/:id` — Product detail

- **Kind:** detail → battery **DB-01…DB-12**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Info grid, stock by lot/location (client view), image, actions

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC006.1 | Client sees own stock only; no internal location codes beyond what is allowed | A-xx | P0 |
| PC006.2 | Edit/Archive buttons per role | client_staff allowed? (A-25) | P1 |

## PC007 — `/products/:id/edit` — Edit product

- **Kind:** form → battery **FB-01…FB-25**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Same as create, prefilled

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC007.1 | Changing SKU after stock exists | Blocked/warned | P0 |
| PC007.2 | Edit while an order uses it | Allowed fields only | P1 |

## PC008 — `/inbound-orders` — Inbound requests list

- **Kind:** list → battery **LB-01…LB-24**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `010_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Import, Export, + New, status filters, search, row actions (edit/delete before approval)

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC008.1 | Status = admin status; locked after EMDAD approval (B8) | Edit/Delete hidden after lock | P0 |
| PC008.2 | Import template (CSV/xlsx) with instructions | S B16 | P1 |
| PC008.3 | Export columns picker | Matches | P1 |

## PC009 — `/inbound-orders/new` — New inbound request

- **Kind:** form → battery **FB-01…FB-25**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `011_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Expected arrival, lines (product, qty), notes ≤ 500, reference ≤ 100, wizard steps

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC009.1 | Far-future/past dates, notes limits (D-031) | Validation | P0 |
| PC009.2 | Submit → admin notification "Inbound order needs approval" | Delivered | P1 |

## PC010 — `/inbound-orders/:id` — Inbound request detail

- **Kind:** detail → battery **DB-01…DB-12**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Status timeline, lines (expected/received), GRN download (EN/AR) when complete, edit/cancel while pending

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC010.1 | Cancel pending request | Status cancelled; admin sees | P0 |
| PC010.2 | GRN PDF opens EN+AR | Numbers equal admin | P1 |

## PC011 — `/outbound-orders` — Outbound requests list

- **Kind:** list → battery **LB-01…LB-24**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `012_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Export, + New, status filters, search

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC011.1 | Own orders only; columns | tenant | P0 |
| PC011.2 | Create → admin approval flow | status moves | P1 |

## PC012 — `/outbound-orders/new` — New outbound request

- **Kind:** form → battery **FB-01…FB-25**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `013_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Lines from own stock, destination, shipping method, notes

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC012.1 | Qty > available | Blocked with available qty | P0 |
| PC012.2 | Destination address cascade (governorate → city → town) tolerant matching (B11) | ok | P1 |

## PC013 — `/outbound-orders/:id` — Outbound request detail

- **Kind:** detail → battery **DB-01…DB-12**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Status, lines, tracking panel, DN PDF

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC013.1 | Tracking panel shows carrier statuses (Arabic detail like Babel; Sila detailed — A2) | No carrier cost/price breakdown | P0 |
| PC013.2 | DN EN/AR | ok | P1 |

## PC014 — `/outbound-orders/returns` — Outbound returns list

- **Kind:** list → battery **LB-01…LB-24**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `021_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Create return, status filters

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC014.1 | Return only for shipped/delivered quantities | Validation | P0 |

## PC015 — `/outbound-orders/returns/new` — New outbound return

- **Kind:** form → battery **FB-01…FB-25**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `022_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Select order/lines, reason, qty

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC015.1 | Qty ≤ delivered − returned | Rule D-… return-quantity.validation | P0 |

## PC016 — `/outbound-orders/returns/:id` — Outbound return detail

- **Kind:** detail → battery **DB-01…DB-12**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Stages, lines

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC016.1 | Stage progression visible | Matches admin | P0 |

## PC017 — `/ecommerce-orders` — Online (OMS) orders list

- **Kind:** list → battery **LB-01…LB-24**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `003_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Import, Export (modal with columns), + Create, status nav (ClientOmsOrdersStatusNav), filters (store name, dates), search, copy buttons, tracking

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC017.1 | Status chips counts equal list | LB-08 | P0 |
| PC017.2 | Filter by store name + dates (B4) | AND | P1 |
| PC017.3 | Import messy file (B22) + template with dropdown governorate→city→area (B23) | Tolerant; row errors | P1 |
| PC017.4 | Edit/Cancel only before EMDAD confirmation (B8); after: disabled with reason | Server also refuses | P1 |
| PC017.5 | Client never sees carrier cost/margin | DTO scan | P1 |

## PC018 — `/ecommerce-orders/new` — Create online order

- **Kind:** form → battery **FB-01…FB-25**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `004_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Recipient, phone (+963), governorate/city/town cascade + map, address, payment COD/prepaid, COD amount, products lines, notes, wizard

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC018.1 | Company/client selector not applicable (own company) — no "Acme" default bug (B18) | n/a | P0 |
| PC018.2 | Shipping fee preview in USD; destination without fee group → message | S #24 | P1 |
| PC018.3 | Raqqa/Hasakah etc. accepted (B10) | ok | P1 |
| PC018.4 | Double submit | one order | P1 |

## PC019 — `/ecommerce-orders/:id` — Online order detail

- **Kind:** detail → battery **DB-01…DB-12**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Status, recipient, lines, tracking panel + shipment movement panel (carrier detailed statuses), edit/cancel (before confirmation), waybill/print?

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC019.1 | Timeline shows detailed statuses (Sila/Babel) in order | A2 | P0 |
| PC019.2 | Cancel before confirmation → admin sees | sync | P1 |
| PC019.3 | Amounts: COD, shipping fee (USD), no carrier cost | Equals admin | P1 |

## PC020 — `/ecommerce-orders/returns` — Online returns list

- **Kind:** list → battery **LB-01…LB-24**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `005_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Create, filters

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC020.1 | Returns of own orders only | tenant | P0 |

## PC021 — `/ecommerce-orders/returns/new` — New online return

- **Kind:** form → battery **FB-01…FB-25**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `023_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Order select, lines, reason

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC021.1 | Return for delivered order only | Rule | P0 |

## PC022 — `/ecommerce-orders/returns/:id` — Online return detail

- **Kind:** detail → battery **DB-01…DB-12**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Stages (plan/receive/put away), lines

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC022.1 | Received/put-away counts shown (admin page lacks them — V-034) | Counts present | P0 |

## PC023 — `/my-profits` — Cash on delivery / my profits (COD report)

- **Kind:** report → battery **RB-01…RB-14**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `006_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Summary cards (pending, available, paid out), table, export, filters

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC023.1 | Numbers equal admin COD for the same client; USD only | Equal | P0 |
| PC023.2 | Policy-dependent availability visible (A-03) | Explained text | P1 |
| PC023.3 | Client shield hides in-transit gaps (B12) | Hidden | P1 |

## PC024 — `/finances` — Financial account

- **Kind:** dashboard → battery **DASH-01…DASH-08**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `007_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Current/available/pending balance, transactions, statement download, payout request (admin only?)

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC024.1 | Balance = Σ transactions; statement opening+movements=closing | Equal | P0 |
| PC024.2 | Payout request minimum 10 USD, ≤ available | Validation (S) | P1 |
| PC024.3 | Raw category keys not shown | Human labels (V-022 pattern) | P1 |

## PC025 — `/billing` — Billing (client view)

- **Kind:** dashboard → battery **DASH-01…DASH-08**
- **Roles:** client_admin only; others refused
- **Screenshots:** `008_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Billing summary, plan, restriction status

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC025.1 | No cycle wording; on-demand model | D-042 | P0 |
| PC025.2 | client_staff cannot open | 403/redirect | P1 |

## PC026 — `/invoices` — Invoices list

- **Kind:** list → battery **LB-01…LB-24**
- **Roles:** client_admin only; others refused
- **Screenshots:** `009_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Table, export, filters, row → detail

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC026.1 | Only own invoices; statuses | tenant | P0 |
| PC026.2 | Export equals list | ok | P1 |

## PC027 — `/invoices/:id` — Invoice detail (client)

- **Kind:** detail → battery **DB-01…DB-12**
- **Roles:** client_admin only; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Lines: fulfilment (inbound/outbound/OMS), shipping fee, storage, incentive discount, total; PDF

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC027.1 | NO carrier cost, NO margin, NO internal notes (invoice redesign §3) | Absent from DOM and API | P0 |
| PC027.2 | Totals equal admin client-total | Equal | P1 |
| PC027.3 | PDF EN/AR | ok | P1 |

## PC028 — `/billing/invoices/:id` — Invoice detail (alias)

- **Kind:** redirect → battery **RD-01…RD-02**
- **Roles:** client_admin only; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Alias route

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC028.1 | Alias renders same as /invoices/:id | Same content | P0 |

## PC029 — `/sheets` — Sheets (OMS/inbound/outbound sheets)

- **Kind:** form → battery **FB-01…FB-25**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `026_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Fixed dropdown-only fields with search, row grid, submit, "Open in Google Sheets" (hidden/blocked), status, built-in API credentials hidden

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC029.1 | Fields restricted to dropdown values; invalid value impossible even via paste | Server validation | P0 |
| PC029.2 | Rows editable only before admin approval; after approval locked (UI + API + Google Sheet) | S #12/#13 | P1 |
| PC029.3 | Google connect: shows Google 403 until owner adds Test users — BLOCKED(owner) | Documented | P1 |
| PC029.4 | Credentials not visible/deletable by client | Absent in DOM | P1 |

## PC030 — `/apis` — APIs (keys + webhooks + docs)

- **Kind:** settings → battery **SB-01…SB-10**
- **Roles:** client_admin only; others refused
- **Screenshots:** `027_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** API keys list, create, regenerate, revoke, enable/disable, docs link, WebhooksSection (endpoints, secrets, events, test)

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC030.1 | Create key: shown once; regenerate invalidates old; revoke immediate | Works with /v1 endpoints | P0 |
| PC030.2 | Webhook endpoint https only; signature; test delivery; retries | S #14 | P1 |
| PC030.3 | client_staff cannot see page | RBAC | P1 |
| PC030.4 | Docs page per scope renders examples with correct base URL | ok | P1 |

## PC031 — `/notifications` — Notifications (client)

- **Kind:** list → battery **LB-01…LB-24**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `028_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** All/unread/read, mark read

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC031.1 | Notifications about own orders only | tenant | P0 |
| PC031.2 | No legacy billing-cycle notices | A-07 | P1 |

## PC032 — `/profile` — Profile (client)

- **Kind:** form → battery **FB-01…FB-25**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** `029_*.png` ×4 devices
- **Elements expected (from source/requirements; verify against screenshots):** Photo, name, password change, language/theme, (Google link hidden)

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC032.1 | Change password rules | FB | P0 |
| PC032.2 | Avatar upload/remove | FB-17 | P1 |

## PC033 — `/cod-reports` — Alias → /my-profits

- **Kind:** redirect → battery **RD-01…RD-02**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Redirect

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC033.1 | Lands on /my-profits | RD-01 | P0 |

## PC034 — `/returns` — Alias → /ecommerce-orders/returns

- **Kind:** redirect → battery **RD-01…RD-02**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Redirect

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC034.1 | Lands correctly; /returns/new, /returns/:id too | RD-01 | P0 |

## PC035 — `/returns/new` — Alias → /ecommerce-orders/returns/new

- **Kind:** redirect → battery **RD-01…RD-02**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Redirect

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC035.1 | Lands on the new online return form | RD-01 | P0 |

## PC036 — `/returns/:id` — Legacy return redirect (LegacyReturnRedirect)

- **Kind:** redirect → battery **RD-01…RD-02**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** Redirect decides online vs outbound return by id

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC036.1 | Id of an online return and of an outbound return each land on the right detail page; unknown id → 404 | RD-01 | P0 |

## PC037 — `*` — Not found page

- **Kind:** detail → battery **DB-01…DB-12**
- **Roles:** client_admin, client_staff; others refused
- **Screenshots:** pending (needs client session)
- **Elements expected (from source/requirements; verify against screenshots):** NotFoundPage

| ID | Page-specific case | Expected | Pri |
|---|---|---|---|
| PC037.1 | Unknown URL shows branded 404 with link home (and unauthenticated → /login) | No blank page | P0 |

---

## Client states/modals to capture

- Order import modal (`ClientOrderImportModal`): choose file, errors list, success summary
- Export modal (`ClientOmsOrdersExportModal`): column picker
- Barcode image modal
- Confirm dialogs: cancel order, delete inbound, revoke API key, regenerate key, delete webhook
- Wizard steps (`ClientWizardSteps`) of each create form
- Empty states for every list; error 403/404/500; session-expired; billing-restricted banner on every page; app-update modal
- Role switch: same pages as `client_staff` (hidden nav items: APIs, Billing, Invoices)

