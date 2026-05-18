# Admin Dashboard — Components, Hooks & API Reference

## Reusable component inventory

### Layout

| Component | File | Purpose | Key props / behavior |
|-----------|------|---------|----------------------|
| **Layout** | `Layout.tsx` | App shell, sidebar, EN/AR, logout | Wraps `WorkflowUxProvider` + `Outlet` |
| **PageHeader** | `PageHeader.tsx` | Title, optional description, action slot | `title`, `description?`, `actions?` |

### Actions & forms

| Component | Variants / notes |
|-----------|------------------|
| **Button** | `primary` (emerald-600), `secondary`, `danger`, `ghost`; sizes `sm`/`md`; `loading` spinner |
| **TextField** | Label, error, standard input styling |
| **SelectField** | Native select wrapper |
| **Combobox** | Searchable dropdown; `options: {value, label}[]` |

### Data display

| Component | Behavior |
|-----------|----------|
| **DataTable** | Client-side pagination (default 20 rows); `columns`, `rows`, `rowKey`, `onRowClick`, `loading`, `empty`, RTL-aware headers |
| **StatusBadge** | Maps order/task status → colored pill (uses `.badge-*` classes) |
| **PieChart** | SVG pie for dashboard capacity |

### Overlays

| Component | Behavior |
|-----------|----------|
| **Modal** | Title, children, footer actions; backdrop click |
| **ConfirmModal** | Confirm/cancel destructive flows |
| **BarcodeScanModal** | html5-qrcode camera scan → callback |
| **BarcodeImageModal** | jsbarcode render |

### Filters

| Component | Behavior |
|-----------|----------|
| **FilterPanel** | Collapsible container for filter fields |
| **FilterActions** | Apply / Reset buttons |

### Workflow

| Component | Behavior |
|-----------|----------|
| **WorkflowOrderTimeline** | Loads workflow by order ref; steps with status; links to tasks |
| **WorkflowNextRunnableCard** | Highlights next actionable workflow step |

### Feedback

| Component | Behavior |
|-----------|----------|
| **ToastProvider** | `useToast()` → `success(message)`, `error(message)`; stacked toasts top-right |

---

## Hooks

| Hook | File | Returns / behavior |
|------|------|-------------------|
| `useDefaultWarehouseId` | `useDefaultWarehouse.ts` | `{ warehouseId, warehouses }` from env or first active |
| `useFilters` | `useFilters.ts` | `{ draft, applied, setDraft, apply, reset }` |
| `useTaskOnlyMode` | `useTaskOnlyMode.ts` | Boolean from workflow context + env |
| `useWorkflowContext` | `useWorkflowContext.ts` | Workflow UX settings |
| `useExecutionExitBlocker` | `useExecutionExitBlocker.ts` | Blocks router navigation when dirty |
| `useAuth` | `AuthContext.tsx` | User session |
| `useToast` | `ToastProvider.tsx` | Toast API |
| `useDebounced` | `lib/useDebounced.ts` | Debounced value |

---

## Query keys (`QK`)

```typescript
// constants/query-keys.ts (abbreviated)
products, companies, users, warehouses
inventoryStock, inventoryStockByLocation, inventoryStockByProduct
ledger, ledgerDetail, ledgerEntry
inboundOrders, outboundOrders
dashboardOverview, dashboardOpenOrdersCharts
adjustments, availability
locationsTree, locationsPurgeContext, locationsFlat, locationsFlatAll
tasks: { all, list, detail, byWorker }
workflows: { all, instance, byOrderRef, timeline, workflowTimelineByRef }
workers: { all, detail, workload, load }
```

Ad-hoc keys: `['locations', 'dock', warehouseId]`, `['workflows', 'ux-settings', warehouseId]`, etc.

---

## API modules — full endpoint map

Base URL: `VITE_API_URL` (default `http://localhost:3000/api`)

### `api/client.ts`
- Axios + interceptors, envelope unwrap, `PageResult<T>`, 401 redirect

### `api/auth.ts`
| Function | Method | Path |
|----------|--------|------|
| login | POST | `/auth/login` |
| logout | POST | `/auth/logout` |
| me | GET | `/auth/me` |

### `api/companies.ts`
| Function | Method | Path |
|----------|--------|------|
| list | GET | `/companies` |
| get | GET | `/companies/:id` |
| create | POST | `/companies` |
| update | PATCH | `/companies/:id` |
| suspend | POST | `/companies/:id/suspend` |
| close | POST | `/companies/:id/close` |
| remove | DELETE | `/companies/:id` |

### `api/users.ts`
| Function | Method | Path |
|----------|--------|------|
| list | GET | `/users` |
| get | GET | `/users/:id` |
| create | POST | `/users` |
| update | PATCH | `/users/:id` |
| suspend | POST | `/users/:id/suspend` |
| remove | DELETE | `/users/:id` |

### `api/warehouses.ts`
| Function | Method | Path |
|----------|--------|------|
| list | GET | `/warehouses` |
| create | POST | `/warehouses` |
| update | PATCH | `/warehouses/:id` |
| deactivate | DELETE | `/warehouses/:id` |
| nextCode | GET | `/warehouses/next-code` |
| setStatus | PATCH | `/warehouses/:id/status` |

### `api/products.ts`
| Function | Method | Path |
|----------|--------|------|
| get | GET | `/products/:id` |
| list | GET | `/products` |
| listLots | GET | `/products/:id/lots` |
| create | POST | `/products` |
| update | PATCH | `/products/:id` |
| archive | DELETE | `/products/:id` |
| suspend/unsuspend | POST | `/products/:id/suspend` \| `/unsuspend` |
| hardDelete | DELETE | `/products/:id/hard` |
| nextSku | GET | `/products/next-sku` |

### `api/locations.ts`
| Function | Method | Path |
|----------|--------|------|
| list | GET | `/locations` |
| tree | GET | `/locations/tree` |
| purgeContext | GET | `/locations/purge-context` |
| create | POST | `/locations` |
| update | PATCH | `/locations/:id` |
| archive | DELETE | `/locations/:id` |
| permanentDelete | DELETE | `/locations/:id/permanent` |

### `api/inventory.ts`
| Function | Method | Path |
|----------|--------|------|
| stock | GET | `/inventory/stock` |
| stockByProductSummary | GET | `/inventory/stock/by-product` |
| currentStock | GET | `/inventory/current-stock` |
| ledger | GET | `/inventory/ledger` |
| ledgerEntry | GET | `/inventory/ledger/entry` |
| availability | GET | `/inventory/availability` |
| internalTransfer | POST | `/inventory/internal-transfer` |

### `api/inbound.ts`
| Function | Method | Path |
|----------|--------|------|
| list | GET | `/inbound-orders` |
| get | GET | `/inbound-orders/:id` |
| create | POST | `/inbound-orders` |
| confirm | POST | `/inbound-orders/:id/confirm` |
| cancel | POST | `/inbound-orders/:id/cancel` |
| receive | POST | `/inbound-orders/:id/lines/:lineId/receive` |

### `api/outbound.ts`
| Function | Method | Path |
|----------|--------|------|
| list | GET | `/outbound-orders` |
| get | GET | `/outbound-orders/:id` |
| create | POST | `/outbound-orders` |
| confirm | POST | `/outbound-orders/:id/confirm` |
| cancel | POST | `/outbound-orders/:id/cancel` |

### `api/tasks.ts`
| Function | Method | Path |
|----------|--------|------|
| list | GET | `/tasks` |
| get | GET | `/tasks/:id` |
| assign | POST | `/tasks/:id/assign` |
| start | POST | `/tasks/:id/start` |
| complete | POST | `/tasks/:id/complete` |
| cancel | POST | `/tasks/:id/cancel` |
| patchProgress | PUT | `/tasks/:id/progress` |
| leaseAcquire/Release | POST | `/tasks/:id/lease` \| `/lease/release` |
| getPathOrder | GET | `/tasks/:id/path-order` |
| skip/retry/resolve | POST | `/tasks/:id/skip` \| `/retry` \| `/resolve` |

### `api/workflows.ts`
| Function | Method | Path |
|----------|--------|------|
| startInbound | POST | `/workflows/inbound/:orderId/start` |
| startOutbound | POST | `/workflows/outbound/:orderId/start` |
| getTimeline | GET | `/workflows/references/:type/:id` |
| getInstanceGraph | GET | `/workflows/instances/:id/graph` |
| getInstanceGraphByReference | GET | `/workflows/instances/by-reference` |
| getContextSettings | GET | `/workflows/context-settings` |

### `api/workers.ts`
| Function | Method | Path |
|----------|--------|------|
| list | GET | `/workers` |
| listLoad | GET | `/workers/load` |
| create | POST | `/workers` |
| get | GET | `/workers/:id` |

### `api/adjustments.ts`
| Function | Method | Path |
|----------|--------|------|
| list | GET | `/adjustments` |
| get | GET | `/adjustments/:id` |
| create | POST | `/adjustments` |
| patch | PATCH | `/adjustments/:id` |
| addLine | POST | `/adjustments/:id/lines` |
| patchLine | PATCH | `/adjustments/:id/lines/:lineId` |
| approve | POST | `/adjustments/:id/approve` |
| cancel | POST | `/adjustments/:id/cancel` |

### `api/dashboard.ts`
| Function | Method | Path |
|----------|--------|------|
| overview | GET | `/dashboard/overview` |
| openOrdersCharts | GET | `/dashboard/open-orders-charts` |

---

## WebSocket events (listen only — no emit from frontend)

| Constant | Event name |
|----------|------------|
| `INBOUND_ORDER_CREATED` | `order.inbound.created` |
| `INBOUND_ORDER_UPDATED` | `order.inbound.updated` |
| `OUTBOUND_ORDER_CREATED` | `order.outbound.created` |
| `OUTBOUND_ORDER_UPDATED` | `order.outbound.updated` |
| `TASK_UPDATED` | `task.updated` |
| `INVENTORY_CHANGED` | `inventory.changed` |

**Handler:** invalidate query keys (see `RealtimeProvider.tsx`).

---

## Shared utilities (`lib/`)

| Module | Purpose |
|--------|---------|
| `queryClient.ts` | TanStack defaults |
| `invalidate-wms-queries.ts` | Post-mutation workflow/inventory invalidation |
| `task-only-flows.ts` | Env flag reader |
| `company-filter-options.ts` | Combobox options for clients |
| `location-types.ts` | Dock vs storage type guards |
| `ledger-display.ts` | Signed quantity formatting |
| `identifiers.ts` | SKU/lot generation helpers |
| `inbound-shortfall.ts` | Partial receive detection |
| `order-planning-dates.ts` | Date validation helpers |
| `task-worker-label.ts` | Display names for assignees |
| `geography.ts` | Country list |
