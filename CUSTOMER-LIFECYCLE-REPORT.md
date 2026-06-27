# Customer Lifecycle Management — Implementation Report

> Enterprise customer (company/client) deletion & archiving workflow for the Emdad WMS.
> Replaces the simple "Delete" action with a status-driven lifecycle that preserves
> historical/referential integrity and only allows permanent removal when it is safe.

In this system a **customer / client = `Company`** (the tenant entity).

---

## 1. Lifecycle Diagram

```
        ┌──────────┐   suspend (reason)        ┌────────────┐
        │  ACTIVE  │ ────────────────────────▶ │ SUSPENDED  │
        │          │ ◀──────────────────────── │            │
        └────┬─────┘        restore             └─────┬──────┘
             │                                        │
             │ archive (stock=0, no open orders)      │ archive
             ▼                                        ▼
        ┌────────────────────────────────────────────────┐
        │                  ARCHIVED                        │
        │  read-only historical record · users disabled    │
        └───────────────┬──────────────────────────────────┘
                        │ restore  ▲
                        │          └── back to ACTIVE
                        │
                        │ purge  (Super Admin only, after retention period,
                        ▼         all purge conditions satisfied)
                 ┌──────────────┐
                 │   PURGED     │   (anonymized tombstone, FKs preserved)
                 └──────────────┘

  Scenario 1 (zero references anywhere): ACTIVE/SUSPENDED ── hard delete ──▶ row removed
```

Legacy statuses (`paused`, `offboarding`, `closed`, `restricted`) remain valid for
backward compatibility with the existing billing engine. The new canonical lifecycle
states are `active → suspended → archived → purged`.

---

## 2. Business Rules

### Status behaviour

| Capability | ACTIVE | SUSPENDED | ARCHIVED | PURGED |
|---|---|---|---|---|
| Portal login | ✅ | ❌ | ❌ | ❌ |
| Client APIs | ✅ | ❌ | ❌ | ❌ |
| Create products/orders/returns | ✅ | ❌ | ❌ | ❌ |
| New billing cycles / invoices | ✅ | ❌ | ❌ | ❌ |
| Internal admin can edit | ✅ | ✅ | read-only | read-only |
| Existing data (reports, history, invoices, audit) | ✅ | ✅ | ✅ (read-only) | ✅ (anonymized) |
| Users | active | login blocked | disabled (`inactive`) | disabled |

### Deletion / archive decision rules

| # | Customer state | Allowed action | Notes |
|---|---|---|---|
| 1 | No products, orders, stock, billing, audit references | **Hard delete** | Row removed — safe, no FKs |
| 2 | Has products, never used | **Archive** (default). Hard delete only if products have zero references | Otherwise blocked |
| 3 | Has orders (even pending) | **Archive only** after every order is cancelled/completed | Never hard delete |
| 4.1 | Stock > 0 | **Blocked** (archive & delete) | "This customer still owns inventory inside the warehouse." |
| 4.2 | Stock = 0 with history | **Archive only** | Never delete |

### Permanent purge eligibility (ALL must be true)

- Status = `archived`
- Archived for ≥ `CUSTOMER_PURGE_RETENTION_DAYS` (default **90**)
- Stock = 0
- No pending inbound / outbound / return orders
- No active users
- No open billing cycles
- No unresolved financial records (no `open`/`overdue` invoices)
- No legal hold *(no legal-hold field is currently modeled → always satisfied; documented as a follow-up)*

Purge generates a full archive export, then:
- **Empty customer** → hard delete (row removed).
- **Customer with history** → anonymized in place (PII scrubbed, `status = purged`,
  `purgedAt` set). The row and **every foreign key are preserved** so reports, billing
  history, audit logs and inventory history keep full referential integrity.

---

## 3. Validation Matrix

| Action | Guard | Server validation |
|---|---|---|
| Suspend | InternalAdminGuard | Not `purged`. |
| Archive | InternalAdminGuard | Not `purged`/`archived`; stock = 0; no open orders. |
| Restore | InternalAdminGuard | Not `purged`; not already `active`. Re-enables users. |
| Hard delete (`DELETE`) | InternalAdminGuard | Zero references anywhere (Scenario 1). |
| Purge (`/purge`) | **SuperAdminGuard** + service role re-check | All purge conditions above. |
| Lifecycle context (`/lifecycle`) | InternalAdminGuard | Read-only decision payload for the UI. |

---

## 4. RBAC Behaviour

| Role | Suspend | Archive | Restore | Hard delete | Purge |
|---|---|---|---|---|---|
| `super_admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `wh_manager` | ✅ | ✅ | ✅ | ✅ | ❌ (blocked by `SuperAdminGuard`) |
| `wh_operator` / `finance` | ❌ | ❌ | ❌ | ❌ | ❌ |

Frontend gates the "Permanently Delete" button: enabled only when the customer is
hard-deletable (empty) **or** the user is a super admin and all purge conditions are met;
otherwise it is disabled with an explanatory tooltip listing the blockers.

---

## 5. API Changes

`backend/src/modules/companies/`

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/companies/:id/lifecycle` | InternalAdmin | Counts, blockers, allowed actions. |
| `POST` | `/companies/:id/suspend` | InternalAdmin | `{ reason? }` → `suspended`, revokes sessions. |
| `POST` | `/companies/:id/archive` | InternalAdmin | `{ reason? }` → `archived`, disables users. |
| `POST` | `/companies/:id/restore` | InternalAdmin | `{ reason? }` → `active`, re-enables users. |
| `POST` | `/companies/:id/purge` | **SuperAdmin** | Export + delete/anonymize. |
| `DELETE` | `/companies/:id` | InternalAdmin | Hard delete only when empty. |
| `GET` | `/companies?status=` | (existing) | New `status` filter. |

### Login / session

- Client portal `login()` and `JwtClientStrategy.validate()` now reject any user whose
  company status ≠ `active`. Because `validate()` runs on **every request**, suspension/
  archive takes effect immediately (next request is rejected) — effective session
  revocation for the portal.
- Internal sessions for a company's users are also revoked on suspend/archive via
  `RefreshSessionService.invalidateUserSessions` (bumps `tokenVersion`, kills refresh
  families).

### Billing

- `BillingAccessService` (operational gate) now blocks `suspended`, `archived`, `closed`,
  `offboarding`, `purged` (previously only `restricted`).
- `BillingCycleProcessor` skips invoice finalization and renewal for archived/closed/
  purged/offboarding companies — **no new invoices or cycles**; existing ones are kept.

---

## 6. UI Changes

### Internal admin (`frontend`)
- `ClientsPage` actions menu: "Delete" replaced by **Manage account status**, opening a
  new `CustomerLifecycleModal`.
- `CustomerLifecycleModal` shows current status, an account-data summary (products,
  inbound/outbound + open counts, on-hand stock, invoices, active users), archive
  retention progress, an optional reason field, and gated action buttons:
  **Suspend / Restore / Archive / Permanently Delete** (with blocker tooltips).
- Client list **status filter**: All / Active / Suspended / Archived.
- `StatusBadge` extended with `suspended`, `archived`, `purged` (EN + AR).

### Client portal (`client-frontend`)
- New `AccountStatusPage` (`/account-inactive`): a dedicated, bilingual "your account is
  inactive — contact support" screen. Inactive logins are redirected here, and existing
  sessions are bounced out by the per-request company-status check.

---

## 7. Migration Summary

Migration `20260902140000_customer_lifecycle`:
- `ALTER TYPE company_status ADD VALUE` → `suspended`, `archived`, `purged`.
- New columns on `companies`: `suspended_at`, `suspended_by`, `suspension_reason`,
  `archived_at`, `archived_by`, `archive_reason`, `purged_at`.
- New env var `CUSTOMER_PURGE_RETENTION_DAYS` (default 90) in `env.validation.ts`.

No data backfill required — existing companies keep their current status; new columns are
nullable. Legacy statuses continue to function.

---

## 8. Audit Events

Emitted via `AuditLogService` (`resourceType: 'company'`) with actor, timestamp, reason,
previous status and new status:

| Event | When |
|---|---|
| `customer.suspended` | Suspend |
| `customer.archived` | Archive |
| `customer.restored` | Restore |
| `customer.deleted` | Hard delete (Scenario 1) |
| `customer.purged` | Permanent purge (mode = `deleted` or `anonymized`) |

---

## 9. Verification Scenarios

| Scenario | Expected | Result |
|---|---|---|
| **1** — empty customer | Hard delete allowed; row removed | ✅ `canHardDelete = true`, `DELETE` succeeds |
| **2** — products, unused | Archive default; delete blocked if products referenced | ✅ Archive allowed (stock 0, no open orders); delete blocked by history |
| **3** — has orders (any) | No hard delete; archive only after orders closed | ✅ Open orders block archive; delete blocked |
| **4.1** — stock > 0 | Archive & delete blocked, message shown | ✅ "This customer still owns inventory inside the warehouse." |
| **4.2** — stock 0, history | Archive only, never delete | ✅ Archive allowed, hard delete blocked, purge requires retention |
| **Purge** before retention | Blocked with reason | ✅ "must remain archived for at least N days" |
| **Purge** all conditions met (super admin) | Export + anonymize/delete | ✅ FKs preserved, audit `customer.purged` |
| **Suspended/archived login** | Denied + account-status page | ✅ 403, redirect to `/account-inactive` |

### Referential integrity guarantee
No reports, inventory history, audit logs, billing records, backups or historical
transactions lose referential integrity: archive and purge-with-history never delete child
rows. Only the Scenario-1 hard delete removes a record, and only when it has **zero**
references. Purge of a customer with history anonymizes the row in place rather than
deleting it.

---

## 10. Follow-ups / Notes

- **Legal hold** is not yet a first-class field; purge currently treats every archived
  customer as not on hold. Add a `legalHold` boolean to `Company` to enforce this gate.
- Archive disables client users by flipping `User.status` to `inactive`; restore flips
  them back to `active`. The original per-user status is not separately preserved.
- Purge archive export is written to `backend/storage/customer-archives/<id>-<ts>.json`
  (best-effort) and its path is recorded in the `customer.purged` audit `newState`.
