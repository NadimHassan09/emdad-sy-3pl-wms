# Raw visual observations while capturing (working notes → feed 09-visual / 08-UAT plans)
- Tablet 820px: sidebar stays fully expanded (~31% of width) → every table is clipped (products shows 2 of 6 columns; locations Action column cut).
- /products: "Scan barcode" control is a very wide bar with icon only, no label (all devices).
- /warehouses mobile: Actions buttons clipped ("Locatio", "Deactiv"), need horizontal scroll; Previous/Next rendered full-width & oversized.
- /inventory/stock mobile+tablet: product name column wraps to 4-5 lines because columns are too narrow.
- Label inconsistency: "Reset" (/locations) vs "Reset filters" (/warehouses, /inventory).
- Status badge casing inconsistent: "Active" (/locations, /products) vs "active" (/warehouses).
- /warehouses: country shown as "Syr"/"EG"/"SA" (mixed formats), city "—".
- /orders/inbound tablet+mobile: order number wraps onto 3 lines ("INB-/2026-/00063") — column too narrow, should be nowrap.
- /inventory/adjustments: "Adjustment id" shows raw UUID (not a human code) and the search field is a UUID box; mobile wraps the UUID on 4 lines.
- /inventory/ledger mobile/tablet: Arabic product names wrap one word per line.
- /orders/inbound: test row with expected arrival 1/1/2999 (date upper-bound validation missing?).
- /orders/oms status card reads "Field Delivery" — likely typo for "Failed Delivery".
- /orders/outbound tablet+mobile: rows become extremely tall (≈110px each) because a hidden/overflowing Destination column still wraps; only 2-4 rows visible per screen.
- /orders/outbound: "Bulk Shipping Processing" button permanently disabled-looking with no hint why.
- /orders/oms laptop: order number wraps in 2 lines, carrier badge clipped; table needs horizontal scroll at 1366.
- /orders/oms/new: map tile shows grey seams/lines between tiles (Leaflet tile gap) on desktop/laptop.
- /orders/oms/new: "Street / Detailed Address **" double asterisk.
- /oms/cod and /oms/returns and /returns: status summary cards show "—" instead of counts (only "All" has a number).
- /returns (super admin): banner "Select a tenant company to list returns." but no company selector on the page; desktop/tablet show endless skeleton rows with "0-0 of 0", mobile shows "No returns found." (inconsistent states); "+ New return" looks disabled.
- /internal: "FROM → TO" column renders "— → —" on 3 lines (empty locations); Ref shows truncated UUID.
- /cycle-count/my-tasks as admin: developer-ish instruction text ("so /auth/me includes workerId").
- /cycle-count mobile: empty-state text clipped by horizontal scroll.
- /contracts/grn + /dn: tablet/mobile PDF buttons clipped off-screen; statuses "Partial"/"Pending/Not generated" need meaning check (UAT).
- Reports: 19 report tabs wrap into 2-3 rows on desktop/laptop and 7 rows on mobile (push content below the fold); "Server-side reporting / Paginated preview and export — no bulk client fetch." is developer wording shown to end users; Export buttons disabled until Generate (no hint).
- /oms/cod mobile: three full-width Export buttons stacked (takes a third of the screen).
- Finance pages (/finance/*): page-title icon is an empty pale-green square (icon missing) on all devices.
- /finance/overview + /finance/accounts: Pending COD shown with "$" although underlying records are SYP (Madino 85000 SYP COD appears as "$85000.00", total "$102,144.00") → currency-mixing logic/display issue (UAT + system test).
- /finance/overview: "Legacy cycle invoicing disabled on staging cutover" and tab "Legacy Billing" = internal wording shown to user.
- /finance/accounts: status badges lowercase ("active", "restricted"); two clients with identical name "Valid Co Check".
- /finance/transactions: Category shown raw lowercase ("cod credit", "manual adjustment"); Reference shows raw internal keys ("oms_order: 0f191f12-ffc", "manual_adjustment:"); date format differs from other pages (no seconds, 24h vs 12h).
- /finance/transactions tablet: Export buttons overlap the title block.
- /forms: phone formats inconsistent (data), Arabic message truncated with leading "..." on the wrong side (RTL ellipsis).
- /finance/carrier-costs: "Pending Quote" as cost for shipments already created; "Cost source" raw key "api_estimate"; provider code shown raw (SILA_SY); AWB for Sila is a UUID; 337 rows with no pagination control visible (check).
- /finance/float: subtitle starts with internal ticket id "B12 —"; provider code is free text (should be a dropdown of carriers); "Run reconciliation" disabled with no reason next to it.
- /finance/policies: headings contain internal ticket ids ("B12 — …", "B15 — …"); "Architectural Rule:" wording; "Deactivate Cutover" is a dangerous action styled as neutral button (needs confirm — test).
- /users/custom-roles: subtitle "O-11 — …" internal id; permission chips are lowercase raw keys ("oms · read") with "Denied" badge — not obvious they are clickable toggles; only 6 modules listed (billing, reports, shipping, returns, cycle count, settings missing?) → UAT logic question.
- /billing/* : billing sub-nav shows only Dashboard/Plans/Invoices — Templates and Charge rules pages have no tab (reachable only by buttons) → navigation consistency.
- /billing/plans/new: Cancel (red) + Create plan placed top-right far from the form; numeric fields default "0" (user must delete 0 before typing — same class of friction as the dropdown-search issue).
- /billing/templates: "Reset"/"Apply" vs "Reset filters"/"Apply filters" elsewhere; title icon present here but missing on finance pages.
- /billing/invoices: amount shown as "205 USD" while finance uses "$205.00" (currency format inconsistency); status "Draft" has no badge style while others do; hint "Click a row to view invoice details." 
- /billing/invoices/on-demand: Preview/Calculate storage/Check incentive disabled until client chosen (no hint).
- /billing/dashboard: legacy "billing cycle expiring" widgets shown although legacy cycles are disabled by cutover → logic consistency (UAT).
- /users/client_users: "Worker profile" column shown for client users (always "—", irrelevant column); phone formats inconsistent.
- /audit-logs: flooded with "AUTH REFRESH REPLAY IDEMPOTENT" rows every ~15 min (noise hides real actions; possible repeated token-refresh calls → performance/system check); technical retention line "Query window default 30d · Count cap 10,000" shown to user; actor shows email twice.
- /notifications: "billing cycle expiring" notifications still generated although legacy cycles are disabled (logic); timestamps mix relative ("3d ago") and absolute formats.
- /profile: read-only field "AUTH GROUP: Admin" is internal wording; dark empty banner above the photo card.
- /backups/google-drive and /backups/google-oauth-settings render the plain Backups overview (route hidden/redirected since Google UI is hidden) — confirm direct URL behaviour (should 404 or redirect with message).
- /backups health: banner "Healthy" while "Recent health monitoring events" lists a CRITICAL "stale_successful_backup" event (92.7h) — contradictory until alerts refresh; Activity feed shows raw event keys ("backup.health.critical") and actor email eng.yousef@emdadsy.com (check it is a real user).
- /backups retention: red "Run local retention cleanup" is destructive — test confirm dialog. Manual cooldown is 1 minute (default says 15).
- /backups mobile+tablet: header action buttons (Restore/Factory Reset/Upload/Create Backup) overlap the tabs row ("Scheduled Backups" is covered) — real overlap bug.
- /backups: "Factory Reset" is adjacent to Restore/Upload with same size — danger of misclick; needs confirm + typed phrase (test).
- /shipping/companies: page has no H1 title — only a green "Shipping Fee Rate" breadcrumb-like link at top (wrong label for this page); sections stacked in one long page with no anchors; Exchange-rate "Manual rate 120" while active rate is 130.01 (automatic) — unclear which wins; "Active rate 130.01 new SYP = 13,001 old SYP" wording heavy.
- /shipping/fee-rates: "group 1" Inactive group with no destinations and "حلب" group with "No destinations" but Active → empty active groups (UAT logic); action icons (✎ ▶ ⏸) are icon-only with no label/tooltip check; tablet: Base-rate/Weight columns clipped; mobile: table clipped.
- /products/:sku (detail) — header shows product name twice (page title + card title); "Stock health —" and "Dimensions —" empty with "Min stock threshold: Not configured" (dimension absent blocks the new storage-fee calculation → UAT/system link); no Edit/Archive buttons visible for admin on detail.
- /orders/inbound/:id — tablet/mobile "Print instructions" button wraps above the card; "Expected arrival" shown before "Created" in mobile but after on desktop (field order differs per breakpoint).
- /orders/outbound/:id — "Shipping company: SILA_SY" raw code; status chip "Waiting for Shipping Details" text; green banner + "Mark Shipping Details as Complete" button is the main CTA but sits far right on desktop.
- /orders/oms/:id — title reads "OMS OMS-2026-03729" (prefix duplicated); tablet truncates title to "OMS OMS..."; "Warehouse status: waiting_for_shipping_details" raw enum shown to user; header action row has 5 buttons (Waybill / Cancel Shipment / Cancel order / Edit shipping fee / Open outbound) wrapping to 2 rows on tablet/mobile; "Cancel order" (solid red) next to "Cancel Shipment" (outline red) — two similarly named destructive actions; Carrier "مرسال" with tracking 100554961267 while linked outbound says SILA_SY with a UUID AWB (data inconsistency to verify in system test).
- /orders/oms/:id — Pricing card: "Client shipping rate 5 USD [Edit]", "Carrier quote 3.5 USD", "Actual carrier cost 3.5 USD" visible → verify client view hides carrier cost; Edit control only on client rate (carrier-cost edit expected from Sprint 1 invoice redesign).
- /orders/oms/:id/waybill — good: bilingual 10x15cm label with 2 QR codes; checks: sender block says "Test" (client company) not the warehouse pickup contact "مستودعات إمداد" configured in Shipping Companies (UAT: which is the correct sender?); "معتمد من مرسال" badge wording; English/PDF/Print controls present (test each); tablet/mobile toolbar wraps to 2 rows.
- /oms/batches/:id — page title BATCH-1015 with 3 stacked summary rows (5+7+8 chips) → dense; "Issues 1" while batch is healthy-looking (Progress 0/1) → needs definition; Shipping cost block shows "SYP quotes 0 SYP / USD quotes $1.90 / Total (SYP) 24,702 SYP" (mixed currencies on the same card; owner rule: USD inside EMDAD, SYP only toward carriers) ; "Exchange rate used: 1 USD = 13,001.072 SYP" uses OLD-SYP scale while the settings page shows 1 USD = 130.01 new SYP — unit mismatch risk (system test X07).
- /oms/batches/:id — bulk action bar has 4 red/green primary buttons + 4 outline buttons in one row; "Cancel (1)" and "Cancel Shipments (1)" both red and adjacent.
- /oms/returns/:id — status "Return Received" while the line shows Received "–" and Put away "–" (counts missing) → logic/UX inconsistency; two Rollback buttons ("Rollback to Out for Delivery", "Rollback to Ready to Ship") placed top-right without confirm hint; status chip duplicated (header + details).
- /clients/:id — detail page is read-only: no Edit / Suspend / Contract / Users / Plan shortcuts (UAT: how does admin edit a client from here?); Billing field shows "monthly · 30 days" although cycle billing was retired by the on-demand model (stale wording); country "SA" / city "Riyadh" for Acme vs Syria operations (test data).
- /billing/invoices/:id — redesigned order tables present (Inbound 8 / OMS 2) with Carrier cost + Margin columns visible to admin; cancelled invoice still shows "Edit invoice" button (should a cancelled invoice be editable? business rule to confirm); "Payment status: Cancelled" duplicates the status chip; carrier cost "—" for a delivered OMS order (OMS-2026-03720) → verify source; no storage / incentive / grand-total blocks visible on this invoice (check on a non-cancelled one).
- /inventory/adjustments/:id — "Adjustment ID" is a raw UUID and "Lot ID" is a raw UUID (should show lot code); movement type "Adjustments" (plural) as value; reason "QA restore test stock to 5" ok; mobile lines table clipped.
- /tasks/:id (task detail) — DEFECT CANDIDATE: page shows only "Assigned worker: — / Assign worker / Start"; no task type, order, lines, status, location, timestamps (page looks empty/half-rendered at every breakpoint). Test must open a pick, pack, putaway, receiving and count task and verify content for each.
- /locations/:warehouseId — header "10 location(s)" but table "1-8 of 8 locations" (10 vs 8 mismatch — child locations under "Aisle A" are collapsed; confirm count semantics); title shows "(WH-001)" twice (header + breadcrumb "WH-001 (Emdad Logistics Warehouse )" with stray space before ")"); "+ + New location" doubled plus sign; tablet/mobile table clipped; Reset red / Apply green colour semantics (Reset is not destructive — red means delete/cancel per owner rule → colour misuse, appears on every filter bar).
- /users/warehouse_users/:id with a client user's id (negative route) — shows red banner "This user does not belong on this list." but still renders the person's name/email in the header (information shown for a user from another list) → tenant/role leakage check (SEC).
## Client portal
- /login (client) — mobile 390: login card is wider than the viewport (right edge clipped, language chip "العربية" clipped at top-right) → V-048; email/password are browser-autofilled (note for tests: clear before AUTH tests); desktop/laptop fine; "Remember me for 30 days" toggle default off.
- /dashboard (client) — "Billing cycle expiring in 3/7 d" items in "Orders needing attention" although cycles are retired (V-049); client sees "Current obligation 230 USD" (red) and COD 101 USD pending; Reset Filters red (same as admin); mobile OK; tablet keeps full sidebar like admin.
- /ecommerce-orders (client) — status card still "Field Delivery" (should be Failed Delivery); order number wraps on tablet/mobile; counts all numeric here (unlike admin COD chips).
- /ecommerce-orders/new — fields: recipient, +963 phone, governorate/city/town, street, map with big blue circle overlay (radius 1 km?), ship date prefilled today, payment method "—"; no client select (good). 
- /ecommerce-orders/returns — status chips Requested/Approved/In progress/Completed/Rejected show "—" instead of counts (same as admin V-013); date inputs use browser mm/dd/yyyy; mobile table clipped; Export Excel + Create return.
- /my-profits (client "Cash on delivery") — page title "Cash on delivery" but route/name "my-profits"; chips 46 / Pending 39 / Collected 0 / Remitted 7 / Settled 7 / Returned 0 (chip set differs from admin COD: Pending/Available/Paid out/Returned) → terminology mismatch admin vs client (V-050); "Total COD amount 15141 USD" without thousands separator/$ format; "Filter by date" filter bar has no inputs visible (empty) at all sizes.
- /finances — all balances $0.00 while COD pending 101 USD on dashboard and 39 pending COD orders → account page vs COD page disagree (V-051, S2?); "Request Payout" button disabled-looking (pale) with no reason; date inputs mm/dd/yyyy native; tabs Account Statement / Payout Requests / COD Movements.
- /billing — still shows "Monthly Plan, Billing cycle: Monthly, Next billing —, Orders this billing cycle" although cycles retired (V-052); "Capacity 100 m³", donut "Used 0.02 m³ / Remaining 99.98 m³"; "Included features" chips; billing is client_admin only.
- /invoices — statuses Draft/Pending/Paid/Cancelled chips; client sees **Draft** invoice INV-2026-00022 (drafts are internal in the admin redesign — should clients see drafts?) (V-053); date format "Oct 13, 2026"; "Payment status Pending"; amount column right aligned; tablet/mobile columns clipped (Due date/Amount partly off-screen).
- /inbound-orders (client) — chips "Waiting for approval / In progress / Completed / Cancelled" all "—" (only All=10) (V-013 class); list contains cancelled order with 0 lines; checkbox column present but no bulk action visible; tablet/mobile order number wraps 3 lines.
- /inbound-orders/new — simple form (arrival date, notes, product + quantity "Select a product first", trash, +); Cancel is red, Submit green; no reference field although API has reference ≤100 (D-031) — verify; on desktop the product row layout leaves large empty right area (narrow centered column).
- /outbound-orders — chips "—" except All 42; statuses show only "In progress"/"Shipped" (admin has 9 statuses) → client mapping coarse; recipient column; tablet columns clipped (Required ship / Lines cut).
- /outbound-orders/new — fields: Destination* (free text input, no address cascade!), Required ship date, Carrier (free text, disabled-looking grey) → inconsistent with OMS order form; destination as plain text may be unusable for carriers (V-054, S3).
- /products (client "Inventory") — page title "Inventory", nav "Inventory", route /products; 3 products only; chips In stock 2 / Low 0 / Out 1; "test product" shows on hand 10,000 vs available 8,992 / reserved 8 (reserved 8 + 1,000 other?) → verify availability formula (A?); "s23 ultra" out of stock; tablet table clipped (On hand column cut); row ⋯ menu.
- /products/new — Name*, SKU + Generate, Barcode + Generate, Description, UoM, inventory mode cards FIFO/FEFO (FEFO described "Recommended for products with expiration dates"); **no dimension / weight / min stock fields** at create → storage-fee needs dimensions but client cannot enter them (V-055, S2 for billing feature; admin can?); Cancel red.
- /products/:id — detail shows Available 9,992 / Reserved 8 / Total on hand 10,000, identity card (SKU, barcode, UoM, expiry tracking), "Dimensions & weight" card shows only Min stock threshold 0 units + Weight 1 kg + created/updated (no L×W×H); no Edit button visible on the page itself (Edit reachable by URL /edit); mobile OK.
- /products/:id/edit — only name, description, photo, min stock threshold editable (SKU/barcode/UoM locked); "Save" has check icon, "Cancel" plain → inconsistent button styles vs create.
- /inbound-orders/:id — detail ok: Order details, Line items Expected/Received (10,000/10,000), no GRN download card visible although completed (E2E to verify) (V-056); tablet/mobile table clipped.
- /outbound-orders/:id — shows Destination (Arabic), lines requested/picked; **no tracking/carrier/waybill info**, no DN download; status chip "In progress" (OUT-2026-04462 is a completed ship in admin?) → status mapping coarse (V-057).
- /ecommerce-orders/:id — order tracking stepper (Waiting for confirmation → Confirmed → Processing → Ready to ship → Out for delivery → Delivered) + timeline ("oms created", "order waiting_for_confirmation", "oms confirmed" raw event keys, V-058) + "Cancel order" red button; Pricing & COD shows shipping fee 5 USD, subtotal 15 USD, COD status pending; "Address" has Arabic word only; district shows "أريحا"? ; Created date 11/7/2026; no carrier cost (good).
- /outbound-orders/returns — empty state "No returns yet" + CTA; chips Pending/Receiving/Completed/Cancelled "—"; Create return top-right and CTA duplicated.
- /outbound-orders/returns/new and /ecommerce-orders/returns/new — identical forms (Linked order*, reason, products); "Create return" button pale/disabled with no reason until valid; Cancel plain; the "Back" link goes to "/returns"; on desktop form column narrow (centered 600px) leaving empty sides — fine.
- /ecommerce-orders/returns/:id — OR-2026-00455 Completed: line Expected 10, Received "—", status "completed" → completed but received "—" (same defect pattern as admin V-034); notes "—"; created 10/24/2026 mm/dd; tablet/mobile table clipped (Status column cut).
- /invoices/:id (client INV-2026-00022 Draft) — sections Summary, Billing plan snapshot (Fixed subscription fee 10 USD, Reserved volume 100 m³), Line items (Fixed subscription 10 USD, Subtotal 20? "Grand total 20 USD" while only 10 shown?), Payment information, Invoice timeline; **client sees cycle-era invoice (plan snapshot)**, no order tables/shipping/storage lines (the new on-demand client view from the redesign spec is not visible here — pre-redesign invoice) (V-059); Draft invoice visible to client; "Print" button.
- /sheets (client) — tabs Delivery orders (OMS) / Inbound / Outbound; spreadsheet grid with inline edit (order, ship date, recipient, phone, governorate, city, neighbourhood, street, payment, product SKU×qty), toolbar Search / + Add row / Save changes (0) / Reload, info banner "Edit orders here until the warehouse approves them…"; rows show per-order status text ("confirmed waiting for admin approval"), Cancel order / Delete buttons on rows; **orders after approval still listed with "Cancel order"** (locked state needs verification); grid is very dense — columns clipped on laptop/tablet, mobile shows only first 2 columns; SKU column shows raw SKU codes; no Google button visible (hidden as intended).
- /apis — table Name/Type/Status/Created/Last used/Key (masked prefix) + actions (Download documentation, Regenerate secret, Disable, Revoke); 4 keys (out, in, oms, shopify Revoked); Webhooks section (address input + Add, "No webhook addresses yet"); key names are lowercase codes; created dates Aug 2026; Create API button; action link row has no icons — 4 text links wrap on tablet/mobile (clipped on mobile: Actions column not visible) (V-060).
- /notifications (client) — 60 unread; list dominated by "Billing cycle expiring in N days / Your billing cycle ends on 12 Nov 2026" and "Account renewed … billing cycle has been renewed" → retired-cycle messages still sent to clients (V-043 confirmed on client side); "Invoice overdue … Please contact Finance" for INV-2026-00016; tabs All / Unread 60 / Read; Mark all read.
- /profile (client) — black empty banner above photo card (same as admin V-029), cards NAME/EMAIL/ROLE/COMPANY, Personal details (full name), Change password; no language/theme/Google options here; password fields on one column; fine on mobile.
- NotFound (client) — "Page not found. This link is not part of the Client Portal. Return to the dashboard…" good; works on all devices.
## Modals (admin)
- New user modal: Email*, Full name*, Phone, Password* ("Minimum 8 characters"), System role (Worker default); role select shows only Worker/…; Cancel red/Create green; mobile fits.
- New company modal: Country defaults **SY** (OK) but is a free-text box with helper "ISO code or country name"; warehouse modal uses a select defaulting to SA → inconsistent controls for same concept (V-066); scrollable body on laptop/mobile, sticky footer ok.
- Manual adjustment modal (finance): Client select "Mr Jad (Avail: $17.00)", Type "Credit (Increase Balance)", Amount (USD) 0.00 placeholder, Mandatory reason; **Cancel is white here but red in other modals** (V-067 inconsistency); title "Create Manual Financial Adjustment"; on mobile type select text truncated ("Credit (Increase Balan").
- New warehouse modal re-captured at 4 widths: Country default **Saudi Arabia (SA)** confirmed (V-064).
- Scan QR modal: raw camera error text, manual input fallback, Done button.
- Create backup modal: explanatory text + optional label; Cancel red; fine.
- Factory reset modal: good safety pattern — danger banner, "Create pre-reset snapshot" checked by default, must type FACTORY RESET, button disabled until typed; verify typed phrase is case-sensitive and server also enforces (SEC-BIZ-012). Never executed.
- Error state /orders/oms/<unknown uuid>: red banner "Could not load OMS order." + "Back to OMS orders"; plain, no hint (404 vs 500 not distinguished) (V-068, S4); good: no stack trace.
- /orders/<uuid> (unknown top route) silently redirects to dashboard (RoleHomeRedirect) — no 404 page in admin, unlike the client portal which has a branded "Page not found" (V-069, S3). Captured desktop only; mobile showed "Loading…".
- Quick-jump (Ctrl+K) with no match shows "No matching pages" — fine (seen on all widths; typed into top search instead of list search).
- Filtered-empty state of the OMS list itself was not captured (typing hit the quick-jump box); re-do in phase 3 with the list search field selector.
- /orders/oms empty-search state: table body "No OMS orders match the filters."; all 11 status cards drop to 0 and "Filters: Search: zzzzqqqq-nomatch" caption appears (good); but "All statuses 0" counters change with the search (cards reflect filter, not global) — note for LB-08. Filter state persists in localStorage (wms.listUi.*) — Reset clears it.
- OMS list with 1 row selected: bulk bar "1 selected" with Create batch / Add to existing batch / Edit Shipping Fee / Confirm Shipping (1) / Complete Dispatch (1) / Cancel Shipments (1) / Cancel All (1) / Download waybills (1) / Print waybills / Clear selection — 10 controls in one bar, two red outlined cancels adjacent (V-034/UX-13); on laptop the bar is below the 600px fold; tablet wraps in 3 rows, mobile 2 rows + more below.
- Create batch modal: green summary "1 orders selected" (grammar: "1 orders"), 3 counters (Eligible / With issues / Already finished), optional Batch name, Cancel/Create batch (green). Not submitted.
- Edit Shipping Fee modal (bulk bar): purple info box "Manual Fee Override: modifies the client-facing shipping fee… does NOT alter carrier costs, carrier tracking, or order statuses"; order number + client; Current fee 5.00 USD; New Fee (USD)* input (prefilled "5"? shows "$"); Difference 0.00 USD; Adjustment reason (optional); Cancel/Save Fee. Reason optional here, while carrier-cost correction spec makes it audited → decide mandatory (A-xx). Title has mixed colours (blue "Shipping Fee").
- Confirm "Cancel 1 order(s)?": text "All selected cancellable orders (1) will be marked cancelled." buttons **Cancel orders (red) / Keep orders (green)** — correct semantics but "Cancel orders" label next to dialog title "Cancel…" is ambiguous; no mention of reservation release / carrier shipment / COD effects (UX-05).
- Not opened on purpose: Confirm Shipping / Complete Dispatch / Cancel Shipments (bulk shipping modal fires PATCH shipping-details on open per D-009 and quotes carriers; needs owner-approved test order) → phase 3 with approval.
## Arabic / RTL (admin, super_admin)
- Layout mirrors correctly (sidebar right, text right-aligned, charts keep LTR axes); greeting "مساء الخير, Nadim" mixes Latin name — fine.
- **Untranslated strings in AR:** OMS Orders page title "OMS Orders" and subtitle "Manage ecommerce and OMS fulfillment orders." stay English; tab names partly Arabic ("لوحة OMS", "طلبات OMS", "COD", "مرتجعات OMS"); "Create OMS Order" is Arabic but "Import/Export CSV" show "استيراد / تصدير CSV"; status chip "Field Delivery" translated as "فشل التسليم" (correct) while EN says Field (confirms typo is EN-only).
- Dashboard: chart date axis labels stay English (Oct 18 … Nov 9) and "Last updated less than a minute ago" translated; KPI cards "$0" currency left; tablet 820 sidebar full width on the right squeezes content (V-044 again).
- OMS table in RTL: column order reversed correctly; order number cell still LTR; phone numbers show "+963…" with trailing dash glyph; checkbox column now on the right.
## Dark theme (admin)
- Dashboard + OMS list readable in dark; tokens consistent. **Finance → Client accounts table stays a white island inside the dark page** (desktop and mobile) — dark-mode defect V-070 (not filed as image; re-capture in phase 3).
- Dark: status cards keep tinted borders; Reset red/Apply green unchanged.

## Round 4 — admin dynamic routes (105–122)
Ids used (read-only unless noted):
- A1 inbound edit: dab51dee… / INB-2026-00053 pending_approval → 105
- A2 outbound edit: 67478f86… / OUT-2026-01321 pending_approval → 106
- A3 COD: 5477f590… / OMS-2026-03682 Available USD 17 (order cancelled) → 107; status dropdown present (not clicked)
- A4 OMS return edit: 87ab5a55… / OR-2026-00447 requested → 108; Warehouse/Dock/Putaway/Notes/Save plan/Cancel
- A5 putaway execute: fe3b5a72… in_progress → 109 (URL /execute redirects to /tasks/:id); Start still visible; Scan destination bin; Complete putaway
- A5 pick 642c654e… pending → 110 empty body (V-078); pack 482546b9… → 111 same
- A6 cycle-count: SKIPPED no sessions
- A7 WMS return: 91ef2a61… / RTN-2026-00453 completed Acme → 112 detail; 113 process (banner only)
- A8 product stock: b5414bd7… AIRCOOLING1 Mr Jad qty 75 → 114; tabs Overview/Inventory/Locations/Lots/Logs/Stock Movement; View stock movement / Inventory details
- A9 ledger line d4ce27be… → 115; ref return_order/709bce15… → 116 (UUID in title)
- A10 plan WorkerTest Co ae0c5041… → 117 detail Renew/Edit; 118 edit Custom + zeros 0 + auto-renew (not saved)
- A11 client user 453409f1… test@emdad.com Client admin Mr Jad → 119 (no Edit/Deactivate buttons visible on this page — note)
- A12 wh user 357e9a68… Yousef Samarli Worker Linked receiver/picker/packer → 120; Update profile; Profile UUID shown
- A13 draft INV-2026-00024 Noviara → 121 Issue/Cancel/Download PDF/Calculate storage/Check incentive; unpaid INV-2026-00025 Test company → 122 Mark as paid/Edit invoice/Deduct; grand total $0 vs subscription line (V-083)
- Interactive: iframe device capture via #qa-cap-frame at 1920/1366/820/390; JPEG→PNG normalize

## Round 4 — A14 OMS statuses + A16 batch (123–130)
Button sets observed (do not click carriers):
- ready_to_ship OMS-2026-03729: Waybill, Cancel Shipment, Cancel order, Edit shipping fee, Open outbound; carrier مرسال + tracking; warehouse waiting_for_shipping_details (desync note)
- delivered TEST-ORD-… Madino: Revert delivery, Edit shipping fee, Create return; 0 line items; Babel Express
- cancelled OMS-2026-03725: Undo Cancel, Edit shipping fee, Delete; notes long "x" string
- failed_delivery OMS-2026-03305 UI "Field Delivery": Out for delivery, Mark delivered, Return pending receipt, Create return, Open outbound; return OR-2026-00450 cancelled
- returned OMS-2026-03720 "Return Received": Rollback OFD / Ready to ship, Undo confirmed return; carrier شركة سينا TEST-261103-…
- waiting OMS-2026-03718: Confirm / Reject / Cancel / Edit / Edit fee
- out_for_delivery OMS-2026-03603 (DB shipped): Mark delivered, Field Delivery, Cancel, Create return
- BATCH-1013: 6 orders, Issues 3, Babel 3 / كرم 2 / Unassigned 1; bulk bar Shipping details/Confirm/OFD/… — photographed only, no carrier actions

## Round 4 — A15/A18 (131–134)
- INB-2026-00063 completed: Print instructions; GRN-2026-00026 Open PDF EN/AR
- OUT-SENA-TEST-… delivered Madino: SENA_EXPRESS AWB TEST-261031-…; 0 line items (V-089 candidate)
- GRN EN PDF viewer: barcode, lot LOT-20261103-SWQN, signatures
- Waybill OMS-2026-03729: 10×15, EN, Mersal AWB 100554961267, COD 20 / fee 5; unlabeled icon button opens waybill (a11y)

## Round 4 — §3 modals batch (135–143)
- 135 warehouses Edit WH-001 modal (Cancel only): Code/Name/City/Country/Address/Active; Cancel red / Save
- 136 locations New location WH-001: Parent/Name/Type=Storage/Barcode/Max weight/volume; Cancel/Create
- 137 warehouses Deactivate confirm WH-003 TEST warehouse I-7 (Cancel only)
- 138 adjustments New modal: Client + Reason; Next disabled until filled
- 139 adjustments row ⋯ Draft Acme: Edit / Delete (red); Approved rows menu sparse; portal menus captured on desktop viewport (tablet/mobile copy)
- 140 internal Create transfer: Client optional, Find product, Source/Dest location+scan, Qty; Create disabled empty; Source placeholder bug (V-092); list From→To dashes (V-093)
- 141 OMS Import: Client company, Download template, Choose File, Close/Import (no upload)
- 142 OMS Advanced Filtering open: Order ID, Start/End No., Client, Customer, Phone, City, Shipping payer, Created from/to, Carrier, Total/Cost ≥0
- 143 OMS Confirm by QR: camera NotFoundError raw message (V-094); Retry camera; manual order# + Record; Done
- Interactive inventory: New location fields; Deactivate confirm; adjustment wizard step1; internal transfer scans; OMS import/filters/QR

## Round 4 — §3 continued (144–149)
- 144 cycle-count Count sessions empty: "No cycle counts for this warehouse."; no Create button (V-095)
- 145 Product schedule empty: Overdue only filter; "No product count history yet."
- 146 inbound Import modal: Client + Download template + Choose File (no upload)
- 147 backups Restore dialog: warnings, Choose backup, pre-snapshot checked, type RESTORE; Cancel only
- 148 shipping companies scrolled to Sena/Fatih/Sila cards (live carriers photographed only — no Test/Disconnect on them)
- 149 Sena Test connection exercised: Last test updated to ~11/14 evening ok; no toast visible in shot
- Baseline FX note (read-only): Manual rate 120 SYP/USD; pickup مستودعات إمداد / حلب الشيخ نجار (not changed)
- Inbound expected 1/1/2999 on cancelled row (V-096)

## Round 4 — COD (150–152)
- 150 COD with 1 Sena row selected: Set 1 selected enabled; status cards — counts (V-097)
- 151 after Set Available on already-Available OMS-SENA-TEST-…COD: toast "Updated 1." no confirm (V-098); no status change
- 152 Pending by QR modal: same camera NotFoundError + manual entry; Done
- Records touched: COD OMS-SENA-TEST-1793439374704-COD Set→Available (noop)

## Round 4 — Finance adjust (153–155)
- 153 Adjust modal Test company: Credit/Debit, Amount USD default 0.00, reason required; Cancel white (V-067 related)
- 154 Credit $0.01 QA-TEST ORDER round4 credit → balance $0.01
- 155 Debit $0.01 QA-TEST ORDER round4 debit → balance back $0.00
- Pending COD $ with SYP amounts (V-099); duplicated client names (V-100)

## Round 4 — Global chrome (156–159)
- 156 notifications bell: Invoice overdue + Billing cycle expiring; Mark all read / View all; badge 51
- 157 user menu: EN/AR language toggle, Profile, Sign out (red)
- 158 Ctrl+K / Quick jump typed "ord" with results
- 159 sidebar collapsed (icons only) then re-expanded
- Dashboard Ready count inconsistency noted (V-101)

## Round 4 — OMS returns modals (160–161)
- 160 Create OMS return: Reason optional, order search, +Add Order/Import CSV/Download Template, Confirm (0 lines) disabled empty
- 161 Express Return: similar add-orders flow, Confirm (0 orders); Cancel
- Status cards Pending/Received/… show — like COD (same class as V-097)
