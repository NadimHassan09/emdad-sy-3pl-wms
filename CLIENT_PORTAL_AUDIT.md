# Client Portal Audit — E-commerce Merchant Morning Check

**Role:** E-commerce merchant  
**Routine:** Log into Client Portal every morning  
**Only questions that matter:**  
1. Where are my orders?  
2. Where is my inventory?  
3. Where is my money?  

**Areas reviewed:** Dashboard · OMS / Online orders · Billing · COD · Returns · Inventory / Products  
**Baseline:** Staging Client Portal (`HEAD`)  
**Lens:** Anything that blocks **fast decision making** — not visual polish

---

## Verdict

The portal *knows* the three questions (dashboard subtitles even ask them), but the morning path still forces **catalog totals, WMS order hubs, and subscription billing** before a scannable answer on **stuck customer orders**, **sellable stock**, and **COD cash**. Most numbers **do not open the matching actionable list**.

---

## 1. Dashboard — first screen of the day

### What I need in 10 seconds
- How many orders are stuck / need me today  
- What I can still sell  
- How much COD is ready vs waiting  

### What slows decisions

| Blocker | What I see | Why I can’t decide fast |
|---------|------------|-------------------------|
| Wrong lead metrics | First KPIs: **Total products**, **Total orders**, **Completed orders** | Answers catalog size and volume — not “what’s broken today.” |
| Status strip not clickable | Unprocessed / Processing / Out for delivery / Delivered / Returned are static cells; pie chart also dead | I must leave the dashboard and rebuild the filter myself. |
| “Returned” is contaminated | Bucket mixes `returned`, `cancelled`, `rejected`, `failed_delivery` | I treat cancels/failures as returns and chase the wrong work. |
| “Orders needing attention” lies | **Latest orders** = first 8 of the **date-filtered** set (default this month), not urgency | I scan recent volume instead of exceptions. |
| Money is below the fold | COD cards sit after inventory + latest orders; cards are **not links** | Extra scroll; can’t jump from a number to the COD list. |
| “Total COD” mislabeled | Value = pending + collected + remitted; hint says “COD collected this period” | I misread cash position vs collected-only. |
| Inventory row → dead end | Click goes toward `/products/:id`, App **redirects to `/products`** | Lost context; restart search. |
| “View all” inventory loses meaning | Dashboard shows Available / Reserved; Products list shows single **Stock** (`totalOnHand`) | Clarity dies one click later. |
| Weak loading/empty | Inventory “—” / “No inventory rows” with no next step | Can’t tell loading vs empty vs problem. |
| Activity doesn’t land right | Notification deep links cover inbound/outbound/billing invoices — not ecommerce, returns, or COD | Morning alerts often don’t open the right work. |

**Decision cost:** Dashboard looks busy but does not answer the three questions above the fold with actionable exits.

---

## 2. Orders / OMS — “Where are my orders?”

### What I need
One list of **customer orders** with statuses I understand, filterable to “needs me.”

### What slows decisions

| Blocker | What I see | Why it slows me |
|---------|------------|-----------------|
| Three order hubs | **Online orders** + **Inbound** + **Outbound** | I waste the first minute choosing which “orders” are mine. |
| OMS jargon on detail | List says Online orders; detail still **“OMS order”** / “Back to OMS orders” | Extra mental translate every open. |
| Warehouse language in filters | `Allocated`, `Picking`, `Packing`, `Pending approval`, `Ready to ship` | Not seller language (waiting / packing / with courier). |
| Dashboard ≠ list filters | Dashboard buckets don’t map 1:1; some live statuses missing from filters | I can’t open the same slice I just counted. |
| Misleading subtitle | “Online, COD, and returns” on Online orders | I expect COD/returns in this table; they’re other tabs. |
| Equal weight on Inbound/Outbound | Warehouse nav peers to Store | Restock/ship-out lists compete with customer-order triage. |
| Fake table chrome on WMS lists | Dead Filters button, checkboxes, ellipsis with no actions | Noise while hunting real work. |
| Return → wrong order type | Return detail links **original outbound**, not the online order | Reconstructing the customer order takes another hop. |

**Decision cost:** “Where are my orders?” is not one place. Morning triage requires knowing WMS vs Store vs OMS vocabulary.

---

## 3. Inventory — “Where is my inventory?”

### What I need
Sellable vs reserved vs problem stock at a glance — then drill one SKU.

### What slows decisions

| Blocker | What I see | Why it slows me |
|---------|------------|-----------------|
| Nav says **Products**, not inventory | Under Warehouse | “Products” sounds like catalog, not “what can I sell?” |
| List hides sellable split | **Stock** = `totalOnHand` + decorative bar; Available/Reserved only in a detail modal | Can’t scan sellable vs held on the morning list. |
| **Status** ≠ stock health | Product lifecycle (`active` / `suspended`), not low/out/damaged | I misread “Active” as “in stock and fine.” |
| No damaged / quarantine | Not in the stock/product surfaces used here | Can’t see dead/unsellable stock in the morning pass. |
| Empty copy unhelpful | “No products found.” / “No inventory rows.” | Don’t know: empty catalog, no stock, or filter issue. |
| Dashboard preview only 8 rows | “Live inventory” truncated | Full answer requires leaving and losing Available/Reserved columns. |

**Decision cost:** I cannot answer “can I still sell this?” without opening modals and ignoring misleading Status.

---

## 4. Money — Billing · Invoices · COD — “Where is my money?”

### What I need
One morning money picture: COD ready / pending / remitted, and separately what I owe Emdad.

### What slows decisions

| Blocker | What I see | Why it slows me |
|---------|------------|-----------------|
| Money is three destinations | **Billing** (subscription/m³/usage), **Invoices** (pay Emdad), **My profits** (COD) | I don’t know which tab is “my cash” vs “their fees.” |
| Top nav money ≠ COD | Billing + Invoices sit high; COD is **My profits** under Store | First money clicks are warehouse fees, not remittance. |
| Naming chaos | Nav **My profits** · page **Cash on delivery** · CTA **View COD** · route `/my-profits` (legacy `/cod-reports`) | Same idea, four names — slows recognition. |
| COD page thin on decision KPIs | Count + total amount; pending/collected/remitted breakdown lives on dashboard (non-clickable) | Bounce dashboard ↔ COD to understand state. |
| Remitted vs Settled | Filter options without merchant plain language | Unsure what is “done” vs “still with Emdad.” |
| Invoices: no unpaid headline | Flat table + status filter; no “X overdue / Y unpaid” summary | Must scan rows to know if money is due. |
| Billing is plan/usage charts | m³, entitlements, upgrade mailto — not COD | Easy to open Billing when hunting customer cash. |
| Payout is email | Dashboard “request payout” builds a mailto | Not a status I can track in-portal next to remitted. |

**Decision cost:** “Where is my money?” takes three pages and vocabulary decoding before I know collectable COD vs fees owed.

---

## 5. Returns

### What I need
How many returns are open / stuck, then the ones that need me — tied to the customer order and stock/money impact.

### What slows decisions

| Blocker | What I see | Why it slows me |
|---------|------------|-----------------|
| No status filter / summary | Flat list only | Can’t triage without reading every row. |
| Same Store subtitle | “Online, COD, and returns” | Blurs whether this list is money, orders, or returns. |
| Sparse detail | Expected/Received/lineStatus; outbound link only | Hard to connect return → customer order → restock/COD. |
| Dashboard folds returns into mixed “Returned” | Cancels/failures included | Inflates “returns” and misdirects follow-up. |

**Decision cost:** Returns are a dump, not a morning exception queue.

---

## 6. Navigation & findability

| Blocker | Impact on morning decisions |
|---------|------------------------------|
| Nav groups **Warehouse** vs **Store** with Billing elevated | Customer orders and COD are not the first-class top three. |
| Search placeholder “orders, products, invoices…” but results are **page jumps only** | False hope; typing an order # doesn’t find the order. |
| Notifications unread filter “current page only” | Unread count can’t be trusted for morning triage. |
| Notifications skip ecommerce / returns / COD deep links | Alerts don’t land on the actionable list. |
| Staff vs admin money map differs (staff: COD, no Billing) | Fine for COD-only roles; admins still get Billing-first money chrome. |

---

## Morning path vs what I need

| Question | Ideal 1-hop answer | Actual path today |
|----------|--------------------|-------------------|
| Where are my orders? | Stuck / action-needed customer orders | Dashboard totals → decode buckets → Online orders → re-filter; or confuse with Inbound/Outbound |
| Where is my inventory? | Sellable / reserved / problem SKUs | Dashboard Available/Reserved (8 rows) → Products with only totalOnHand → modal for split; product `:id` redirects away |
| Where is my money? | COD ready / pending / remitted (+ fees due) | Scroll past orders for non-linked COD cards **or** open My profits / Billing / Invoices and reconcile mentally |

---

## Top blockers (ranked)

1. **Dashboard leads with vanity counts; actionable status/money not click-through.**  
2. **Three order lists + OMS/WMS jargon** — no single “my customer orders” morning hub.  
3. **Money split three ways** with **My profits ≠ COD** naming.  
4. **Inventory list hides Available/Reserved**; Status means product lifecycle.  
5. **“Orders needing attention” and “Returned” are misleading.**  
6. **Product detail route redirects to list** — kills inventory drill-down.  
7. **Search doesn’t find entities**; notifications don’t deep-link OMS/COD/returns.  
8. **Returns have no triage summary/filter.**

---

*End of client portal audit. Decision-friction findings only — no implementation recommendations.*
