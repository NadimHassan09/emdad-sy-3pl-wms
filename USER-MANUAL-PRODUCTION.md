# Emdad SY 3PL WMS — Production User Manual

**Version:** Production (audited from live UI, June 2026)  
**Audience:** Warehouse staff, warehouse managers, finance users, super administrators, and client portal users  
**Language:** Simple business English

This manual describes the **actual screens and routes** in the production system. It was built by auditing the admin app (`frontend/`) and the client portal (`client-frontend/`), not from outdated documentation.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Roles at a Glance](#2-roles-at-a-glance)
3. [Admin Portal — Page Guide](#3-admin-portal--page-guide)
4. [Client Portal — Page Guide](#4-client-portal--page-guide)
5. [Step-by-Step Workflows](#5-step-by-step-workflows)
6. [Screenshot & Evidence References](#6-screenshot--evidence-references)
7. [Quick Reference Tables](#7-quick-reference-tables)

---

## 1. Getting Started

### 1.1 Two separate applications

| Application | Who uses it | Typical URL |
|-------------|-------------|-------------|
| **Admin WMS** | Warehouse staff, managers, finance, super admin | Your admin site (e.g. `admin.yourcompany.com`) |
| **Client Portal** | Your customers’ staff | Your client site (e.g. `portal.yourcompany.com`) |

Each app has its own login screen. Use the account your administrator gave you.

### 1.2 Logging in

**Admin WMS**

1. Open the admin website.
2. Enter your **email** and **password**.
3. Click **Sign in**.
4. You are taken to your **home page** based on your role:
   - **Warehouse operator** → **Tasks** (`/tasks`)
   - **Everyone else** → **Dashboard** (`/dashboard/overview`)

**Client Portal**

1. Open the client portal website.
2. Enter your email and password.
3. Click **Sign in**.
4. You land on **Dashboard** (`/dashboard`).

> **Screenshot reference:** Shared login layout — `docs/evidence/release-r3-e2e/` (workflow certification captures).

### 1.3 Navigation basics

**Admin WMS** — left sidebar shows only the sections your role can access. Some sections have **tabs** at the top of the page (for example Inventory → Stock / Ledger / Adjustments).

**Client Portal** — left sidebar plus an **Orders** tab row (Inbound / Outbound) when you are in the orders area.

**Top bar (both apps)** — language toggle (English / Arabic), notifications bell, and your user menu (logout).

### 1.4 Language

Both apps support **English** and **Arabic**. Use the language control in the top bar. Labels and dates follow your chosen language.

---

## 2. Roles at a Glance

### 2.1 Admin WMS roles

| Role | Who | Home page | Main work |
|------|-----|-----------|-----------|
| **Super admin** | IT / system owner | Dashboard | Full system access, backups, factory reset |
| **Warehouse manager** | Warehouse supervisor | Dashboard | Products, locations, orders, tasks, settings |
| **Warehouse operator** | Floor staff | Tasks | Receiving, putaway, pick, pack, ship, cycle count, returns |
| **Finance** | Billing / accounts | Dashboard | Reports, billing, invoices, audit logs (read-focused) |

### 2.2 Client portal roles

| Role | Who | Can see |
|------|-----|---------|
| **Client admin** | Customer’s main contact | Dashboard, orders, products, stock, billing, notifications |
| **Client staff** | Customer’s day-to-day user | Dashboard, orders, stock, notifications — **not** products or billing |

If client staff try to open Products or Billing, the system sends them to Stock or Dashboard.

---

## 3. Admin Portal — Page Guide

Routes below are relative to your admin site root (no `/api` prefix).

---

### 3.1 Dashboard

| | |
|---|---|
| **Route** | `/dashboard/overview` |
| **Navigation** | Sidebar → **Dashboard** |
| **Who can access** | Super admin, warehouse manager, finance |
| **Purpose** | One-screen view of warehouse health: open orders, stock highlights, charts, and KPIs. |

**How to use**

1. Open **Dashboard** from the sidebar.
2. Review the summary cards (open inbound/outbound, stock, tasks).
3. Use charts for open-order trends (if shown).
4. Click links on cards to jump to the related list (orders, inventory, etc.).

**Common workflow** — Morning warehouse check: manager opens dashboard, scans open inbound/outbound counts, then goes to **Tasks** or **Orders** for follow-up.

**Common mistakes**

- Expecting operators to see this page — operators land on **Tasks**, not Dashboard.
- Treating dashboard numbers as real-time to the second; data refreshes when you load the page.

**Expected outcome** — Clear picture of what needs attention today without opening every module.

> **Screenshot reference:** `docs/evidence/release-r3-e2e/` (dashboard overview).

---

### 3.2 Products

| | |
|---|---|
| **Routes** | `/products` (list), `/products/:sku` (detail) |
| **Navigation** | Sidebar → **Products** |
| **Who can access** | Super admin, warehouse manager |

**Purpose** — Create and maintain the product catalog (SKU, name, barcode, dimensions, client assignment).

**How to use**

1. Open **Products**.
2. Use search/filters (name, SKU, barcode, client).
3. Click a row to open the product detail page.
4. On detail: view stock summary, edit fields, manage lots if applicable.
5. Use **New product** (or equivalent action) on the list to add a product.

**Common workflow** — New client onboarding: create products for that client before receiving stock.

**Common mistakes**

- Creating duplicate SKUs for the same client.
- Forgetting to assign the correct **client (company)** on the product.
- Editing product data while inbound is in progress — can cause receiving confusion.

**Expected outcome** — Every physical item has a unique SKU in the system before inbound or stock movements.

---

### 3.3 Locations

| | |
|---|---|
| **Route** | `/locations` |
| **Navigation** | Sidebar → **Locations** |
| **Who can access** | Super admin, warehouse manager |

**Purpose** — Manage storage locations (bins, aisles, zones) inside warehouses.

**How to use**

1. Open **Locations**.
2. Filter by warehouse, type, or search by name/barcode.
3. Create or edit locations; set type (storage, fridge, quarantine, scrap, etc.).
4. Use barcodes on location labels for scanning during putaway and picking.

**Common workflow** — Warehouse layout change: add new bin locations before putaway tasks are executed.

**Common mistakes**

- Putting stock in a location that is not **active** or wrong type (e.g. quarantine used as normal storage).
- Duplicate barcodes on different locations.

**Expected outcome** — Every physical bin exists in the system and is scannable.

---

### 3.4 Warehouses

| | |
|---|---|
| **Route** | `/warehouses` |
| **Navigation** | Sidebar → **Warehouses** |
| **Who can access** | Super admin, warehouse manager |

**Purpose** — Define warehouse sites (codes, names, status) used across orders, stock, and tasks.

**How to use**

1. Open **Warehouses**.
2. View list of warehouses.
3. Create or edit warehouse records.
4. Ensure each warehouse has locations configured under **Locations**.

**Common mistakes**

- Confirming inbound/outbound against the wrong warehouse.
- Deactivating a warehouse that still holds stock.

**Expected outcome** — All operations are tied to the correct physical site.

---

### 3.5 Inventory (section)

The **Inventory** sidebar item opens the inventory area. Use the **tabs** at the top to switch between Stock, Ledger, and Adjustments.

| Tab | Route |
|-----|-------|
| Stock | `/inventory/stock` |
| Ledger | `/inventory/ledger` |
| Adjustments | `/inventory/adjustments` |

**Who can access (all inventory tabs)** — Super admin, warehouse manager, finance (finance is typically view-only for operational changes).

---

### 3.6 Stock

| | |
|---|---|
| **Routes** | `/inventory/stock`, `/inventory/product/:productId` |
| **Navigation** | Sidebar → **Inventory** → tab **Stock** |
| **Who can access** | Super admin, warehouse manager, finance |

**Purpose** — See **current quantity on hand** by product, location, lot, and warehouse.

**How to use**

1. Open **Inventory → Stock**.
2. Filter by warehouse, client, product, status, or search.
3. Click a product row to open **product stock detail** (`/inventory/product/:productId`) for location-level breakdown.
4. Use pagination to browse large catalogs.

**Common workflow** — Manager checks whether SKU is available before confirming an outbound order.

**Common mistakes**

- Confusing **on-hand** with **reserved** or **available to promise** — check order and task status too.
- Looking at the wrong warehouse filter.

**Expected outcome** — Accurate view of where stock sits right now.

> **Screenshot reference:** `docs/evidence/release-r3-e2e/` (inventory/stock list).

---

### 3.7 Ledger

| | |
|---|---|
| **Routes** | `/inventory/ledger`, `/inventory/ledger/line/:ledgerId/:createdAt`, `/inventory/ledger/:referenceType/:referenceId` |
| **Navigation** | Sidebar → **Inventory** → tab **Ledger** |
| **Who can access** | Super admin, warehouse manager, finance |

**Purpose** — **History** of every stock movement (receive, putaway, pick, adjust, transfer, etc.).

**How to use**

1. Open **Inventory → Ledger**.
2. Filter by date, client, product, movement type, warehouse, or reference.
3. Click a movement to open the **line detail** page.
4. Use reference links to see all movements for one inbound/outbound/adjustment.

**Common workflow** — Dispute investigation: finance filters ledger by client and date to trace a quantity change.

**Common mistakes**

- Expecting ledger to show **future** reservations — it shows **completed** movements.
- Forgetting to set the warehouse filter when investigating a specific site.

**Expected outcome** — Full audit trail from receipt to shipment.

---

### 3.8 Adjustments

| | |
|---|---|
| **Routes** | `/inventory/adjustments`, `/inventory/adjustments/:id` |
| **Navigation** | Sidebar → **Inventory** → tab **Adjustments** |
| **Who can access** | Super admin, warehouse manager, finance (view); operators use cycle count / returns instead |

**Purpose** — Formal stock corrections (damage, loss, found stock) with approval workflow.

**How to use**

1. Open **Inventory → Adjustments**.
2. Click **New adjustment** to create a draft.
3. Add lines (product, location, quantity change, reason).
4. Open the adjustment detail page to **approve**, **post**, or **cancel**.
5. Posted adjustments update stock and appear in the ledger.

**Common workflow** — After cycle count approval, manager posts reconciliation adjustments (see [Cycle count workflow](#56-performing-a-cycle-count)).

**Common mistakes**

- Posting before lines are reviewed.
- Wrong sign on quantity (increase vs decrease).

**Expected outcome** — Stock matches physical reality with an approved paper trail.

---

### 3.9 Internal Transfers

| | |
|---|---|
| **Route** | `/internal` |
| **Navigation** | Sidebar → **Tasks** → tab **Internal transfer** (not a top-level sidebar item) |
| **Who can access** | Super admin, warehouse manager only |

**Purpose** — Move stock between locations **inside the same warehouse** without an inbound/outbound order.

**How to use**

1. Go to **Tasks → Internal transfer**.
2. Select client and warehouse.
3. Search for the product (name, SKU, or barcode scan).
4. Choose **from location**, **to location**, and quantity.
5. Submit the transfer.
6. Confirm success message; verify in **Inventory → Stock** and **Ledger**.

**Common mistakes**

- Operators cannot access this page — they must ask a manager.
- Transferring more than available at the source location.
- Transferring between warehouses (use outbound/inbound instead).

**Expected outcome** — Stock quantity decreases at source and increases at destination; ledger shows an internal transfer movement.

---

### 3.10 Inbound Orders

| | |
|---|---|
| **Routes** | `/orders/inbound`, `/orders/inbound/:id` |
| **Navigation** | Sidebar → **Orders** → tab **Inbound orders** |
| **Who can access** | Super admin, warehouse manager, finance |

**Purpose** — Plan and track **incoming** shipments from clients.

**How to use — list**

1. Open **Orders → Inbound orders**.
2. Filter by status, client, warehouse, dates.
3. Click **New inbound** (or similar) to create an order.
4. Add lines (product, expected quantity).

**How to use — detail** (`/orders/inbound/:id`)

1. Review order number, client, status, expected arrival, and lines.
2. **Approve** or **Confirm** the order when goods are expected (wording depends on status).
3. For **task-based receiving** (typical for operators): confirmation creates **receiving tasks** — operators complete them under **Tasks**.
4. For **direct receive** (manager mode): use **Receive** on each line with quantity and location.
5. **Cancel** only while order is still open/draft.

**Common workflow** — See [Receiving inventory](#51-receiving-inventory).

**Common mistakes**

- Confirming without selecting the correct **warehouse**.
- Receiving more than expected without noting shortfall/overage.
- Finance users trying to execute receives — they usually only monitor status.

**Expected outcome** — Status moves from draft → confirmed → in progress → partially received / completed; stock increases when receiving is posted.

> **Screenshot reference:** `docs/evidence/release-r3-e2e/` (inbound list, receiving).

---

### 3.11 Outbound Orders

| | |
|---|---|
| **Routes** | `/orders/outbound`, `/orders/outbound/:id` |
| **Navigation** | Sidebar → **Orders** → tab **Outbound orders** |
| **Who can access** | Super admin, warehouse manager, finance |

**Purpose** — Plan and track **outgoing** shipments to clients’ customers.

**How to use — detail**

1. Create outbound with lines (product, requested quantity).
2. **Approve** if status is `pending_approval`.
3. **Confirm & start workflow** (task mode) or **Confirm & deduct stock** (direct mode).
4. Operators complete pick → pack → dispatch tasks.
5. **Cancel** only when allowed by status.

**Common workflow** — See [Shipping inventory](#52-shipping-inventory).

**Common mistakes**

- Confirming when stock is insufficient — order may go to `pending_stock`.
- Skipping pack task when packing is required for the order.

**Expected outcome** — Stock is reserved/picked/shipped; order ends as completed or cancelled.

---

### 3.12 Tasks

| | |
|---|---|
| **Routes** | `/tasks`, `/tasks/:id`, `/tasks/:id/execute` |
| **Navigation** | Sidebar → **Tasks** |
| **Who can access** | Super admin, warehouse manager, warehouse operator |

**Task type tabs** (under Tasks section): All tasks, Receive, Putaway, Pick, Pack, Delivery — each filters `?taskType=…`

**Purpose** — **Work queue** for floor staff: receiving, QC, putaway, pick, pack, dispatch.

**How to use**

1. Open **Tasks** (operators land here after login).
2. Filter by type, status, warehouse.
3. Open a task → review instructions and assigned worker.
4. Click **Execute** (`/tasks/:id/execute`) when status is **in progress**.
5. Fill in quantities, locations, barcodes as prompted.
6. Submit to complete the task; next workflow task may appear automatically.

**Task types**

| Type | What the operator does |
|------|------------------------|
| **Receiving** | Enter received quantities per inbound line |
| **QC** | Pass/fail quantities after receive |
| **Putaway** | Move received stock to storage locations |
| **Pick** | Pick stock from locations for outbound |
| **Pack** | Confirm packed quantities |
| **Dispatch** | Confirm shipment / ship quantities |

**Common mistakes**

- Starting execute before assigning a worker (when assignment is required).
- Wrong location scan during putaway or pick.
- Completing pick with short quantity without supervisor awareness.

**Expected outcome** — Task status becomes **completed**; stock and order status update; next task in chain unlocks.

> **Screenshot reference:** `docs/evidence/release-r3-e2e/` (task execution panels).

---

### 3.13 Returns

| | |
|---|---|
| **Routes** | `/returns`, `/returns/:id`, `/returns/:id/process` |
| **Navigation** | Sidebar → **Returns** |
| **Who can access** | Super admin, warehouse manager, warehouse operator |

**Purpose** — Handle **customer returns** back into the warehouse.

**How to use**

1. **Returns** list — filter by status/client.
2. Create or open a return order.
3. On detail: **Confirm** (manager), **Start receiving** (operator), **Process** (`/returns/:id/process`) to inspect lines.
4. Manager: **Post inventory** and **Complete** when finished.

**Common workflow** — See [Processing returns](#54-processing-returns).

**Common mistakes**

- Completing before physical inspection.
- Posting inventory before quantities are verified.

**Expected outcome** — Return order completed; stock updated (or scrapped/quarantined per process); ledger entries created.

---

### 3.14 Cycle Count

| | |
|---|---|
| **Routes** | `/cycle-count`, `/cycle-count/my-tasks`, `/cycle-count/:id`, `/cycle-count/:id/execute` |
| **Navigation** | Sidebar → **Cycle count** |
| **Who can access** | Super admin, warehouse manager, warehouse operator |

**Tabs**

| Tab | Route | Who |
|-----|-------|-----|
| Dashboard | `/cycle-count` | All roles above |
| My tasks | `/cycle-count/my-tasks` | Operators with a **worker profile** linked to their user |

**Purpose** — Physical inventory counts and variance resolution.

**How to use**

1. Manager creates a cycle count session from the dashboard.
2. Operators open **My tasks** or the session **Execute** page to enter counted quantities.
3. Manager reviews **variances** on the session detail page — approve or reject with reason.
4. **Build reconciliation** → **Post reconciliation** to adjust stock.

**Common workflow** — See [Performing a cycle count](#53-performing-a-cycle-count).

**Common mistakes**

- Operator account without **worker ID** cannot see My tasks.
- Posting reconciliation before all variances are reviewed.

**Expected outcome** — System stock aligned with physical count; approved variances posted to inventory.

---

### 3.15 Reporting

| | |
|---|---|
| **Routes** | `/reports` (redirects to warehouse analysis), plus 14 report pages under `/reports/…` |
| **Navigation** | Sidebar → **Reports** |
| **Who can access** | Super admin, warehouse manager, finance |

**Available reports** (tab bar inside Reports)

| Report | Route |
|--------|-------|
| Warehouse Analysis | `/reports/warehouse-analysis` |
| Worker Productivity | `/reports/worker-productivity` |
| Order Cycle Time | `/reports/order-cycle-time` |
| Inbound Accuracy | `/reports/inbound-accuracy` |
| Outbound Fill Rate | `/reports/outbound-fill-rate` |
| SLA Compliance | `/reports/sla-compliance` |
| Inventory | `/reports/inventory` |
| Product Moves | `/reports/product-moves` |
| Stock Aging | `/reports/stock-aging` |
| Lot Expiry | `/reports/lot-expiry` |
| Capacity Utilization | `/reports/capacity-utilization` |
| Return Rate | `/reports/return-rate` |
| Revenue by Client | `/reports/revenue-by-client` |
| Receivables Aging | `/reports/receivables-aging` |

**How to use (all reports)**

1. Open **Reports** and choose a report tab.
2. Set filters (warehouse, client, date range, SKU, status).
3. Click **Generate** to load a **preview page** (50 rows at a time).
4. Use table pagination for more preview rows.
5. **Export CSV** or **Export Excel** downloads the full filtered result from the server (up to system limit).
6. For charts/pivots, set **Group by** and load the aggregate view.

**Common mistakes**

- Assuming preview shows all rows — export for full data.
- Wrong date range excluding the period you need.

**Expected outcome** — Accurate filtered data for operations or finance decisions; export file for sharing.

> **Screenshot reference:** `docs/evidence/reports-perf/` (report preview and export certification).

---

### 3.16 Billing

| | |
|---|---|
| **Routes** | `/billing/dashboard`, `/billing/plans`, `/billing/plans/:clientId`, `/billing/invoices`, `/billing/invoices/:id` |
| **Navigation** | Sidebar → **Billing** (lands on Plans); tabs: Dashboard, Plans, Invoices |
| **Who can access** | Super admin, warehouse manager, finance |

**Purpose** — Manage client **billing plans**, **cycles**, and **invoices**.

**Billing → Dashboard** (`/billing/dashboard`)

- KPIs: expiring cycles, overdue clients, recent invoices, suspended accounts.

**Billing → Plans** (`/billing/plans`)

- List all clients’ plans; filter by expiry, status.
- Create or edit a plan for a client; open `/billing/plans/:clientId` for detail and volume allocation.

**Billing → Invoices** (`/billing/invoices`)

- Search and filter invoices; open detail to change status or add lines.

**Common workflow** — See [Managing billing plans](#55-managing-billing-plans).

**Common mistakes**

- Letting a client cycle expire without renewal — client portal may become **restricted**.
- Editing invoice status without finance approval process.

**Expected outcome** — Clients billed correctly; invoices move draft → open → paid.

> **Screenshot reference:** `docs/evidence/billing-4b/` (billing API/UI certification).

---

### 3.17 Audit Logs

| | |
|---|---|
| **Route** | `/audit-logs` |
| **Navigation** | Sidebar → **Audit logs** |
| **Who can access** | Super admin, warehouse manager, finance |

**Purpose** — Read-only log of important system actions (who did what, when).

**How to use**

1. Open **Audit logs**.
2. Filter by date, user, action type, client.
3. Use pagination — logs can be very large.
4. Export if your role shows an export action.

**Common mistakes**

- Expecting to change or delete log entries — they are permanent.
- Too narrow a date filter and missing the event.

**Expected outcome** — Evidence for compliance and troubleshooting.

---

### 3.18 Notifications

| | |
|---|---|
| **Route** | `/notifications` |
| **Navigation** | Sidebar → **Notifications**; also top-bar bell |
| **Who can access** | All admin roles |

**Purpose** — In-app messages (order updates, billing reminders, system alerts).

**How to use**

1. Click the **bell** for a quick panel, or open **Notifications** for the full list.
2. Mark items read as you work through them.
3. Click a notification to jump to the related record when a link is provided.

**Expected outcome** — Staff see time-sensitive items without refreshing every list page.

---

### 3.19 Backup & Restore (under Settings)

| | |
|---|---|
| **Routes** | See table below |
| **Navigation** | Sidebar → **Settings** |
| **Who can access** | Super admin and warehouse manager (read); **destructive actions** super admin only |

**Settings tabs**

| Tab | Route | Super admin | Manager |
|-----|-------|:-----------:|:-------:|
| History | `/settings/backups` | ✓ | ✓ |
| Upload | `/settings/backups/upload` | ✓ | — |
| Restore | `/settings/backups/restore` | ✓ | — |
| Factory Reset | `/settings/backups/factory-reset` | ✓ | — |
| Scheduled Backups | `/settings/backups/schedules` | ✓ | ✓ |
| Retention | `/settings/backups/retention` | ✓ | ✓ |
| Health | `/settings/backups/health` | ✓ | ✓ |
| Storage Policy | `/settings/backups/storage-policy` | ✓ | ✓ |
| Google Drive | `/settings/backups/google-drive` | ✓* | ✓* |

\*Google Drive tab appears only when enabled by your deployment.

**History page — how to use**

1. View backup jobs (manual, scheduled, upload).
2. Filter by type and status.
3. **Create backup** (super admin) — waits until job completes.
4. **Download** a completed backup file.
5. Open row **detail** for size, duration, storage location.

**Common workflow** — See [Restoring backups](#57-restoring-backups).

**Common mistakes**

- Running restore on a live production system without maintenance window.
- Managers looking for Upload/Restore tabs — only super admin sees them.

**Expected outcome** — Reliable backups; successful restore returns system to the backup point in time.

> **Screenshot reference:** `docs/evidence/backup-qa-1/` (history through factory reset), `docs/evidence/backup-6d/` (retention, storage policy), `docs/evidence/release-r4-dr/` (disaster recovery flow).

---

### 3.20 Settings (overview)

**Purpose** — Central place for **backup and disaster recovery** configuration. There is no separate “general settings” page; Settings opens the backup area.

**Who can access** — Super admin, warehouse manager (limited).

---

### 3.21 Additional admin pages (not in sidebar summary above)

These pages exist in the app and are included for completeness.

#### Customers (client companies)

| | |
|---|---|
| **Routes** | `/clients`, `/clients/:id` |
| **Navigation** | Sidebar → **Customers** |
| **Who can access** | Super admin, warehouse manager |

**Purpose** — Manage 3PL **client companies** (your customers), contact info, and status.

#### Users

| | |
|---|---|
| **Routes** | `/users/warehouse_users`, `/users/warehouse_users/:id`, `/users/client_users`, `/users/client_users/:id` |
| **Navigation** | Sidebar → **Users** (tabs: Warehouse users / Client users) |
| **Who can access** | Super admin, warehouse manager |

**Purpose** — Create and deactivate **admin** and **client portal** user accounts; link operators to worker profiles.

**Common workflow** — See [Creating users](#58-creating-users).

---

## 4. Client Portal — Page Guide

Routes are relative to the client portal root.

---

### 4.1 Dashboard

| | |
|---|---|
| **Route** | `/dashboard` |
| **Navigation** | Sidebar → **Dashboard** |
| **Who can access** | Client admin, client staff |

**Purpose** — Summary of your company’s activity: stock usage, open orders, expiring products, billing status (admin only).

**How to use**

1. Sign in — you land here.
2. Read KPI cards (products, inbound/outbound counts, storage utilization).
3. **Client admin** also sees billing expiry and recent invoices.
4. Use quick links (e.g. new inbound) when account is not restricted.

**Common mistakes**

- **Restricted account** — creating orders is blocked until billing is renewed; message shows on dashboard.
- Staff expecting billing widgets — only **client admin** sees them.

**Expected outcome** — At-a-glance health of your inventory and orders.

> **Screenshot reference:** `docs/evidence/client-portal-2/` (client API/UI certification).

---

### 4.2 Products

| | |
|---|---|
| **Route** | `/products` |
| **Navigation** | Sidebar → **Products** |
| **Who can access** | **Client admin only** |

**Purpose** — View your product catalog as held by the 3PL (read-focused list and search).

**How to use**

1. Open **Products**.
2. Search by name or SKU.
3. Browse pages of your catalog.

**Expected outcome** — Confirm SKUs exist before creating inbound orders.

---

### 4.3 Inventory (Stock)

| | |
|---|---|
| **Route** | `/stock` |
| **Navigation** | Sidebar → **Stock** |
| **Who can access** | Client admin, client staff |

**Purpose** — View **your** stock levels held in the warehouse.

**How to use**

1. Open **Stock**.
2. Filter/search products.
3. Review quantities and status.

**Note** — The menu label is **Stock**, not “Inventory”. This is your inventory view.

**Expected outcome** — Know what the warehouse is holding on your behalf.

---

### 4.4 Inbound

| | |
|---|---|
| **Routes** | `/inbound-orders`, `/inbound-orders/:id` |
| **Navigation** | Sidebar → **Orders** → tab **Inbound orders** |
| **Who can access** | Client admin, client staff |

**Purpose** — Create and track **inbound** shipments you send to the warehouse.

**How to use**

1. Open **Orders → Inbound orders**.
2. **New inbound** — add expected lines and arrival date.
3. Submit; track status on detail page until completed.

**Common mistakes**

- Creating inbound when account is **restricted** (billing expired).
- Wrong expected quantities — receiving may show shortfall.

**Expected outcome** — Warehouse receives goods against your inbound order; status updates as they process.

---

### 4.5 Outbound

| | |
|---|---|
| **Routes** | `/outbound-orders`, `/outbound-orders/:id` |
| **Navigation** | Sidebar → **Orders** → tab **Outbound orders** |
| **Who can access** | Client admin, client staff |

**Purpose** — Request **outbound** shipments from warehouse stock to your customers.

**How to use**

1. Open **Outbound orders**.
2. Create order with lines and ship-to details (as form provides).
3. Track picking/shipping progress on detail page.

**Expected outcome** — Warehouse picks and ships per your request; status becomes completed when done.

---

### 4.6 Billing

| | |
|---|---|
| **Route** | `/billing` |
| **Navigation** | Sidebar → **Billing** |
| **Who can access** | **Client admin only** |

**Purpose** — View billing plan, cycle dates, account status, and invoice list.

**How to use**

1. Open **Billing**.
2. Read account status banner (active / expiring / restricted).
3. Review current plan and usage summary.
4. Scroll invoice table; filter by status.
5. Click an invoice row to open detail.

---

### 4.7 Invoices

| | |
|---|---|
| **Route** | `/billing/invoices/:id` |
| **Navigation** | From **Billing** page — click an invoice (no separate sidebar item) |
| **Who can access** | Client admin |

**Purpose** — Invoice detail: line items, amounts, status, dates.

**Expected outcome** — Client admin can reconcile charges with their finance team.

---

### 4.8 Notifications

| | |
|---|---|
| **Route** | `/notifications` |
| **Navigation** | Sidebar → **Notifications** |
| **Who can access** | Client admin, client staff |

**Purpose** — Alerts about orders, billing, and account status.

**How to use** — Same pattern as admin notifications (bell + full page).

---

## 5. Step-by-Step Workflows

### 5.1 Receiving inventory

**Roles:** Manager confirms; operator executes tasks.

**Steps**

1. **Manager** — **Products**: ensure SKUs exist.
2. **Manager or client** — Create **Inbound order** with lines and expected arrival.
3. **Manager** — Open inbound detail → **Approve/Confirm** → select **warehouse** if prompted.
4. **Operator** — Open **Tasks → Receive** (or filter receiving tasks).
5. **Operator** — **Execute** task: enter received quantity per line (and lot if required).
6. If QC is enabled — complete **QC** task (pass/fail quantities).
7. **Operator** — **Putaway** task: scan/choose destination locations.
8. **Manager** — Verify inbound status **completed** or **partially received** on order detail.
9. **Anyone with access** — Check **Inventory → Stock** and **Ledger** for movements.

**Expected outcome** — Stock increased at bin locations; inbound closed; ledger shows receive and putaway.

**Common mistakes** — Skipping putaway (stock stays in receiving area); wrong warehouse on confirm.

---

### 5.2 Shipping inventory

**Roles:** Manager confirms outbound; operator picks, packs, ships.

**Steps**

1. **Manager** — Create **Outbound order** with lines and ship-to info.
2. **Manager** — **Approve** if required → **Confirm & start workflow**.
3. **Operator** — **Pick** task: pick from locations (scan barcodes).
4. **Operator** — **Pack** task if required.
5. **Operator** — **Dispatch** task: confirm ship quantities.
6. **Manager** — Confirm outbound status **completed**.
7. Verify **Stock** decreased and **Ledger** shows pick/ship movements.

**Expected outcome** — Order shipped; stock deducted; client can see completion in portal.

**Common mistakes** — Short pick without manager decision; confirming outbound without available stock.

---

### 5.3 Performing a cycle count

**Roles:** Manager plans; operator counts; manager posts.

**Steps**

1. **Manager** — **Cycle count → Dashboard** → create new count (warehouse, scope).
2. **Operator** — **Cycle count → My tasks** (must have worker profile).
3. **Operator** — Open assigned session → **Execute** → enter counted qty per line/location.
4. **Manager** — Open session detail → review **variances**.
5. For each variance — **Approve** or **Reject** with reason code.
6. **Manager** — **Build reconciliation** (creates adjustment draft).
7. **Manager** — **Post reconciliation** — stock updates.
8. **Manager** — **Complete** cycle count session.

**Expected outcome** — Stock matches floor; variances documented and posted.

**Common mistakes** — Counting during active picking on same locations; posting with open variances.

---

### 5.4 Processing returns

**Roles:** Manager creates/confirms; operator receives; manager completes.

**Steps**

1. **Manager** — **Returns** → create return with client and lines.
2. **Manager** — **Confirm** return on detail page.
3. **Operator** — **Start receiving** when physical goods arrive.
4. **Operator** — **Process** (`/returns/:id/process`) — inspect quantities/condition.
5. **Manager** — **Post inventory** (puts stock back or to quarantine/scrap per setup).
6. **Manager** — **Complete** return.

**Expected outcome** — Return closed; inventory and ledger updated.

---

### 5.5 Managing billing plans

**Roles:** Finance or manager (admin billing access).

**Steps**

1. Open **Billing → Plans**.
2. Find client or click **New plan**.
3. Set cycle dates, rates, volume limits, and status.
4. Open **Billing → Plans → [client]** for volume allocation if used.
5. Monitor **Billing → Dashboard** for expiring cycles.
6. When cycle ends — system generates invoice under **Billing → Invoices**.
7. Open invoice → update status to **paid** when payment received.
8. Client admin sees invoice on portal **Billing** page.

**Expected outcome** — Active billing cycle; client account stays **active** in portal.

**Common mistakes** — Missing renewal → client portal shows **restricted** and blocks new orders.

---

### 5.6 Restoring backups

**Roles:** Super admin only.

**Before you start** — Schedule maintenance; notify all users; confirm you have the correct backup file.

**Steps**

1. **Super admin** — **Settings → History** — verify backup **completed** and downloadable.
2. Optional — **Download** backup for off-site copy.
3. **Settings → Restore** — select backup job from list.
4. Read warnings — restore **replaces the entire database**.
5. Confirm restore → wait for job to finish (do not close browser).
6. **Settings → Health** — confirm system healthy after restore.
7. Spot-check **Dashboard**, **Stock**, and a sample order.

**Expected outcome** — System data rolled back to backup timestamp; operations resume after verification.

**Common mistakes** — Restoring the wrong backup; allowing staff to use system during restore.

> **Screenshot reference:** `docs/evidence/release-r4-dr/` (restore certification), `docs/evidence/backup-qa-1/07-factory-reset-*` (destructive ops evidence — factory reset is separate from restore).

---

### 5.7 Creating users

**Roles:** Super admin or warehouse manager.

**Warehouse user (admin app)**

1. **Users → Warehouse users**.
2. Click **New user**.
3. Enter name, email, password, role (super admin / admin / worker / finance).
4. For **worker** role — link **worker profile** so they can execute tasks and cycle counts.
5. Set status **active** → save.
6. User receives credentials (your process) and logs in at admin URL.

**Client portal user**

1. **Users → Client users**.
2. **New user** — assign **client company**, role (**client admin** or **client staff**).
3. Save and share client portal URL + credentials.

**Expected outcome** — User logs in and sees only allowed sidebar items.

**Common mistakes** — Worker role without worker profile → cannot execute tasks; wrong portal URL given to client users.

---

### 5.8 Creating a manual backup

**Roles:** Super admin.

1. **Settings → History**.
2. Click **Create backup**.
3. Optional label → confirm.
4. Wait until status **completed**.
5. Download or verify size on detail modal.

**Expected outcome** — New row in history; database dump stored per storage policy.

---

## 6. Screenshot & Evidence References

Production UI screenshots are captured during certification runs. Ask your administrator for access to these folders on the server or documentation repo:

| Area | Evidence path |
|------|----------------|
| Login, inbound, receiving, tasks | `docs/evidence/release-r3-e2e/` |
| Reports preview/export | `docs/evidence/reports-perf/` |
| Billing | `docs/evidence/billing-4b/` |
| Client portal | `docs/evidence/client-portal-2/` |
| Backup history & operations | `docs/evidence/backup-qa-1/` |
| Backup retention & storage | `docs/evidence/backup-6d/` |
| Disaster recovery / restore | `docs/evidence/release-r4-dr/` |
| Realtime updates | `docs/evidence/release-r2-realtime/` |

To capture fresh screenshots locally, administrators can run the frontend screenshot scripts documented in `SYSTEM-ARCHITECTURE.md` (`frontend/scripts/`, `client-frontend/scripts/`).

---

## 7. Quick Reference Tables

### 7.1 Admin routes by role

| Route area | Super admin | WH manager | WH operator | Finance |
|------------|:-----------:|:----------:|:-----------:|:-------:|
| Dashboard | ✓ | ✓ | — | ✓ |
| Orders | ✓ | ✓ | — | ✓ |
| Inventory | ✓ | ✓ | — | ✓ |
| Tasks | ✓ | ✓ | ✓ | — |
| Internal transfer | ✓ | ✓ | — | — |
| Cycle count | ✓ | ✓ | ✓ | — |
| Returns | ✓ | ✓ | ✓ | — |
| Products / Locations / Warehouses | ✓ | ✓ | — | — |
| Customers / Users | ✓ | ✓ | — | — |
| Reports | ✓ | ✓ | — | ✓ |
| Billing | ✓ | ✓ | — | ✓ |
| Audit logs | ✓ | ✓ | — | ✓ |
| Notifications | ✓ | ✓ | ✓ | ✓ |
| Settings (backup) | ✓ | ✓ (limited) | — | — |
| Backup upload/restore/reset | ✓ | — | — | — |

### 7.2 Client portal routes by role

| Route | Client admin | Client staff |
|-------|:------------:|:------------:|
| `/dashboard` | ✓ | ✓ |
| `/inbound-orders` | ✓ | ✓ |
| `/outbound-orders` | ✓ | ✓ |
| `/products` | ✓ | — |
| `/stock` | ✓ | ✓ |
| `/billing` | ✓ | — |
| `/billing/invoices/:id` | ✓ | — |
| `/notifications` | ✓ | ✓ |

### 7.3 Status glossary (common)

| Term | Meaning |
|------|---------|
| **Draft** | Started but not confirmed — can still edit or cancel |
| **Confirmed / In progress** | Work has started |
| **Partially received** | Inbound short of expected quantity |
| **Completed** | Workflow finished successfully |
| **Restricted** (client billing) | Billing expired — portal limits new orders |
| **Pending stock** | Outbound waiting for available inventory |

### 7.4 Who to contact

| Issue | Contact |
|-------|---------|
| Cannot log in | Your administrator (Users page) |
| Wrong stock count | Warehouse manager → cycle count or adjustments |
| Billing / invoice question | Finance team |
| System down after restore | Super admin / IT |
| Client cannot create orders | Check billing cycle — finance renewal |

---

## Document Control

| Field | Value |
|-------|-------|
| Document | USER-MANUAL-PRODUCTION.md |
| Audit source | `frontend/src/router.tsx`, `client-frontend/src/App.tsx`, RBAC catalogs, page components |
| Code changes | None |
| Intended use | Customer delivery — warehouse, finance, and client users |

---

*End of manual.*
