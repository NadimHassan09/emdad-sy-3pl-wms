# 17 — Assumptions the test author made (owner must confirm or correct)

A test whose expected result rests on one of these is **not allowed to be reported as a defect** until the owner answers. If the owner says "no, it should be X", the listed tests are rewritten to X. This list exists because the owner warned that the executor may assume wrong and then call a wrong behaviour "passed".

How to answer: mark each row ✅ (my assumption is right) / ✏ (correct it) / ❓ (decide later). Rows marked **blocking** stop dependent P0 tests.

| ID | Topic | Assumption used as the oracle | Why it matters / evidence | Dependent tests | Blocking |
|---|---|---|---|---|---|
| A-01 | Tablet layout | At 820 px the sidebar should collapse (drawer) so tables get full width | 820 px screenshots show a permanent ~190 px sidebar; products shows 2 of 6 columns | CT-LAY-001, VIS-*, V-044 | |
| A-02 | Supported browsers/devices | Chrome + Edge latest, Safari iOS latest for the client portal, Firefox smoke only | no statement found | `11`, `10`, E2E device matrix | |
| A-03 | Currency display | Client sees **USD only**; admin finance pages show USD with a "$" and any carrier amounts with their own unit label. A client whose COD is collected in SYP is converted to USD at the active rate at the event time | owner decisions 5–9 Nov; finance overview currently shows "$85000.00" for SYP-origin COD | SYS-FIN-005, SYS-CUR-*, IT-FIN-* | **blocking** |
| A-04 | "Pending Quote" | A carrier cost stays "Pending Quote" only until the carrier API returns a price; after shipment creation the quote should be shown (estimate) | Carrier-costs page shows Pending Quote for already-created Babel/Sila/DJ shipments | PA052.1 | |
| A-05 | Prep fee (B15) | Mode "Prep fee": fee = % × order value, debited when the order is submitted/confirmed (not at delivery), refunded if cancelled before shipping | decision 15/5 Nov said "charge upfront / none / later" — implementation details unspecified | E2E-FIN-006, SYS-FIN-004 | |
| A-06 | Custom roles modules | Roles cover 6 modules (oms, inbound, outbound, finance, inventory, users) × read/write on purpose; billing/reports/shipping/returns/cycle-count/settings are admin-only | UI shows only 6 | PA055.4, IT-AUT-005 | |
| A-07 | Legacy billing cycles | Cycle billing is retired (on-demand only); cycle notifications/widgets/"Renew" must not appear | owner: "no fixed cycles"; staging still shows 49 cycle notices and widgets | PA056.1, PA066.2, SYS-X-004, IT-BIL-007 | |
| A-08 | FX precedence | When "Automatic" source is active the manual rate field is only a fallback; UI must say which is in use | settings show manual 120 beside active 130.01 | PA074.8, UT-FX-001/003 | |
| A-09 | Fee groups | A group with no destinations never matches (should be flagged, not "Active"); weight policy "up to 10 kg + $1 per 5 kg" rounds **up** per started 5 kg | page shows active empty groups | UT-FEE-002/004, PA075.3 | |
| A-10 | Missing dimensions | A product without dimensions must show a warning where storage is calculated (admin) and be flagged on its detail page | storage fee needs L×W×H | PA076.2, SYS-BIL-003 | |
| A-11 | Batch "Issues" | Issues = orders in the batch with a failed/blocked step (failed delivery, shipping error, missing label) | batch with 0 % progress shows Issues 1 | PA081.4 | |
| A-12 | Express return | Express return skips plan/approve and goes directly to receive+putaway by the admin | button exists, rule undocumented | E2E-RET-002 | |
| A-13 | GRN/DN statuses | "Partial", "Pending", "Not generated" mean: PDF generated for part of lines / waiting for completion / never created | unexplained labels | PA018.2 | |
| A-14 | Final contracts | A client can have several final contracts; overlapping validity is allowed | no rule found | PA020.2 | |
| A-15 | B3 traceability | OMS order detail lists source inbound orders (exists) **and** inbound order detail lists the OMS orders that consumed it (reverse link) | owner decision B3 = "traceability only" | E2E-OMS-017 | |
| A-16 | Waybill sender | Sender block shows the EMDAD warehouse pickup contact (Settings → Pickup address), not the client's company name | waybill shows "Test"; pickup says "مستودعات إمداد" | E2E-OMS-013, PA080.4 | |
| A-17 | Cancelled invoice | A cancelled invoice cannot be edited (no "Edit invoice") | button visible on cancelled INV-…26 | PA084.3 | |
| A-18 | Rounding | All money rounded HALF_UP to 2 decimals per line, totals summed from rounded lines | not documented | UT-MON-001, SYS-BIL-011 | **blocking** for money tests |
| A-19 | Number/date format | One money format app-wide: `$1,234.50`; dates `DD/MM/YYYY` or `YYYY-MM-DD`? (admin shows US `MM/DD/YYYY` today) | V-046 mixed formats | UT-FE-003, VIS | |
| A-20 | Empty invoice | An on-demand invoice for a period with no billable activity is blocked with a message | unspecified | SYS-BIL-010 | |
| A-21 | Return fee rule | When an order is returned: shipping fee is kept (client pays outbound leg) and a return fee is charged only if configured | handover lists "return fee rule" as undecided | SYS-FIN-003 | |
| A-22 | OMS order amounts | `subtotal` = line total + client shipping fee (20 + 5 = 25); `COD amount` = what the recipient pays (20 for the product only, shipping prepaid by sender?) | OMS-2026-03729 pricing card; Sila rule: COD must include shipping when recipient pays | SYS-X-003, E2E-CAR-003 | **blocking** for carrier COD tests |
| A-23 | Timezone | Business timezone is Asia/Damascus; all UI timestamps in that zone; DB stored UTC | mixed formats seen | SYS-X-006, SYS-NF-004 | |
| A-24 | Role names | "Accountant" in UI = `finance` role; "Inventory" = `inventory_controller`; viewer sees finance/billing read-only (per `rbac.ts` FIN list) | `rbac.ts` | `09` matrix | |
| A-25 | Client staff vs admin | `client_staff` can create/edit orders but not manage API keys, webhooks, Sheets, finances | not documented | `09`, PC pages | |
| A-26 | Account restriction | A restricted client can log in and read but cannot create orders | banner exists | SYS-SM-012 | |
| A-27 | Realtime | Lists/dashboards update within 3 s without reload for order status and notifications; others require manual refresh | realtime module exists | LB-22 | |
| A-28 | Search semantics | Search boxes are case-insensitive, accent/hamza-insensitive for Arabic, match substring anywhere in the displayed identifiers | | LB-05 | |
| A-29 | Export scope | Export = **all rows matching current filters** (not only current page) | | LB-11 | |
| A-30 | Language persistence | Chosen language/theme is remembered per user across sessions/devices (server side) or per browser (local)? | `wms-ui-language` in localStorage | AUTH-15 | |

Items already decided by the owner (not assumptions; sources): inbound↔OMS = traceability only (B3); COD settlement moment selectable (policy cards); B12 modular & disabled by default; custom roles with migration approved; D-040 Sila webhook registered by API; picking list separate from packing list organised by order; no live carrier call without per-shipment approval; production never touched.
