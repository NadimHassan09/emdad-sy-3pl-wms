# I-2 — Filters + exports matrix (work in progress)

Legend: ✅ present · ⚠ partial · ❌ missing · n/a

| List | Portal | Store/client filter | Date range | CSV | Branded Excel | Notes |
|---|---|---|---|---|---|---|
| OMS / Online orders | Admin | ✅ company | ✅ createdFrom/To | ✅ | ✅ | |
| OMS / Online orders | Client | n/a (own data) | ✅ createdFrom/To | ✅ | ✅ (wired 6 Nov) | Controller previously ignored `format=xlsx` despite service+UI |
| Inbound | Admin | ✅ | ✅ | ✅ | ✅ | |
| Inbound | Client | n/a | ✅ | ✅ | ✅ | |
| Outbound | Admin | ✅ | ✅ | ✅ | ✅ | |
| Outbound | Client | n/a | ✅ | ✅ | ✅ | |
| Products / Inventory | Admin | ✅ company | ⚠ | ⚠ | ✅ | Confirm date + CSV in UI |
| Products / Inventory | Client | n/a | ⚠ | ❌ | ✅ (fixed 6 Nov route order) | Was 400 `id must be a UUID` because `export` hit `:id`; added `GET /client/products/export` before `:id` |
| COD records | Admin | ✅ | ✅ | ❌? | ✅ | Check CSV |
| COD report | Client | n/a | ✅ | ❌ | ✅ | Excel only today |
| Returns (OMS) | Admin | ⚠ | ⚠ | ⚠ | ⚠ | Audit next |
| Returns | Client | n/a | ⚠ | ❌ | ❌ | Likely gap |
| Finance transactions | Admin | ⚠ | ⚠ | ⚠ | ⚠ | Audit next |
| Financial account | Client | n/a | ⚠ | ⚠ | ⚠ | Audit next |
| Invoices | Admin | ⚠ | ⚠ | ⚠ | ⚠ | Audit next |
| Invoices | Client | n/a | ⚠ | ❌ | ✅ | Excel export exists |
| Stock / inventory levels | Client | n/a | ⚠ | ❌ | ❌ | Likely gap |
| Reports | Admin | varies | varies | varies | varies | Per report registry |

Update this table as each row is verified in the browser.
