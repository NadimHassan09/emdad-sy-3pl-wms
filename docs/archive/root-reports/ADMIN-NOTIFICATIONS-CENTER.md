# Admin Notifications Center — Implementation Report

**Date:** 2026-06-12  
**Branch:** `staging`

## Summary

Full notifications center for the admin WMS application: dedicated page, server-side read/unread filtering, pagination, mark read / mark all read, sidebar + topbar navigation.

## Components

| Layer | Path | Purpose |
|-------|------|---------|
| Backend API | `GET /api/notifications?limit&offset&isRead` | Paginated list + total + unread count |
| Backend | `PATCH /api/notifications/:id/read` | Mark single notification read |
| Backend | `POST /api/notifications/read-all` | Mark all read |
| Frontend module | `frontend/src/modules/notifications/` | Page, deep links, filter helpers |
| Topbar | `Layout.tsx` | **View all** → `/notifications` |
| Sidebar | `rbac.ts` | **Notifications** nav for all internal roles |

## Features

| Requirement | Implementation |
|-------------|----------------|
| Dedicated page | `/notifications` → `NotificationsPage` |
| Read/unread filter | Server-side `isRead=true|false` query param |
| Mark read | Click row → `PATCH :id/read` |
| Mark all read | Header button → `POST read-all` |
| Pagination | 20 per page, Previous/Next |
| Navigation | Sidebar item + topbar **View all** link |

## Deep links

| `referenceType` | Route |
|-----------------|-------|
| `inbound_order` | `/orders/inbound/:id` |
| `outbound_order` | `/orders/outbound/:id` |
| `product` | `/products/:id` |
| `warehouse_task` | `/tasks/:id` |
| `invoice` | `/billing/invoices/:id` |
| `billing_cycle` | `/billing/dashboard` |

## Verification checklist

- [ ] Sidebar **Notifications** visible for super_admin, wh_manager, wh_operator, finance
- [ ] Topbar bell **View all** opens `/notifications`
- [ ] Page lists notifications with unread highlight
- [ ] **All / Unread / Read** filters change server results
- [ ] **Mark all read** clears unread badge in topbar
- [ ] Click unread row marks read and navigates when reference exists
- [ ] Pagination appears when total > 20
- [ ] Realtime new notification updates topbar bell (existing behavior)

## Tests

```bash
# Backend unit tests
cd backend && npm run test:unit -- notifications.service.unit.spec.ts

# Admin UI e2e (mocked API)
cd frontend && npm run test:e2e -- e2e/notifications-center-ui.spec.ts
```

## Deploy

```bash
cd backend && npm run build && pm2 reload emdad-wms-backend-staging --update-env
cd frontend && npm run build
```
