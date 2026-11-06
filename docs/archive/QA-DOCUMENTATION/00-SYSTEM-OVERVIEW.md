# 00 — System Overview

**Confidence:** High for portal structure and primary lifecycle. Medium for edge commercial statuses rarely used in new flows.

---

## What the system is

EMDAD is a **3PL warehouse management system (WMS)** with an integrated **order management (OMS)** layer for ecommerce / online orders, plus **billing**, **documents**, and **client self-service**.

Two separate web portals exist:

| Portal | Who uses it | Staging URL |
|--------|-------------|-------------|
| **Admin portal** | Warehouse staff, managers, finance, super admins | https://staging-admin.emdadsy.com |
| **Client portal** | Merchant / client company users | https://staging-client.emdadsy.com |

Users log into **one** portal based on their account type. Admin accounts cannot use the client portal login, and client accounts cannot use the admin portal login.

---

## Who uses the system

### Admin-side roles (internal)

| Role (system) | Friendly label often shown | Typical job |
|---------------|----------------------------|-------------|
| `super_admin` | Super admin | Full control, including sensitive backups / lifecycle |
| `wh_manager` | Admin | Day-to-day warehouse & catalog management |
| `wh_operator` | Worker | Tasks, cycle counts, returns, contracts execution |
| `finance` | Finance | Dashboards, reports, billing visibility, OMS visibility (nav) |

### Client-side roles

| Role | Friendly label | Typical job |
|------|----------------|-------------|
| `client_admin` | Administrator | Full client portal including billing, invoices, APIs, product create/edit |
| `client_staff` | Staff | Operational orders & inventory view; no billing/APIs/product mutations |

Warehouse **worker profiles** (picker, packer, QA, receiver, dispatcher) may be linked to operator users for task assignment and cycle-count “My tasks”. That is operational assignment, not a separate login portal.

---

## Portals at a glance

### Admin portal — used for

- Approving client-submitted inbound / outbound / OMS orders
- Running warehouse work (receiving, putaway, pick, pack, shipping, dispatch)
- Managing clients (companies), products, warehouses, locations
- Inventory visibility and adjustments
- OMS commercial tracking (delivery, COD, ecommerce returns)
- Billing plans and invoices
- Documents (GRN, delivery notes, final contracts)
- Reports, audit logs, backups, shipping carrier connections

### Client portal — used for

- Creating online (OMS) orders, inbound receipts, outbound shipments, returns
- Confirming / cancelling early OMS orders
- Viewing stock availability (product-level, not bin/lot detail)
- Viewing COD / “My profits”
- Billing & invoices (**client_admin only**)
- Managing API credentials (**client_admin only**)
- Notifications and profile photo

---

## Major modules (conceptual)

```text
Admin
├── Dashboard
├── WMS: Inbound, Outbound, Inventory, Tasks, Cycle count, Returns, Products, Locations, Warehouses
├── OMS: Dashboard, Orders, COD, OMS Returns
├── Contracts (GRN / DN / Final contract)
├── Reports
├── Clients
├── Forms
├── Billing
├── Users
├── Audit logs
├── Notifications
├── Backups
└── Shipping Companies

Client
├── Dashboard
├── Store: Online orders, Cash on delivery, Returns
├── Warehouse: Inbound, Outbound, Inventory (products)
└── Account: Notifications, Billing*, Invoices*, APIs*, Profile
```

\* Billing / Invoices / APIs: **client_admin only**.

---

## Main business lifecycle (ecommerce path)

This is the primary cross-module happy path when a **client** creates an online order:

```text
Client creates Online order
        ↓
Status: Waiting for Confirmation
        ↓
Client confirms (or order waits)
        ↓
Status: Confirmed — Waiting for Admin Approval
        ↓
Admin reviews / sets shipping fee if needed / Approves
        ↓
OMS: Processing + linked Outbound order created (Draft)
        ↓
Admin releases warehouse work (approve outbound → Picking)
        ↓
Pick → Pack (if required) → Waiting for Shipping Method
        ↓
Select Manual or Shipping Company → Waiting for Shipping Details
        ↓
Complete shipping details → Waiting for Dispatch (Ready to ship)
        ↓
Dispatch → Shipped
        ↓
Admin marks OMS Delivered (commercial)
        ↓
Optional: COD collection / Remittance (COD orders)
        ↓
Optional: Client creates return after Delivered
        ↓
Billing cycles / invoices (ongoing subscription & usage)
```

### Alternate entry points that exist

- **Admin creates OMS order with fulfillment provisioned** → may start already in Processing with an outbound draft (no client confirmation step).
- **Client creates warehouse Inbound / Outbound** → Waiting for approval → admin approves → warehouse stages.
- **Bulk / import** paths exist on both portals for orders (CSV/XLSX templates).

---

## How modules relate

| Module | Depends on | Affects |
|--------|------------|---------|
| Online (OMS) orders | Products + stock availability | Creates outbound when approved; drives commercial status |
| Outbound | Products, stock, shipping config | Tasks, inventory reservations/decrements, DN documents |
| Inbound | Products | Receiving/putaway tasks, on-hand stock, GRN documents |
| Tasks | Inbound/Outbound/Cycle count | Status progression of parent orders; PDFs |
| Inventory | Products, locations, lots | What can be ordered / picked |
| Billing | Company plan | Can restrict client create actions when restricted / no plan |
| Documents | Completed warehouse stages | Downloadable PDFs |
| Notifications | Order / billing events | Inbox badges on both portals |

---

## Languages & directionality

Both portals support **English** and **Arabic** (user menu Language toggle). Layout may switch direction for Arabic. QA should spot-check critical flows in both languages when language bugs are in scope.

**Confidence:** High that toggles exist; Medium for 100% translation coverage of every string.

---

## What this package does **not** cover

- Source code, APIs, database schemas
- Infrastructure / DevOps except staging URLs needed for testing
- Features that appear only as unused components in code without a routed page
