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
| A15 / A17 / A18 | pending | — | inbound/outbound detail variants; contract PDF; waybill/picking/packing/GRN/DN |

## Skipped / blocked
- A6: SKIPPED(no cycle count sessions)
- Receiving task type: none open

## New defect candidates (V-077+)
S1: 0 · S2: 2 (V-078, V-083) · S3: 8 (V-077, V-079, V-080, V-082, V-086–V-088, …) · S4: 2 (V-081, V-084)

## Records created / changed
None so far this round (read-only captures). Plan edit page opened, not saved.

## Next batches
Continue A14–A18 → §3 modals → §4 states → §5 AR/dark → §7 client → §9b Sena → §2 login → §6 roles.
