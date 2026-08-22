# 03 — Client Portal

**Confidence:** High for nav, routes, and create forms. Medium for outbound-returns discoverability and unused export UI.

**Base URL (staging):** https://staging-client.emdadsy.com

---

## Shell chrome

### Sidebar brand

**EMDAD** with warehouse icon. Footer shows avatar/initials, name, role (**Administrator** / **Staff**), navigating to Profile.

### Navigation order

**Both roles:**

1. **Dashboard**
2. Section **Store**
   - **Online orders**
   - **Cash on delivery**
   - **Returns** → ecommerce returns
3. Section **Warehouse**
   - **Inbound**
   - **Outbound**
   - **Inventory**
4. Section **Account**
   - **Notifications** (unread badge)

**client_admin only (Account):**

- **Billing**
- **Invoices**
- **APIs**  
  (Order with Notifications: Billing → Invoices → Notifications → APIs)

**Not in sidebar:**

- Profile (footer / user menu)
- **Outbound returns** (`/outbound-orders/returns`) — reachable via Quick jump or direct URL only

### Topbar

- Quick jump (**⌘K** / **Ctrl+K**)
- Theme toggle
- Notifications dropdown
- User menu: Language EN/AR, Sign out

### OMS pill tabs

On Store pages: **Online orders | Cash on delivery | Returns**

---

## Routes

| Path | Purpose | Who |
|------|---------|-----|
| `/login` | Sign in | Public |
| `/account-inactive` | Inactive notice | Directed |
| `/dashboard` | Dashboard | Both |
| `/products` | Inventory / catalog | Both (staff view-only mutations) |
| `/products/new` | New product | Admin only |
| `/products/:id` | Product details | Both |
| `/products/:id/edit` | Edit product | Admin only |
| `/inbound-orders` | Inbound list | Both |
| `/inbound-orders/new` | New inbound | Both* |
| `/inbound-orders/:id` | Detail | Both |
| `/outbound-orders` | Outbound list | Both |
| `/outbound-orders/new` | New outbound | Both* |
| `/outbound-orders/:id` | Detail | Both |
| `/outbound-orders/returns*` | Outbound returns | Both* |
| `/ecommerce-orders` | Online orders | Both |
| `/ecommerce-orders/new` | New online order | Both* |
| `/ecommerce-orders/:id` | Detail | Both |
| `/ecommerce-orders/returns*` | Online returns | Both* |
| `/my-profits` | COD | Both |
| `/billing` | Billing | Admin |
| `/invoices` | Invoices | Admin |
| `/invoices/:id` | Invoice detail / print | Admin |
| `/apis` | API credentials | Admin |
| `/notifications` | Notifications | Both |
| `/profile` | Profile | Both |

\* Disabled when billing account is restricted / no plan.

---

## Dashboard

### Purpose

Operational snapshot for the merchant.

### Typical sections (user-visible)

- Metrics / OMS status buckets
- COD summary
- Live inventory highlights
- Attention list / recent activity
- CTA **New order** when account is operational

### Expected states

- Loading while metrics fetch
- Empty buckets when no orders
- Restricted banner when billing blocks operations

---

## Online orders (OMS)

### List `/ecommerce-orders`

- Create order, Import
- Status filters using commercial labels (see `06-OMS-WORKFLOW.md`)
- Open detail

### Create `/ecommerce-orders/new`

Sections: **Shipping information**, **Order details**, **Products**.

| Field | Required | Notes |
|-------|----------|-------|
| Recipient name | Yes | Letters + spaces only |
| Recipient phone | Yes | International phone |
| Governorate | Yes | Cascading Syria selectors |
| City/Region | Yes | |
| Town/Neighborhood | Yes | |
| Street / Detailed Address | Yes | |
| Map delivery pin | Yes | Click map; blue circle is area guide |
| Required ship date | Yes | Not before today |
| Payment method | Optional | COD / Prepaid / Credit |
| Notes | Optional | |
| Product lines | ≥1 | Product, Qty (whole number), Price |

**Submit:** **Submit for approval**  
**Cancel:** returns without creating.

After submit:

1. Order appears in Online orders.
2. Initial commercial status: **Waiting for Confirmation**.
3. No warehouse outbound yet.

### Detail actions

| Action | When visible |
|--------|----------------|
| **Confirm order** | Waiting for Confirmation |
| **Cancel order** | Waiting for Confirmation, Confirmed — Waiting for Admin Approval, or legacy pending approval |

After admin approval / processing: client cancel controls are **not** shown; warehouse/admin cancel only.

Incomplete shipping may show **Incomplete Order** / shipping information incomplete.

---

## Inbound (client)

### Create fields

| Field | Required |
|-------|----------|
| Expected arrival date (≥ today) | Yes |
| Notes | Optional |
| Product + Quantity (≥1 whole) | Yes, ≥1 line |

**Submit for approval** → list status **Waiting for approval**. Client cannot approve.

---

## Outbound (client)

### Create fields

| Field | Required |
|-------|----------|
| Destination | Yes |
| Required ship date (≥ today) | Yes |
| Carrier | Optional |
| Notes | Optional |
| Product + Quantity | Yes; capped by available stock |

**Submit for approval** → **Waiting for approval**.

Client-facing outbound statuses collapse many warehouse stages into: **Waiting for approval · In progress · Shipped · Cancelled** (`shipped` and `delivered` both display as **Shipped**).

---

## Inventory / Products

### List

Shows catalog with stock columns: **Available**, **Reserved**, **On hand**; health **In stock / Low stock / Out of stock**.

### Create product (admin only)

Photo optional; Name required; SKU/Barcode optional with Generate; Description; UoM (Piece, Kilogram, Litre, Carton, Pallet, Box, Roll); Inventory mode FIFO/FEFO.

### Edit product (admin only)

Name, Description, Min stock threshold, Photo. SKU/barcode/UoM/mode not edited here.

### Staff

View list/detail only; create/edit routes redirect away.

---

## Returns

### Online returns

- Create only against linked OMS order in **Delivered**
- Reason/notes + product lines capped by returnable qty
- Action: **Create return**

### Outbound returns

- Create against outbound in **Shipped**
- No sidebar entry — **QA should use Quick jump or direct URL**
- Confidence: High that route exists; Medium that all users discover it

---

## Cash on delivery (`/my-profits`)

Filters: All · Pending · Collected · Remitted · Settled · Returned (labels as shown in UI).

---

## Billing & Invoices (admin role only)

- Billing: plan, usage, capacity, next invoice preview; **Contact sales** / **Upgrade plan** → sales email
- Invoices: list filters Pending/Overdue/Paid/Draft/Cancelled; detail **View** / **Print** (browser print, not necessarily a server PDF blob)

Staff: denied.

---

## APIs (admin role only)

- **Create API**
- Download documentation PDF
- Regenerate secret, enable/disable, revoke
- Statuses: Active · Disabled · Revoked

---

## Profile

Identity fields described as managed by warehouse; user can upload/change avatar photo. WhatsApp support number may appear.

---

## Notifications

List with All / Unread / Read; **Mark all read**; clicking may navigate to related entity.

---

## Billing restriction banners

| Status | Effect |
|--------|--------|
| Active | Normal |
| Expiring | Warning only |
| Restricted / No plan | Blocks creates/imports; banner; admin may open Billing |
