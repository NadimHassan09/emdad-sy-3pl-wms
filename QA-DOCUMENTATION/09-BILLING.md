# 09 — Billing

**Confidence:** High for admin plan/invoice pages and client_admin-only access. Medium for every charge line type appearing on UI and email reminders.

---

## Purpose

Billing manages client subscription plans, cycles, usage-related charges, and invoices. Account status can restrict client portal operations.

---

## Actors

| Actor | Access |
|-------|--------|
| Super admin / Wh manager | Create/edit plans, issue invoices, mark paid |
| Finance | Billing nav / read; mutations may be blocked by backend internal-admin rules |
| client_admin | View billing summary & invoices; cannot issue invoices |
| client_staff | No billing / invoices routes |

---

## Admin billing navigation

```text
Billing
├── Dashboard
├── Plans (+ create / edit / detail)
├── Templates
└── Invoices (+ detail)
```

Sidebar **Billing** deep-links to **Plans**.

### Plan actions

- Create plan / edit plan
- Plan templates
- Associate plan to a client company

### Invoice actions

- Issue invoice
- Mark as paid
- Add charge (manual)
- **Download PDF** / **Export PDF**

### Invoice statuses (user-facing)

| Status | Meaning |
|--------|---------|
| Draft | Not issued |
| Unpaid / Pending | Awaiting payment (UI may map open/overdue → Unpaid/Pending) |
| Overdue | Past due (filter/label) |
| Paid | Settled |
| Cancelled | Cancelled |

### Cycle statuses

active · expired · renewed

### Cycle types

monthly · quarterly (company plan)

---

## Client billing

### Entry

Account → **Billing** (`/billing`) — **client_admin only**.

### Visible content

- Current plan
- Usage / capacity summaries
- Days remaining / account status
- Next invoice preview (when available)
- CTAs: **Contact sales** / **Upgrade plan** (email `sales@emdadsy.com`)

### Account status banners

| Status | User effect |
|--------|-------------|
| Active | Normal operations |
| Expiring (≤7 days) | Warning; creates still allowed |
| Restricted | Creates/imports disabled portal-wide |
| No plan | Creates/imports disabled |

### Invoices (client)

- List + detail
- Filters: Pending, Overdue, Paid, Draft, Cancelled
- **Print** via browser print dialog
- Server PDF download on client: **UNKNOWN / NEEDS VERIFICATION** (admin has Download PDF)

---

## Notifications related to billing

Users may receive in-app notifications for:

- Invoice generated
- Invoice overdue
- Cycle expiring (30/14/7/3/1 day variants)
- Account suspended / renewed

See `11-NOTIFICATIONS-AND-REALTIME.md`.

---

## Cross-module effect (critical for E2E)

If QA restricts or suspends a client company billing state:

1. Client login still works (unless inactive user).
2. Create Online/Inbound/Outbound/Import should be **disabled** with banner.
3. Restoring active plan should re-enable creates.

Exact admin control path for “restricted”: via company/billing lifecycle screens — verify on staging which button sets restricted vs suspended.

**Confidence:** High that client UI gates on restricted/no_plan; Medium for every admin CTA name that produces those states.

---

## Negative tests

| Attempt | Expected |
|---------|----------|
| Staff opens `/billing` | Denied / redirected + role banner |
| Client issues invoice | No such action |
| Mark paid without permission | Hidden or API denied |
| Create order while restricted | Blocked |
