# Client Portal — Billing Restriction UX

**Date:** 2026-06-12  
**Scope:** Client frontend only — backend `BillingAccessService` enforcement unchanged.

## Summary

Billing restrictions now surface consistently across the client portal: global warning banners, disabled create actions with tooltips, role-aware redirects, and bilingual copy.

## UX components

| Component | Purpose |
|-----------|---------|
| `BillingRestrictionBanner` | Global banner in `PortalLayout` (restricted / no plan / expiring) |
| `ClientRoleAccessBanner` | One-time info after role-based redirect |
| `useClientOperationalAccess` | Shared access state from `GET /api/client/billing/access` |
| `client-billing-restriction.ts` | Restriction reason copy (EN + AR) |

## Restriction states

| `accountStatus` | Banner | Create actions |
|-----------------|--------|----------------|
| `active` | None | Enabled |
| `expiring` | Warning — days remaining | Enabled |
| `restricted` | Error — cycle expired | Disabled + reason tooltip |
| `no_plan` | Error — no billing plan | Disabled + reason tooltip |

## Pages updated

| Page | Change |
|------|--------|
| All (layout) | Global billing + role access banners |
| Inbound orders | Disabled **+ New inbound** when restricted |
| Outbound orders | Disabled **+ New outbound** when restricted |
| Products | Disabled **+ New product** when restricted |
| Dashboard | Empty-state CTA disabled when restricted |
| Billing | Existing detailed status cards (no duplicate banner when active) |

## Role-based routing

| Role | `/products`, `/billing` | Redirect target |
|------|-------------------------|-----------------|
| `client_admin` | Allowed | — |
| `client_staff` | Blocked | `/stock` (products) or `/dashboard` (billing) |

Redirect shows an informational banner explaining why.

## Verification checklist

### Restricted account (`operationalAllowed: false`)

- [ ] Global red banner visible on dashboard, orders, products, stock
- [ ] Banner explains restriction reason and links to billing (admin only)
- [ ] **+ New inbound** disabled with tooltip
- [ ] **+ New outbound** disabled with tooltip
- [ ] **+ New product** disabled with tooltip (admin)
- [ ] Dashboard empty-state button disabled with tooltip
- [ ] Existing orders/products/stock lists still load (read-only)
- [ ] API create calls still return 403 from backend (unchanged)

### Expiring account (`accountStatus: expiring`)

- [ ] Amber warning banner with days remaining
- [ ] Create actions remain enabled
- [ ] Billing page shows expiring status

### Active account

- [ ] No restriction banner
- [ ] All create actions enabled

### Role routing (`client_staff`)

- [ ] Sidebar hides Products and Billing
- [ ] Direct URL `/products` redirects to `/stock` with info banner
- [ ] Direct URL `/billing` redirects to `/dashboard` with info banner
- [ ] Orders and stock remain accessible

### Arabic UI

- [ ] Switch language to AR — banner and tooltips show Arabic copy

## Manual test API

```bash
# Access probe (client JWT)
curl -s -H "Authorization: Bearer $CLIENT_TOKEN" \
  http://127.0.0.1:3001/api/client/billing/access | jq .
```

Expected when restricted:

```json
{
  "operationalAllowed": false,
  "accountStatus": "restricted",
  "daysRemaining": null
}
```

## Deploy

```bash
cd client-frontend && npm run build
# nginx serves client-frontend/dist
```
