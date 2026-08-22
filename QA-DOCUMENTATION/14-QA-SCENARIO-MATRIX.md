# 14 — QA Scenario Matrix

**How to use:** Each row is an executable browser scenario. Expand Steps using the matching workflow file. Do not invent steps for UNKNOWN items — skip or mark blocked.

**Priority:** P0 critical path · P1 important · P2 coverage  
**Type:** Positive · Negative · Edge · Permission · Regression · End-to-End

**Environments:** Prefer staging admin/client URLs from `README.md`.

---

## Authentication

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| AUTH-01 | Auth | Admin login success | wh_manager | Valid admin user | Open admin login → email/password → Sign in | Lands dashboard overview | P0 | Positive |
| AUTH-02 | Auth | Operator home is Tasks | wh_operator | Valid operator | Login | Lands `/tasks` | P0 | Positive |
| AUTH-03 | Auth | Client login success | client_admin | Valid client | Client login | Lands dashboard | P0 | Positive |
| AUTH-04 | Auth | Invalid password | Any | Known user | Wrong password submit | Error; stay on login | P0 | Negative |
| AUTH-05 | Auth | Logout | Any | Logged in | User menu → Sign out | Login page | P0 | Positive |
| AUTH-06 | Auth | Deep link while logged out | client_staff | Logged out | Open `/ecommerce-orders` | Redirect login then return after login | P1 | Positive |
| AUTH-07 | Auth | Inactive client | client | Inactive account | Login | Account inactive page | P1 | Negative |
| AUTH-08 | Auth | Admin account on client login | admin user | Admin credentials | Try client portal login | Failure; no client shell | P1 | Negative |
| AUTH-09 | Auth | Remember me Continue | Any | Remember enabled previously | Open login → Continue | Session resumes or password re-prompt | P2 | Edge |
| AUTH-10 | Auth | Language toggle on login | Any | — | Switch AR/EN | Labels change | P2 | Positive |

---

## Authorization

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| PERM-01 | AuthZ | Staff cannot open Billing | client_staff | Logged in | Navigate `/billing` | Denied banner / dashboard | P0 | Permission |
| PERM-02 | AuthZ | Staff cannot create product | client_staff | — | Open `/products/new` | Redirect to products list | P0 | Permission |
| PERM-03 | AuthZ | Operator no Products nav | wh_operator | — | Inspect sidebar | Products hidden | P0 | Permission |
| PERM-04 | AuthZ | Operator deep-link Products | wh_operator | — | Open `/products` | Redirect home | P1 | Permission |
| PERM-05 | AuthZ | Finance sees Billing | finance | — | Open billing | Page loads (read) | P1 | Permission |
| PERM-06 | AuthZ | Internal transfer hidden for operator | wh_operator | — | Check tasks tabs / `/internal` | No access | P1 | Permission |
| PERM-07 | AuthZ | Admin-only API page | client_admin | — | Open APIs | Page loads | P1 | Positive |

---

## Dashboard

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| DASH-01 | Dashboard | Admin overview loads | wh_manager | — | Open dashboard | KPIs / quick actions visible | P1 | Positive |
| DASH-02 | Dashboard | Client dashboard CTAs | client_admin | Operational account | Open dashboard | New order CTA works | P1 | Positive |
| DASH-03 | Dashboard | Restricted banner | client_admin | Restricted company | Open dashboard | Restricted banner; creates disabled | P0 | Negative |

---

## Clients & Users

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| CLI-01 | Clients | Create company | wh_manager | — | Clients → New company → save | Company appears active | P1 | Positive |
| USR-01 | Users | Create warehouse user | wh_manager | — | Users → warehouse → New | User appears | P1 | Positive |
| USR-02 | Users | Create client user | wh_manager | Company exists | Client users → New | User can login to client portal | P0 | End-to-End |
| USR-03 | Users | Presence indicator | two admins | Realtime up | Observe Users list | Online/offline may update | P2 | Edge |

---

## Catalog / Products / Locations

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| PRD-01 | Products | Admin create product | wh_manager | — | Products → New → save | Product detail reachable | P0 | Positive |
| PRD-02 | Products | Client admin create product | client_admin | — | Inventory → New product | Product listed with stock zeros | P0 | Positive |
| PRD-03 | Products | Client staff cannot edit | client_staff | Product exists | Open edit URL | Redirect / no save | P1 | Permission |
| LOC-01 | Locations | Create location | wh_manager | Warehouse exists | Locations → New | Location Active | P1 | Positive |
| LOC-02 | Locations | Suspend location | wh_manager | Active location | Suspend | Status Suspended | P2 | Positive |
| WH-01 | Warehouses | Create warehouse | wh_manager | — | Warehouses → New | Appears active | P2 | Positive |

---

## Inventory

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| INV-01 | Inventory | Stock page loads | wh_manager | Stock exists | Inventory → Stock | Rows with on-hand/available | P0 | Positive |
| INV-02 | Inventory | Client stock columns | client_staff | Products with stock | Inventory list | Available/Reserved/On hand shown | P0 | Positive |
| INV-03 | Inventory | Adjustment draft→approve | wh_manager | — | New adjustment → approve | Stock changes | P1 | Positive |
| INV-04 | Inventory | Order above available | client_admin | Known available qty | Outbound/OMS qty > available | Insufficient stock error | P0 | Negative |

---

## Inbound

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| INB-01 | Inbound | Client submit inbound | client_admin | Product exists | New inbound → submit | Waiting for approval | P0 | Positive |
| INB-02 | Inbound | Admin approve & complete | wh_manager | Pending inbound | Approve → receive → putaway | Completed; stock up | P0 | End-to-End |
| INB-03 | Inbound | Past arrival date | client | — | Date yesterday | Validation blocks | P1 | Negative |
| INB-04 | Inbound | Client cannot approve | client_admin | Pending | Open detail | No approve CTA | P0 | Permission |
| INB-05 | Inbound | Export CSV | wh_manager | Rows exist | Export | File downloads | P2 | Positive |
| INB-06 | Inbound | Import template | client_admin | — | Import → download template | Template file | P2 | Positive |
| INB-07 | Inbound | Cancel inbound | wh_manager | Cancellable status | Cancel | Cancelled | P1 | Positive |

---

## Outbound

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| OUT-01 | Outbound | Client submit outbound | client_admin | Available stock | New outbound → submit | Waiting for approval | P0 | Positive |
| OUT-02 | Outbound | Full pick→ship manual | wh_manager | Approved outbound | Pick→pack?→method manual→details→dispatch | Shipped | P0 | End-to-End |
| OUT-03 | Outbound | Must select shipping method | wh_manager | After pack/pick | Observe status | Waiting for Shipping Method before details | P0 | Positive |
| OUT-04 | Outbound | Carrier without provider | wh_manager | At method stage | Choose carrier, skip provider | Validation error | P1 | Negative |
| OUT-05 | Outbound | Qty above available | client | — | Enter excess qty | Blocked | P0 | Negative |
| OUT-06 | Outbound | Client status collapse | client | Shipped outbound | View list | Shows Shipped | P1 | Positive |

---

## OMS

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| OMS-01 | OMS | Client create with map pin | client_admin | Stock | Fill form + pin → submit | Waiting for Confirmation | P0 | Positive |
| OMS-02 | OMS | Submit without pin | client_admin | — | Omit pin | Blocked | P0 | Negative |
| OMS-03 | OMS | Map circle follows area | client_admin | Create page | Change neighborhood | Circle recenters | P1 | Regression |
| OMS-04 | OMS | Client confirm | client_admin | Waiting confirmation | Confirm | Waiting admin approval | P0 | Positive |
| OMS-05 | OMS | Admin approve creates outbound | wh_manager | Confirmed waiting | Approve | Processing + outbound draft | P0 | End-to-End |
| OMS-06 | OMS | Client cancel early | client_admin | Waiting confirmation | Cancel | Cancelled | P0 | Positive |
| OMS-07 | OMS | Client cannot cancel after approve | client_admin | Processing | Open detail | No cancel | P0 | Permission |
| OMS-08 | OMS | Invalid recipient name | client | — | Name with digits/symbols | Validation | P1 | Negative |
| OMS-09 | OMS | Mark delivered | wh_manager | Shipped OMS | Mark delivered | Delivered | P0 | Positive |
| OMS-10 | OMS | Revert delivery | wh_manager | Delivered | Revert with reason | Back to shipped | P1 | Positive |
| OMS-11 | OMS | Failed delivery | wh_manager | Shipped | Failed delivery | Failed Delivery | P1 | Positive |
| OMS-12 | OMS | Incomplete approve blocked | wh_manager | needsInformation order | Approve | Error incomplete shipping | P1 | Negative |
| OMS-13 | OMS | Admin create provisioned | wh_manager | Stock | Create OMS with fulfillment | Processing + outbound | P1 | Positive |
| OMS-14 | OMS | COD list filters | client_admin | COD data | My profits filters | Rows filter | P2 | Positive |

---

## Tasks

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| TSK-01 | Tasks | Operator sees tasks | wh_operator | Tasks exist | Open Tasks | List loads | P0 | Positive |
| TSK-02 | Tasks | Execute pick completes | wh_operator | Pick task | Execute → complete | Task completed; outbound advances | P0 | End-to-End |
| TSK-03 | Tasks | Invalid pack qty | operator/admin | Pack task | Pack > picked | Error | P1 | Negative |
| TSK-04 | Tasks | Filter by type | wh_manager | Mixed tasks | Select Receiving tab | Only receiving | P2 | Positive |

---

## Cycle count

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| CC-01 | Cycle count | List loads | wh_manager | — | Open cycle count | Sessions/schedule UI | P1 | Positive |
| CC-02 | Cycle count | My tasks requires worker | wh_operator | No worker link | Open my-tasks | Empty/deny — verify | P2 | Edge |
| CC-03 | Cycle count | Approve variance | wh_manager | pending_review | Approve | Posted / completed path | P1 | Positive |

---

## Returns

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| RET-01 | Returns | OMS return after delivered | client_admin | Delivered order | Create return | Requested | P0 | Positive |
| RET-02 | Returns | Cannot return non-delivered | client_admin | Processing order | Try create return | Order not selectable / error | P0 | Negative |
| RET-03 | Returns | Admin approve OMS return | wh_manager | Requested return | Approve + process WH | Completed; order Returned | P0 | End-to-End |
| RET-04 | Returns | Outbound return via URL | client_admin | Shipped outbound | Open `/outbound-orders/returns/new` | Create succeeds | P1 | Positive |
| RET-05 | Returns | WH return dispositions | wh_manager | Return in process | Set restock vs scrap | Inventory matches disposition | P1 | Positive |

---

## Billing

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| BIL-01 | Billing | Admin invoice PDF | wh_manager | Invoice exists | Download PDF | File opens | P1 | Positive |
| BIL-02 | Billing | Mark paid | wh_manager | Unpaid invoice | Mark paid | Status Paid | P1 | Positive |
| BIL-03 | Billing | Client view invoices | client_admin | Invoices exist | Invoices list | Rows visible; Print works | P1 | Positive |
| BIL-04 | Billing | Restricted blocks create | client_admin | Restricted | Try new OMS | Disabled + banner | P0 | Negative |

---

## Documents

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| DOC-01 | Documents | Create GRN PDF | wh_manager | Eligible inbound | Contracts GRN → Create PDF EN | PDF downloads | P1 | Positive |
| DOC-02 | Documents | DN after dispatch | wh_manager | Shipped outbound | Create/Open DN | PDF available | P1 | Positive |
| DOC-03 | Documents | AR PDF | wh_manager | Eligible | Create PDF AR | Arabic content | P2 | Positive |
| DOC-04 | Documents | API docs PDF | client_admin | — | APIs → Download documentation | PDF downloads | P2 | Positive |

---

## Shipping

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| SHP-01 | Shipping | Companies page | wh_manager | — | Open Shipping Companies | Connect UI visible | P1 | Positive |
| SHP-02 | Shipping | Test connection | wh_manager | Connected carrier | Test connection | Success or config error (classify env) | P2 | Edge |
| SHP-03 | Shipping | Manual path without Send | wh_manager | waiting details | Complete details manual | Ready to ship | P0 | Positive |

---

## Notifications & Realtime

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| NTF-01 | Notifications | Pending inbound notifies admin | wh_manager | — | Client submits inbound | Admin notification appears | P1 | End-to-End |
| NTF-02 | Notifications | Mark all read | Any | Unread exist | Mark all read | Badge clears | P2 | Positive |
| RT-01 | Realtime | List refresh without reload | two users | Shared module open | User A completes task | User B list updates | P1 | Positive |
| RT-02 | Realtime | Forced logout | user | Session invalidated | Wait/observe | Redirect login | P2 | Edge |

---

## Error handling / UI

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| ERR-01 | UI | Empty list | Any | Filter nonsense | Apply impossible filter | Empty state not crash | P2 | Edge |
| ERR-02 | UI | Double submit create | client_admin | — | Double-click submit | One order or clear error | P1 | Edge |
| ERR-03 | UI | Browser back after create | client | Just created | Back button | No corrupt form / duplicate — observe | P2 | Edge |
| ERR-04 | UI | 404 client path | client | Logged in | Open `/no-such-page` | Page not found | P2 | Negative |

---

## Cross-module End-to-End

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| E2E-01 | Cross | Client OMS → Delivered | client_admin + wh_manager | Stock, operational billing | Create→confirm→approve→fulfill outbound→mark delivered | Delivered; stock reduced | P0 | End-to-End |
| E2E-02 | Cross | Inbound stock enables OMS | both | — | Complete inbound then OMS sell | OMS succeeds with new stock | P0 | End-to-End |
| E2E-03 | Cross | Delivered → return → restock | both | Delivered order | Return→approve→complete | Returned; inventory per disposition | P0 | End-to-End |
| E2E-04 | Cross | Billing restrict mid-flow | admin+client | Active client | Restrict account → client create | Create blocked | P1 | End-to-End |
| E2E-05 | Cross | Notifications across portals | both | — | Client create inbound | Admin notified; later client completed notify | P1 | End-to-End |

---

## Business rules, calculations, invariants (added layer)

Reference rules in `18-BUSINESS-RULES-AND-INVARIANTS.md`, formulas in `19-CALCULATIONS-AND-DERIVED-VALUES.md`, sync in `20-CROSS-MODULE-INVARIANTS.md`, journeys in `21-END-TO-END-INVARIANTS.md`. Resolve tensions via `22-DOCUMENTATION-CONFLICTS.md` before filing bugs.

| ID | Module | Scenario | Actor | Preconditions | Steps Summary | Expected Result | Priority | Type |
| -- | ------ | -------- | ----- | ------------- | ------------- | --------------- | -------- | ---- |
| BR-001 | OMS | Approve incomplete OMS | wh_manager | needsInformation order | Approve | Blocked; incomplete shipping message | P0 | Business Rule |
| BR-002 | OMS | Client cannot set shipping fee | client_admin | Create page | Inspect form | No shipping fee field | P0 | Business Rule |
| BR-003 | Outbound | Shipping method wrong status | wh_manager | Outbound in picking | Attempt select method if exposed | Rejected / not available | P0 | Business Rule |
| BR-004 | Outbound | Pack > pick | operator/admin | Pack task | Enter packed > picked | `Packed qty cannot exceed picked qty` | P0 | Business Rule |
| BR-005 | Outbound | Ship qty ≠ pick | admin | Dispatch | Mismatch ship qty | Ship qty must match picked | P0 | Business Rule |
| BR-006 | Inventory | Available = on-hand − reserved | wh_manager | Stock row | Read three columns | Equality holds | P0 | Business Rule |
| BR-007 | Billing | Restricted disables creates | client_admin | Restricted company | Open New order | Disabled + banner | P0 | Business Rule |
| BR-008 | Returns | OMS return over remaining | client_admin | Delivered + prior return | Exceed remaining | Validation error | P0 | Business Rule |
| BR-009 | OMS | Mark delivered too early | wh_manager | Waiting confirmation | Look for Mark delivered | Action absent / rejected | P0 | Forbidden state |
| BR-010 | Inbound | Receive >110% | wh_manager | Receiving | Enter 115% expected | Failure (DB/app) | P1 | Boundary value |
| CALC-001 | OMS | Subtotal = lines + fee | wh_manager | OMS with lines | Set fee 10 on lines totaling 100 | Subtotal/total 110 | P0 | Calculation |
| CALC-002 | OMS | COD defaults to subtotal | wh_manager | COD payment | Set fee; open COD fields | COD equals subtotal | P0 | Calculation |
| CALC-003 | OMS | Discount not applied to line math | wh_manager | If discount visible | Set discount; check total | Total ignores discount unless product says otherwise | P1 | Calculation |
| CALC-004 | Billing | Invoice VAT/discount math | wh_manager | Draft invoice | Set % discount + VAT | Matches CALC-BIL-002 | P1 | Calculation |
| CALC-005 | Billing | Draft counts shipped/completed | wh_manager | Known N/M in cycle | Open draft lines | inbound=N outbound=M + subscription | P1 | Calculation |
| INV-OMS-001 | Cross | OMS Processing ↔ Outbound Draft after approve | both | Confirmed waiting | Approve OMS | Processing + one Draft outbound | P0 | Invariant |
| INV-OMS-002 | Cross | OMS not Delivered after ship only | wh_manager | Outbound shipped | Check OMS | Shipped/ready synced; not Delivered until Mark delivered | P0 | Invariant |
| INV-OMS-003 | Cross | Status sync map after ready_to_ship | wh_manager | Complete shipping details | Compare OMS vs Outbound | OMS ready_to_ship | P0 | Invariant |
| INV-STK-001 | Cross | No on-hand drop at approve (task-only) | wh_manager | Snapshot stock | Approve outbound | On-hand stable; reserved may rise | P0 | Invariant |
| INV-STK-002 | Cross | On-hand drops at dispatch | wh_manager | Snapshot before ship | Complete dispatch | On-hand decreased by ship qty | P0 | Invariant |
| FS-001 | OMS | Delivered while waiting confirmation | — | — | Attempt illegal transition | Impossible via UI | P0 | Forbidden state |
| FS-002 | Outbound | Cancel after shipped | wh_manager | Shipped | Cancel | Blocked | P0 | Forbidden state |
| FS-003 | Inventory | Available > on-hand | — | Any stock row | Observe | Never | P0 | Forbidden state |
| DUP-001 | OMS | Approve twice | wh_manager | Approvable then processing | Approve → Approve again | One outbound; second no-op | P0 | Idempotency |
| DUP-002 | OMS | Mark delivered twice | wh_manager | Delivered | Mark delivered again | No-op / same state | P0 | Idempotency |
| DUP-003 | OMS | Client confirm twice | client_admin | Already confirmed waiting | Confirm again | Idempotent | P1 | Idempotency |
| DUP-004 | Tasks | Complete pick twice | operator | Completed pick | Complete again | Idempotent no second reserve | P1 | Idempotency |
| DUP-005 | Outbound | Dispatch twice | admin/operator | Shipped | Dispatch again | Idempotent; no double decrement | P0 | Idempotency |
| CONS-001 | Cross | OMS lines = Outbound lines after approve | both | After approve | Compare SKU/qty | Match | P0 | Consistency |
| CONS-002 | Cross | COD amount vs OMS money after deliver | both | COD delivered | Compare COD record to OMS | Matches codAmount/subtotal rule | P0 | Reconciliation |
| CONS-003 | Cross | Client available vs admin stock | both | Same SKU | Compare portals | Consistent free stock story | P1 | Reconciliation |
| CONS-004 | Cross | Billing outbound count vs shipped orders | wh_manager | Cycle window | Count shipped vs invoice outbound line qty | Match | P1 | Reconciliation |
| CONS-005 | Cross | GRN after receive / DN after dispatch | wh_manager | Completed stages | Open documents | PDFs available | P1 | Reconciliation |
| QTY-001 | Quantity | Client OMS qty decimal | client_admin | Create | Enter 1.5 | Blocked (integer) | P1 | Boundary value |
| QTY-002 | Quantity | Order qty > available | client_admin | Known available | Exceed | Insufficient stock | P0 | Boundary value |
| QTY-003 | Quantity | Return qty 0 / negative | client_admin | Return form | Enter 0 or -1 | Blocked | P1 | Boundary value |
| DATE-001 | Dates | Ship date yesterday | client_admin | Create OMS/outbound | Date < today | Blocked | P0 | Boundary value |
| DATE-002 | Dates | Expiring ≤7 still allows create | client_admin | Expiring account | New order | Allowed + warning | P1 | Business Rule |
| GAP-001 | Billing | Restricted UI vs OMS create | client_admin | Restricted | Confirm UI disabled | UI blocked; note API gap in conflicts | P1 | Consistency |

---

## Scenario counts (this matrix)

| Group | Count |
|-------|------:|
| Authentication | 10 |
| Authorization | 7 |
| Dashboard | 3 |
| Clients & Users | 4 |
| Catalog / Locations | 6 |
| Inventory | 4 |
| Inbound | 7 |
| Outbound | 6 |
| OMS | 14 |
| Tasks | 4 |
| Cycle count | 3 |
| Returns | 5 |
| Billing | 4 |
| Documents | 4 |
| Shipping | 3 |
| Notifications & Realtime | 4 |
| Error / UI | 4 |
| Cross-module E2E | 5 |
| Business / Calc / Invariant layer | 39 |
| **Total** | **136** |

Skip feature-flagged COD/Returns/Google Drive scenarios when those UI flags are off in the environment under test.
