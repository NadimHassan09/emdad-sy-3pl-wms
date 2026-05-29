# Phase 7.4 — Cycle Count Frontend

**Status:** Implemented  
**Date:** 2026-05-29  
**Scope:** Internal WMS cycle count operational UI — dashboard, detail/review, and mobile-first worker execution. Consumes Phase 7.1–7.3 backend APIs.

---

## Summary

| Deliverable | Route | Audience |
|-------------|-------|----------|
| Cycle count dashboard | `/cycle-count` | Admin, manager, operator |
| My count tasks | `/cycle-count/my-tasks` | Operators (primary) |
| Count details + variance review | `/cycle-count/:id` | Admin / manager |
| Worker execution (blind count) | `/cycle-count/:id/execute` | Operators |

---

## Pages Implemented

### 1. Dashboard — `CycleCountListPage`

**Path:** `/cycle-count`  
**File:** `frontend/src/pages/cycle-count/CycleCountListPage.tsx`

Two operational tabs:

| Tab | Data source | Purpose |
|-----|-------------|---------|
| **Count sessions** | `GET /cycle-count/counts` | Active/completed count runs |
| **Product schedule** | `GET /cycle-count/product-history` + schedules | Recurrence planning |

**Sessions columns:** warehouse, status, line count, discrepancy indicator, assigned worker, recurrence interval, created date, source.

**Schedule columns:** product (name + SKU), last count, next due (overdue highlight), status, recurrence days, completion count.

**Actions:**
- Operators → **My count tasks**
- Managers → **Worker view** shortcut

### 2. My tasks — `CycleCountMyTasksPage`

**Path:** `/cycle-count/my-tasks`  
**File:** `frontend/src/pages/cycle-count/CycleCountMyTasksPage.tsx`

- Lists `GET /cycle-count/execution/tasks`
- Auto-refetch every 30s
- Row click → execute page
- Sub-nav tab alongside dashboard

### 3. Count details — `CycleCountDetailPage`

**Path:** `/cycle-count/:id`  
**File:** `frontend/src/pages/cycle-count/CycleCountDetailPage.tsx`

**Summary cards:** status, lines, assignee, snapshot time, interval, blind mode.

**Sections:**
- **Variances** — list + approve/reject (admin) with reason codes
- **Count lines** — expected / actual / variance (supervisor view — not blind)

**Admin actions (when applicable):**
- Execute count → `/execute`
- Build reconciliation
- Post reconciliation
- Complete count

Operators see lines but variance approve/reconcile buttons are hidden.

### 4. Worker execution — `CycleCountExecutePage`

**Path:** `/cycle-count/:id/execute`  
**File:** `frontend/src/pages/cycle-count/CycleCountExecutePage.tsx`

Mobile-first blind counting UI:
- Auto-claims session on `scheduled` status
- Progress bar (counted + skipped / total)
- **No expected quantity shown**
- Active product/location card with large qty input
- Product list with completion fraction
- Barcode scan → jump to product/location
- Sticky bottom action bar (Save / Skip / Finish)

---

## Filters & Search

**Filter panel** (dashboard, both tabs where relevant):

| Filter | Applies to | Implementation |
|--------|------------|----------------|
| Warehouse | All | `useDefaultWarehouseId()` (global warehouse context) |
| Status | Sessions | Server query param |
| Assigned worker | Sessions | Client filter on list |
| Discrepancy only | Sessions | Client — `pending_review` sessions |
| Overdue only | Schedule | Client — `nextDueAt < now` |
| Date from / to | Both | Client on `createdAt` or `lastCountedAt` |

Uses existing `useFilters` draft/apply pattern (same as adjustments/tasks).

---

## API Client

**File:** `frontend/src/api/cycle-count.ts`

Wraps:
- Count CRUD lifecycle
- Schedules + product history
- Variances + reconciliation
- Execution endpoints (blind task)

**Query keys:** `frontend/src/constants/query-keys.ts` → `QK.cycleCount.*`

---

## Navigation & RBAC

| Change | File |
|--------|------|
| Sidebar item **Cycle count** | `frontend/src/lib/rbac.ts` — roles: super_admin, wh_manager, wh_operator |
| Route group `cycle-count` | Same file — route guard |
| Sub-nav: Dashboard / My tasks | `frontend/src/lib/section-sub-nav.ts` |
| Routes (lazy) | `frontend/src/router.tsx` |

Execute/detail pages hide section sub-nav (same pattern as task execute).

---

## UX Behavior

### Blind count (execution)

- Backend blind presenter omits `expectedQuantity` and `discrepancyQuantity`
- UI only shows **Counted quantity** input for pending lines
- Previously counted lines show operator-entered actual only
- Banner: “Blind count — expected quantities are hidden”

### Completion flow (worker)

1. Claim (auto if scheduled)
2. Count or skip each location
3. **Finish & submit** → `pending_review` (blocked while pending lines remain)

### Supervisor flow (detail)

1. Review variances (approve + reason / reject)
2. Build reconciliation draft
3. Post reconciliation (inventory)
4. Complete count

### Status badges

Extended `StatusBadge` for cycle count states: `scheduled`, `pending_review`, `counted`, `skipped`, `posted`, `rejected`.

---

## Mobile Optimizations

| Pattern | Where |
|---------|--------|
| Sticky bottom footer | Execute page — `fixed inset-x-0 bottom-0` + safe-area padding |
| 48px min touch targets | Save / Skip / Finish buttons |
| Large quantity input | `text-lg`, numeric keyboard |
| Compact product list | Tap to switch active product |
| Barcode scan modal | Product/SKU/location barcode lookup |
| Reduced chrome | Sub-nav hidden on execute |
| Bottom padding on page | `pb-28` so content clears sticky footer |

Desktop: footer becomes static below content (`sm:static`).

---

## Operational Assumptions

1. **Warehouse context** — list/history scoped via default warehouse selector (topbar).
2. **Operators** land on tasks via sidebar or **My count tasks**; full dashboard still accessible.
3. **Supervisor discrepancy view** is only on detail page — never on execute page.
4. **No offline sync** — requires live API (Phase 7.2 backend).
5. **Create count / schedule admin** — not in UI this phase (API exists; can be added to dashboard actions later).
6. **Arabic** — inline `t(en, ar)` pattern consistent with rest of app.

---

## Remaining Limitations

| Limitation | Notes |
|------------|--------|
| No create-count modal | Manual count creation API not wired in UI |
| No schedule admin UI | Interval config still API-only |
| Product schedule lacks per-location column | Locations only visible inside session/detail |
| Discrepancy filter is proxy | Uses `pending_review` status, not variance count |
| Assigned worker filter is client-side | Backend list API has no worker param |
| No line-level barcode walk | Scan selects product, not auto-advance location |
| No print/export | Pick-style PDF not implemented |
| Finance role | No access (by design — operational module) |
| Realtime updates | Polling on my-tasks only (30s) |

---

## File Inventory

```
frontend/src/api/cycle-count.ts
frontend/src/pages/cycle-count/
  CycleCountListPage.tsx
  CycleCountMyTasksPage.tsx
  CycleCountDetailPage.tsx
  CycleCountExecutePage.tsx
frontend/src/constants/query-keys.ts      (QK.cycleCount)
frontend/src/router.tsx
frontend/src/lib/rbac.ts
frontend/src/lib/section-sub-nav.ts
frontend/src/components/StatusBadge.tsx
```

---

## Related

- [Phase 7.1 — Backend Foundation](./PHASE-7.1-CYCLE-COUNT-BACKEND-FOUNDATION.md)
- [Phase 7.2 — Task Execution](./PHASE-7.2-CYCLE-COUNT-TASK-EXECUTION.md)
- [Phase 7.3 — Variance Workflow](./PHASE-7.3-INVENTORY-VARIANCE-ADJUSTMENT-WORKFLOW.md)

---

## Verify

```bash
cd frontend
npx tsc --noEmit
npm run dev
```

Navigate to `/cycle-count` with backend running and a warehouse selected.
