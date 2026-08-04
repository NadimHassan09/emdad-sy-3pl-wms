# Clients (companies)

**App:** Admin Dashboard
**Route(s):** `/clients`
**Source:** `frontend/src/pages/ClientsPage.tsx`
**Nav label:** Clients

## Purpose

Merchant companies list, create/edit profile, and lifecycle management.

## Primary users

Route `clients`: `super_admin`, `wh_manager`. `CustomerLifecycleModal` receives `isSuperAdmin = (role === 'super_admin')` for privileged lifecycle transitions.

## User goals

- Onboard clients
- Edit company profiles
- Manage account status (lifecycle)
- Open client detail

## Business goal

Tenant master for 3PL ops and billing.

## Main workflows

1. Create (`New company`) / Edit modal
2. Manage account status → CustomerLifecycleModal
3. Open `/clients/:id`

## Components

- `FilterPanel` (`Client filters`)
- `DataTable` title `Clients`
- Create/Edit `Modal`
- `CustomerLifecycleModal`

## Forms

**New company**: Name, Trade name (optional), Contact email, Country, City, Phone (optional), Address (optional), Notes (optional).

**Edit {name}**: Status (Active / Paused / Offboarding / Closed options as coded), Name, Trade name, Contact email, Country, City, Phone, Address, Notes.

## Tables

Columns: **Name**, **Trade name**, **Email**, **Phone**, **City**, **Country**, **Billing**, **Status**, **Actions**.

Row actions: Edit, Manage account status (`Open actions`).

## Filters

FilterPanel: **Client filters**

| Field | Notes |
| --- | --- |
| Search | `Search client...` |
| Search by | Company name; Trade name; Email; Phone; City; Country |
| Status | All; Active; Suspended; Archived |

## Actions

- Create company
- Edit / Manage account status
- Open detail

## Dialogs

- Modal — `New company`
- Modal — `Edit {name}` / `Edit company`
- **CustomerLifecycleModal** (super_admin-gated capabilities)

## Drawers

- None.

## Empty states

- `No companies yet.`

## Loading states

- DataTable loading.

## Validation

- Create requires Name + Contact email (and other required fields as coded).

## Permissions

- Route: sa/mgr.
- Lifecycle privileged ops: `super_admin` via `isSuperAdmin` prop.

## Relationships with other pages

- → `/clients/:id`
- Clients used across orders, products, billing filters

---

*Documentation only — derived from staging codebase. No UI redesign implied.*
