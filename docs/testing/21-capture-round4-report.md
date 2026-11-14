# Capture Round 4 — report (in progress)

Date: 14–15 Nov 2026. Portal screenshots via Browser MCP iframe device frames; PNGs on VPS only (gitignored).

## Progress (§1 admin dynamic routes)

| Item | Status | Screenshots | Id / note |
|---|---|---|---|
| A1 inbound edit | done | 105 ×4 | INB-2026-00053 `dab51dee…` |
| A2 outbound edit | done | 106 ×4 | OUT-2026-01321 `67478f86…` |
| A3 COD detail | done | 107 ×4 | COD `5477f590…` / OMS-2026-03682 |
| A4 OMS return edit | done | 108 ×4 | OR-2026-00447 `87ab5a55…` |
| A5 task execute | partial | 109–111 ×4 | putaway / pick / pack; pick+pack empty body |
| A6 cycle-count | SKIPPED | — | no cycle_count rows on staging |
| A7 WMS returns | done | 112–113 ×4 | RTN-2026-00453 completed |
| A8 inventory product | done | 114 ×4 | AIRCOOLING1 `b5414bd7…` |
| A9 ledger | done | 115–116 ×4 | line + return_order ref |
| A10 billing plans | done | 117–118 ×4 | WorkerTest Co `ae0c5041…` (edit not saved) |
| A11 client user | done | 119 ×4 | test@emdad.com |
| A12 warehouse user | done | 120 ×4 | Yousef Samarli |
| A13 invoices | done | 121–122 ×4 | INV-2026-00024 draft, INV-2026-00025 unpaid |
| A14 OMS statuses | done | 123–129 ×4 | ready/delivered/cancelled/failed/returned/waiting/out_for_delivery |
| A16 batch ≥2 | done | 130 ×4 | BATCH-1013 (6 orders) |
| A15 inbound/outbound detail | partial | 131–132 ×4 | completed inbound + Sena delivered outbound |
| A18 docs | partial | 133–134 | GRN EN PDF + OMS waybill 10×15; picking/packing/DN/AR toggle still open |
| A17 final-contract PDF | pending | — | |

## Progress (§3 modals — partial)

| Item | Status | Shots | Note |
|---|---|---|---|
| warehouses Edit | done | 135 | WH-001 Cancel only |
| locations New | done | 136 | WH-001 Cancel only |
| warehouses Deactivate | done | 137 | WH-003 TEST Cancel only |
| adjustments New + row menu | done | 138–139 | Draft Edit/Delete |
| internal Create | done | 140 | Cancel only |
| OMS Import / Adv filters / QR Confirm | done | 141–143 | no upload; camera absent → V-094 |
| cycle-count sessions + product schedule | done | 144–145 | empty; create modal SKIPPED (no control) |
| inbound Import | done | 146 | no upload |
| backups Restore | done | 147 | Cancel only |
| shipping Sena card + Test connection | done | 148–149 | Sena test OK; other carriers photo-only |
| outbound import / COD / returns / finance / users / billing / fee-rates / global chrome | pending | — | next |

## Skipped / blocked
- A6: SKIPPED(no cycle count sessions)
- Receiving task type: none open

## New defect candidates (V-077+)
S1: 0 · S2: 2 (V-078, V-083) · S3: 14 (… V-091–V-093, V-095–V-096) · S4: 4 (V-081, V-084, V-090, V-094)

## Records created / changed
None so far this round (read-only captures; modals Cancelled). Plan edit page opened, not saved.

## Next batches
Rest of §3 → §4 states → §5 AR/dark → §7 client → §9b Sena → §2 login → §6 roles.
