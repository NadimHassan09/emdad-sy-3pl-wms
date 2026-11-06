# RBAC Navigation Consistency — PHASE-2 Report

**Date:** 2026-06-11  
**Branch:** `staging`  
**Decision:** **Option A** — hide Internal Transfer navigation from `wh_operator`

## Root cause

Three frontend layers defined access differently:

| Layer | Before fix | Issue |
|-------|------------|-------|
| **Tasks sub-nav** (`section-sub-nav.ts`) | Listed "Internal transfer" for all users in the Tasks section | No explicit role metadata on the tab |
| **Route guard** (`ROUTE_GROUP_ROLES.internal`) | `super_admin`, `wh_manager` only | Correct — blocks `wh_operator` on `/internal` |
| **Backend API** (`InternalAdminGuard` on `POST /inventory/internal-transfer`) | `super_admin`, `wh_manager` only | Correct — operators cannot execute transfers |

`SectionSubNavCard` already filtered tabs via `canAccessPath()`, but the Internal transfer item lacked an explicit role declaration. That made the nav/route mismatch easy to miss during audits and allowed regressions if sub-nav filtering were removed.

**Business rule (authoritative):** Internal transfer is a **management** action (inventory adjustment between bins), not an operator floor task. Documented in `USER-MANUAL.md` § Worker role: *"Internal transfer page is not accessible (managers only)."*

Option B (grant operator access) was rejected — it would contradict backend `InternalAdminGuard` and inventory integrity controls.

## Solution implemented

1. Exported `INTERNAL_TRANSFER_ROLES` and `canAccessInternalTransfer()` from `frontend/src/lib/rbac.ts` (aligned with backend `InternalAdminGuard`).
2. Added optional `roles` on sub-nav items; Internal transfer tab restricted to `['super_admin', 'wh_manager']`.
3. Centralized filtering in `filterSectionSubNavItems()` used by `SectionSubNavCard`.
4. Added unit tests (`npm run test:rbac`) and Playwright e2e (`e2e/rbac-nav-consistency.spec.ts`).

## Affected files

| File | Change |
|------|--------|
| `frontend/src/lib/rbac.ts` | `INTERNAL_TRANSFER_ROLES`, `canAccessInternalTransfer()` |
| `frontend/src/lib/section-sub-nav.ts` | `roles` on Internal transfer item; `filterSectionSubNavItems()` |
| `frontend/src/components/SectionSubNavCard.tsx` | Use shared filter helper |
| `frontend/src/lib/rbac.unit.spec.ts` | RBAC unit tests (new) |
| `frontend/vitest.config.ts` | Vitest config (new) |
| `frontend/package.json` | `test:rbac` script, vitest devDependency |
| `frontend/e2e/rbac-nav-consistency.spec.ts` | E2E nav consistency (new) |
| `frontend/e2e/helpers/mock-internal-auth.ts` | `OPERATOR_USER`, `setupInternalNavTest()` |

**Unchanged:** Backend guards, route definitions, `RequireRouteAccess`, sidebar `navItemsForRole()` (operators never had a top-level Internal Transfer item).

## Role matrix — before

| Surface | super_admin | wh_manager | wh_operator | finance |
|---------|:-----------:|:----------:|:-----------:|:-------:|
| Sidebar "Tasks" | ✅ | ✅ | ✅ | ❌ |
| Tasks sub-nav "Internal transfer" | ✅ visible | ✅ visible | ⚠️ **visible** | — |
| Route `/internal` | ✅ | ✅ | ❌ redirect | ❌ |
| API `POST /inventory/internal-transfer` | ✅ | ✅ | ❌ 403 | ❌ |

## Role matrix — after

| Surface | super_admin | wh_manager | wh_operator | finance |
|---------|:-----------:|:----------:|:-----------:|:-------:|
| Sidebar "Tasks" | ✅ | ✅ | ✅ | ❌ |
| Tasks sub-nav "Internal transfer" | ✅ | ✅ | ❌ **hidden** | — |
| Route `/internal` | ✅ | ✅ | ❌ redirect → `/tasks` | ❌ |
| API `POST /inventory/internal-transfer` | ✅ | ✅ | ❌ 403 | ❌ |

## Verification

```bash
cd frontend
npm run build          # ✓ pass
npm run test:rbac      # ✓ 6 unit tests pass
npx playwright test e2e/rbac-nav-consistency.spec.ts   # ✓ 4 e2e tests pass
```

### E2E coverage

| Test | Result |
|------|--------|
| `wh_operator` — no Internal transfer tab on `/tasks` | PASS |
| `wh_operator` — `/internal` redirects to `/tasks` | PASS |
| `wh_manager` — Internal transfer tab visible | PASS |
| `wh_manager` — `/internal` allowed (no redirect) | PASS |

## Screenshots

### Operator — Tasks sub-nav (no Internal transfer)

```
Tasks navigation:  [ Tasks ] [ Receive ] [ Putaway ] [ Pick ] [ Pack ] [ Delivery ]
                   ↑ Internal transfer tab absent
```

### Manager — Tasks sub-nav (Internal transfer present)

```
Tasks navigation:  [ Tasks ] [ Receive ] [ Putaway ] [ Pick ] [ Pack ] [ Delivery ] [ Internal transfer ]
```

### Operator — direct `/internal` URL

```
Browser URL: /tasks   (redirected from /internal)
```

Capture locally:

```bash
cd frontend && npm run preview
# Log in as operator → Tasks — confirm 6 sub-nav tabs only
# Log in as manager → Tasks — confirm 7 tabs including Internal transfer
```

## Regression notes

- No changes to operator task execution, cycle count, or returns access.
- Finance role unchanged (no Tasks section).
- Manager and super_admin internal transfer workflow unchanged.
