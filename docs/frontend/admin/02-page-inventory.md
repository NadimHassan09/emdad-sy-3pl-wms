# Admin Dashboard — Full Page Inventory

For each route: **purpose**, **access**, **UI structure**, **logic**, **API mapping**.

**Layout inherited on all protected routes:** `Layout` sidebar + main content area (no breadcrumbs component — back links are inline `<Link>`).

---

## `/login` — LoginPage

| Field | Detail |
|-------|--------|
| **Purpose** | Staff authentication |
| **Access** | Public |
| **Workflow** | Email + password → dashboard |

### UI

- Centered **card** on slate background
- **Form:** email, password fields (`TextField`)
- **Primary button:** Sign in
- **Error:** red text below form
- Redirect if already authenticated

### Logic

- `AuthContext.login` → `POST /auth/login` → store token → navigate to `from` or `/dashboard/overview`

### API

| Method | Endpoint |
|--------|----------|
| POST | `/auth/login` |
| GET | `/auth/me` (boot) |

---

## `/dashboard/overview` — DashboardOverviewPage

| Field | Detail |
|-------|--------|
| **Purpose** | Operational KPIs and quick links |
| **Access** | Authenticated |
| **Workflow** | Landing page after login |

### UI

- **PageHeader:** "Overview"
- **Stat cards (grid):** catalog count, stock total, customers, open inbound/outbound — some link to filtered routes
- **Open tasks by type:** counts with links to `/tasks?taskType=...`
- **Pie chart:** warehouse capacity (`PieChart` component)
- **Table:** soon-expiry lots (6 months)
- **Lists:** recent 5 open inbound / outbound with links to order detail

### Logic

- `useQuery(QK.dashboardOverview)` + charts query
- Realtime invalidates `dashboardOpenOrdersCharts` on order/task events
- EN/AR labels via inline map

### API

| Method | Endpoint |
|--------|----------|
| GET | `/dashboard/overview` |
| GET | `/dashboard/open-orders-charts` |

---

## `/products` — ProductsPage

| Field | Detail |
|-------|--------|
| **Purpose** | Product catalog CRUD for all clients |
| **Access** | Authenticated |
| **Workflow** | Search/filter → create/edit/archive/suspend products |

### UI

- **PageHeader** + actions: New product, barcode scan
- **FilterPanel:** company (Combobox), name, SKU, barcode
- **FilterActions:** Apply / Reset
- **DataTable:** SKU, name, client, status, UoM, barcode, actions
- **Modals:** Create/Edit product (many fields: dimensions, tracking, expiry), barcode image, barcode scan
- **Pagination:** client-side in DataTable

### Logic

- `useFilters` for list filters
- Mutations: create, update, archive, suspend, unsuspend, hard delete
- Optimistic cache updates via `prependProductAcrossCaches` / `upsertProductAcrossCaches`
- Row click → `/products/:sku`
- SKU generation via `ProductsApi.nextSku`

### API

| Method | Endpoint |
|--------|----------|
| GET | `/products` |
| POST | `/products` |
| PATCH | `/products/:id` |
| DELETE | `/products/:id` |
| POST | `/products/:id/suspend`, `/unsuspend` |
| DELETE | `/products/:id/hard` |
| GET | `/products/next-sku` |
| GET | `/companies` (filter) |

---

## `/products/:sku` — ProductDetailPage

| Field | Detail |
|-------|--------|
| **Purpose** | Single product view/edit |
| **Access** | Authenticated |

### UI

- Back link to products
- **PageHeader** with product name
- Detail fields grid, lots table, action buttons (edit, suspend, etc.)
- Modals for edit/barcode

### API

| Method | Endpoint |
|--------|----------|
| GET | `/products` (resolve by SKU) or get by id |
| GET | `/products/:id/lots` |
| PATCH/POST/DELETE | product mutations |

---

## `/locations` — LocationsPage

| Field | Detail |
|-------|--------|
| **Purpose** | Warehouse location hierarchy CRUD |
| **Access** | Authenticated |
| **Workflow** | Tree or flat view per warehouse; archive locations; view stock at node |

### UI

- Warehouse selector (from `useDefaultWarehouseId`)
- **Tree view** / flat toggle
- **Modals:** create, edit, archive, permanent delete
- **Stock drill-in** panel/table for selected location
- FilterPanel for archived inclusion

### API

| Method | Endpoint |
|--------|----------|
| GET | `/locations/tree`, `/locations`, `/locations/purge-context` |
| POST/PATCH/DELETE | `/locations`, `/locations/:id`, `/locations/:id/permanent` |
| GET | `/inventory/stock` (drill-in) |

---

## `/inventory/stock` — InventoryPage

| Field | Detail |
|-------|--------|
| **Purpose** | Stock-by-product summary across warehouse |
| **Access** | Authenticated |

### UI

- **PageHeader**
- **FilterPanel:** product search, company, etc.
- **DataTable:** SKU, product, qty, UoM, lots, link to product detail
- Row navigation → `/inventory/product/:productId`

### API

| Method | Endpoint |
|--------|----------|
| GET | `/inventory/stock/by-product` |

**Realtime:** `inventory.changed` invalidates stock queries.

---

## `/inventory/product/:productId` — InventoryProductDetailPage

| Field | Detail |
|-------|--------|
| **Purpose** | All stock lines for one product (locations, lots, qty) |

### UI

- Back link
- Header with product info
- **DataTable** of stock rows

### API

| Method | Endpoint |
|--------|----------|
| GET | `/inventory/stock` or `/inventory/current-stock` (filtered) |

---

## `/inventory/ledger` — InventoryLedgerPage

| Field | Detail |
|-------|--------|
| **Purpose** | Business-level inventory movements list |
| **Access** | Authenticated |
| **Workflow** | Audit trail; drill to reference or single entry |

### UI

- **FilterPanel:** date range, reference type, product, warehouse
- **DataTable:** signed deltas, reference, product, timestamp
- Row click → reference detail or line detail routes

### API

| Method | Endpoint |
|--------|----------|
| GET | `/inventory/ledger` |

---

## `/inventory/ledger/:referenceType/:referenceId` — InventoryLedgerReferencePage

| Field | Detail |
|-------|--------|
| **Purpose** | All ledger rows for one business reference (order, adjustment, etc.) |

### UI

- Reference header (type, id, link to order if applicable)
- Movements table
- Links to line-level entries

### API

| Method | Endpoint |
|--------|----------|
| GET | `/inventory/ledger` (filtered) |

---

## `/inventory/ledger/line/:ledgerId/:createdAt` — InventoryLedgerEntryPage

| Field | Detail |
|-------|--------|
| **Purpose** | Single ledger entry with lot/location impacts |

### UI

- Detail card: quantities before/after, locations, lots
- Back navigation

### API

| Method | Endpoint |
|--------|----------|
| GET | `/inventory/ledger/entry` |

---

## `/inventory/adjustments` — AdjustmentsPage

| Field | Detail |
|-------|--------|
| **Purpose** | Stock adjustment drafts → approve → ledger |
| **Access** | Authenticated |

### UI

- List with status badges
- **Modal/drawer flows:** create adjustment, add lines, approve, cancel
- **DataTable** for lines per adjustment

### API

| Method | Endpoint |
|--------|----------|
| GET/POST | `/adjustments` |
| GET/PATCH | `/adjustments/:id` |
| POST | `/adjustments/:id/lines`, `/approve`, `/cancel` |

---

## `/orders/inbound` — InboundListPage

| Field | Detail |
|-------|--------|
| **Purpose** | List/create inbound orders |
| **Access** | Authenticated |
| **Workflow** | Filter → create draft → open detail → confirm/receive |

### UI

- **PageHeader** + "+ New inbound"
- **FilterPanel:** order search, client, created date range
- **DataTable:** order #, status (`StatusBadge`), expected arrival, lines count, created
- **Modal:** New order — client, date, notes, line builder (product Combobox, qty, barcode scan)
- Row click → `/orders/inbound/:id`

### Logic

- Default `companyId` from `VITE_MOCK_COMPANY_ID`
- Date validation: expected arrival not before today
- Shortfall indicator on list rows via `inboundHasQuantityShortfall`

### API

| Method | Endpoint |
|--------|----------|
| GET | `/inbound-orders` |
| POST | `/inbound-orders` |
| GET | `/companies`, `/products` |

---

## `/orders/inbound/:id` — InboundDetailPage

| Field | Detail |
|-------|--------|
| **Purpose** | Manage single inbound order |
| **Workflow** | draft → confirm → receive (or task-only confirm → workflow) |

### UI

- **Back link** ← All inbound orders
- **PageHeader** + actions: Cancel, Confirm
- **Metadata grid (2×4):** order #, status badge, client, dates, confirmed/completed
- **Task-only block:** warehouse Combobox, receiving dock Combobox (all lines same dock)
- **WorkflowOrderTimeline** — workflow steps + task links
- **WorkflowNextRunnableCard** (if applicable)
- **DataTable lines:** #, SKU, product, lot, expected, [Receive button]
- **Modal:** Receive line — qty, lot, expiry, location (non-task-only)

### Logic

| State | Actions |
|-------|---------|
| `draft` | Confirm, Cancel |
| `confirmed`+ | Cancel (limited), Receive per line if not task-only |
| task-only | Confirm requires warehouse + dock; no inline receive |

### API

| Method | Endpoint |
|--------|----------|
| GET | `/inbound-orders/:id` |
| POST | `/inbound-orders/:id/confirm` |
| POST | `/inbound-orders/:id/cancel` |
| POST | `/inbound-orders/:id/lines/:lineId/receive` |
| GET | `/locations` (docks) |
| GET | `/workflows/references/inbound_order/:id` |

**Realtime:** inbound order events invalidate this query.

---

## `/orders/outbound` — OutboundListPage

| Field | Detail |
|-------|--------|
| **Purpose** | List/create outbound orders |

### UI

Similar to inbound list: filters, DataTable, create modal with destination, ship date, lines.

### API

| Method | Endpoint |
|--------|----------|
| GET/POST | `/outbound-orders` |

---

## `/orders/outbound/:id` — OutboundDetailPage

| Field | Detail |
|-------|--------|
| **Purpose** | Confirm/cancel outbound; view pick progress |

### UI

- Back link, PageHeader, Cancel/Confirm
- Metadata: destination, carrier, tracking, dates
- **WorkflowOrderTimeline**
- Lines table: requested/picked quantities, line status

### API

| Method | Endpoint |
|--------|----------|
| GET | `/outbound-orders/:id` |
| POST | `/outbound-orders/:id/confirm`, `/cancel` |
| GET | workflow timeline |

---

## `/tasks` — TasksListPage

| Field | Detail |
|-------|--------|
| **Purpose** | Warehouse task queue |
| **Access** | Authenticated |
| **Workflow** | Filter by type/status → open task execution |

### UI

- **PageHeader**
- **FilterPanel:** task type (from URL `?taskType=`), status, worker, reference
- **DataTable:** type, status, reference, assignee, priority, dates
- Row click → `/tasks/:id`

### API

| Method | Endpoint |
|--------|----------|
| GET | `/tasks` |

---

## `/tasks/:id` — TaskDetailPage → TaskExecutionView

| Field | Detail |
|-------|--------|
| **Purpose** | Execute warehouse task (largest UI surface) |
| **Access** | Authenticated operators |

### UI (high level — varies by `taskType`)

- **PageHeader:** task type label, status badge, reference link to order
- **Worker assignment** section (Combobox workers)
- **Lease** acquire/release controls
- **Progress sections** driven by `task-ui-matrix`:
  - **receiving:** scan lines, qty, lot, expiry, dock
  - **putaway:** from staging to storage locations
  - **pick:** reservations, path order, skip/retry
  - **pack:** carton/pack confirmation
  - **dispatch:** carrier, tracking
- **BarcodeScanModal** throughout
- **Advanced JSON** panel (if `showAdvancedJson` from workflow UX settings)
- **Confirm modals** for complete, cancel, resolve
- **Exit blocker** when unsaved progress

### Logic

- `TasksApi.get`, `assign`, `start`, `complete`, `patchProgress`, `lease*`, `skip`, `retry`, `resolve`
- Loads related inbound/outbound order for context
- Uses `@emdad/wms-task-execution` for structured complete payloads
- `VITE_MOCK_WORKER_ID` for dev worker identity

### API

| Method | Endpoint |
|--------|----------|
| GET | `/tasks/:id` |
| POST | `/tasks/:id/assign`, `/start`, `/complete`, `/cancel`, `/skip`, `/retry`, `/resolve` |
| PUT | `/tasks/:id/progress` |
| POST | `/tasks/:id/lease`, `/lease/release` |
| GET | `/tasks/:id/path-order` |
| GET | `/workers`, `/inbound-orders/:id`, `/outbound-orders/:id` |
| GET | `/locations`, `/products/:id/lots` |

**Realtime:** `task.updated` invalidates task + workflow queries.

---

## `/internal` — InternalTransferPage

| Field | Detail |
|-------|--------|
| **Purpose** | Move stock between locations without order |

### UI

- Form: from location, to location, product, lot, qty
- Transfer history table

### API

| Method | Endpoint |
|--------|----------|
| POST | `/inventory/internal-transfer` |
| GET | stock/history endpoints |

---

## `/clients` — ClientsPage

| Field | Detail |
|-------|--------|
| **Purpose** | 3PL customer (company) management |

### UI

- **DataTable** of companies
- **Modal:** create/edit, suspend, close, delete

### API

| Method | Endpoint |
|--------|----------|
| GET/POST/PATCH/DELETE | `/companies` |
| POST | `/companies/:id/suspend`, `/close` |

---

## `/users` — UsersPage

| Field | Detail |
|-------|--------|
| **Purpose** | System user administration |
| **Access** | Intended ADMIN (nav-gated) |

### UI

- User list DataTable
- Create/edit modal, suspend, remove

### API

| Method | Endpoint |
|--------|----------|
| GET/POST/PATCH/DELETE | `/users` |
| POST | `/users/:id/suspend` |

---

## Orphan: `WarehousesPage.tsx`

| Field | Detail |
|-------|--------|
| **Route** | **None** — not in router |
| **Purpose** | Warehouse CRUD (code, status, deactivate) |
| **API** | `/warehouses` full module |

*Rebuild note: either add route or remove dead code.*

---

## Cross-page UI patterns

| Pattern | Where used |
|---------|------------|
| `PageHeader` | Most pages |
| `FilterPanel` + `FilterActions` | Lists |
| `DataTable` | Most lists (client-side pagination) |
| `Modal` / `ConfirmModal` | CRUD, destructive actions |
| `StatusBadge` | Orders, tasks |
| `WorkflowOrderTimeline` | Inbound/outbound detail |
| `useToast` | Mutation feedback |
| Inline `← Link` back | Detail pages (no breadcrumb component) |
| Loading | `Loading…` text or DataTable `loading` prop |
| Empty | DataTable default or custom `empty` prop |
