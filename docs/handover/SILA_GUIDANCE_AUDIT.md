# I-6 — Sila integration guidance (9 points) — code audit

Date: 9 Nov 2026. Live merchant test **⛔ blocked** (needs owner yes for live Sila). Code audit 9/9 ✅; points 5+8 verified from adapter without live call.

| # | Guidance point | Code location | Status |
|---|----------------|---------------|--------|
| 1 | Create may return 201 without courier code | `sila-sy.adapter` createShipment — stores cargo id; courier barcode filled later | ✅ code |
| 2 | Read courier code via `GET /cargos/{id}` or webhook `cargo.courier_barcode_assigned` | `extractSilaCarrierAwb` + webhook util + poll path | ✅ code |
| 3 | Never query by courier code | Searches use cargo id / reference, not courier barcode as lookup key | ✅ code |
| 4 | Cancel only `PUT /cargos/{id}/cancel` | `cancelShipment` → `cargos/{id}/cancel` | ✅ code |
| 5 | COD amount = what recipient pays incl. shipping, in stated currency | `pay_on_delivery.amount` = order COD in stated currency; `shipping_paid_by` merchant|receiver (+ `merchant_pays_shipping`) so recipient total includes shipping when payer=receiver | ✅ code |
| 6 | TARABUT prices in USD | Offered only when currency/COD constraints pass (`carrier-constraints`) | ✅ code |
| 7 | Send `recipient.area_id` (leaf areas) | `sila-area.util` rejects province-level area_id | ✅ code |
| 8 | Check `GET /cargos?reference=` before re-sending | `findShipmentByReference` → `cargos?reference=`; used on `duplicate_reference` 409 + ambiguous send recovery in `shipping.service` | ✅ code |
| 9 | Show `error.message` + keep `request_id` | `sila-sy.http-client` extracts `request_id`; errors surface message | ✅ code |

Do not test on the live Sila merchant account without owner approval (safety rule).
