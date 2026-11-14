# 16 — Defect candidates observed while capturing the screenshots (14 Nov 2026)

Source: admin portal, staging, logged in as super admin, 88 pages × 4 devices (screenshots `001`–`088`), plus element inventories read from the DOM. **Nothing here is confirmed** — each item must be reproduced by the test named in the last column. Severity is a *guess* (S1 data/money wrong · S2 feature broken · S3 misleading · S4 cosmetic). The raw working notes are in `screenshots/visual-notes.md`.

Legend for device columns: D desktop · L laptop · T tablet (820) · M mobile (390).

| ID | Page(s) / screenshot | Observation | Dev | Sev? | Confirm by |
|---|---|---|---|---|---|
| V-001 | `/dashboard/overview` (001) | Loaded fine; widgets present. Check numbers vs source; "Restore" button on a widget has no label context. | all | S4 | PA001.1 |
| V-002 | `/products` (002) | "Scan barcode" is a very wide icon-only bar, no label; status badge casing ("Active") differs from warehouses ("active"). | all | S4 | PA002.*, LB-15 |
| V-003 | `/locations` (003) | Filter **Reset button is red** (red = destructive per owner rule) — repeats on almost every list page (billing templates, invoices, audit logs, backups, locations). | all | S3 | LB-14 |
| V-004 | `/warehouses` (004) | Country column mixes "Syr", "EG", "SA"; city "—"; Actions "Locations / Edit / Deactivate" clipped on mobile ("Locatio", "Deactiv"); Previous/Next oversized on mobile; status lower-case. | M,T | S3 | LB-16, PA004.* |
| V-005 | `/inventory/stock` (005) | Product names wrap onto 4–5 lines on tablet/mobile (columns too narrow because sidebar stays open on 820 px). | T,M | S3 | LB-16 |
| V-006 | `/inventory/ledger` (006) | Arabic product names wrap one word per line on narrow widths. | T,M | S4 | LB-16 |
| V-007 | `/inventory/adjustments` (007) | "Adjustment id" and search field use the raw UUID instead of a readable code. | all | S3 | PA007.3 |
| V-008 | `/orders/inbound` (008) | Order numbers wrap onto 3 lines ("INB-/2026-/00063") on tablet/mobile; a row has expected arrival **1/1/2999** (no upper-bound validation). | T,M | S3 | PA008.3/.4 |
| V-009 | `/orders/inbound/new` (009) | Page structure fine; verify "Execute by Admin/Workers" cards, putaway plan filtering. | all | — | PA009.* |
| V-010 | `/orders/outbound` (010) | "Bulk Shipping Processing" looks permanently disabled with no explanation; rows ~110 px high on tablet/mobile so only 2–4 rows per screen. | T,M | S3 | PA010.1 |
| V-011 | `/orders/oms` (012) | Status card text **"Field Delivery"** (should read "Failed Delivery"); order number wraps in 2 lines and carrier badge clipped on laptop 1366. | D,L | S3 | PA012.2 |
| V-012 | `/orders/oms/new` (013) | Map tiles show grey seams; label "Street / Detailed Address **" has a double asterisk. | D,L | S4 | PA013.6/.8 |
| V-013 | `/oms/cod` (016), `/oms/returns` (017) | Status summary chips show **"—"** instead of counts (only "All 806 / 477" has a number). Mobile shows three full-width Export buttons stacked. | all | S3 | PA016.1 |
| V-014 | `/contracts/grn`, `/contracts/dn` (018,019) | On tablet/mobile the PDF buttons are pushed out of view; status text "Partial / Pending / Not generated" unexplained. | T,M | S3 | PA018.* |
| V-015 | `/cycle-count*` (022,023) | `/cycle-count/my-tasks` for an admin shows developer wording ("…so /auth/me includes workerId"); empty-state text clipped on mobile. | all | S3 | PA023.* |
| V-016 | `/returns` (024) | Banner "Select a tenant company to list returns" but **no selector on the page**; desktop/tablet skeleton rows forever ("0–0 of 0") while mobile shows "No returns found." — inconsistent; "+ New return" looks disabled. | all | **S2** | PA024.1, IT-TEN-004 |
| V-017 | `/internal` (025) | "FROM → TO" renders "— → —" on 3 lines; Ref column shows truncated UUID. | all | S3 | PA025.3 |
| V-018 | `/reports/*` (026–044) | 19 report tabs wrap to 2–3 rows (7 rows on mobile) pushing content below the fold; subtitle text "Server-side reporting. Paginated preview and export — no bulk client fetch." is developer wording; Export buttons disabled until Generate with no hint. | all | S3 | RB-07, RB-11, RB-05 |
| V-019 | `/clients` (045) | OK; verify actions. (Detail page lacks edit shortcuts → V-035.) | | — | PA045.* |
| V-020 | `/forms` (046) | Arabic message truncated with "…" on the wrong side (RTL ellipsis); mixed phone formats. | all | S4 | PA046.3 |
| V-021 | `/finance/overview|accounts|cod|payouts` (047–051) | Page-title icon is an **empty pale-green square** on all finance pages; "Legacy cycle invoicing disabled on staging cutover" and tab "Legacy Billing" are internal wording; **Pending COD shows "$85000.00" for a client whose COD is SYP-origin** and the overview total is "$102,144.00" (currency mixing → see V-040); lowercase badges ("active", "restricted"); two clients named "Valid Co Check". | all | **S2** (money labels) | PA047–PA051, SYS-FIN-005 |
| V-022 | `/finance/transactions` (049) | Category shown as raw lower-case ("cod credit", "manual adjustment"); Reference shows raw internal key ("oms_order: 0f191f12-ffc", "manual_adjustment:"); date format differs from other pages; Export buttons overlap the title on tablet. | T | S3 | PA049.3 |
| V-023 | `/finance/carrier-costs` (052) | Cost "Pending Quote" for shipments already created; "Cost source: api_estimate" and "SILA_SY" raw; Sila AWB is a UUID; 337 rows — confirm pagination. | all | S3 | PA052.1 |
| V-024 | `/finance/float`, `/finance/policies`, `/users/custom-roles` (053–055) | Titles/subtitles contain internal ticket ids ("B12 —", "B15 —", "O-11 —"); "Architectural Rule:" banner wording; provider code is a free-text field; "Deactivate Cutover" is a dangerous action styled neutral; permission chips read like labels not toggles; custom roles list only 6 modules (no billing, reports, shipping, returns, cycle count). | all | S3 | SB-10, PA054.3, PA055.4 |
| V-025 | `/billing/dashboard|plans|plans/new|templates` (056–059) | Sub-nav shows only Dashboard/Plans/Invoices (Templates and Charge rules reachable only through buttons); numeric inputs prefilled with "0" (must delete before typing); Cancel (red) + Create plan placed far from the form; legacy "billing cycle" widgets still shown although cycles are retired. | all | S3 | PA056–PA059 |
| V-026 | `/billing/invoices*`, `/billing/charge-rules` (060–062) | Amount displayed "205 USD" (finance pages use "$205.00"); "Draft" status has no badge style; on-demand invoice buttons Preview / Calculate storage / Check incentive are disabled until a client is chosen with no hint. | all | S3 | PA060.2, PA061.6 |
| V-027 | `/users/*` (063,064) | Client users table shows a "Worker profile" column (always "—"); phone formats inconsistent. | all | S4 | PA064.2 |
| V-028 | `/audit-logs` (065), `/notifications` (066) | Audit list flooded with **"AUTH REFRESH REPLAY IDEMPOTENT"** rows every ~15 min (hides real actions; may indicate repeated refresh calls); technical retention line shown; actor email printed twice. Notifications still contain "Billing cycle expiring in N days" for retired cycles; mixed relative/absolute timestamps. | all | S3 | PA065.3, PA066.2 |
| V-029 | `/profile` (067) | "AUTH GROUP: Admin" internal wording; large dark empty banner above photo card. | all | S4 | PA067.3 |
| V-030 | `/backups*` (068–073) | **Header buttons (Restore / Factory Reset / Upload / Create Backup) overlap the tab row** on tablet and mobile ("Scheduled Backups" is covered) ; "Healthy" banner while a **critical** `stale_successful_backup` event is listed; Activity feed shows raw keys (`backup.health.critical`); manual-backup cooldown is 1 min (UI text says default 15); Factory Reset adjacent to Restore/Upload with equal weight; `/backups/google-drive` and `/backups/google-oauth-settings` render the plain overview. | T,M,all | S3 (overlap S2 on mobile) | PA068.5, PA071.2 |
| V-031 | `/shipping/companies` (074), `/shipping/fee-rates` (075) | Page has **no title** — only a green "Shipping Fee Rate" link at the top (wrong label); manual rate 120 shown beside active automatic rate 130.01 (which wins?); fee-rates: an active group "حلب" with *No destinations* and an inactive "group 1" with none; icon-only ✎ ▶ ⏸ buttons; table clipped on tablet/mobile. | all | S3 | PA074.7/.8, PA075.3 |
| V-032 | `/products/:sku` (076) | Product name shown twice (header + card); Dimensions "—" (blocks the new storage-fee CBM); no Edit/Archive controls visible. | all | S3 | PA076.* |
| V-033 | `/orders/inbound/:id` (077), `/orders/outbound/:id` (078) | Raw carrier code "SILA_SY" shown as company name; field order differs between desktop and mobile; "Mark Shipping Details as Complete" far right. | all | S4 | PA078.3 |
| V-034 | `/orders/oms/:id` (079), waybill (080), batch (081), return (082) | Title **"OMS OMS-2026-03729"** (duplicate prefix; truncated to "OMS OMS…" on tablet); raw `waiting_for_shipping_details` shown as "Warehouse status"; two similar red actions "Cancel Shipment" / "Cancel order"; waybill sender shows "Test" not the warehouse pickup contact; batch page: "Issues 1" on a 0 %-progress batch, cost card mixes "SYP quotes 0 SYP / USD quotes $1.90 / Total (SYP) 24,702 SYP", "Exchange rate used 1 USD = 13,001.072 SYP" (old-SYP scale) while settings says 130.01 new SYP; **OMS return status "Return Received" but line shows Received "–" and Put away "–"**. | all | **S2** (return counts), S3 rest | PA079.5, PA081.3, PA082.1 |
| V-035 | `/clients/:id` (083), `/billing/invoices/:id` (084), `/inventory/adjustments/:id` (085) | Client detail read-only with no edit/suspend/users/plan shortcuts and billing text "monthly · 30 days"; cancelled invoice still offers **Edit invoice**; invoice "Payment status: Cancelled" duplicates chip; carrier cost "—" for a delivered OMS order; adjustment detail shows raw UUID for Adjustment ID and Lot ID. | all | S3 | PA083.*, PA084.3 |
| V-036 | `/tasks/:id` (086) | **Task detail is almost empty**: only "Assigned worker / Assign worker / Start" — no task type, order, lines, status, times. | all | **S2** | PA086.1 |
| V-037 | `/locations/:warehouseId` (087) | Header "10 location(s)" vs table "1–8 of 8"; "+ + New location" doubled plus; title/breadcrumb repeat "(WH-001)" with stray space; Reset is red; table clipped on tablet/mobile. | all | S3 | PA087.3 |
| V-038 | `/users/warehouse_users/:id` with a client user id (088) | Banner "This user does not belong on this list." **but still shows that user's name and email** in the header. | all | S3 (info leak between lists) | PA088.1, SEC |
| V-039 | `/billing/invoices/:id` INV-2026-00026 (084) | Header total 25.75 USD vs visible lines 22.75 → **$3.00 unexplained** (storage/manual line hidden below the fold or rounding?). | D | S1? | SYS-BIL-001 |
| V-040 | `/finance/overview`, `/finance/accounts` (047,048) | Currency mixing: Madino pending COD "$85000.00" (SYP-origin) summed into USD totals. | D | **S1?** | SYS-FIN-005 |
| V-041 | `/oms/batches/:id` (081) | Exchange-rate unit inconsistency (see V-034). | D | S2? | SYS-CUR-002 |
| V-042 | OMS-2026-03729 (079) vs OUT-2026-04466 (078) | Carrier "مرسال"/tracking 100554961267 on OMS vs SILA_SY/UUID AWB on outbound for the same order. | D | S2? | SYS-X-001 |
| V-043 | `/notifications`, `/billing/dashboard` | Retired billing-cycle notifications/widgets still active (49–51 unread, mostly cycle notices). | D | S3 | SYS-X-004 |
| V-044 | Global | **Tablet (820 px) keeps the full sidebar open** (~190 px) so every table loses a quarter of the width (products shows 2 of 6 columns; fee-rates and locations clipped). Define a collapse breakpoint. | T | S3 | CT-LAY-001, VIS |
| V-045 | Global | Sidebar "Reports" etc. fine; but **"Quick jump" (Ctrl+K) shortcut** and sidebar scroll bar overlay: verify usable on 1366 px. | L | S4 | E2E-X-003 |
| V-046 | Global | Mixed date/time formats: `11/14/2026 01:24 AM`, `Nov 14, 2026, 4:37:44 AM`, `3d ago`, `2026-11-10` (waybill), `1/1/2999` — pick one pattern per context. | all | S4 | SYS-X-006 |
| V-047 | Global | Several pages have **no H1/title** (shipping companies) or **an empty icon tile** (finance) → inconsistent page headers. | all | S4 | VIS |

## Client portal (captured 14 Nov 2026, client_admin "Eng Nadim", screenshots `staging-client-frontend-screenshots/001`–`030`)

| ID | Page(s) | Observation | Sev? | Confirm by |
|---|---|---|---|---|
| V-048 | `/login` (001) | On mobile 390 the login card is wider than the viewport (right edge clipped) and the language chip is cut off. | S3 | AUTH-20, VIS-L-02 |
| V-049 | `/dashboard` (002) | "Orders needing attention" lists "Billing cycle expiring in 3/7 days" although cycles are retired. | S3 | PC dashboard, A-07 |
| V-050 | `/my-profits` (006) | Client COD chips (Pending/Collected/Remitted/Settled/Returned) differ from admin COD (Pending/Available/Paid out/Returned); title "Cash on delivery" vs route name; "Filter by date" bar shows no inputs; "15141 USD" has no thousands separator. | S3 | PC my-profits, A-19 |
| V-051 | `/finances` (007) vs `/my-profits` (006) / dashboard | Financial Account shows $0.00 everywhere (pending COD 0) while COD page lists 39 pending orders / 15,141 USD and dashboard shows "Pending collection 101 USD" → three screens disagree. "Request Payout" looks disabled with no reason. | **S2?** | SYS-X-002, E2E-FIN-004 |
| V-052 | `/billing` (008) | Still a cycle-era page ("Monthly Plan", "Billing cycle: Monthly", "Orders this billing cycle", "Next billing —"). | S3 | A-07 |
| V-053 | `/invoices` (009), `/invoices/:id` (025) | Client can see a **Draft** invoice (INV-2026-00022); client invoice detail is the old format (plan snapshot + fixed subscription) — no order tables, storage, incentive or shipping-fee lines from the redesign; "Grand total 20" vs only 10 USD line visible above fold. | S2? | E2E-BIL-005, UAT-09 |
| V-054 | `/outbound-orders/new` (013) | Destination is a free-text box (no governorate/city cascade) and "Carrier" is a free-text/disabled field — inconsistent with online-order form and unusable for carrier address matching. | S3 | PC outbound-orders/new |
| V-055 | `/products/new` (015), `/products/:id` (016) | Client cannot enter dimensions/weight at create (no fields), detail shows no L×W×H → storage-fee CBM will be 0 for client-created products. | S2 (billing) | A-10, SYS-BIL-003 |
| V-056 | `/inbound-orders/:id` (018) | Completed inbound shows no GRN download (admin has GRN PDF). | S3 | PC inbound detail |
| V-057 | `/outbound-orders/:id` (019) | No tracking/carrier/waybill/DN; status chip "In progress" for an order already shipped in admin; client status vocabulary coarse (In progress / Shipped only). | S3 | PC outbound detail |
| V-058 | `/ecommerce-orders/:id` (020) | Timeline shows raw event keys ("oms created", "order waiting_for_confirmation", "oms confirmed"); stepper good. | S3 | PC ecommerce detail |
| V-059 | `/ecommerce-orders/returns/:id` (024) | Completed return with line Received "—" (same pattern as V-034). | S2? | E2E-RET-001 |
| V-060 | `/apis` (027) | Action links (Download documentation / Regenerate secret / Disable / Revoke) are plain text, destructive ones not red/confirmed visibly; Actions column clipped on mobile; lowercase key names. | S3 | PC apis |
| V-061 | `/sheets` (026) | Very dense grid; mobile shows only two columns; rows of already-approved orders still show Cancel/Delete buttons — lock rule must be verified server-side. | S2? | E2E-CLI-008, SEC-BIZ-004 |
| V-062 | `/notifications` (028) | 60 unread dominated by retired billing-cycle messages ("Account renewed … billing cycle has been renewed"). | S3 | A-07 |
| V-063 | Global (client) | Filter **Reset Filters is red** on every list (same as admin V-003); status chips with "—" on returns/inbound/outbound lists (V-013 class); tablet keeps desktop sidebar (V-044). | S3 | LB-14 |

Not yet captured: modals, error/empty states beyond the ones seen, Arabic/dark baselines, client_staff view, `/account-inactive`, `/outbound-orders/returns/:id` (no data).

## Modal states seen (14 Nov 2026, opened only — nothing submitted; images not filed, re-capture in phase 3)

| ID | State | Observation | Sev? | Confirm by |
|---|---|---|---|---|
| V-064 | Admin `/warehouses` → "+ New warehouse" modal | **Country defaults to "Saudi Arabia (SA)"** although D-010 was marked fixed (default SY) — regression of RG-009. Fields: Code (optional) + Generate Code, Name*, Country, City (dependent), Address; Cancel red / Create green. Mobile: modal fits, close × has focus ring. | S3 | RG-009, FB-01 |
| V-065 | Admin `/orders/oms` → "Scan QR" modal | Camera error shown raw: "Error getting userMedia, error = NotFoundError: Requested device not found" (technical text) with Retry camera; manual-entry field + Search present (good fallback); "Waybill fast scan" footer link; chips show Field Delivery typo behind. | S3 | CT-SCN-001, V-011 |

## Extra modal / error states (14 Nov 2026, screenshots 089–096; nothing submitted)

| ID | State | Observation | Sev? | Confirm by |
|---|---|---|---|---|
| V-066 | Modals: New company vs New warehouse | "Country" is free text (default SY) in one and a select (default SA) in the other. | S3 | FB-09, RG-009 |
| V-067 | Finance "Manual adjustment" modal | Cancel is white here but red in other modals; type select truncated on mobile. | S4 | LB-14, VIS-L-08 |
| V-068 | Unknown OMS order id | Generic red "Could not load OMS order." with no distinction 404/403/500. | S4 | DB-01 |
| V-069 | Unknown admin path (`/orders/<uuid>`) | Silently redirects to dashboard, no branded 404 page (client portal has one). | S3 | RD-02, E2E states |
Positive: Factory-reset modal has danger banner, default pre-reset snapshot, typed phrase gate (never executed); Create-backup modal clear.

## Round 3 captures (screenshots 097–104): empty state, bulk-bar modals, Arabic, dark

| ID | State | Observation | Sev? | Confirm by |
|---|---|---|---|---|
| V-070 | Dark theme, `/finance/accounts` | Accounts table renders as a white card in dark mode (white island). Other dark pages fine. | S3 | VIS-L-08, A11Y-VIS-006 |
| V-071 | Arabic UI, `/orders/oms` | Page title "OMS Orders" and subtitle "Manage ecommerce and OMS fulfillment orders." remain English; dashboard chart date labels English. | S3 | UX-CL, SYS-X-007 |
| V-072 | OMS bulk bar | 10 controls in one bar; two adjacent red "Cancel Shipments / Cancel All"; on laptop (600 px high) bar is below the fold. | S3 | UX-13 |
| V-073 | "Cancel 1 order(s)?" confirm | Does not state consequences (reservation release, COD void, carrier shipment); title "Cancel…" + button "Cancel orders" ambiguous vs "Keep orders". | S3 | UX-EL-05 |
| V-074 | "Edit Shipping Fee" modal | Reason optional, while carrier-cost correction requires audit; mixed-colour title. | S4 | A-xx |
| V-075 | Create batch modal | "1 orders selected" grammar. | S4 | UX-CL |
| V-076 | OMS list search | Search box only applies after clicking Apply; typing shows nothing; empty state "No OMS orders match the filters." and status cards drop to 0 with the search. Filters persist in localStorage until Reset. | S4 | LB-05, LB-07, LB-08 |
Deliberately not opened: bulk "Confirm Shipping / Complete Dispatch / Cancel Shipments" (opening the bulk shipping modal fires PATCH shipping-details, D-009, and requests carrier quotes) — needs owner-approved test order in phase 3.

## Round 4 captures (screenshots 105–122+, 14–15 Nov 2026)

| ID | State | Observation | Sev? | Confirm by |
|---|---|---|---|---|
| V-077 | `/orders/inbound/:id/edit` mobile (105) | Page title / form labels truncate on 390px; cramped form columns. | S3 | VIS-L-08, LB-14 |
| V-078 | `/tasks/:id` pick+pack pending (110–111) | Task body nearly empty — only Assign worker + Start; no task type/header/lines until Start (guess). `/execute` redirects to detail. | S2 | E2E-TSK-001 |
| V-079 | Putaway task in_progress (109) | Status "In Progress" but green **Start** still shown; KPI UNITS=7 vs REMAINING=1 while DONE=0 (guess mismatch). | S3 | E2E-TSK-002 |
| V-080 | Ledger line / ref (115–116) | Reference shown as raw UUID; subtitle `return_order · <uuid>` (technical to user). | S3 | UX-CL |
| V-081 | Warehouse user detail (120) | Worker **Profile ID** shown as UUID; Role label "Worker" while system role is wh_operator (guess OK). | S4 | UX-CL |
| V-082 | Billing plan detail (117) | Badges **Active** + **restricted** together; "No active billing cycle" while plan Active — confusing. | S3 | E2E-BIL-001 |
| V-083 | Invoice draft+unpaid (121–122) | **Grand total (admin) Client total $0.00** while Charges show Fixed subscription 50/100 — totals panel ignores subscription lines (guess). | S2 | E2E-BIL-INV |
| V-084 | `/returns/:id/process` completed (113) | Yellow banner only + empty body for completed return (no process UI) — expected?, but no link clarity beyond Details. | S4 | E2E-RET |
| V-085 | A6 cycle-count | **SKIPPED** — zero `cycle_counts` rows on staging; list empty. | — | A6 |
| V-086 | OMS status label | DB `shipped` OMS-2026-03603 renders UI badge **"Out for Delivery"**; failed_delivery still labeled **"Field Delivery"** (V-011). | S3 | A14, V-011 |
| V-087 | Timeline events | ready_to_ship detail shows raw event key `oms ready_to_ship` in Timeline (same class as V-058). | S3 | PC oms detail |
| V-088 | Batch BATCH-1013 | Status counters vs action counts diverge (Shipped 1 vs Shipping confirmed 5); mix of live carriers listed read-only (Babel/Karam) — no actions clicked. | S3 | E2E-BAT |
