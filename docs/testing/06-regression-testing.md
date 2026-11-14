# 06 — Regression testing

**Purpose.** After any change, prove that things that used to work still work and that previously fixed defects stay fixed. Because "start from zero" was ordered, the regression pack is **built from the defect history** (D-001…D-048 in `docs/handover/QA_TRACKER.md`) plus the owner/client requests that were declared done (`CLIENT_WHATSAPP_REQUESTS.md`, `OWNER_CHANGE_REQUESTS.md`) plus the new Sprint-1 features.

## 1. Selection rules (which suites to run after which change)

| Change touches | Run at least |
|---|---|
| `common/money`, FX, fee, billing, financial, COD | `01` money/finance units + `03` IT-FIN/IT-BIL + `05` SYS-BIL/SYS-FIN/SYS-CUR + RG money rows below |
| any carrier adapter / shipping module | adapter units + `03` IT-CAR for that carrier + E2E-CAR for that carrier (live only with approval) + RG carrier rows |
| orders / inventory / workflow | state-machine units + IT-ORD + IT-INV invariants + E2E-ORD/OMS + SYS-SM |
| auth / RBAC / users / custom roles | UT-AUT/RBAC + IT-AUT + `09` RBAC matrix + AUTH battery |
| client portal / external API | IT-CLI/EXT + E2E-CLI + `09` tenant isolation |
| frontend shared component / layout / theme | `02` for that component + VIS on all pages using it (use traceability grep) + a11y smoke |
| any page | that page's `04a/04b` battery on 4 devices |
| DB migration | IT-PLT-009 + full IT + backup/restore rehearsal |
| infra/nginx/build | `07` sanity + 4-device smoke of every top-level page |

## 2. Release-candidate regression = everything in `01`–`13` marked P0/P1 (full run). Nightly = P0 + selection rules for the day's commits. Per-commit (CI) = `01`, `02`, IT smoke, `07`.

## 3. Defect-history regression pack (one test per fixed defect; type in brackets)

| RG | Defect | Regression assertion |
|---|---|---|
| RG-001 | D-001 | Clearing the client select leaves it empty (no auto-Acme) on products/inbound/outbound/OMS new, desktop+mobile [E2E] |
| RG-002 | D-002 | Bulk shipping: a carrier with no quote cannot be selected for an order [UT+E2E] |
| RG-003 | D-003 | Syria hierarchy JSON: no CRLF, no trailing spaces [UT data lint] |
| RG-004 | D-005 | Product image URLs from DB return 200 or the UI shows placeholder [IT+E2E] |
| RG-005 | D-006 | Babel rate error for address without neighbourhood is human-readable [UT mapper] |
| RG-006 | D-007 | No `PICKBENCH`/benchmark orders in lists [SQL] |
| RG-007 | D-008/D-022 | Zero-priced quote is never "recommended" and sorts last; Sena out-of-zone address not priced 0 [UT] |
| RG-008 | D-009 | Opening the bulk shipping modal does not fire `PATCH …/shipping-details` [E2E network assert] |
| RG-009 | D-010 | New company/warehouse default country SY [E2E] |
| RG-010 | D-011 | Error toast stays 9 s, has ✕, width ok [CT] |
| RG-011 | D-012 | Approve for destination with no fee group → clear message + sidebar link; coverage warning lists uncovered governorates [E2E] |
| RG-012 | D-013/D-017 | Rate request carries COD currency; Sena offered only if currency supported; carrier amounts keep unit; new/old SYP conversion 1:100 [UT+IT] |
| RG-013 | D-014 | Failed-send banner never shows `[[se:{…}]]` JSON [CT] |
| RG-014 | D-015 | COD FX uses configured source (central bank → fallback API) with source recorded [IT] |
| RG-015 | D-016 | Carrier webhook events in timeline show "Carrier webhook", not an admin name [E2E] |
| RG-016 | D-018 | Mouse wheel over map does not zoom/trap scroll [E2E] |
| RG-017 | D-019 | Shipping form dimensions come from product (100×50×50), not 10×10×10 [UT] |
| RG-018 | D-021 | Cancel (Babel) dialog text says manual cancel; banner not red "send failed" [CT] |
| RG-019 | D-023 | Quote age chip + refresh; manual price override audited [CT] |
| RG-020 | D-024/D-026 | HTML/script injection in address/notes/product/city/SKU is escaped in waybill, GRN, DN, contract, invoice, instruction sheet, return slip PDFs [IT per PDF] |
| RG-021 | D-025/D-031 | Notes ≤ 500, reference ≤ 100, arrival date upper bound, past expiry rejected [IT] |
| RG-022 | D-027/D-037/D-004 | Unit suite green (158 suites / 990 tests baseline, 4 GB heap) [CI] |
| RG-023 | D-028/D-029 | Putaway picker lists only valid location types; during putaway only destinations editable [E2E+IT] |
| RG-024 | D-030 | Duplicate adjustment line rejected [IT] |
| RG-025 | D-032 | Receiving dock name correct (منطقة استلام) [SQL] |
| RG-026 | D-033 | Putaway writes an idempotent ledger row; location history rebuildable [IT] |
| RG-027 | D-034/D-035/D-036 | COD SYP converted to USD; pending decreases only by what was added; shipping fee debits in USD [IT-FIN] — **and V-040 must not appear** |
| RG-028 | D-038/D-039 | Storage capacity card uses real counts; charts have axes/legend; mandatory filters handled [E2E] |
| RG-029 | D-040 | Sila webhook registered; endpoint accepts valid event [IT] |
| RG-030 | D-041 | Collapsed sidebar link accessible names are text, not `[object Object]` [CT-A11Y] |
| RG-031 | D-042 | Client billing banner does not mention cycles [E2E] |
| RG-032 | D-043 | `GET /client/sheets/google/status` returns 200 `{connected:false}` for an unlinked client [IT] |
| RG-033 | D-044/D-045/D-046 | Delivery Joud: areas parsed from `response`, payer map exists for DELIVERY_JOUD/FATIH, `Sequence` stored as AWB; all calls POST [UT+IT] |
| RG-034 | D-047 | No cancelled OMS order keeps an active reservation [SQL invariant] |
| RG-035 | D-048 | OMS delivered/returned ⇒ outbound not `shipped`; detail page does not show Rollback/Mark delivered inconsistent buttons [SQL+E2E] |
| RG-036 | Earlier QA findings in `docs/handover/QA_TRACKER.md` D-049+ (if any added) | each gets its own row on closure |

## 4. Requirement regression (declared ✅ earlier → must be re-proven because "start from zero")

| RG | Requirement | Source | Test |
|---|---|---|---|
| RG-101 | Waybill printing, Excel import, Babel link work | Client A1 | E2E-OMS-013, E2E-OMS-010, E2E-CAR-002 |
| RG-102 | Sila detailed tracking statuses (not only "processing") | A2 | CT-C-004, E2E-CAR-003 |
| RG-103 | Sena integration | A3/A7 | E2E-CAR-001 |
| RG-104 | Sila guidance 9 points | A4 | UT-SIL-*, IT-CAR-003 |
| RG-105 | QR scanning receives/handles many orders | A5 | E2E-OMS-012 |
| RG-106 | Financial system per proposal (current account, statements, no double counting, hidden margin) | A8 | E2E-FIN-*, SYS-FIN-* |
| RG-107 | Client edit/cancel before confirmation; admin cancel visible | B1/B8 | E2E-CLI-005, SYS-SM-001 |
| RG-108 | Filters + Excel export everywhere (store name + dates) | B4 | LB-07, LB-11 on all lists |
| RG-109 | New warehouse + locations | B5 | E2E-INV-005 |
| RG-110 | Super admin edit anything at any stage | B9/B14 | E2E-OMS-006 |
| RG-111 | Raqqa orders accepted | B10 | E2E-OMS-003 |
| RG-112 | Tolerant address matching | B11 | E2E-OMS-002, UT-ADR-001 |
| RG-113 | "Ready to ship" status | B13 | E2E-OMS-005 |
| RG-114 | Simple import template with instructions + dropdowns for all governorates | B16/B22/B23 | E2E-OMS-010, UT-IMP-002 |
| RG-115 | Picking list ≠ packing list, organised per order | B17 | E2E-OMS-011 |
| RG-116 | Company selector does not reset to Acme on phone | B18 | E2E-OMS-001 mobile |
| RG-117 | Contents column + copy buttons | B19 | E2E-OMS-014 |
| RG-118 | Group-by like Olivery (page-scoped) | B20 | E2E-OMS-014 |
| RG-119 | Delivery Joud integration | B21 | E2E-CAR-004 |
| RG-120 | USD inside, carriers in own currency, new SYP only with carriers | owner #4/#5 | SYS-CUR-* |
| RG-121 | On-demand invoices, optional items, dynamic fulfilment, EMDAD shipping fee, netting against COD | owner #6 | E2E-BIL-* |
| RG-122 | OMS fulfilment covers its own outbound, billed once | owner #7 | E2E-OMS-016 |
| RG-123 | Admin can edit carrier price and invoice lines | owner #8 | E2E-OMS-007 |
| RG-124 | FX manual/auto/custom source with thresholds | owner #9/#10 | E2E-FX-001 |
| RG-125 | Roles viewer/accountant/inventory + custom roles | owner #11 | E2E-USR-002, `09` |
| RG-126 | Client Sheets (fixed dropdowns, locked after approval), API keys + webhooks | owner #12–#14 | E2E-CLI-008/010 |
| RG-127 | Forgot password by emailed code; suspended account refused (password + Google) | owner #16/#17 | AUTH-10/16 |
| RG-128 | Searchable dropdowns; colour-coded buttons | owner #18 | LB-06, LB-14 |
| RG-129 | CSV and branded Excel export on every list | owner #19 | LB-11 |
| RG-130 | Sidebar collapse, tighter tables, full-width pages | owner #21 | VIS |
| RG-131 | Shipping fee rates: block on missing rate, sidebar link, warning, templates | owner #24 | PA075, E2E-MD-004 |
| RG-132 | Storage fee + incentive discount + invoice redesign + carrier-cost correction | Sprint 1 | E2E-BIL-001…006 |
| RG-133 | B3 traceability, B12 float/reconciliation/shield, B15 policies, O-11 custom roles, D-040 | owner decisions 14 Nov | E2E-OMS-017, E2E-FIN-005/006, E2E-USR-002, IT-CAR-006 |

## 5. Automation rules

* Every regression row becomes an automated test tagged `@regression @RG-nnn` (UI rows tagged by device).
* A failing regression test blocks the release even if the new feature passes.
* When a new defect is fixed: add `RG-2nn` *before* merging the fix (test first, red→green evidence in the PR).
