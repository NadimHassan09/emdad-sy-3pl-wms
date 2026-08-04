# UX Audit — EMDAD WMS Admin

**Role:** Senior UX Researcher  
**Persona:** First-time warehouse / ops user (never used this product)  
**Method:** End-to-end workflow walkthrough of Admin Portal on staging (`HEAD` UI source)  
**Scope workflows:** Receiving · Putaway · Picking · Packing · Inventory · Billing · OMS · Returns · Products · Users · Clients  
**Deliverable:** Observed friction only — no redesign recommendations

---

## Method note

Walkthroughs follow the click path a new user would take from the sidebar, through create → confirm → execute → done (or the closest equivalent). Findings are framed as what a first-time user would think, ask, or get wrong.

---

## Cross-cutting findings (every workflow)

### Mental model split
Orders live under **Inbound / Outbound**; floor work lives under **Tasks**. Confirming an order starts a workflow but **does not take the user into the work**. A first-time user stays on the order page looking for “Receive” / “Pick” buttons that either don’t exist (task-only mode) or are secondary (“Open task” on a timeline).

### Assign → Start tax
Every execution panel is gated behind **Assign worker** → **Assign** → **Start**. After finishing receiving, the next putaway/pack task feels like starting a brand-new job, not continuing the same order. Extra clicks on every stage.

### Label inconsistency
Same concepts rename across surfaces:
- **Receive** (Tasks sub-nav) vs **Receiving** (filter/type) vs **Complete receiving**
- **Delivery** (Tasks sub-nav) vs **Dispatch** (filter/type / Complete dispatch)
- **Customers** (sidebar) vs **Clients** (page title) vs **Company** (create CTA) vs **Customer** (lifecycle toasts)
- **OMS Orders** vs path `/orders/oms` vs “e-commerce orders”

### Opaque task list
Tasks table shows raw `taskType` (`receiving`) and truncated UUID **Reference** (`abc12345…`). Search placeholder asks for “order id, task id, or worker id” — not the human order number the user just created. High cognitive load to find “my” work.

### Filter Apply tax
Nearly every list uses draft filters + **Apply filters**. Typing search then forgetting Apply is a common empty-state trap (“No … match the filters”).

### Empty states blame filters
Default empties read as filter failures, not “you haven’t created anything yet” / “here’s how to start.” No guided first-run for Receiving, Tasks, Returns, OMS, Products, Inventory ledger, etc.

### No product onboarding
Login says “Welcome back! Sign in to manage warehouse operations.” There is no tour, role explanation, or “start here” for operators vs managers. Operators lack Inbound/Outbound nav entirely and land in Tasks with no story of how work appears.

### Feedback gaps
Success is mostly toasts. After Confirm, there is often **no primary next-step CTA** on the page. Blocked tasks say to “use the order timeline” without a reliable deep link from the task itself. Errors sometimes appear as rose paragraphs or toast-only.

---

## 1. Receiving

### Happy path observed (manager, task-only)
1. Sidebar **Inbound**  
2. **+ New inbound** → client, arrival, lines → **Create**  
3. Order detail → set **Warehouse** / **Receiving dock** → **Confirm order**  
4. Toast: workflow started — **still on order**  
5. Discover **Workflow timeline** → **Receive** → **Open task** *(or leave to Tasks → Receive)*  
6. **Assign** → **Start**  
7. Enter received / damaged / missing; optional **Validate specs**  
8. **Save progress** → **Complete receiving**  
9. Card: **Next task: Quality check** (often) or Putaway  

**~12–18 interactions** before “receiving done.”

### Findings

| Category | Observation |
|----------|-------------|
| **Confusing workflow** | Order page looks like the place to receive; actual work is on Tasks. Confirm ≠ start working. |
| **Extra clicks** | Confirm → hunt task → Assign → Start before any qty entry. Line filters need Apply. |
| **Cognitive load** | Dock required before Confirm with little explanation; received/damaged/missing + specs validation before complete. |
| **Bad labels** | Inbound vs Receive vs Receiving; timeline **Receive** vs CTA **Complete receiving**. |
| **Unexpected behavior** | After complete, next step is often **Quality check**, not putaway — “I received it; where do I put it?” |
| **Poor navigation** | No automatic jump to the receiving task after Confirm. |
| **Missing feedback** | Toast only; no “Go to receiving” primary action on the order. |
| **Bad onboarding** | Empty list: *No inbound orders match the filters.* — no “create your first inbound to start receiving.” |
| **Poor empty states** | Same filter-blame empty; operator role never sees Inbound at all. |

---

## 2. Putaway

### How a first-timer finds it
- Best: post-receive card **Next task: Putaway** (if QC isn’t in front)  
- Else: Inbound detail → timeline → **Putaway** → **Open task**  
- Else: **Tasks** → **Putaway** → guess which truncated reference matches the order  

There is **no** “Put away stock” action on the inbound order lines in task-only mode.

### Findings

| Category | Observation |
|----------|-------------|
| **Confusing workflow** | Putaway is a separate task identity, not a continuation of receiving on the same screen. |
| **Extra clicks** | Assign → Start again; destination picker per line; Save → Complete. |
| **Cognitive load** | Choose storage bin + optional scan + **Split** without “suggested bin” guidance; quarantine putaway exists as a type but not in Tasks sub-nav. |
| **Bad labels** | Sub-nav **Putaway** omits **Putaway (quarantine)** — only in type dropdown. |
| **Unexpected behavior** | Task may be **blocked** waiting for QC; banner points to timeline without clear recovery. |
| **Poor navigation** | Easy to lose the chain after leaving the post-complete card. |
| **Missing feedback** | Empty: *No putaway lines.* / *No matching storage bins* — doesn’t explain upstream failure. |
| **Bad onboarding** | Nothing teaches “receive → QC → putaway” as one story. |
| **Poor empty states** | Global Putaway list with opaque refs feels empty of meaning even when rows exist. |

---

## 3. Picking

### Happy path observed
1. **Outbound** → **+ New outbound**  
2. Modal: client, ship date, destination, checkbox **Packing** (default on, no help) → lines → Create  
3. Amber note about task-driven stock deduction  
4. **Confirm & start workflow** → stay on order  
5. Timeline **Pick** → **Open task** (or Tasks → Pick)  
6. Assign → Start  
7. Pick lines; set **Drop-off (packing)** or **delivery area** with Apply/Scan  
8. **Complete picking** → Next: Pack or Delivery  

**Alternate:** **Quick outbound** — separate mental model, success “Outbound successful,” bypasses normal pick/pack UI.

### Findings

| Category | Observation |
|----------|-------------|
| **Confusing workflow** | Two outbound modes (normal vs Quick) without a clear “when to use which.” |
| **Extra clicks** | Same Confirm → task hunt → Assign → Start; drop-off Apply before complete. |
| **Cognitive load** | **Packing** checkbox is a single word — users don’t know it inserts a pack station and pack task. |
| **Bad labels** | Order status **Picking** vs task **Pick** vs **Complete picking**; drop-off jargon. |
| **Unexpected behavior** | Can finish line quantities and still fail complete because drop-off barcode wasn’t set. |
| **Poor navigation** | Stock deducted only at dispatch — easy to misread amber banner and expect stock gone at Confirm. |
| **Missing feedback** | Empty: *No pick reservations on this task.* — opaque if allocation failed. |
| **Bad onboarding** | No explanation of pick → pack → delivery pipeline on first outbound. |
| **Poor empty states** | Filter-match empties on list; no first-order guidance. |

---

## 4. Packing (and handoff to ship)

### Happy path observed
1. From pick complete: **Next task: Pack** *(or Tasks → Pack)*  
2. Assign → Start  
3. **Packages** table (seeded open package) → open **Ship prep** modal  
4. Dims/weight, **Add products**, **Finalize package**, optional print  
5. **Complete packing** (blocked if packages still open)  
6. **Next task: Delivery** → Assign → Start → shipment verification → **Complete dispatch**  

### Findings

| Category | Observation |
|----------|-------------|
| **Confusing workflow** | Two-level completion: **Finalize package** then **Complete packing** — easy to miss. Work happens in a modal, not the main table. |
| **Extra clicks** | Per-package modal loop + Assign/Start for Delivery after pack. |
| **Cognitive load** | Package model + shipment verification + carrier handoff on the next task is a lot after pick. |
| **Bad labels** | Tasks sub-nav **Delivery** vs filter **Dispatch** vs CTA **Complete dispatch** vs timeline **Delivery**. Users hunting “Ship” or “Dispatch” don’t match the nav word. |
| **Unexpected behavior** | If **Packing** was unchecked on create, pack is skipped and drop-off becomes delivery area — path changes with little guided explanation after confirm. |
| **Poor navigation** | Operators only see tasks appear; weak link from task row to human outbound number. |
| **Missing feedback** | Table may show *No packages yet.* while a seeded package exists depending on state — distrust. |
| **Bad onboarding** | No packing station story on first outbound. |
| **Poor empty states** | Same opaque task-list empty/filter pattern. |

---

## 5. Inventory

### Surfaces
Sidebar **Inventory** → `/inventory/stock` with sub-nav **Stock · Ledger · Adjustments**. Row → product lot/location breakdown. Adjustments also under inventory match.

### Findings

| Category | Observation |
|----------|-------------|
| **Confusing workflow** | Three views (stock summary, ledger movements, adjustments) without a plain-language “I want to see what’s on hand / what moved / fix a count.” |
| **Extra clicks** | Apply filters on stock and ledger; barcode scan is a side path. Creating an adjustment is another list under the same parent. |
| **Cognitive load** | Search-by categories (name, SKU, barcode, lot, inbound order #); ledger movement types; warehouse-not-configured dead end. |
| **Bad labels** | Sidebar **Inventory** vs table **Inventory** vs **Stock** tab — redundant; **Ledger** is accountant jargon for floor staff. |
| **Unexpected behavior** | Clicking SKU/barcode affordances open barcode viewers — not always what “click product” implies. |
| **Poor navigation** | `/adjustments` historically vs `/inventory/adjustments` — mental path must stay inside Inventory sub-nav. |
| **Missing feedback** | Warehouse missing: alert to “contact administrator” — no in-app path to Warehouses settings for eligible roles. |
| **Bad onboarding** | No explanation of stock vs ledger vs adjustments on first visit. |
| **Poor empty states** | *No on-hand stock matches the current filters.* / *No ledger rows for the current filters.* / *No adjustments match the filters.* — all filter-blame; *Warehouse not resolved yet.* is system-speak. |

---

## 6. Billing

### Surfaces
Sidebar **Billing** lands on **`/billing/plans`** (not dashboard). Sub-nav: Dashboard · Plans · Invoices. Plans list shows **cycle status** and **billing status** together; row actions suspend/resume **plan**. Clients separately have **Manage account status** (lifecycle). Templates via secondary **Create plan template**.

### Findings

| Category | Observation |
|----------|-------------|
| **Confusing workflow** | “Billing” opens Plans, not an overview. Creating a plan vs template vs assigning to a client is multi-path. Suspend plan ≠ suspend client account — two freeze concepts. |
| **Extra clicks** | Dual create CTAs in header; filters Apply; templates on another route. |
| **Cognitive load** | Two status columns/badges on one row (cycle + billing); Volume/storage panel above the list distracts from “find a plan.” |
| **Bad labels** | **Billing status** vs client **Account status** / **Lifecycle**; toast “Subscription is frozen” vs company suspend — overlapping language. |
| **Unexpected behavior** | First-time users may suspend a **plan** thinking they suspended the **client**, or vice versa. |
| **Poor navigation** | Dashboard is secondary; invoices and plans don’t clearly tell “start here for month-end.” |
| **Missing feedback** | Billing dashboard empty: *No data yet.* — no what/why/next. |
| **Bad onboarding** | No glossary of plan vs cycle vs invoice vs account lifecycle. |
| **Poor empty states** | Plans/invoices use filter-match empties; dashboard charts empty with minimal copy. |

---

## 7. OMS

### Surfaces
Sidebar: **OMS Dashboard**, **OMS Orders**, **COD**, **OMS Returns** (plus duplicate sub-nav on OMS section). Create OMS order from list. Dashboard is a KPI grid + recent orders. COD / OMS Returns pages are report-like workspaces, not the same as WMS **Returns**.

### Findings

| Category | Observation |
|----------|-------------|
| **Confusing workflow** | Unclear relationship: OMS order → warehouse outbound/tasks. Delete warns linked outbound won’t be deleted — first-timers won’t know what “linked” means until they break something. |
| **Extra clicks** | Dashboard “View OMS orders” then filters Apply; create is modal-heavy. |
| **Cognitive load** | 12 KPI cards on OMS Dashboard; status list duplicates the tiles. |
| **Bad labels** | **OMS** acronym unexplained; **COD** unexplained; **OMS Orders** vs **Outbound**; **OMS Returns** vs WMS **Returns**. |
| **Unexpected behavior** | Two “returns” destinations in the product; COD sits next to orders but is collection/settlement, not fulfillment. |
| **Poor navigation** | Sidebar OMS items + section sub-nav repeat the same four destinations — noise. Paths mix `/oms/...` and `/orders/oms`. |
| **Missing feedback** | Dashboard load/error are plain text lines; status tiles are not click-through to filtered lists (except recent order links). |
| **Bad onboarding** | Description “E-commerce order pipeline…” assumes channel knowledge. |
| **Poor empty states** | *No data.* / *No recent orders.* / *No e-commerce orders match the filters.* — no “connect a store / create first OMS order.” |

---

## 8. Returns (WMS)

### Happy path observed
1. Sidebar **Returns** (requires tenant/company context — may show **Select a tenant company…**)  
2. **New return** → detail  
3. **Confirm** / **Start receiving** on detail  
4. **Process** → `/returns/:id/process` (also auto-starts receiving when status is confirmed)  
5. Per line: receive qty → condition → disposition → location → post  

Parallel: **OMS Returns** is a different list under OMS.

### Findings

| Category | Observation |
|----------|-------------|
| **Confusing workflow** | Detail vs **Process** split; auto-start receiving on process page can surprise; disposition enums (`restock`, `quarantine`, `inspection_required`) are expert language. |
| **Extra clicks** | List → detail → Process (or Process from list) → per-line multi-step; Confirm separate from Process. |
| **Cognitive load** | Condition + disposition + target location + notes; knowing when a line is “done” vs needs inspection. |
| **Bad labels** | **Returns** vs **OMS Returns**; condition options shown as raw tokens (`new`, `good`, `damaged`). |
| **Unexpected behavior** | Process page may auto-call start receiving when status is `confirmed` — silent workflow advance. |
| **Poor navigation** | Blocked without companyId with only a warning — unclear how a new user selects tenant. |
| **Missing feedback** | Success toasts per micro-step; overall “return complete” story is easy to lose. |
| **Bad onboarding** | No comparison “warehouse return vs OMS return.” |
| **Poor empty states** | *No returns match the filters.* / *No returns found.* — filter-blame; no create guidance when truly empty. |

---

## 9. Products

### Happy path observed
**Products** → filters Apply → **+ New product** modal (many fields/dims) → list with stock bar + stock health + status. Row actions: suspend / reactivate / delete / edit. Barcode camera path available.

### Findings

| Category | Observation |
|----------|-------------|
| **Confusing workflow** | Product status (active/suspended/archived) vs **stock health** vs inventory **on-hand** — three “is this OK?” signals. |
| **Extra clicks** | Apply filters; open modal create; manage lifecycle via row menu. |
| **Cognitive load** | Create modal asks for dimensions/specs early; stock health bar uses threshold math users don’t see explained. |
| **Bad labels** | Stock column + Stock health column compete; health badges are tiny. |
| **Unexpected behavior** | SKU/barcode interactions open barcode UI — may feel like accidental navigation. |
| **Poor navigation** | Product detail vs inventory product detail are different destinations for “this SKU.” |
| **Missing feedback** | Toasts on create/save; little guidance when create fails validation beyond toast/field errors. |
| **Bad onboarding** | Empty: *No products match the filters.* — not “add the client’s catalog to receive stock.” |
| **Poor empty states** | Filter-blame empty; no sample or import hint. |

---

## 10. Users

### Surfaces
Sidebar **Users** → `/users/warehouse_users` with sub-nav **Warehouse users · Client users**. Create modal: system role, password, company (for client users), worker warehouse for operators.

### Findings

| Category | Observation |
|----------|-------------|
| **Confusing workflow** | Two user populations in one nav item; “System role” vs displayed role labels; worker profile status only for operators. |
| **Extra clicks** | Switch sub-nav to see client users; create requires knowing company + role pairing. |
| **Cognitive load** | Creating a client user without selecting company fails with toast *Select a company for the client user.* — late discovery. |
| **Bad labels** | **Users** vs **Warehouse users** / **Client users**; roles like `wh_operator` humanized unevenly; status pills ad-hoc vs StatusBadge elsewhere. |
| **Unexpected behavior** | Suspend from row menu; password set at create and optionally on edit — no “invite / set password later” story. |
| **Poor navigation** | No link from Clients → “users for this company” as primary path (user must know Client users tab + company field). |
| **Missing feedback** | Success toasts; little explanation of what each role can access. |
| **Bad onboarding** | Empty: *No warehouse users yet.* / *No client users yet.* — better than filter-blame, but no “create operator to run Tasks.” |
| **Poor empty states** | Acceptable copy when truly empty; still no role primer. |

---

## 11. Clients

### Surfaces
Sidebar label **Customers** → route `/clients` → page title **Clients** → CTA **+ New company** → toasts say **Customer** suspended/archived. Row: Edit · **Manage account status** (Lifecycle modal). Billing column shows cycle · payment terms days. Row click → company detail.

### Findings

| Category | Observation |
|----------|-------------|
| **Confusing workflow** | Account lifecycle (suspend/archive/restore/delete/purge) vs Billing plan suspend — both “stop this client” mental models. |
| **Extra clicks** | Actions menu → Manage account status → choose lifecycle action; create company is a large form modal. |
| **Cognitive load** | Lifecycle modal: Account data blockers, hard delete vs purge rules, super-admin-only delete — heavy for a first admin. |
| **Bad labels** | **Customers** (nav) ≠ **Clients** (page) ≠ **Company** (CTA) ≠ **Customer** (toasts) ≠ **Lifecycle** (modal title). Billing column is not the billing plans screen. |
| **Unexpected behavior** | Filter status options omit nuances users see in lifecycle (e.g. purged handling). |
| **Poor navigation** | From Clients, path to that client’s billing plan / users is not obvious as a single journey. |
| **Missing feedback** | Create success *Company created.* while nav said Customers — vocabulary whiplash. |
| **Bad onboarding** | Empty: *No companies yet.* — closest to a true empty state, still no “clients own products, orders, and billing.” |
| **Poor empty states** | Better than filter-only lists, but no next-step CTA beyond the table header button. |

---

## Priority themes (researcher synthesis)

1. **Broken handoff after Confirm** — highest session killer across Receiving, Picking, and downstream putaway/pack.  
2. **Orders vs Tasks dual hub** — forces role and navigation expertise before floor work.  
3. **Assign → Start on every stage** — multiplies clicks and breaks “continue this order” feeling.  
4. **Naming collisions** — Customers/Clients/Company; Receive/Receiving; Delivery/Dispatch; Returns ×2; OMS jargon.  
5. **Opaque task identity** — truncated UUIDs and raw task types.  
6. **Filter Apply + filter-blame empties** — false “no data” and lost first-run guidance.  
7. **Account status vs billing plan status** — freeze/suspend confusion between Clients and Billing.  
8. **No role-based onboarding** — operators and managers get the same silent login.  

---

## Severity ranking (first-session impact)

| Rank | Issue | Workflows hit |
|------|--------|----------------|
| P0 | Confirm does not open the next task | Receiving, Picking, Packing chain |
| P0 | Customers / Clients / Company / Customer label chaos | Clients, Users, Billing |
| P0 | Returns vs OMS Returns (and Delivery vs Dispatch) | Returns, OMS, Packing |
| P1 | Assign → Start gate every stage | All floor tasks |
| P1 | Task list reference = truncated UUID | All Tasks |
| P1 | Account lifecycle vs plan suspend | Clients, Billing |
| P1 | Packing checkbox unexplained; package finalize ritual | Picking, Packing |
| P2 | Apply-filter tax + empty copy | Nearly all lists |
| P2 | Inventory Stock / Ledger / Adjustments unexplained | Inventory |
| P2 | OMS KPI dashboard non-actionable | OMS |
| P2 | No first-run / role onboarding | All |

---

*End of UX audit. Observations only — no implementation recommendations.*
