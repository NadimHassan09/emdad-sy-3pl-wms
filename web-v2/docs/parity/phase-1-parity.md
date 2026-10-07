# Phase 1 parity sheet

Legend: ✔ same behaviour · ◐ same behaviour, deliberate improvement · ⏳ deferred (falls back to the classic UI)

## Login (admin + client)
| Item | Status | Notes |
|---|---|---|
| Email/password, remember 30 days, remembered-account "Continue as…", remove remembered | ✔ | Same storage keys and endpoints (copied logic). |
| Admin: Google sign-in button + callback handling | ✔ | |
| Client: inactive account → `/account-inactive`; copy-support-email | ✔ | |
| Return-to path after login | ✔ | Admin keeps `next` + stored path; client keeps `from`. |
| Follows light/dark theme | ◐ | D9: classic forced light on login. |
| Digits in Arabic | ◐ | D9: Latin digits everywhere (`ar-SY-u-nu-latn`). |

## Dashboards
| Item | Status | Notes |
|---|---|---|
| Admin overview: KPIs, charts, queues, filters (warehouse/client/period), export, notifications | ✔ | Same endpoints/queries. |
| Admin: `window.confirm` replaced by `ConfirmDialog` | ◐ | D9. |
| Client: 4 top KPIs, 7-day order-movement donut, order-summary status row with month/date/channel filters, live inventory, orders needing attention, 4 finance cards, recent activity | ✔ | Same queries and bucket rules. |
| Client: "Reset" is ghost, not red; status colours from the shared tone map | ◐ | Audit F1–F4. |
| Client: "Orders needing attention" subtitle wording | ◐ | Text now matches what the query really lists (waiting for confirmation / approval). |
| Client: return statuses translated (EN/AR) instead of raw enum | ◐ | |

## Admin OMS Orders list
| Item | Status | Notes |
|---|---|---|
| 10 status cards remain **filter cards**; stage chips (processing) | ✔ | |
| Advanced filters, search, sort, server pagination (chunked fetch + UI page size) | ✔ | Page-size choices are presets only. |
| Row menu: confirm, approve, picking, packing, shipping complete, dispatch, delivered, failed delivery, returned, cancel, delete | ✔ | Cancel/Delete/Bulk-cancel use `ConfirmDialog`. |
| Scan by waybill/QR (camera + manual), status scan transitions | ✔ | |
| Import / export dialogs, create batch, add to batch | ✔ | |
| Bulk selection toolbar + bulk result dialog | ✔ | |
| Edit order modal | ⏳ | Opens classic UI. |
| Waybill modal, single "complete shipping details" modal | ⏳ | Opens classic UI. |
| Custom page-size input | ⏳ | Presets only. |

## Platform
| Item | Status | Notes |
|---|---|---|
| Sidebar collapses to off-canvas below 1024px (was 768) | ◐ | Fixes overflow at 768. |
| Tables/cards respond to container width, not viewport | ◐ | |
| Not-yet-rebuilt routes keep their URL and show "Open in classic interface" | ✔ | |

## OMS module (post–Phase 1 continuation)

| Route | Status |
|---|---|
| `/oms/dashboard` | ✔ native |
| `/orders/oms` | ✔ native (Edit / Waybill / Shipping details dialogs now native) |
| `/orders/oms/new` | ✔ native |
| `/orders/oms/:id` | ✔ native |
| `/orders/oms/:id/waybill` | ✔ native |
| `/oms/batches`, `/oms/batches/:id` | ✔ native |
| `/oms/cod`, `/oms/cod/:id` | ✔ native |
| `/oms/returns`, `/oms/returns/:id`, `/oms/returns/:id/edit` | ✔ native |
| `/oms/orders/:id` (+ waybill) | ✔ redirect → `/orders/oms/...` |

Deferred earlier list modals (Edit, Waybill, Complete shipping details) are rebuilt. Bulk shipping details on batches uses a lean V2 dialog (carrier/manual) rather than the full classic CarrierShippingDetailsForm UX.

## WMS module (admin)

All primary WMS nav routes are native in web-v2:

| Area | Routes |
|---|---|
| Inbound | `/orders/inbound`, `/new`, `/:id`, `/:id/edit` |
| Outbound | `/orders/outbound`, `/new`, `/:id`, `/:id/edit` (+ directed redirect) |
| Inventory | `/inventory/stock`, `/product/:id`, `/ledger…`, `/adjustments…` |
| Tasks | `/tasks`, `/tasks/:id` (`/execute` → redirect) |
| Cycle count | `/cycle-count`, `/my-tasks`, `/:id`, `/:id/execute` |
| Products | `/products`, `/products/:sku` |
| Locations | `/locations` |
| Warehouses | `/warehouses` |
| WMS Returns | `/returns`, `/:id`, `/:id/process` |

Notes: Outbound/OMS shipping UIs are leaner than classic carrier-quote forms where noted. Reports and management (Users/Clients/Billing/…) remain notMigrated.
