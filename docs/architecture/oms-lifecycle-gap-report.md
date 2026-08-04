# OMS Lifecycle Gap Report (WP0)

**Date:** 2026-08-03  
**Scope:** `/var/www/emdad-sy-3pl-wms-staging`  
**Purpose:** Validate current schema/APIs/UI against the OMS Lifecycle Architecture before WP1 coding.

## Schema

| Item | Current | Target |
|------|---------|--------|
| `OmsOrderStatus` | 17 values incl. picking/packing/shipped/completed/returned | 5 commercial: Waiting (`pending_approval`), Pending, Out for Delivery, Delivered, Cancelled |
| `CodRecord` / `CodAdjustment` | **Absent** — COD on `OmsOrder`/`OutboundOrder` columns | Independent COD module |
| `OmsReturn` | **Absent** — OMS `returned` status + outbound returned report | Commercial return entity |
| `ReturnOrder` | Warehouse returns exist | Keep; link from OMS Return |
| `OmsOrder.outboundOrderId` | Unique optional FK | Keep (1:1 bridge) |

## APIs

| Flow | Current behavior | Gap |
|------|------------------|-----|
| Client create | `pending_approval` | OK for Waiting |
| Admin create | Also `pending_approval` | Must → Pending + outbound atomic |
| Approve | Creates outbound, sets `approved` | Must set **Pending**; idempotent |
| `mapOutboundStatusToOms` | Mirrors picking/packing/etc. | Only terminal → OFD |
| Mark Delivered | Status only | Must create COD (WP3) |
| COD collect/settle | On OMS order fields | Replace with COD module (WP3) |
| OMS Return approve | N/A | WP4 |

## Frontend

| Surface | Current | Gap |
|---------|---------|-----|
| Dashboard | KPIs include approved/allocated, OFD; donut has WMS stages | Commercial KPIs only |
| List | Filters all warehouse statuses | Commercial filters only |
| Detail | Warehouse (WMS) section with status | Link to outbound only |
| COD UI | Report shell behind flag | Real COD module |
| Returns UI | Outbound-returned report | OMS Return module |

## Invariant violations today

1. OMS status mirrors WMS stages (picking/packing) — **breaks invariant 14**
2. No CodRecord — Delivered does not create COD — **breaks invariant 9** (until WP3)
3. No OMS Return → Warehouse Return bridge — **breaks invariant 8/10** (until WP4)
4. Admin create does not skip approval — **breaks create rules**

## Exit

WP0 complete. WP1 implements against this report.
