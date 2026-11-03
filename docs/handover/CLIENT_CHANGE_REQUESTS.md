# Client change requests and billing redesign (3 Nov 2026)

Status: ✅ built (staging code committed) · 🟡 built, waiting for the database migration and a deploy · ⬜ not started · 🔴 hard or blocked (reason given).

## Finance and billing

Owner direction: finance is the most important area and must be exactly right. On-demand invoicing, no fixed cycle; finance and billing linked.

| Request | Status | Notes |
|---|---|---|
| Invoice a client any day, for any period | 🟡 | `POST /billing/invoices/on-demand` (+ `/preview`); page `/billing/invoices/on-demand`. Draft first, then Issue. |
| Choose per client what is charged (inbound, outbound, OMS orders, storage, shipping fee) | 🟡 | `billing_charge_rules`, page `/billing/charge-rules`. Every item optional per client. |
| Dynamic fulfillment price (grows with number of lines and weight) | 🟡 | fee = base + extra lines x fee + extra kg x fee, per order type. Pure function with unit tests. |
| EMDAD shipping fee (our tariff, never the carrier price) | 🟡 | Charged on the invoice unless it was already debited at dispatch (shown as "already deducted"). |
| Client invoice shows order counts and statuses per type, fulfillment per order and total only for billed types, per-OMS shipping fee | 🟡 | `GET /client/billing/invoices/:id/breakdown`; client invoice page section. External carrier cost and carrier names are never returned. |
| Admin invoice shows carrier cost and margin per order | 🟡 | `GET /billing/invoices/:id/breakdown` (admin). Carrier cost converted to USD in the carrier's own pound unit. |
| Deduct fees from the client's COD balance (had X, owe Y, remaining Z) | 🟡 | `POST /billing/invoices/:id/settle`: debits only what the available balance covers, records balance before and after, leaves the rest due. Cancelling the invoice returns the deduction and frees the orders. |
| One order can be on one active invoice only | 🟡 | Partial unique index on `invoice_order_items`. |
| Storage space charge | 🟡 | Flat fee per 30 days, pro-rated by days in the period. A smarter space model (volume, locations) is a later step. |

Money correctness found while auditing finance (fixed in the same change, also waiting for the migration):
- COD in SYP was added to the USD client account without conversion (Madino: 170,000 SYP counted as 170,000 USD pending). Now converted to USD when the COD record is created (rate and source stored), credited from the stored USD amount, and refused with a clear message when no rate exists.
- Pending balance was decremented by the credited amount (original plus adjustments) although only the original had been added. Now decremented by what was added.
- Shipping-fee debits and adjustments used the order currency as if it were USD. Now converted.
- `POST /finance/accounts/reconcile` (super admin; dry run by default) fills COD USD amounts and recomputes pending balances; it only reports current balance differences.

## Smaller modifications

| Request | Status | Notes |
|---|---|---|
| GRN and DN saved with a readable name ("GRN-2026-00025 - Client name.pdf") instead of an internal id | ✅ | Short-lived signed link whose last path segment is the real file name; Arabic documents get "(AR)". |
| OMS list: QR scans accumulate (10, 20 orders) instead of replacing each other | ✅ | Scanner stays open; scanned codes shown as removable chips; backend search accepts several terms (comma or line separated). |
| Copy shipment info button on OMS order details | ✅ | Order, recipient, phone, address, carrier, tracking number. |
| OMS list: two columns before Actions (contents, last carrier status) | ✅ | Last carrier status is admin only and stripped for clients. |
| OMS list: Group by (city, client, product, carrier, status) | ✅ | Groups the rows of the current page. Whole-result grouping needs a server query (later). |
| Sidebar collapse button | ✅ | Remembered per browser. |
| Less padding around tables | ✅ | Pages are no longer capped at 1280 px; table cell and page padding reduced. |
| COD status synced from the carrier by webhook | 🔴 | **Verified at the carriers (3 Nov):** Babel (webhooks.yaml: ChangedReceiver, ArrivedToHub, EnRoute, DeliveryContact, DeliveryFailed, CreatedFollowupShipment, OutForDelivery, Delivered, ReturnedToSender, Disposed, ShipmentLost; no cod/settle/remit/payment term anywhere), Sena (portal webhook events: create, any status, out for delivery, delivered, failed, in return, returned, cancel), Sila (cargo.created, courier_barcode_assigned, status_changed, delivered, returned, cancelled; and no webhook is registered on the account at all). None sends a COD settlement event. Carrier webhooks carry shipment events only. "COD available / remitted" is a settlement event that Babel shows in its portal; none of the three carriers sends it by webhook or API today. Delivered already creates the COD record. Needs each carrier to expose a COD settlement feed; until then remittance stays a manual confirmation. |
| Google Sheets per client (inbound, outbound, OMS) as an alternative to the API | 🔴 | Needs a Google Workspace app (OAuth, Apps Script or Sheets API), per-client sheet provisioning and a two-way sync with the order API. It is a separate project; proposed approach is an Apps Script template per client calling the existing client API key. Not started. |
| Roles (viewer, accountant, inventory ...), editable permissions, super admin creating roles, RBAC review | ⬜ | Large: needs a permissions model and a full RBAC matrix test (X01). Not started. |
| Import template and sheets with drop-down lists (country code, governorate, city, area) | ⬜ | Needs the location hierarchy cleaned first (D-003) so lists are right. |
| CSV and Excel export everywhere | ⬜ | Audit of every list first. |
| Reports and charts review | ⬜ | Part of the report pass (F33). |

## Currency model (owner decision 3 Nov)

The system distinguishes three currencies: US dollar, old Syrian pound (stored code `SYP`, all existing data), new Syrian pound (`SYP_NEW`). 1 new = 100 old. Any amount in a pound carries its unit; carriers receive only the currency they use (USD or SYP), never several. Values can be shown in all three. Built: `common/money/currency.ts` and `lib/money.ts`, carrier prices labelled with the carrier's unit, COD collection converted to the carrier's unit, finance converts any currency to USD, order currency selector (USD / new / old), carrier cards show the other two values. Babel states its unit itself in `calculatePrice` (`isNewSYP`) and expects `cod.isNewSYP` on create: both are now used.
