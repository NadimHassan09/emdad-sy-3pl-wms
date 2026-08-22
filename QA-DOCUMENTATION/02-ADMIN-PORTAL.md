# 02 — Admin Portal

**Confidence:** High for navigation and page inventory. Medium for every button on every detail page (detail pages are large; key CTAs are documented in workflow files).

**Base URL (staging):** https://staging-admin.emdadsy.com

---

## Shell chrome

### Sidebar

Grouped navigation (English labels):

```text
Dashboard
WMS
  Inbound
  Outbound
  Inventory
  Tasks
  Cycle count
  Returns
  Products
  Locations
  Warehouses
OMS
  OMS Dashboard
  OMS Orders
  COD                    (feature-flagged)
  OMS Returns            (feature-flagged)
Contracts
Reports
Clients
Forms
Billing                  (deep-links to /billing/plans)
Users
Audit logs
Notifications
Backups
Shipping Companies
```

Exact visibility depends on role (see `01-AUTHENTICATION-AND-ROLES.md`).

### Topbar

- Quick jump search
- Theme toggle
- Notifications
- User menu: Profile, Language (EN/AR), Sign out

### Section sub-nav (tabs)

When inside certain areas, horizontal tabs appear (examples):

| Area | Tabs |
|------|------|
| Inventory | Stock · Adjustments |
| Orders lists | Inbound orders · Outbound orders |
| OMS | OMS Dashboard · OMS Orders · COD · OMS Returns |
| Tasks | Tasks · typed filters (Receiving, QC, Putaway, …) |
| Contracts | GRN · Delivery note · Final contract |
| Users | Warehouse users · Client users |
| Billing | Dashboard · Plans · Invoices |
| Backups | Overview · Scheduled · Retention · Health · Google Drive (flag) |
| Cycle count | Dashboard · My tasks (if worker linked) |

---

## Module pages (catalog)

### Dashboard

| Path | Purpose |
|------|---------|
| `/dashboard/overview` | KPIs and Quick Actions |

**Quick Actions (examples):** New Client, New Inbound, New Outbound, Create Invoice, New Contract; more links to Products, Warehouses, Billing, Reports, Inventory.

**Expected UI states:** Loading skeleton/cards; empty metrics when no data.

---

### Products

| Path | Purpose |
|------|---------|
| `/products` | Catalog list |
| `/products/:sku` | Product detail |

**Typical actions:** New product; search / barcode scan (list); open detail.

**Status / health:** Stock health concepts appear in inventory views (Healthy / Low / Critical / Out of Stock). Product lifecycle labels: **UNKNOWN / NEEDS VERIFICATION** for full filter set on products list.

---

### Locations & Warehouses

| Path | Purpose |
|------|---------|
| `/locations` | Storage locations |
| `/warehouses` | Warehouses |

**Location actions:** New location, Edit, Suspend/activate.

**Location status labels:** Active · Suspended · Archived  
**Location types include:** Aisle, Storage, Fridge, Packing, Receiving dock, Shipping dock, Quarantine, Scrap.

**Warehouse statuses:** active · inactive.

---

### Inventory

| Path | Purpose |
|------|---------|
| `/inventory/stock` | On-hand stock |
| `/inventory/product/:productId` | Stock by product |
| `/inventory/adjustments` | Adjustments list |
| `/inventory/adjustments/:id` | Adjustment detail |
| Ledger deep links | Ledger entry / by reference |

**Actions:** New adjustment; cancel draft adjustment.

**Adjustment statuses:** draft · approved · cancelled.

See `07-INVENTORY.md`.

---

### Inbound / Outbound orders

| Path | Purpose |
|------|---------|
| `/orders/inbound` | List |
| `/orders/inbound/new` | Create |
| `/orders/inbound/:id` | Detail / workflow |
| `/orders/inbound/:id/edit` | Edit plan |
| `/orders/outbound` | List |
| `/orders/outbound/new` | Create |
| `/orders/outbound/:id` | Detail / workflow |
| `/orders/outbound/:id/edit` | Edit plan |

**List actions:** New, Import, Export CSV; row open detail.

See `04-INBOUND-WORKFLOW.md` and `05-OUTBOUND-WORKFLOW.md`.

---

### OMS

| Path | Purpose |
|------|---------|
| `/oms/dashboard` | OMS KPIs |
| `/orders/oms` | Orders list |
| `/orders/oms/new` | Create OMS order |
| `/orders/oms/:id` | Detail |
| `/oms/cod` | COD records |
| `/oms/cod/:id` | COD detail |
| `/oms/returns` | Ecommerce returns |
| `/oms/returns/:id` | Return detail |
| `/oms/returns/:id/edit` | Edit return plan |

See `06-OMS-WORKFLOW.md` and `16-RETURNS.md`.

---

### Tasks & Internal transfer

| Path | Purpose |
|------|---------|
| `/tasks` | Task list |
| `/tasks/:id` | Detail |
| `/tasks/:id/execute` | Execution UI |
| `/internal` | Internal transfer |

See `08-TASKS.md`.

---

### Cycle count

| Path | Purpose |
|------|---------|
| `/cycle-count` | Sessions / schedule |
| `/cycle-count/my-tasks` | Worker tasks |
| `/cycle-count/:id` | Detail / review |
| `/cycle-count/:id/execute` | Blind count |

**Session statuses:** scheduled · in_progress · pending_review · completed · cancelled.

Creation entry from list: **UNKNOWN / NEEDS VERIFICATION**.

---

### Returns (WMS)

| Path | Purpose |
|------|---------|
| `/returns` | List |
| `/returns/:id` | Detail |
| `/returns/:id/process` | Process |

See `16-RETURNS.md`.

---

### Contracts / Documents

| Path | Purpose |
|------|---------|
| `/contracts/grn` | GRN slots |
| `/contracts/dn` | Delivery notes |
| `/contracts/final-contract` | Final contracts |

Actions: **Create PDF** / **Open PDF** (EN/AR). See `10-DOCUMENTS.md`.

---

### Clients

| Path | Purpose |
|------|---------|
| `/clients` | Companies |
| `/clients/:id` | Company detail |

**Actions:** + New company, Edit.  
**Company statuses include:** active, paused, offboarding, closed, restricted, suspended, archived, purged.

---

### Users

| Path | Purpose |
|------|---------|
| `/users/warehouse_users` | Warehouse users |
| `/users/client_users` | Client users |
| Detail pages | Edit / view |

**User statuses:** active · inactive. Online/offline may show via realtime.

---

### Billing

| Path | Purpose |
|------|---------|
| `/billing/dashboard` | Overview |
| `/billing/plans` | Plans |
| `/billing/plans/new` | Create |
| `/billing/plans/:clientId` | Detail |
| `/billing/plans/:clientId/edit` | Edit |
| `/billing/templates` | Templates |
| `/billing/invoices` | Invoices |
| `/billing/invoices/:id` | Invoice detail |

See `09-BILLING.md`.

---

### Reports

Under `/reports/*` with a pill nav of report titles (Warehouse Analysis, Inventory, Product Moves, Stock Aging, Capacity, Return Rate, Revenue by Client, Receivables Aging, Worker Productivity, Order Cycle Time, Inbound Accuracy, Outbound Fill Rate, SLA Compliance, Merchant Orders, Sales, Delivery, Allocation, Inventory Reserved, etc.).

COD/Returns “report” nav may redirect into OMS modules when that UI is enabled.

---

### Notifications, Audit, Forms, Profile, Backups, Shipping

| Path | Purpose |
|------|---------|
| `/notifications` | Inbox |
| `/audit-logs` | Audit stream |
| `/forms` | Form submissions |
| `/profile` | Profile |
| `/backups*` | Backup ops |
| `/shipping/companies` | Carrier connections |

See `11-NOTIFICATIONS-AND-REALTIME.md` and `17-SHIPPING-AND-CARRIERS.md`.

---

## Shared list patterns

Most admin lists support some combination of:

- Search / filters / status chips
- Pagination
- Export CSV (orders)
- Primary **+ New** / Create button
- Click row → detail

Empty and loading states: see `12-UI-BEHAVIOR.md`.

---

## Cross-links from Dashboard Quick Actions

Quick Actions are shortcuts into create flows. After using them, QA should verify the destination form matches the labeled action (New Inbound → inbound create, etc.).
