# EMDAD QA Tracker

Status: ⬜ not started · 🔄 in progress · ✅ passed · ❌ defect open (see ID) · ⛔ blocked · ➖ n/a
One row per route. Defects are logged below with ID, severity (S1 blocker, S2 major, S3 minor, S4 cosmetic), evidence and fix commit.

## Admin portal (staging-admin.emdadsy.com) — roles: super_admin, wh_manager, wh_operator

| Route | Functional | Validation/edge | Roles | Consistency | Mobile | Notes |
|---|---|---|---|---|---|---|
| `//` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `//login` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/adjustments` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/allocation-report` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/audit-logs` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/factory-reset` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/google-drive` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/health` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/restore` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/retention` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/schedules` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/storage-policy` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/backups/upload` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/dashboard` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/invoices` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/invoices/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/plans` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/plans/:clientId` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/plans/:clientId/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/plans/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/billing/templates` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/capacity-utilization` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/clients` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/clients/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/cod-report` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/contracts` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/contracts/dn` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/contracts/final-contract` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/contracts/grn` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/cycle-count` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/cycle-count/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/cycle-count/:id/execute` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/cycle-count/my-tasks` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/dashboard` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/dashboard/overview` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/delivery-report` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/directed-outbound` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/factory-reset` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/accounts` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/carrier-costs` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/cod` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/overview` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/payouts` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/policies` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/finance/transactions` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/forms` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/google-drive` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/health` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inbound` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inbound-accuracy` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inbound/create` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/internal` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory-reserved` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/adjustments` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/adjustments/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/ledger` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/ledger/:referenceType/:referenceId` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/ledger/line/:ledgerId/:createdAt` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/product/:productId` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/inventory/stock` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/locations` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/locations/:warehouseId` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/lot-expiry` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/merchant-orders` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/notifications` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/batches` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/batches/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/cod` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/cod/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/dashboard` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/orders/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/orders/:id/waybill` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/returns` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/oms/returns/:id/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/order-cycle-time` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/directed-outbound` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/inbound` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/inbound/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/inbound/:id/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/inbound/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/oms` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/oms/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/oms/:id/waybill` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/oms/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/outbound` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/outbound/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/outbound/:id/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/orders/outbound/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/outbound` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/outbound-fill-rate` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/outbound/create` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/product-moves` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/products` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/products/:sku` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/profile` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/receivables-aging` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/reports` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/reports/oms/cod` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/reports/oms/returns` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/restore` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/retention` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/return-rate` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/returns` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/returns-report` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/returns/:id/process` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/revenue-by-client` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/sales-report` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/schedules` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/settings` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/shipping` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/shipping/companies` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/shipping/fee-rates` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/sla-compliance` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/stock-aging` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/storage-policy` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/tasks` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/tasks/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/tasks/:id/execute` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/upload` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/users` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/users/client_users` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/users/client_users/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/users/warehouse_users` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/users/warehouse_users/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/warehouse-analysis` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/warehouses` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/worker-productivity` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |

## Client portal (staging-client.emdadsy.com) — roles: client_admin, client_staff

| Route | Functional | Validation/edge | Roles/tenant | Consistency vs Admin | Mobile | Notes |
|---|---|---|---|---|---|---|
| `/account-inactive` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `/login` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `apis` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `billing` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `billing/invoices/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `cod-reports` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `dashboard` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `ecommerce-orders` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `ecommerce-orders/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `ecommerce-orders/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `ecommerce-orders/returns` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `ecommerce-orders/returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `ecommerce-orders/returns/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `finances` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `inbound-orders` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `inbound-orders/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `inbound-orders/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `invoices` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `invoices/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `my-profits` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `notifications` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `outbound-orders` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `outbound-orders/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `outbound-orders/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `outbound-orders/returns` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `outbound-orders/returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `outbound-orders/returns/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `products` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `products/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `products/:id/edit` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `products/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `profile` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `returns` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `returns/:id` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |
| `returns/new` | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |

## Carrier end-to-end matrix

| Scenario | Sena (sandbox) | Babel (live) | Sila (live) | Delivery Joud |
|---|---|---|---|---|
| Quote vs create price | ⬜ | ⬜ | ⬜ | ⬜ |
| Create payload accepted (name, phone, address, COD, weight) | ⬜ | ⬜ | ⬜ | ⬜ |
| Coverage: offered only if address supported | ⬜ | ⬜ | ⬜ | ⬜ |
| Currency / COD min-max rules | ⬜ | ⬜ | ⬜ | ⬜ |
| Tracking updates reach EMDAD (poll) | ⬜ | ⬜ | ⬜ | ⬜ |
| Webhook update (valid / invalid signature / duplicate) | ⬜ | ⬜ | ⬜ | ⬜ |
| Client sees same tracking | ⬜ | ⬜ | ⬜ | ⬜ |
| Cancel from EMDAD reflected at carrier | ⬜ | ⬜ | ⬜ | ⬜ |
| Cancel at carrier reflected in EMDAD | ⬜ | ⬜ | ⬜ | ⬜ |
| Change carrier (supersede) and replacement shipment | ⬜ | ⬜ | ⬜ | ⬜ |
| Edit order info / price after shipment | ⬜ | ⬜ | ⬜ | ⬜ |
| Waybill / barcode print | ⬜ | ⬜ | ⬜ | ⬜ |
| Failure and timeout handling | ⬜ | ⬜ | ⬜ | ⬜ |
| Return flow | ⬜ | ⬜ | ⬜ | ⬜ |

## Defect log

| ID | Sev | Area | Summary | Evidence | Status | Fix commit |
|---|---|---|---|---|---|---|
| D-001 | S2 | Admin/Products,Inbound,Outbound | First client auto-selected after field cleared (Acme) | Staging UI check 2 Nov | Fixed, desktop verified | fe1cfc87 |
| D-002 | S2 | Admin/Bulk shipping | Carrier with no quote selectable per order | Code review 2 Nov | Fixed, UI not yet verified | a7999e3d |
| D-003 | S3 | Data | Hierarchy has CRLF in a city key and 13 neighbourhoods with trailing spaces | JSON scan | Open | |
| D-004 | S3 | Backend tests | Jest run OOM after 23/144 suites; 9 suites failing (stale specs/drift) | jest-baseline | Open | |
