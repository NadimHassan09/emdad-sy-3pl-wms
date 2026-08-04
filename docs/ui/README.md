# UI Screen Documentation

Product UI inventory for **Emdad SY 3PL WMS** (staging codebase).

This folder documents **every routed screen** before any redesign work.
Docs are descriptive only — **no application code was modified** to produce them.

## Structure

- [`client/`](./client/) — Client Portal (`client-frontend`)
- [`admin/`](./admin/) — Admin Dashboard (`frontend`)

## Documentation template (every page)

Purpose · Primary users · User goals · Business goal · Main workflows · Components · Forms · Tables · Filters · Actions · Dialogs · Drawers · Empty states · Loading states · Validation · Permissions · Relationships

## Client Portal pages

- [Login](./client/login.md) — ``/login``
- [Account inactive](./client/account-inactive.md) — ``/account-inactive``
- [Dashboard](./client/dashboard.md) — ``/dashboard` (index `/` redirects here)`
- [Inventory (Products list)](./client/products.md) — ``/products``
- [Product detail](./client/product-detail.md) — ``/products/:id``
- [Inbound orders](./client/inbound-orders.md) — ``/inbound-orders``
- [Inbound order detail](./client/inbound-order-detail.md) — ``/inbound-orders/:id``
- [Outbound orders](./client/outbound-orders.md) — ``/outbound-orders``
- [Outbound order detail](./client/outbound-order-detail.md) — ``/outbound-orders/:id``
- [Online orders (OMS)](./client/ecommerce-orders.md) — ``/ecommerce-orders``
- [Online order detail](./client/ecommerce-order-detail.md) — ``/ecommerce-orders/:id``
- [Cash on delivery (My profits)](./client/cod-reports.md) — ``/my-profits` (canonical); `/cod-reports` redirects here`
- [Returns](./client/returns.md) — ``/returns``
- [Return detail](./client/return-detail.md) — ``/returns/:id``
- [Billing](./client/billing.md) — ``/billing``
- [Invoices](./client/invoices.md) — ``/invoices``
- [Invoice detail](./client/billing-invoice-detail.md) — ``/invoices/:id` (+ legacy `/billing/invoices/:id` redirect)`
- [Notifications](./client/notifications.md) — ``/notifications` (`?filter=all|unread|read`)`
- [Profile](./client/profile.md) — ``/profile``
- [Not found](./client/not-found.md) — `Unauthenticated catch-all → `/login`; authenticated unknown paths → `NotFoundPage``

## Admin Dashboard pages

Total admin docs: **86**

- [Login](./admin/login.md) — `/login`
- [Dashboard overview](./admin/dashboard-overview.md) — `/dashboard/overview` (`/dashboard` redirects here)
- [Inbound orders list](./admin/inbound-list.md) — `/orders/inbound` (aliases `/inbound`, `/orders`)
- [Inbound order detail](./admin/inbound-detail.md) — `/orders/inbound/:id`
- [Outbound orders list](./admin/outbound-list.md) — `/orders/outbound` (alias `/outbound`)
- [Outbound order detail](./admin/outbound-detail.md) — `/orders/outbound/:id`
- [Quick directed outbound](./admin/quick-directed-outbound.md) — `/orders/directed-outbound` (alias `/directed-outbound`)
- [Tasks list](./admin/tasks-list.md) — `/tasks` (+ `?taskType=` via sub-nav)
- [Task execution](./admin/task-detail.md) — `/tasks/:id` (`/tasks/:id/execute` redirects here)
- [Task panel — Receiving](./admin/task-panel-receiving.md) — Rendered inside `/tasks/:id` when `taskType=receiving`
- [Task panel — Putaway / Quarantine putaway](./admin/task-panel-putaway.md) — Inside `/tasks/:id` for `putaway` / `putaway_quarantine`
- [Task panel — Pick](./admin/task-panel-pick.md) — Inside `/tasks/:id` when `taskType=pick`
- [Task panel — Pack](./admin/task-panel-pack.md) — Inside `/tasks/:id` when `taskType=pack`
- [Task panel — Dispatch](./admin/task-panel-dispatch.md) — Inside `/tasks/:id` when `taskType=dispatch`
- [Internal transfer](./admin/internal-transfer.md) — `/internal`
- [Inventory stock](./admin/inventory-stock.md) — `/inventory/stock` (`/inventory` redirects)
- [Inventory product detail](./admin/inventory-product-detail.md) — `/inventory/product/:productId`
- [Inventory ledger](./admin/inventory-ledger.md) — `/inventory/ledger`
- [Inventory ledger entry](./admin/inventory-ledger-entry.md) — `/inventory/ledger/line/:ledgerId/:createdAt`
- [Inventory ledger by reference](./admin/inventory-ledger-reference.md) — `/inventory/ledger/:referenceType/:referenceId`
- [Stock adjustments](./admin/adjustments-list.md) — `/inventory/adjustments` (alias `/adjustments`)
- [Adjustment detail](./admin/adjustment-detail.md) — `/inventory/adjustments/:id`
- [Cycle count dashboard](./admin/cycle-count-list.md) — `/cycle-count`
- [Cycle count my tasks](./admin/cycle-count-my-tasks.md) — `/cycle-count/my-tasks`
- [Cycle count detail](./admin/cycle-count-detail.md) — `/cycle-count/:id`
- [Cycle count execute](./admin/cycle-count-execute.md) — `/cycle-count/:id/execute`
- [Returns list (WMS)](./admin/returns-list.md) — `/returns`
- [Return detail (WMS)](./admin/return-detail.md) — `/returns/:id`
- [Return process](./admin/return-process.md) — `/returns/:id/process`
- [OMS dashboard](./admin/oms-dashboard.md) — `/oms/dashboard` (`/oms` redirects)
- [OMS orders list](./admin/oms-orders-list.md) — `/orders/oms`
- [OMS order detail](./admin/oms-order-detail.md) — `/orders/oms/:id`, `/oms/orders/:id`
- [OMS COD report](./admin/oms-cod.md) — `/oms/cod` (feature-flagged; report aliases redirect)
- [OMS returns report](./admin/oms-returns-report.md) — `/oms/returns` (feature-flagged)
- [Contracts — GRN](./admin/contracts-grn.md) — `/contracts/grn` (`/contracts` redirects here)
- [Contracts — Delivery note](./admin/contracts-dn.md) — `/contracts/dn`
- [Final contract](./admin/final-contract.md) — `/contracts/final-contract`
- [Products](./admin/products.md) — `/products`
- [Product detail (Admin)](./admin/product-detail.md) — `/products/:sku`
- [Locations](./admin/locations.md) — `/locations`
- [Warehouses](./admin/warehouses.md) — `/warehouses`
- [Clients (companies)](./admin/clients.md) — `/clients`
- [Client detail](./admin/client-detail.md) — `/clients/:id`
- [Billing dashboard](./admin/billing-dashboard.md) — `/billing/dashboard` (`/billing` redirects)
- [Billing plans](./admin/billing-plans.md) — `/billing/plans`
- [Billing plan create](./admin/billing-plan-create.md) — `/billing/plans/new`
- [Billing plan detail](./admin/billing-plan-detail.md) — `/billing/plans/:clientId`
- [Billing plan edit](./admin/billing-plan-edit.md) — `/billing/plans/:clientId/edit`
- [Billing plan templates](./admin/billing-templates.md) — `/billing/templates`
- [Billing invoices](./admin/billing-invoices.md) — `/billing/invoices`
- [Billing invoice detail (Admin)](./admin/billing-invoice-detail.md) — `/billing/invoices/:id`
- [Report — Warehouse Analysis](./admin/report-warehouse-analysis.md) — `/reports/warehouse-analysis`
- [Report — Inventory](./admin/report-inventory.md) — `/reports/inventory`
- [Report — Product Moves](./admin/report-product-moves.md) — `/reports/product-moves`
- [Report — Stock Aging](./admin/report-stock-aging.md) — `/reports/stock-aging`
- [Report — Lot Expiry](./admin/report-lot-expiry.md) — `/reports/lot-expiry`
- [Report — Capacity Utilization](./admin/report-capacity-utilization.md) — `/reports/capacity-utilization`
- [Report — Return Rate](./admin/report-return-rate.md) — `/reports/return-rate`
- [Report — Worker Productivity](./admin/report-worker-productivity.md) — `/reports/worker-productivity`
- [Report — Order Cycle Time](./admin/report-order-cycle-time.md) — `/reports/order-cycle-time`
- [Report — Inbound Accuracy](./admin/report-inbound-accuracy.md) — `/reports/inbound-accuracy`
- [Report — Outbound Fill Rate](./admin/report-outbound-fill-rate.md) — `/reports/outbound-fill-rate`
- [Report — SLA Compliance](./admin/report-sla-compliance.md) — `/reports/sla-compliance`
- [Report — Revenue by Client](./admin/report-revenue-by-client.md) — `/reports/revenue-by-client`
- [Report — Receivables Aging](./admin/report-receivables-aging.md) — `/reports/receivables-aging`
- [Report — Merchant Orders](./admin/report-merchant-orders.md) — `/reports/merchant-orders`
- [Report — Sales Report](./admin/report-sales-report.md) — `/reports/sales-report`
- [Report — Delivery Report](./admin/report-delivery-report.md) — `/reports/delivery-report`
- [Report — Allocation Report](./admin/report-allocation-report.md) — `/reports/allocation-report`
- [Report — Inventory Reserved](./admin/report-inventory-reserved.md) — `/reports/inventory-reserved`
- [Warehouse users](./admin/warehouse-users.md) — `/users/warehouse_users` (`/users` redirects)
- [Warehouse user detail](./admin/warehouse-user-detail.md) — `/users/warehouse_users/:id`
- [Client users](./admin/client-users.md) — `/users/client_users`
- [Client user detail](./admin/client-user-detail.md) — `/users/client_users/:id`
- [Forms (lead submissions)](./admin/forms.md) — `/forms`
- [Audit logs](./admin/audit-logs.md) — `/audit-logs`
- [Notifications (Admin)](./admin/notifications.md) — `/notifications`
- [Backup history](./admin/backup-history.md) — `/settings/backups` (`/settings` → backups)
- [Backup upload](./admin/backup-upload.md) — `/settings/backups/upload`
- [Backup restore](./admin/backup-restore.md) — `/settings/backups/restore`
- [Factory reset](./admin/backup-factory-reset.md) — `/settings/backups/factory-reset`
- [Backup schedules](./admin/backup-schedules.md) — `/settings/backups/schedules`
- [Backup retention](./admin/backup-retention.md) — `/settings/backups/retention`
- [Backup health](./admin/backup-health.md) — `/settings/backups/health`
- [Backup storage policy](./admin/backup-storage-policy.md) — `/settings/backups/storage-policy`
- [Backup Google Drive](./admin/backup-google-drive.md) — `/settings/backups/google-drive`

## Cross-app notes

- Client Portal is the **design language SoT** for presentation; Admin converges via `@ds`.
- Parallel domains: Client Online orders ↔ Admin OMS; Client Inbound/Outbound ↔ Admin Orders; Client COD ↔ Admin OMS COD; Client Billing/Invoices ↔ Admin Billing.
- Admin task execution is the warehouse floor; Client surfaces are merchant visibility/create, not floor execution.

*Generated from staging routers/pages. File count: 107 markdown files including this index.*
