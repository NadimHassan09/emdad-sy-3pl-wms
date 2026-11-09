# I-2 — B4 list filter/export audit (code pass, 9 Nov)

Status: code changes done on `staging`; **not browser-verified yet** (stays 🔍 until each export is opened in Excel/CSV and cross-checked with the list).
Complements the older matrix in `I2_EXPORT_FILTER_MATRIX.md`.

All new exports share one helper (`backend/src/common/utils/tabular-export.util.ts`):
`format=xlsx|csv`, branded Excel via `buildExcelBuffer` (summary block above the table), CSV = UTF-8 BOM with the same formula-injection guard as Excel (`sanitizeExcelText`), cap `EXPORT_MAX_ROWS = 10000` (response headers `X-Export-Row-Count`, `X-Export-Truncated`; Excel gets a "Note" line when truncated). Exports reuse the list's DTO + tenant scope, so a restricted admin / client never exports more than the list shows. Money fields are exported as stored (no recalculation).

| List | Portal | Had | Missing | Fixed |
|---|---|---|---|---|
| Inventory stock (by product) | Admin | client filter, search filters | export | `GET /inventory/stock/by-product/export?format=xlsx\|csv` (+ summary: total SKUs, total available, on hand, reserved, clients) + Export Excel / CSV buttons. Date range n/a (stock is a snapshot). Note: the status cards (in/low/out of stock) are a client-side view of the loaded page and are not applied to the export. |
| Inventory ledger | Admin | client + date filters | export | `GET /inventory/ledger/export?format=xlsx\|csv` (+ summary: movements, received, issued, net, clients, date range) + buttons |
| Financial transactions | Admin | `startDate`/`endDate` in API, client only via URL `?companyId=` | client selector, date inputs, export; `endDate` excluded the whole end day | client combobox, From/To date inputs, `GET /finance/transactions/export?format=xlsx\|csv` (+ summary: credits, debits, clients, range) + buttons. Date-only `endDate` is now inclusive (`23:59:59.999Z`), invalid dates return 400. Client portal statement uses the same service, so it also gets the inclusive end date. |
| Billing invoices | Admin | client + createdFrom/To filters | export | `GET /billing/invoices/export?format=xlsx\|csv` (+ summary: invoices, total, paid, clients) + buttons |
| Inbound orders | Client | search + status | date range | `createdFrom`/`createdTo` added to the client list DTO/service, to the export DTO/services and to the page (From/To inputs, passed to the export modal) |
| Outbound orders | Client | search + status | date range | same as inbound |
| Inbound / Outbound | Admin | CSV + Excel in the export modal | button said "Export CSV" | button label now "Export" (AR: تصدير) |
| Products | Admin | Excel (`/products/export`) | CSV | `?format=csv` on `/products/export` (xlsx stays default) + Export CSV button. Client `/client/products/export` stays Excel only. |
| OMS returns | Admin | Excel + `format=csv` in controller | `format` was not declared in the query DTO (global pipe uses `forbidNonWhitelisted`); no CSV button | `format` declared in `ListOmsReturnsQueryDto`; CSV button next to Excel |
| COD records | Admin | Excel + PDF | CSV | `?format=csv` on `/cod/records/export` (same dataset as Excel) + button |

## Remaining gaps

- Admin reports registry: not audited.
- No browser verification of any of the above (QA_TRACKER rows stay ⬜/🔍) — scheduled in `TESTING_SPRINT.md`.

## Client portal exports (closed 9 Nov — code)

| List | Endpoints | UI |
|---|---|---|
| Stock levels | `GET /client/stock/export?format=xlsx\|csv` | Products (Inventory) → Export stock |
| Financial statement | `GET /client/finances/transactions/export?format=xlsx\|csv` | Finances statement filters |
| Invoices | `GET /client/billing/invoices/export?format=xlsx\|csv` | Invoices → Excel + CSV |
| COD report | `GET /client/oms/cod-report/export?format=xlsx\|csv` | COD → Excel + CSV |
| Products | `GET /client/products/export?format=xlsx\|csv` | Inventory → Excel + CSV |
