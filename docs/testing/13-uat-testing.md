# 13 — User Acceptance Testing (UAT)

**Purpose.** The owner (and later the client's operations team) confirms that the system does what the business needs. Unlike the other files, the oracle here is the **people**, not the code. Scenarios are written in plain business language, executed on staging with realistic (but TEST ORDER-marked) data, **in Arabic and English**, on the devices they really use (owner laptop; client's operations contact on phone; warehouse staff on tablet/phone).
**Who.** Owner (Nadim) — admin/finance scenarios · client operations contact — client portal scenarios · client owner (Yousef) — finance/billing sign-off · warehouse staff — tasks.
**Rule.** UAT starts only after `07` sanity is green, no open S1/S2, and `17` blocking assumptions are answered. Everything the participants say becomes a recorded decision or a defect.

## 1. Acceptance scenarios

| ID | Business scenario | Steps (user language) | Acceptance (pass if…) | From |
|---|---|---|---|---|
| UAT-01 | "Receive a client's goods" | Client requests inbound; I approve; staff receive and put away; client sees GRN | Stock appears with right quantity and location; GRN in Arabic and English is correct and printable | client A1/F24 |
| UAT-02 | "Ship an online order, COD" | Client (or I) create order; confirm; approve; pick; pack; ready to ship; choose carrier; waybill; carrier delivers; COD collected | Every status is understandable; the right carrier and price; waybill prints and scans; client tracking visible | B13, A2 |
| UAT-03 | "Orders for governorates Babel does not serve" | Create Raqqa/Hasakah/Deir ez-Zor/Suwayda order | Accepted; other carrier or manual route offered; no confusing error | B10 |
| UAT-04 | "Customer typed a wrong area" | Enter a neighbourhood that is not in the list / wrong governorate | System suggests the right area or lets me pick it; order is not rejected for a typo | B11 |
| UAT-05 | "Bulk day" | Import 30 orders, batch them, ship all, print all waybills and picking/packing lists | Takes minutes not hours; lists are simple and per order like the reference picture | B16/B17/B22 |
| UAT-06 | "A shipment goes wrong" | Delivery fails; returned to sender; return processed; stock back | I can see why and what to do; stock/COD/fees right | F13/F14 |
| UAT-07 | "Fix a wrong order after approval" | Super admin changes COD/qty/price/address at any stage | Possible; clear warning that carrier is not notified; history kept | B9/B14 |
| UAT-08 | "Client edits/cancels before we confirm" | Client edits and cancels an order | Allowed before confirmation, blocked after, with explanation | B8 |
| UAT-09 | "Month-end invoice" | On-demand invoice for a client: orders tables, storage, incentive, edit a carrier cost, finalise, send PDF | Totals make sense; client view hides carrier cost and margin; I trust the numbers | pricing doc |
| UAT-10 | "Is the client's money right?" | Open client account, statement, pending COD, payout request | Balance = what I expect by hand; COD moment follows my chosen policy | A8/B15 |
| UAT-11 | "Cash-flow control" | Turn on float and reconciliation; paste Babel statement | Float and mismatches make sense; client sees nothing of it | B12 |
| UAT-12 | "Who can do what" | Create accountant, viewer, inventory user, custom role; log in as each | Each sees only what I intended; names understandable | owner #11 |
| UAT-13 | "Client self-service" | Client uses Sheets, API key, webhooks | Fixed dropdowns, locked after approval; keys work | #12–#14 |
| UAT-14 | "Rates and currency" | Change exchange-rate source/threshold; compare carrier prices in SYP/USD | Best price chosen correctly; client sees USD only | #4–#10 |
| UAT-15 | "Reports I need" | Run the 19 reports for a month; export Excel | Numbers match what I know; Excel looks professional (EMDAD identity + summary block) | #19 |
| UAT-16 | "Security basics" | Log out/in, remember me, forgot password, suspended user | Works as expected, no surprises | |
| UAT-17 | "Mobile reality" | Client creates order on phone; warehouse staff run tasks on tablet | Comfortable, no zooming/scrolling pain | |
| UAT-18 | "Backups" | See backup health, create one, understand retention | I know my data is safe | |
| UAT-19 | "Arabic first" | Do UAT-02 and UAT-09 fully in Arabic | No untranslated or broken RTL screens | |
| UAT-20 | "Hand-over" | Read the user guide and runbook, perform 3 tasks from it | Guide matches system | handover pack |

## 2. Sign-off questions per scenario (asked after each run)
1. Did you understand every screen without help? 2. Anything you expected that was missing? 3. Anything you did not expect? 4. Any number you do not trust? 5. Would you let a real client/employee do this today? (Yes/No + why) 6. Wording/colour/order you would change.

## 3. Owner approvals required (collected here, linked to `17`)
Picking/packing list look (B17) · invoice layout (Table order, margin block) · currency display (A-03/A-19) · COD default policy and prep-fee default (A-05) · terminology glossary · role names · which modules custom roles can control (A-06) · timezone (A-23) · tablet layout (A-01).

## 4. Exit criteria
All 20 scenarios `ACCEPTED` or `ACCEPTED WITH NOTES (non-blocking)`; no `REJECTED`; every note converted to a ticket; owner signs the release record. The client signs UAT-02/09/10/13 for their portal before production cut-over.
