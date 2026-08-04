# Real-time Product Matrix

**Product:** Emdad 3PL WMS / OMS  
**Document type:** Product-behavior Real-time Coverage Audit  
**Audience:** Product, system architects, Technical Audit (Investigation)  
**Source of truth:** Expected product behavior — **not** current implementation, sockets, or event buses  
**Surfaces:** Admin WMS portal · Client portal · Cross-cutting platform chrome  

This document is the sole product reference for what must update automatically without a page refresh. A later Technical Audit must compare implementation against this matrix and must not guess whether a change “should” be realtime.

---

## 0. Principles

### 0.1 Live vs Static

| Class | Meaning | Product expectation |
|-------|---------|---------------------|
| **Always live** | Shared mutable state that other actors change while the user watches | Must update via push without refresh |
| **Instant** | Same as always live; latency must feel immediate (collaboration / ops floor) | Push within interactive latency |
| **Session-fresh** | Important but not floor-critical; may update on navigation or soft refresh of the view | Prefer push; acceptable to refresh when entering the page if marked Low |
| **Static** | Does not change from other users’ actions during a normal session, or change is rare | No realtime required; load on visit |

**Rule:** If another user (or system automation) can change a value that would mislead the current viewer into a wrong operational action, that value is **Always live / Instant**.

### 0.2 Priority Rubric

| Priority | When to use |
|----------|-------------|
| **Critical** | Stale data causes operational error, double-work conflict, oversell, missed approval, or security/session invalidation |
| **High** | Users collaborate on the same object; stale status wastes work or creates support load |
| **Medium** | Awareness / KPI freshness that guides decisions but is not floor-critical |
| **Low** | Rarely changing master data or historical views; refresh-on-visit is enough |

### 0.3 No Polling

- Unless a feature is **explicitly** marked as polling-allowed fallback, the expected product delivery is **push-based realtime**.
- Polling is a **fallback only**, never the assumed product model.
- This Product Matrix **never** assumes polling as the primary update mechanism.
- Technical Audit compares **push coverage** against this matrix — not against ad-hoc poll intervals.
- **No feature in this matrix is marked polling-primary.** Any polling in implementation is a gap versus product expectation unless documented later as an approved fallback for a specific degraded mode.

### 0.4 Realtime Scope Vocabulary

Every Business Event **must** declare one or more scopes from this closed set:

| Scope | Meaning |
|-------|---------|
| `SamePage` | Other viewers of the same detail/workspace URL |
| `SameBrowser` | Other tabs/windows of the same browser session |
| `SameUser` | All sessions for that user (multi-device) |
| `SameCompany` | All users of that client company (admin views for that company + client portal as applicable) |
| `SameWarehouse` | Users operating that warehouse |
| `AllWarehouseOperators` | Operators and managers on the warehouse floor (task queues, stock, stage boards) |
| `ClientPortal` | Client portal surfaces for the affected company |
| `AdminDashboard` | Admin dashboard / KPI / overview / OMS dashboard widgets |
| `SystemWide` | All authenticated admin surfaces (rare: platform-wide alerts) |

Scope describes **who must receive the push**, not the transport technology.

### 0.5 Out of Scope (explicit non-realtime)

These must **not** be treated as always-live unless Consistency Rules make a narrow exception:

| Item | Why static |
|------|------------|
| Historical report result sets (`/reports/*` after load) | Analytical snapshots; user re-runs/filters intentionally |
| Theme / language / UI preferences | Local user preference; not shared operational state |
| System configuration / settings forms | Rare admin edits; load on visit (exception: **active backup job progress**) |
| Archived / purged company browse views | Immutable historical records |
| Old audit log history while scrolling past | Browse is static; **new** append may be Medium live-tail only |
| Already-generated archived PDFs (frozen GRN/DN/contract files) | Immutable artifacts |
| Static marketing / landing / public forms submission UX for the submitter | Submitter does not need live fan-out; **admin Forms inbox** does (Medium) |
| Profile display fields managed by warehouse (client profile view) | Rare; exception: force-logout / role revoke / company suspend → Critical session |
| Online presence indicators | **Not a product requirement** for this platform — see Shared State → Presence (Out of Scope) |

---

## 1. Shared State Objects

Every Business Event maps to one or more of these objects. Technical Audit uses this as the shared-state backbone.

### 1.1 Sessions

| Field | Value |
|-------|-------|
| **Who can modify** | Auth system (login/logout/expiry); admin deactivate user; company suspend / billing restrict (portal gate) |
| **Who can observe** | The authenticated user (own session); portal gate pages |
| **Expected realtime consumers** | Admin + Client: force logout / session invalidation; Client `/account-inactive`; Billing restriction banners; SameBrowser + SameUser tab sync for auth state |
| **Priority baseline** | Critical |

### 1.2 Presence

| Field | Value |
|-------|-------|
| **Who can modify** | N/A — **Out of Scope** for this product |
| **Who can observe** | N/A |
| **Expected realtime consumers** | None. Do not build presence channels unless product later requires collaborator awareness on task/order detail |
| **Priority baseline** | Out of Scope |

### 1.3 Companies (Clients)

| Field | Value |
|-------|-------|
| **Who can modify** | `super_admin`, `wh_manager` (lifecycle: suspend / archive / restore / purge) |
| **Who can observe** | Admin Clients module; finance billing widgets; all client portal users of that company |
| **Expected realtime consumers** | `/clients`, `/clients/:id`; billing restriction / lifecycle banners; Client portal access gate; AdminDashboard billing widgets (expiring/suspended) |
| **Priority baseline** | Critical (suspend/restrict); High (other lifecycle) |

### 1.4 Users

| Field | Value |
|-------|-------|
| **Who can modify** | Admin Users module (warehouse + client users); worker profile provisioning |
| **Who can observe** | Admin user lists/detail; task assignee pickers; operators via assignment |
| **Expected realtime consumers** | `/users/*` lists/detail; task assignment eligibility; SameUser session on deactivate/role change |
| **Priority baseline** | Critical (deactivate/role revoke); Medium (profile field edits) |

### 1.5 Notifications

| Field | Value |
|-------|-------|
| **Who can modify** | System on domain actions; user marks read / mark all |
| **Who can observe** | Owning user only (admin or client) |
| **Expected realtime consumers** | Topbar bell unread count; `/notifications` inbox; Client dashboard recent activity / attention; SameUser |
| **Priority baseline** | High (create); High (read → badge) |

### 1.6 Products

| Field | Value |
|-------|-------|
| **Who can modify** | Admin Products; Client `client_admin` catalog create/edit |
| **Who can observe** | Admin products/inventory; Client products/inventory; order line pickers |
| **Expected realtime consumers** | `/products`, product detail; Client `/products`; stock health badges when stock also changes |
| **Priority baseline** | Medium (catalog CRUD); Critical when paired with StockChanged |

### 1.7 Inventory / Stock

| Field | Value |
|-------|-------|
| **Who can modify** | Receive, putaway, pick, adjust approve, return post, internal transfer, cycle count post, scrap/QC quarantine/release |
| **Who can observe** | Admin inventory/stock/product stock; Client sellable stock (available/reserved/on hand); allocation/OMS |
| **Expected realtime consumers** | `/inventory/stock`, `/inventory/product/:id`, location stock modals; Client `/products` + dashboard inventory; AdminDashboard capacity/expiry; OMS/outbound available qty |
| **Priority baseline** | Critical |

### 1.8 Reservations

| Field | Value |
|-------|-------|
| **Who can modify** | OMS/outbound allocate / release-allocation; fulfillment consuming reservation |
| **Who can observe** | Admin ops on order/stock; Client available qty |
| **Expected realtime consumers** | Stock available vs reserved; OMS/outbound detail; Client inventory numbers |
| **Priority baseline** | Critical |

### 1.9 Inbound Orders

| Field | Value |
|-------|-------|
| **Who can modify** | Client create/submit; Admin plan/confirm/execute/complete/cancel; Operators via receiving tasks |
| **Who can observe** | Admin Inbound; Client inbound; dashboards |
| **Expected realtime consumers** | Admin list/detail; Client list/detail; AdminDashboard open inbound; notifications; task linkage |
| **Priority baseline** | Critical (status/qty); High (list membership) |

### 1.10 Outbound Orders

| Field | Value |
|-------|-------|
| **Who can modify** | Client/admin create; Admin confirm/allocate/fulfill/ship; Operators via pick/pack/dispatch |
| **Who can observe** | Admin Outbound; Client outbound; dashboards |
| **Expected realtime consumers** | Admin list/detail; Client list/detail; AdminDashboard; stock/reservations; notifications |
| **Priority baseline** | Critical |

### 1.11 OMS Orders

| Field | Value |
|-------|-------|
| **Who can modify** | Client/channel/admin create; Admin approve/reject; allocation & WMS fulfillment; delivery/COD actions |
| **Who can observe** | Admin OMS; Client Store; OMS dashboard; COD workspaces |
| **Expected realtime consumers** | `/orders/oms`, OMS detail, Client ecommerce orders + tracking; `/oms/dashboard`; COD pages; linked outbound; notifications |
| **Priority baseline** | Critical |

### 1.12 Returns (WMS + OMS)

| Field | Value |
|-------|-------|
| **Who can modify** | Client request; Admin confirm/approve/process/post/cancel |
| **Who can observe** | Admin returns / OMS returns; Client returns; stock after post |
| **Expected realtime consumers** | Return lists/detail/process; Client returns; stock; dashboards; notifications |
| **Priority baseline** | Critical (post inventory); High (status) |

### 1.13 Tasks / Workflow

| Field | Value |
|-------|-------|
| **Who can modify** | System creates from workflow; Manager assign/unassign/skip/retry; Operator start/complete/progress; Admin confirm |
| **Who can observe** | Operators (queues + My work); Managers; Order detail stage/next-task |
| **Expected realtime consumers** | `/tasks`, `/tasks/:id`, order workspaces, AdminDashboard open tasks chart, cycle-count adjacent queues |
| **Priority baseline** | Critical |

### 1.14 Cycle Counts

| Field | Value |
|-------|-------|
| **Who can modify** | Manager schedule/create/review/post; Operator execute counts |
| **Who can observe** | Managers; assigned operators |
| **Expected realtime consumers** | `/cycle-count`, `/cycle-count/my-tasks`, session detail/execute; stock after post |
| **Priority baseline** | Critical (post); High (assignment/progress) |

### 1.15 Adjustments

| Field | Value |
|-------|-------|
| **Who can modify** | Manager draft lines; Manager approve/cancel |
| **Who can observe** | Managers; anyone viewing affected stock after approve |
| **Expected realtime consumers** | `/inventory/adjustments`, detail; Stock consumers on approve |
| **Priority baseline** | Critical (approve → stock); High (status) |

### 1.16 Documents (GRN / DN)

| Field | Value |
|-------|-------|
| **Who can modify** | System generation on receiving/dispatch; slot overrides by ops |
| **Who can observe** | Order/task document panels; Contracts GRN/DN lists |
| **Expected realtime consumers** | Order detail documents; `/contracts/grn`, `/contracts/dn`; generation availability |
| **Priority baseline** | High (generation complete); Medium (list) |

### 1.17 Contracts / Final Contracts

| Field | Value |
|-------|-------|
| **Who can modify** | Admin create/generate final contracts; GRN/DN generation |
| **Who can observe** | Admin Contracts module |
| **Expected realtime consumers** | `/contracts/*` lists/status |
| **Priority baseline** | Medium |

### 1.18 Invoices / Billing Plans

| Field | Value |
|-------|-------|
| **Who can modify** | Finance/admin issue/pay/cancel; suspend/renew plans; system cycles; capacity usage updates from ops volume |
| **Who can observe** | Finance; Admin billing; Client `client_admin` billing/invoices |
| **Expected realtime consumers** | Billing dashboards; plan/invoice lists/detail; Client billing + restriction banner; capacity widgets |
| **Priority baseline** | Critical (restrict/suspend); High (invoice status); Medium (KPI charts) |

### 1.19 Forms / Leads

| Field | Value |
|-------|-------|
| **Who can modify** | Public form submit |
| **Who can observe** | Admin Forms inbox |
| **Expected realtime consumers** | `/forms` list + unread-style awareness |
| **Priority baseline** | Medium |

### 1.20 Audit Log Entries

| Field | Value |
|-------|-------|
| **Who can modify** | System append-only |
| **Who can observe** | Admin audit viewers |
| **Expected realtime consumers** | Optional live tail of **new** rows on `/audit-logs` |
| **Priority baseline** | Low–Medium |

### 1.21 Backup Jobs

| Field | Value |
|-------|-------|
| **Who can modify** | Super admin / scheduler |
| **Who can observe** | Super admin Settings backups |
| **Expected realtime consumers** | Running job progress/status on backup pages |
| **Priority baseline** | High while running; Low otherwise |

### 1.22 COD Records

| Field | Value |
|-------|-------|
| **Who can modify** | Ops collect/remit/settle; adjustments |
| **Who can observe** | Admin COD; Client my-profits; OMS dashboard finance widgets |
| **Expected realtime consumers** | `/oms/cod`, Client `/my-profits`, OMS dashboard COD KPIs, order COD panels |
| **Priority baseline** | High |

---

## 2. Realtime Event Triggers (Business Events)

Primary Investigation reference. Events are **product language**, aligned to workflows — not socket channel names.

**Row schema:** Event · Shared state · Scope · Affected screens · Producer · Consumers · Priority

### 2.1 Auth / Session / Company

| Event | Shared state | Scope | Affected screens / widgets | Producer | Consumers | Priority |
|-------|--------------|-------|----------------------------|----------|-----------|----------|
| `UserLoggedIn` | Sessions | SameUser, SameBrowser | Auth chrome; optional session list | Auth | Same user tabs | Low |
| `UserLoggedOut` | Sessions | SameUser, SameBrowser | Force all tabs to login | Auth / user | Same user | Critical |
| `UserSessionExpired` | Sessions | SameUser, SameBrowser | Force re-auth | Auth | Same user | Critical |
| `UserRoleChanged` | Users, Sessions | SameUser | Nav RBAC; home redirect; force refresh of permissions | Admin | Affected user | Critical |
| `UserDeactivated` | Users, Sessions | SameUser | Immediate logout / blocked API UX | Admin | Affected user | Critical |
| `CompanySuspended` | Companies, Sessions | SameCompany, ClientPortal, AdminDashboard | Client `/account-inactive`; admin client detail/list badges; billing widgets | Admin | Client users; admin clients/billing | Critical |
| `CompanyActivated` | Companies, Sessions | SameCompany, ClientPortal, AdminDashboard | Portal re-entry; admin badges; dashboards | Admin | Client users; admin | Critical |
| `CompanyArchived` | Companies | SameCompany, ClientPortal, AdminDashboard | Portal gate; admin list | Admin | Client; admin | Critical |
| `CompanyRestored` | Companies | SameCompany, ClientPortal, AdminDashboard | Portal access restored; admin list | Admin | Client; admin | High |
| `BillingRestricted` | Companies, Invoices/Plans, Sessions | SameCompany, ClientPortal | Operational create bans; restriction banner; billing page | Billing/admin | Client users; admin billing | Critical |
| `BillingRestrictionLifted` | Companies, Invoices/Plans | SameCompany, ClientPortal | Remove banner; allow creates | Billing/admin | Client users | Critical |

### 2.2 Inbound

| Event | Shared state | Scope | Affected screens / widgets | Producer | Consumers | Priority |
|-------|--------------|-------|----------------------------|----------|-----------|----------|
| `InboundCreated` | Inbound Orders, Notifications | SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Admin inbound list; Client inbound list; dashboards; bell | Client or admin | Admin ops; client company; dashboards | High |
| `InboundSubmittedForApproval` | Inbound Orders, Notifications | SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Lists; detail approval banner; pending queues; notifications | Client | Approvers; client detail | Critical |
| `InboundPlanned` | Inbound Orders | SamePage, SameWarehouse, ClientPortal | Admin detail plan/stage; client visible status if exposed | Admin | SamePage; client | High |
| `InboundConfirmed` | Inbound Orders, Tasks, Notifications | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Lists; detail; tasks created; dashboards; client status | Admin | Ops; client; dashboards | Critical |
| `InboundInProgress` | Inbound Orders, Tasks | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Status badges; stage; task linkage; dashboards | Operator/system | Ops; client | Critical |
| `InboundPartiallyReceived` | Inbound Orders, Inventory, Tasks | SamePage, SameCompany, AllWarehouseOperators, ClientPortal | Detail qty progress; stock; client detail | Operator | Ops; client | Critical |
| `InboundCompleted` | Inbound Orders, Inventory, Documents, Notifications | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Lists; detail; stock; GRN availability; dashboards; notifications | Operator/admin | Ops; client; finance volume | Critical |
| `InboundCancelled` | Inbound Orders, Tasks, Notifications | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Lists; detail; cancel tasks; dashboards; notifications | Admin | Ops; client | Critical |

### 2.3 Outbound

| Event | Shared state | Scope | Affected screens / widgets | Producer | Consumers | Priority |
|-------|--------------|-------|----------------------------|----------|-----------|----------|
| `OutboundCreated` | Outbound Orders, Notifications | SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Lists; dashboards; notifications | Client or admin | Ops; client | High |
| `OutboundSubmittedForApproval` | Outbound Orders, Notifications | SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Approval queues; client waiting banner; notifications | Client | Approvers; client | Critical |
| `OutboundPlanned` | Outbound Orders | SamePage, SameWarehouse, ClientPortal | Detail plan; client status | Admin | SamePage; client | High |
| `OutboundReleased` / `OutboundConfirmed` | Outbound Orders, Tasks, Reservations, Notifications | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Lists; detail; tasks; stock reserved; dashboards | Admin | Ops; client | Critical |
| `OutboundAllocated` | Outbound Orders, Reservations, Inventory | SamePage, SameCompany, AllWarehouseOperators, ClientPortal | Detail allocation; available/reserved | Admin/system | Ops; client stock | Critical |
| `OutboundPicking` | Outbound Orders, Tasks, Inventory | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Stage badge; task progress; dashboards | Operator | Ops; client | Critical |
| `OutboundPacking` | Outbound Orders, Tasks | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Stage; pack progress | Operator | Ops; client | Critical |
| `OutboundReadyToShip` | Outbound Orders, Tasks | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Stage; dispatch queue | Operator | Ops; client | Critical |
| `OutboundOutForDelivery` | Outbound Orders | SamePage, SameCompany, ClientPortal, AdminDashboard | Status; client tracking | Ops | Ops; client | High |
| `OutboundShipped` | Outbound Orders, Documents, Inventory, Notifications | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Lists; detail; DN; stock; dashboards; notifications | Ops | Ops; client | Critical |
| `OutboundDelivered` | Outbound Orders | SamePage, SameCompany, ClientPortal, AdminDashboard | Status; dashboards | Ops | Ops; client | High |
| `OutboundCompleted` | Outbound Orders | SamePage, SameCompany, ClientPortal, AdminDashboard | Lists; dashboards | System/ops | Ops; client | High |
| `OutboundCancelled` | Outbound Orders, Tasks, Reservations, Notifications | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Lists; detail; release reservations; cancel tasks; notifications | Admin | Ops; client | Critical |

### 2.4 OMS

| Event | Shared state | Scope | Affected screens / widgets | Producer | Consumers | Priority |
|-------|--------------|-------|----------------------------|----------|-----------|----------|
| `OmsCreated` | OMS Orders, Notifications | SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Admin OMS list; Client ecommerce list; OMS dashboard; notifications | Client / channel / admin | Ops; client | High |
| `OmsSubmittedForApproval` | OMS Orders, Notifications | SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Pending approval KPI; lists; detail; notifications | Client | Approvers; client | Critical |
| `OmsApproved` | OMS Orders, Notifications | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Status; tracking milestone; dashboards; notifications | Admin | Ops; client | Critical |
| `OmsRejected` | OMS Orders, Notifications | SamePage, SameCompany, ClientPortal, AdminDashboard | Status; lists; notifications | Admin | Client; ops | Critical |
| `OmsAllocated` | OMS Orders, Reservations, Inventory, Outbound Orders | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | OMS detail; stock reserved; linked outbound; dashboards | Admin/system | Ops; client | Critical |
| `OmsFulfillmentStageChanged` | OMS Orders, Tasks, Outbound Orders | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Tracking panel; warehouse status; OMS dashboard; lists | Operator/system | Ops; client | Critical |
| `OmsOutForDelivery` | OMS Orders | SamePage, SameCompany, ClientPortal, AdminDashboard | Tracking; dashboards | Ops | Ops; client | High |
| `OmsDelivered` | OMS Orders, COD Records | SamePage, SameCompany, ClientPortal, AdminDashboard | Tracking; COD pending; dashboards | Ops | Ops; client; finance | Critical |
| `OmsFailedDelivery` | OMS Orders, Notifications | SamePage, SameCompany, ClientPortal, AdminDashboard | Status; attention lists; notifications | Ops | Ops; client | Critical |
| `OmsCancelled` | OMS Orders, Reservations, Tasks, Notifications | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Lists; detail; release stock; notifications | Admin/client rules | Ops; client | Critical |
| `OmsCompleted` | OMS Orders | SamePage, SameCompany, ClientPortal, AdminDashboard | Lists; dashboards | System/ops | Ops; client | High |
| `CodCollected` | COD Records, OMS Orders | SameCompany, ClientPortal, AdminDashboard | COD workspaces; order COD panel; OMS dashboard; my-profits | Ops | Finance; client; ops | High |
| `CodRemitted` | COD Records | SameCompany, ClientPortal, AdminDashboard | COD pages; my-profits; dashboards | Ops/finance | Finance; client | High |
| `CodSettled` | COD Records | SameCompany, ClientPortal, AdminDashboard | COD pages; my-profits; dashboards | Finance | Finance; client | High |

### 2.5 Returns

| Event | Shared state | Scope | Affected screens / widgets | Producer | Consumers | Priority |
|-------|--------------|-------|----------------------------|----------|-----------|----------|
| `WmsReturnCreated` | Returns, Notifications | SameCompany, AllWarehouseOperators, ClientPortal | Admin returns list; client returns; notifications | Admin or client | Ops; client | High |
| `WmsReturnConfirmed` | Returns, Tasks | SamePage, SameCompany, AllWarehouseOperators, ClientPortal | Detail; process queue | Admin | Ops; client | High |
| `WmsReturnReceiving` / `WmsReturnInspecting` | Returns, Tasks | SamePage, AllWarehouseOperators, ClientPortal | Process UI progress; status | Operator | Ops; client | High |
| `WmsReturnInventoryPosted` | Returns, Inventory, Notifications | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Return detail; stock; client inventory; notifications | Admin/ops | Ops; client | Critical |
| `WmsReturnCompleted` | Returns | SamePage, SameCompany, ClientPortal, AdminDashboard | Lists; dashboards | Ops | Ops; client | High |
| `WmsReturnCancelled` | Returns, Notifications | SamePage, SameCompany, ClientPortal | Lists; detail; notifications | Admin | Ops; client | High |
| `OmsReturnCreated` | Returns, Notifications | SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | OMS returns; client ecommerce returns; notifications | Client | Ops; client | High |
| `OmsReturnApproved` | Returns, Notifications | SamePage, SameCompany, ClientPortal, AdminDashboard | Status; notifications | Admin | Client; ops | Critical |
| `OmsReturnRejected` | Returns, Notifications | SamePage, SameCompany, ClientPortal | Status; notifications | Admin | Client | Critical |
| `OmsReturnCompleted` | Returns, Inventory (if restock) | SamePage, SameCompany, ClientPortal, AdminDashboard | Lists; stock if posted; dashboards | Ops | Ops; client | Critical |

### 2.6 Products / Stock

| Event | Shared state | Scope | Affected screens / widgets | Producer | Consumers | Priority |
|-------|--------------|-------|----------------------------|----------|-----------|----------|
| `ProductCreated` | Products | SameCompany, ClientPortal | Admin/client product lists | Admin or client_admin | Catalog users | Medium |
| `ProductUpdated` | Products | SameCompany, ClientPortal, SamePage | Product detail/lists; line pickers on open forms (session-fresh ok) | Admin or client_admin | Catalog users | Medium |
| `ProductDeleted` / `ProductArchived` | Products | SameCompany, ClientPortal | Lists; detail unavailable | Admin | Catalog users | Medium |
| `StockChanged` | Inventory, Reservations | SameCompany, SameWarehouse, AllWarehouseOperators, ClientPortal, AdminDashboard | Stock tables; product stock; location stock; client available; capacity; allocation views | WMS ops / system | All stock observers | Critical |
| `StockReserved` | Reservations, Inventory | SameCompany, AllWarehouseOperators, ClientPortal | Available vs reserved; order allocation panels | Allocate actions | Ops; client | Critical |
| `StockReleased` | Reservations, Inventory | SameCompany, AllWarehouseOperators, ClientPortal | Available vs reserved | Release/cancel | Ops; client | Critical |
| `StockAdjusted` | Adjustments, Inventory | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Adjustment detail; all stock consumers | Adjustment approve | Ops; client | Critical |
| `InternalTransferCompleted` | Inventory | SameWarehouse, AllWarehouseOperators | Stock by location; product stock; transfer UI | Manager/ops | Ops | Critical |
| `LedgerLinePosted` | Inventory | SamePage, SameWarehouse | Open ledger views for that reference/SKU; product movements panel | System | Viewers of those pages | High |

### 2.7 Tasks / Workflow / Cycle Count

| Event | Shared state | Scope | Affected screens / widgets | Producer | Consumers | Priority |
|-------|--------------|-------|----------------------------|----------|-----------|----------|
| `TaskCreated` | Tasks, Inbound/Outbound/OMS | AllWarehouseOperators, SamePage (order), AdminDashboard | Task queues; order next-task; dashboards | Workflow system | Operators; managers | Critical |
| `TaskAssigned` | Tasks | SameUser (assignee), AllWarehouseOperators, SamePage | Queues; task detail; assignee’s my-work | Manager | Assignee; managers | Critical |
| `TaskUnassigned` | Tasks | SameUser, AllWarehouseOperators, SamePage | Queues; task detail | Manager | Previous assignee; managers | Critical |
| `TaskStarted` | Tasks, parent Order | SamePage, AllWarehouseOperators, ClientPortal (order stage), AdminDashboard | Task detail; order stage; queues | Operator | Collaborators; client stage | Critical |
| `TaskProgressUpdated` | Tasks | SamePage, AllWarehouseOperators | Line counters; scan progress; order workspace | Operator | SamePage collaborators | Critical |
| `TaskCompleted` | Tasks, parent Order, Inventory (if applicable) | SamePage, AllWarehouseOperators, ClientPortal, AdminDashboard | Queues; order stage advance; stock; dashboards | Operator | Ops; client | Critical |
| `TaskBlocked` / `TaskFailed` | Tasks, Notifications | SamePage, AllWarehouseOperators, AdminDashboard | Queues; detail; notifications; dashboards | Operator/system | Managers | Critical |
| `TaskCancelled` | Tasks | SamePage, AllWarehouseOperators, AdminDashboard | Queues; order workspace | Manager/system | Ops | High |
| `TaskReopened` | Tasks | SamePage, AllWarehouseOperators | Queues; detail | Manager | Ops | High |
| `WorkflowNodeAdvanced` | Tasks, parent Order | SamePage, AllWarehouseOperators, ClientPortal, AdminDashboard | Order stage footer; next task; client collapsed status | System | Ops; client | Critical |
| `CycleCountStarted` | Cycle Counts | AllWarehouseOperators, SamePage | Cycle list; my-tasks; execute | Manager/operator | Assigned ops | High |
| `CycleCountLineCounted` | Cycle Counts | SamePage | Execute UI progress for collaborators | Operator | SamePage | High |
| `CycleCountPendingReview` | Cycle Counts, Notifications | AllWarehouseOperators | List filters discrepancy; review UI; notifications | System | Managers | Critical |
| `CycleCountPosted` | Cycle Counts, Inventory | SamePage, SameCompany, AllWarehouseOperators, ClientPortal, AdminDashboard | Session complete; **StockChanged** fan-out | Manager | Ops; client stock | Critical |
| `CycleCountCancelled` | Cycle Counts | AllWarehouseOperators, SamePage | Lists; my-tasks | Manager | Ops | High |

### 2.8 Notifications / Documents / Billing / Platform

| Event | Shared state | Scope | Affected screens / widgets | Producer | Consumers | Priority |
|-------|--------------|-------|----------------------------|----------|-----------|----------|
| `NotificationCreated` | Notifications | SameUser | Bell badge; inbox; client dashboard activity | System | Owning user | High |
| `NotificationRead` | Notifications | SameUser, SameBrowser | Badge decrement; inbox row state | User | Same user sessions | High |
| `NotificationAllRead` | Notifications | SameUser, SameBrowser | Badge zero; inbox | User | Same user | High |
| `DocumentGenerated` | Documents | SamePage, SameWarehouse | Order/task document panel; GRN/DN contract lists | System | Ops on order; contracts UI | High |
| `DocumentSlotOverrideChanged` | Documents | SamePage | Document slot UI on task/order | Ops | SamePage | Medium |
| `FinalContractCreated` | Contracts | SystemWide (admin contracts) | `/contracts/final-contract` | Admin | Admin contracts | Medium |
| `InvoiceIssued` | Invoices, Notifications | SameCompany, ClientPortal, AdminDashboard | Invoice lists/detail; client invoices; billing dashboard; notifications | Finance/system | Finance; client_admin | High |
| `InvoicePaid` | Invoices | SameCompany, ClientPortal, AdminDashboard | Status badges; dashboards; may lift restriction | Finance | Finance; client_admin | High |
| `InvoiceCancelled` | Invoices | SameCompany, ClientPortal, AdminDashboard | Lists; detail; dashboards | Finance | Finance; client_admin | High |
| `PlanSuspended` | Billing Plans, Companies | SameCompany, ClientPortal, AdminDashboard | Plan detail; client billing; restriction path | Admin/finance | Client; finance | Critical |
| `PlanRenewed` | Billing Plans | SameCompany, ClientPortal, AdminDashboard | Plan status; renewals widgets | Admin/finance | Client; finance | High |
| `CapacityChanged` | Billing Plans, Inventory | SameCompany, ClientPortal, AdminDashboard | Capacity gauges; client billing usage; admin overview | Ops volume / system | Admin; client_admin | Medium |
| `FormSubmitted` | Forms | SystemWide (admin forms) | `/forms` inbox | Public | Admin forms users | Medium |
| `BackupJobStarted` | Backup Jobs | SameUser (super_admin viewers), SameBrowser | Backup pages progress | Super admin / scheduler | Super admins | High |
| `BackupJobProgress` | Backup Jobs | SameUser | Progress indicators | System | Super admins | High |
| `BackupJobCompleted` / `BackupJobFailed` | Backup Jobs, Notifications | SameUser | Job history; notifications | System | Super admins | High |

---

## 3. Realtime Consistency Rules

**Core rule:** A single business action must update **every** affected screen and widget. Updating one page and forgetting siblings is a **product defect**.

**Anti-pattern:** Emit/push for Inbound Detail only and leave Inbound List, Client Portal, Dashboard counters, Notifications, and Stock stale.

Reports mid-session counters are **Out of Scope** unless an exception is listed below (none by default).

### 3.1 Company Suspend / Activate / Billing Restrict

**Events:** `CompanySuspended`, `CompanyActivated`, `BillingRestricted`, `BillingRestrictionLifted`

**Must update:**
- Admin `/clients` list badges / lifecycle state
- Admin `/clients/:id` detail + lifecycle modal state
- AdminDashboard billing widgets (suspended / expiring)
- Client portal session gate → `/account-inactive` or restore access (`Sessions`)
- Client `BillingRestrictionBanner` on operational pages
- Client `/billing` account status badges
- Client create actions enabled/disabled state (inbound/outbound/OMS/returns/products as gated)
- Notifications to affected client users (`NotificationCreated`)

### 3.2 Inbound Confirm → Complete (and Cancel)

**InboundConfirmed — must update:**
- Admin Inbound List (status badge / row)
- Admin Inbound Detail (status, stage, next task, documents)
- Admin Tasks queues (`TaskCreated` fan-out)
- AdminDashboard open inbound counters / stage bars / recent orders
- Admin Notifications (operators/managers)
- Client Inbound List + Detail (approval waiting cleared; status)
- Client Dashboard attention / recent activity
- Activity widgets on OMS/admin where inbound recent appears

**InboundPartiallyReceived / InboundCompleted — additionally:**
- Inventory / Stock pages and product stock (`StockChanged`)
- Client inventory / product available qty
- Document panel / GRN availability (`DocumentGenerated`)
- Capacity widgets if volume counting (`CapacityChanged`)

**InboundCancelled — must update:**
- Lists/detail both portals; cancel related tasks; dashboards; notifications; release any holds

### 3.3 Outbound Release → Shipped / Delivered

**OutboundReleased / OutboundAllocated — must update:**
- Admin Outbound List + Detail
- Reservations + Stock available/reserved (admin + client)
- Tasks queues
- AdminDashboard outbound widgets
- Client Outbound List + Detail
- Notifications

**OutboundPicking → OutboundShipped — must update:**
- Order stage badges (admin + client collapsed status)
- Task detail progress + queues
- Stock on pick (`StockChanged`)
- DN / documents on ship
- Dashboards; notifications on ship
- Client tracking-equivalent status

**OutboundCancelled — must update:** lists/detail; tasks; **StockReleased**; dashboards; notifications; client views

### 3.4 OMS Approve → Delivered / Cancel (incl. COD)

**OmsApproved / OmsRejected — must update:**
- Admin OMS List + Detail (timeline, badge)
- `/oms/dashboard` pending approval KPI + charts + recent + activity
- Client ecommerce List + Detail + tracking milestones
- Client Dashboard order buckets / attention
- Notifications both sides as applicable

**OmsAllocated / OmsFulfillmentStageChanged — must update:**
- OMS detail warehouse status + linked outbound
- Stock reserved/released as applicable
- Task queues; outbound workspace if linked
- Client tracking panel
- OMS dashboard status donut / KPIs

**OmsDelivered — must update:**
- OMS + client status/tracking
- COD pending widgets (`CodCollected` path may follow)
- Dashboards; notifications

**OmsCancelled / OmsFailedDelivery — must update:**
- Lists/detail; attention lists; stock release if needed; notifications; dashboards

**CodCollected / CodRemitted / CodSettled — must update:**
- `/oms/cod`; Client `/my-profits`; OMS dashboard COD KPIs; order COD panel

### 3.5 Stock Changed (any posting path)

**Triggers include:** receive, putaway, pick, adjust approve, return inventory post, internal transfer complete, cycle count post, QC quarantine/release, scrap

**Event:** `StockChanged` (+ `StockReserved` / `StockReleased` / `StockAdjusted` / `LedgerLinePosted` as applicable)

**Must update:**
- `/inventory/stock`
- `/inventory/product/:productId` (balances, locations, lots, chart, movements)
- Location stock modals
- Open ledger views for affected reference
- Client `/products` metrics + stock health badges
- Client Dashboard live inventory snapshot
- AdminDashboard storage utilization / expiry tables if affected
- Any open order allocation / available qty panels
- OMS/outbound reservation displays

### 3.6 Task Assign / Start / Complete

**TaskAssigned / TaskUnassigned — must update:**
- `/tasks` all filtered queues
- `/tasks/:id` assignee + status
- Assignee SameUser “my work” perception (queue membership)
- Parent order workspace next-task / stage
- AdminDashboard open tasks by type

**TaskStarted / TaskProgressUpdated / TaskCompleted — must update:**
- Task detail (line counters, progress)
- Task queues (remove/move cards)
- Parent Inbound/Outbound/OMS detail stage + progress
- Client collapsed order status when stage maps to client-visible state
- Stock when completion posts inventory
- AdminDashboard task chart / open order stages
- Notifications on block/fail

### 3.7 Notification Created / Read

**NotificationCreated — must update:**
- Topbar unread badge (admin + client)
- `/notifications` if open
- Client Dashboard recent activity / attention when fed by notifications

**NotificationRead / NotificationAllRead — must update:**
- Badge counts all SameUser sessions/tabs
- Inbox row read state

### 3.8 Return Approve → Inventory Posted

**Must update:**
- Admin return list/detail/process
- Client return list/detail
- On `WmsReturnInventoryPosted` / restocking OMS return: full **Stock Changed** fan-out
- Dashboards return KPIs where shown
- Notifications

### 3.9 Invoice Issue / Pay / Plan Suspend

**InvoiceIssued / InvoicePaid / InvoiceCancelled — must update:**
- Admin invoice list/detail; billing dashboard KPIs
- Client `/invoices`, `/invoices/:id`, `/billing` obligation widgets
- Notifications
- If pay lifts restriction: **BillingRestrictionLifted** fan-out

**PlanSuspended / PlanRenewed — must update:**
- Admin plan list/detail; billing dashboard
- Client billing status
- Restriction path if suspend implies operational gate

### 3.10 Adjustment Approve

**StockAdjusted / Adjustment approved — must update:**
- `/inventory/adjustments` + `/:id` status
- Full **Stock Changed** fan-out
- Notifications to relevant managers if product requires
- AdminDashboard if stock KPIs affected

---

## 4. Cross-Cutting Platform Matrix

### 4.1 Authentication

| Feature | Always live? | Instant? | Static? | Why | Producer | Consumer | Priority |
|---------|--------------|----------|---------|-----|----------|----------|----------|
| Session validity | Yes | Yes | No | Prevent acting with revoked credentials | Auth / admin deactivate / company suspend | SameUser all tabs | Critical |
| Logout other tabs | Yes | Yes | No | SameBrowser consistency | User logout | SameBrowser | Critical |
| Login form itself | No | No | Yes | No shared live state | — | — | — |
| Role/nav permissions after role change | Yes | Yes | No | Wrong nav causes unauthorized actions | Admin UserRoleChanged | Affected user | Critical |

### 4.2 Online Presence

| Feature | Always live? | Instant? | Static? | Why | Priority |
|---------|--------------|----------|---------|-----|----------|
| Who is viewing a task/order | No | No | Yes (Out of Scope) | Not a product requirement | Out of Scope |

### 4.3 Notifications

| Feature | Always live? | Instant? | Static? | Why | Producer | Consumer | Priority |
|---------|--------------|----------|---------|-----|----------|----------|----------|
| Unread bell count | Yes | Yes | No | Primary attention signal | NotificationCreated/Read | SameUser | High |
| Inbox list | Yes | Yes | No | Collaborative ops awareness | System | Owner | High |
| Notification deep-link target freshness | Yes | Yes | No | Landing on stale entity defeats the alert | Domain events | Owner | High |

### 4.4 Counters, Badges, KPIs, Charts, Tables, Feeds

| Primitive | Live when | Static when | Priority |
|-----------|-----------|-------------|----------|
| Nav/task queue counters | Always while on ops surfaces | — | Critical–High |
| Status badges on open lists/detail | Always | — | Critical |
| Progress indicators (task lines, receive qty) | Always on open workspace | — | Critical |
| Inventory numbers | Always on inventory/product/client stock | — | Critical |
| Order/task status | Always | — | Critical |
| Approval workflow banners | Always | — | Critical |
| Dashboard KPIs / charts | Yes while dashboard open | — | Medium (AdminDashboard scope) |
| Activity feeds (OMS/client dashboard) | Yes while open | — | Medium |
| Report tables | No | Yes after load | Out of Scope |
| Audit historical browse | Optional new-row tail | Past rows static | Low–Medium |

---

## 5. Admin Module / Page Matrix

Convention for each page:
- **Live:** must push-update
- **Static:** no realtime
- **Events:** primary Business Events that invalidate the page

### 5.1 Dashboard

#### `/dashboard/overview`

| Feature | Live / Static | Instant? | Why | Events | Priority |
|---------|---------------|----------|-----|--------|----------|
| Open inbound/outbound counts & stage bars | Live | Yes | Ops steering | Inbound/Outbound status events | High |
| Open tasks by type chart | Live | Yes | Floor load | Task* events | High |
| Storage utilization gauge | Live | No (Medium ok) | Capacity awareness | StockChanged, CapacityChanged | Medium |
| Expiry lots table | Live | No | Risk awareness | StockChanged, lot movements | Medium |
| Recent open orders tables | Live | Yes | Handoff awareness | Inbound/Outbound created/status | High |
| Billing widgets (expiring/overdue/suspended) | Live | Yes | Commercial risk | Company*, Invoice*, Plan* | High |
| Catalog/customer KPI totals | Session-fresh / Low | No | Rarely critical mid-session | ProductCreated, Company* | Low |

#### `/oms/dashboard`

| Feature | Live / Static | Instant? | Why | Events | Priority |
|---------|---------------|----------|-----|--------|----------|
| Today KPIs (orders, pending approval, OFD, delivered, returns) | Live | Yes | OMS control tower | Oms*, Return* | High |
| COD finance KPIs / sparklines | Live | Yes | Cash awareness | Cod* | High |
| Charts (trend, status donut, COD donut) | Live | No | Awareness | Oms*, Cod* | Medium |
| Recent orders | Live | Yes | Triage | Oms* | High |
| Live activity feed | Live | Yes | Situational awareness | Oms*, Cod*, related notifications | Medium |

#### `/billing/dashboard`

| Feature | Live / Static | Instant? | Why | Events | Priority |
|---------|---------------|----------|-----|--------|----------|
| Revenue / invoice KPIs | Live | No | Finance awareness | Invoice*, Plan* | Medium |
| Charts / renewals lists | Live | No | Planning | Plan*, Invoice* | Medium |

### 5.2 Reports (`/reports/*`)

| Page | Live / Static | Why | Priority |
|------|---------------|-----|----------|
| All Reporting Center routes (warehouse-analysis, worker-productivity, order-cycle-time, inbound-accuracy, outbound-fill-rate, sla-compliance, inventory, product-moves, stock-aging, lot-expiry, capacity-utilization, return-rate, revenue-by-client, receivables-aging, merchant-orders, sales-report, delivery-report, allocation-report, inventory-reserved) | **Static after load** | Analytical snapshots; user re-queries | Out of Scope |

### 5.3 Inbound

#### `/orders/inbound` (list)

| Feature | Live / Static | Instant? | Events | Priority |
|---------|---------------|----------|--------|----------|
| Rows, filters, status badges | Live | Yes | Inbound* | Critical |
| New row appearance | Live | Yes | InboundCreated, Submitted | High |

#### `/orders/inbound/new`, `.../edit`

| Feature | Live / Static | Instant? | Why | Priority |
|---------|---------------|----------|-----|----------|
| Form draft fields | Static (own edits) | — | Authoring | — |
| Product picker stock hints | Live if shown | Yes | Avoid planning against stale qty | Critical |
| Concurrent edit of same order | Live conflict/status | Yes | Prevent overwrite of confirmed order | Critical |

#### `/orders/inbound/:id` (detail / workspace)

| Feature | Live / Static | Instant? | Events | Priority |
|---------|---------------|----------|--------|----------|
| Status badge, stage footer, timeline | Live | Yes | Inbound*, WorkflowNodeAdvanced | Critical |
| Next task / workflow | Live | Yes | Task*, Workflow* | Critical |
| Line qty / receive progress | Live | Yes | InboundPartiallyReceived, TaskProgress | Critical |
| Documents GRN | Live | Yes | DocumentGenerated | High |
| Approval actions visibility | Live | Yes | InboundSubmitted/Confirmed | Critical |

### 5.4 Outbound

#### `/orders/outbound` (list) — same pattern as inbound with `Outbound*` — **Critical**

#### `/orders/outbound/new|edit` — form static; stock hints **Critical** live

#### `/orders/outbound/:id`

| Feature | Live / Static | Instant? | Events | Priority |
|---------|---------------|----------|--------|----------|
| Status / stage / allocation | Live | Yes | Outbound*, StockReserved | Critical |
| Pick/pack/dispatch progress | Live | Yes | Task*, OutboundPicking… | Critical |
| DN documents | Live | Yes | DocumentGenerated | High |
| Linked stock impact | Live | Yes | StockChanged | Critical |

### 5.5 Inventory / Stock / Ledger / Adjustments

#### `/inventory/stock`

| Feature | Live / Static | Instant? | Events | Priority |
|---------|---------------|----------|--------|----------|
| On-hand / location grid | Live | Yes | StockChanged, Reserved, Released | Critical |
| Scan result freshness | Live | Yes | StockChanged | Critical |

#### `/inventory/product/:productId`

| Feature | Live / Static | Instant? | Events | Priority |
|---------|---------------|----------|--------|----------|
| Balances, lots, locations | Live | Yes | Stock* | Critical |
| Balance history chart | Live | No | StockChanged | Medium |
| Movements list | Live | Yes | LedgerLinePosted | High |

#### `/inventory/ledger/...`

| Feature | Live / Static | Instant? | Why | Priority |
|---------|---------------|----------|-----|----------|
| Open ledger for active reference | Live | Yes | Concurrent posting | High |
| Historical line immutable fields after load | Static | — | Append-only past | Low |

#### `/inventory/adjustments` + `/:id`

| Feature | Live / Static | Instant? | Events | Priority |
|---------|---------------|----------|--------|----------|
| Draft/approve status | Live | Yes | StockAdjusted path | High |
| On approve → stock | Live | Yes | Consistency 3.10 | Critical |

### 5.6 Tasks / Internal Transfer

#### `/tasks` (+ type filters)

| Feature | Live / Static | Instant? | Events | Priority |
|---------|---------------|----------|--------|----------|
| Queue membership, status, assignee | Live | Yes | Task* | Critical |
| Timing / blocked flags | Live | Yes | TaskBlocked/Failed | Critical |

#### `/tasks/:id` (execution centre)

| Feature | Live / Static | Instant? | Events | Priority |
|---------|---------------|----------|--------|----------|
| Status, assignee, lease/lock semantics | Live | Yes | Task* | Critical |
| Line counters / scans / complete | Live | Yes | TaskProgress, TaskCompleted | Critical |
| Pack/dispatch modals dependent state | Live | Yes | Task*, Outbound* | Critical |
| Parent order status strip | Live | Yes | Workflow*, Order* | Critical |

#### `/internal` (internal transfer)

| Feature | Live / Static | Instant? | Events | Priority |
|---------|---------------|----------|--------|----------|
| Transfer completion → locations | Live | Yes | InternalTransferCompleted, StockChanged | Critical |

### 5.7 Cycle Count

| Page | Live features | Static | Events | Priority |
|------|---------------|--------|--------|----------|
| `/cycle-count` | Session statuses, overdue/discrepancy | Schedule config forms session-fresh | CycleCount* | High–Critical |
| `/cycle-count/my-tasks` | Assignment queue | — | Task/Cycle assign | Critical |
| `/cycle-count/:id` | Review variances, status | — | CycleCountPendingReview | Critical |
| `/cycle-count/:id/execute` | Line counts, progress | — | CycleCountLineCounted | Critical |
| Post reconcile | Triggers Stock Changed fan-out | — | CycleCountPosted | Critical |

### 5.8 Returns (WMS)

| Page | Live features | Events | Priority |
|------|---------------|--------|----------|
| `/returns` | List statuses | WmsReturn* | High |
| `/returns/:id` | Status, confirm/cancel | WmsReturn* | High |
| `/returns/:id/process` | Line progress; post inventory | Receiving/Inspecting/Posted | Critical |

### 5.9 Products / Locations / Warehouses

| Page | Live / Static | Why | Priority |
|------|---------------|-----|----------|
| `/products` catalog fields | Medium live on CRUD from others | Shared catalog | Medium |
| `/products/:sku` | Medium; **stock sections Critical** | Stock shared | Critical (stock) |
| `/locations` structure | Low/static for layout CRUD | Rare | Low |
| Location stock modal | Live | StockChanged | Critical |
| `/warehouses` | Low/static | Rare master data | Low |

### 5.10 OMS Admin

| Page | Live features | Events | Priority |
|------|---------------|--------|----------|
| `/orders/oms` | Status filters, rows | Oms* | Critical |
| `/orders/oms/new` | Stock hints live; form static | Stock* | Critical (stock) |
| `/orders/oms/:id` | Badge, timeline, approve/reject, delivery, COD, WMS link | Oms*, Cod*, Outbound*, Task* | Critical |
| `/oms/cod` | COD statuses/totals | Cod* | High |
| `/oms/returns` | Return statuses | OmsReturn* | High |

### 5.11 Contracts / Documents

| Page | Live features | Events | Priority |
|------|---------------|--------|----------|
| `/contracts/grn` | Generation status / new docs | DocumentGenerated | High |
| `/contracts/dn` | Same | DocumentGenerated | High |
| `/contracts/final-contract` | New contracts list | FinalContractCreated | Medium |

### 5.12 Clients / Forms / Users

| Page | Live features | Events | Priority |
|------|---------------|--------|----------|
| `/clients` | Lifecycle badges | Company* | Critical |
| `/clients/:id` | Lifecycle state | Company*, Billing* | Critical |
| `/forms` | New submissions | FormSubmitted | Medium |
| `/users/warehouse_users` (+ detail) | Deactivate/role | User* | Critical (auth impact) |
| `/users/client_users` (+ detail) | Deactivate/role | User* | Critical |

### 5.13 Billing Admin

| Page | Live features | Events | Priority |
|------|---------------|--------|----------|
| `/billing/plans` (+ detail/edit) | Suspend/renew status | Plan* | Critical–High |
| `/billing/templates` | Low/static | Rare | Low |
| `/billing/invoices` (+ detail) | Payment/issue status | Invoice* | High |
| Manual charges on orders | Live on open order billing panels | Invoice/charge events | High |

### 5.14 Audit / Notifications / Profile / Settings

| Page | Live / Static | Events | Priority |
|------|---------------|--------|----------|
| `/notifications` | Live inbox + badge | Notification* | High |
| `/audit-logs` | Optional new-row tail; history static | System append | Low–Medium |
| `/profile` | Static fields; session Critical | User*, Session* | Critical (session only) |
| `/settings/backups*` | Live **while job running**; forms otherwise static | BackupJob* | High (running) |
| Backup upload/restore/factory-reset screens | Progress live during operation | BackupJob* | High |
| Schedules/retention/storage-policy/google-drive forms | Static | — | Low |
| `/settings/backups/health` | Live alerts while monitoring | BackupJob*, health events | Medium |

### 5.15 Login

| Page | Live / Static | Priority |
|------|---------------|----------|
| `/login` | Static | — |

---

## 6. Client Portal Module / Page Matrix

### 6.1 Auth / Gate

| Page | Live / Static | Why | Priority |
|------|---------------|-----|----------|
| `/login` | Static | — | — |
| `/account-inactive` | Live entry via session push when suspended | Must not continue operating | Critical |
| Billing restriction banner (global) | Live | Blocks creates correctly | Critical |

### 6.2 `/dashboard`

| Feature | Live / Static | Instant? | Events | Priority |
|---------|---------------|----------|--------|----------|
| Open OMS / obligation / stock KPI cards | Live | Yes | Oms*, Invoice*, Stock* | High |
| Order summary buckets | Live | Yes | Oms* | High |
| Order movement (7d) | Live | No | Oms* | Medium |
| COD finance cards | Live | Yes | Cod* | High |
| Live inventory table | Live | Yes | Stock*, Product* | Critical |
| Orders needing attention | Live | Yes | OmsFailedDelivery, pending, etc. | Critical |
| Recent activity | Live | Yes | Notification*, Return* | Medium |

### 6.3 Store (OMS)

| Page | Live features | Static | Events | Priority |
|------|---------------|--------|--------|----------|
| `/ecommerce-orders` | Status badges, rows | — | Oms* | Critical |
| `/ecommerce-orders/new` | Stock/availability hints | Form fields | Stock* | Critical (stock) |
| `/ecommerce-orders/:id` | Status, tracking milestones, warehouse status, COD, timeline | — | Oms*, Cod*, Outbound* | Critical |
| `/my-profits` | COD totals/statuses | — | Cod* | High |
| `/ecommerce-orders/returns` (+ new/detail) | Statuses; list | Form authoring static | OmsReturn* | High |

### 6.4 Warehouse (WMS) Client

| Page | Live features | Events | Priority |
|------|---------------|--------|----------|
| `/inbound-orders` | Collapsed statuses | Inbound* | Critical |
| `/inbound-orders/new` | Stock/catalog hints | Stock*, Product* | High |
| `/inbound-orders/:id` | Status + approval waiting banner | Inbound* | Critical |
| `/outbound-orders` | Collapsed statuses | Outbound* | Critical |
| `/outbound-orders/new` | Availability hints | StockReserved/Changed | Critical |
| `/outbound-orders/:id` | Status + approval banner | Outbound* | Critical |
| `/outbound-orders/returns` (+ new/detail) | Statuses | WmsReturn* / outbound return events | High |
| `/products` | Available/reserved/on hand, stock health | Stock*, Product* | Critical |
| `/products/new|:id|:id/edit` | Detail stock metrics live; form fields static/Medium | Stock*, Product* | Critical (stock) |

### 6.5 Account

| Page | Live features | Events | Priority |
|------|---------------|--------|----------|
| `/billing` | Plan status, restriction, capacity/usage, next invoice | Plan*, Capacity*, Invoice*, BillingRestricted* | Critical–High |
| `/invoices` (+ detail) | Status badges | Invoice* | High |

### 6.6 Notifications / Profile

| Page | Live features | Events | Priority |
|------|---------------|--------|----------|
| `/notifications` | Inbox + badge | Notification* | High |
| Topbar bell | Unread count | Notification* | High |
| `/profile` | Static display; session invalidation Critical | Session*, Company* | Critical (session) |

---

## 7. Approval Workflow Matrix (cross-module)

| Workflow | Waiting state must be live for | Resolver action events | Priority |
|----------|--------------------------------|------------------------|----------|
| Client inbound submit → admin confirm | Client detail banner; admin inbound queue; notifications | InboundSubmittedForApproval, InboundConfirmed/Cancelled | Critical |
| Client outbound submit → admin release | Same pattern | OutboundSubmittedForApproval, OutboundReleased/Cancelled | Critical |
| Client/admin OMS submit → approve/reject | OMS dashboard pending KPI; lists; client tracking | OmsSubmittedForApproval, OmsApproved, OmsRejected | Critical |
| OMS/WMS return approve | Return lists/detail both portals | OmsReturnApproved/Rejected; WmsReturnConfirmed | Critical |
| Adjustment approve | Adjustment detail; then stock fan-out | StockAdjusted | Critical |
| Cycle count pending review | Manager review queue; notifications | CycleCountPendingReview, CycleCountPosted | Critical |

---

## 8. Completeness Review

### 8.1 Admin routes checklist

| Route | Covered in matrix |
|-------|-------------------|
| `/login` | Yes |
| `/` redirect / `/dashboard/overview` | Yes |
| `/orders/inbound` (+ new/edit/:id) | Yes |
| `/orders/outbound` (+ new/edit/:id) | Yes |
| `/inventory/stock`, `/inventory/product/:id`, ledger routes, `/inventory/adjustments` (+ :id) | Yes |
| `/tasks` (+ :id), `/internal` | Yes |
| `/cycle-count` (+ my-tasks, :id, execute) | Yes |
| `/returns` (+ :id, process) | Yes |
| `/products` (+ :sku) | Yes |
| `/locations`, `/warehouses` | Yes |
| `/oms/dashboard`, `/orders/oms` (+ new/:id), `/oms/cod`, `/oms/returns` | Yes |
| `/contracts/grn`, `/dn`, `/final-contract` | Yes |
| `/reports` + all catalog reports | Yes (Out of Scope live) |
| `/clients` (+ :id) | Yes |
| `/forms` | Yes |
| `/billing/dashboard`, plans, templates, invoices | Yes |
| `/users/warehouse_users`, `/users/client_users` (+ :id) | Yes |
| `/audit-logs`, `/notifications`, `/profile` | Yes |
| `/settings/backups*` | Yes |

### 8.2 Client routes checklist

| Route | Covered |
|-------|---------|
| `/login`, `/account-inactive`, `/dashboard` | Yes |
| `/ecommerce-orders` (+ new/:id), `/my-profits`, ecommerce returns | Yes |
| `/inbound-orders`, `/outbound-orders` (+ returns) | Yes |
| `/products` (+ new/:id/edit) | Yes |
| `/billing`, `/invoices` (+ :id) | Yes |
| `/notifications`, `/profile` | Yes |

### 8.3 Workflow checklist

| Workflow | Events | Consistency rule |
|----------|--------|-------------------|
| Company lifecycle / billing restrict | §2.1 | §3.1 |
| Inbound approve → complete/cancel | §2.2 | §3.2 |
| Outbound release → ship/cancel | §2.3 | §3.3 |
| OMS approve → deliver/COD/cancel | §2.4 | §3.4 |
| Stock posting paths | §2.6 | §3.5 |
| Task assign/start/complete | §2.7 | §3.6 |
| Notifications | §2.8 | §3.7 |
| Returns → inventory post | §2.5 | §3.8 |
| Invoicing / plan suspend | §2.8 | §3.9 |
| Adjustment approve | §2.6 | §3.10 |
| Cycle count review/post | §2.7 | §3.5 + §3.6 |

### 8.4 Shared State checklist

All objects in §1 documented with modifiers, observers, consumers: Sessions, Presence (Out of Scope), Companies, Users, Notifications, Products, Inventory, Reservations, Inbound, Outbound, OMS, Returns, Tasks/Workflow, Cycle Counts, Adjustments, Documents, Contracts, Invoices/Plans, Forms, Audit, Backup Jobs, COD Records.

### 8.5 Architecture readiness checklist

| Requirement | Status |
|-------------|--------|
| Business Events catalog | Complete (§2) |
| Realtime Scope on every event | Complete |
| Shared State | Complete (§1) |
| Consistency Rules (fan-out) | Complete (§3) |
| No Polling rule | Stated (§0.3); no polling-primary features |
| Out of Scope | Stated (§0.5 + reports + presence) |
| Page matrix admin + client | Complete (§5–§6) |
| Investigation can proceed without guessing product intent | **Yes** |

### 8.6 Priority rollup (implementation order hint)

1. **Critical first:** Sessions/company gate; Stock*; Task*; Inbound/Outbound/OMS status & approval; Reservations; Return inventory post; Adjustment approve; Cycle count post; Billing restrict  
2. **High:** Notifications; COD; DocumentGenerated; Dashboard operational widgets; list membership; Contracts GRN/DN availability; Backup job progress  
3. **Medium:** Charts, activity feeds, forms inbox, capacity widgets, product catalog CRUD, audit live-tail  
4. **Low / Out of Scope:** Reports mid-session, theme/language, warehouse/location master structure, templates, presence  

### 8.7 Statement for implementers

An architect implementing or auditing realtime for this platform must use **only** this document as the product source of truth. Partial fan-out that updates one screen while leaving Consistency Rule siblings stale is a defect. Push-based delivery is required; polling is not the product model.

---

## Document control

| Field | Value |
|-------|-------|
| Filename | `REALTIME_PRODUCT_MATRIX.md` |
| Location | Staging repository root |
| Derived from | Product behavior + product surface inventory (routes/workflows/roles) |
| Explicitly excluded from authorship | WebSocket/SSE/event-bus implementation inspection |
