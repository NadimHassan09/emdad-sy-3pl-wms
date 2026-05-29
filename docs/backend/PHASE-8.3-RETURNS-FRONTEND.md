# Phase 8.3 — Returns Frontend

**Status:** Implemented  
**Scope:** Returns operational UI only (backend from Phases 8.1–8.2)

---

## Pages implemented

| Route | Component | Purpose |
|-------|-----------|---------|
| `/returns` | `ReturnsListPage` | Dashboard: filters, dense table (desktop), card list (mobile), create return |
| `/returns/:id` | `ReturnDetailPage` | Header summary, line grid, manager actions (confirm, post, complete, cancel) |
| `/returns/:id/process` | `ReturnProcessPage` | Operator flow: receive → inspect → post per line |
| *(modal on list)* | `NewReturnModal` | Multi-line creation with optional outbound link |

Routes are registered in `frontend/src/router.tsx` with **`/returns/:id/process` before `/returns/:id`** so `process` is not captured as an id.

Navigation: standalone **Returns** item in sidebar (`wh_manager`, `wh_operator`, `super_admin`) — not under `/orders` so operators can reach returns without finance-only order access.

---

## Workflow UX

### Creation (`NewReturnModal`)

1. Select **client** (tenant company from `useTenantCompanyId`).
2. Optionally link a **shipped outbound**; line picker then uses outbound lines and caps quantity to picked qty.
3. Without outbound: pick products from catalog and enter expected quantities.
4. Optional client reference, shipment reference, and return notes.
5. Submit → `POST /return-orders` with `warehouseId` from `useDefaultWarehouseId` → navigate to detail.

### Detail (supervisor / manager)

- **Draft:** Confirm, Cancel (no receipts).
- **Confirmed:** Start receiving (optional; process page auto-starts).
- **Receiving / Inspecting:** Post inventory (batch), Complete (requires all lines received and posted).
- **Process** link for active statuses.

### Processing (floor)

1. Auto **start receiving** when opening process on a confirmed return.
2. **Line chips** — switch SKU; progress bar = % lines posted.
3. **Receive** — increment qty (defaults to remaining expected), optional condition.
4. **Inspect** — condition, disposition, target location (filtered by disposition policy), notes.
5. **Post line** — `apply-disposition` when line is inspected with a postable disposition.
6. Sticky footer: **Post all eligible**, **Complete return** (hidden for `wh_operator`).

Recommended backend flow: **confirm → receive → inspect → apply-disposition / post-inventory → complete**.

---

## Operational assumptions

- **Tenant scope:** List/create require `companyId` from `useTenantCompanyId` (or `VITE_MOCK_COMPANY_ID` in dev); same pattern as cycle count.
- **Warehouse:** Create and inventory posting require `warehouseId` on the return (set at create from default warehouse hook).
- **Outbound link:** Only **shipped** outbounds appear in the create modal; quantities validated server-side against picked qty.
- **Disposition → location:** Client filters locations by type (`restock` → internal/fridge; quarantine/damaged → quarantine/scrap; discard → scrap).
- **Roles:** Operators run process UI; confirm / batch post / complete are manager-oriented on detail (operators still receive/inspect/post single lines on process page).
- **List API:** List endpoint returns `_count.lines` only — product names, quantities, and disposition summaries are on **detail/process**, not the main table (see limitations).

---

## Mobile behavior

- **&lt; md:** List uses **stacked cards** with status badge, key fields, Details + Process buttons.
- **Process page:** Full-width line chips (horizontal scroll), large touch targets, **fixed bottom action bar** for post-all / complete.
- **Desktop:** Standard `DataTable` on list and detail line grid.
- RTL / Arabic: bilingual `t(en, ar)` helpers; `StatusBadge` Arabic labels for return statuses (`receiving`, `inspecting`, `received`).

---

## Files touched

| Area | Files |
|------|--------|
| API | `frontend/src/api/returns.ts` |
| Pages | `frontend/src/pages/returns/*.tsx` |
| Components | `frontend/src/components/returns/NewReturnModal.tsx` |
| Lib | `frontend/src/lib/return-labels.ts` |
| Wiring | `router.tsx`, `rbac.ts`, `query-keys.ts`, `StatusBadge.tsx`, `section-sub-nav.ts`, `Layout.tsx` (AR nav label) |

---

## Remaining limitations

1. ~~**List columns**~~ — Addressed in Phase 8.4 (`summary` on list API).
2. **Lot capture** — Create flow does not yet prompt for lot on lot-tracked products (backend validates when required).
3. **Barcode scan** — No scanner integration on process page (unlike cycle count execute).
4. **Partial receive UX** — Multiple receive taps per line work (increment API) but UI does not show receive history per line.
5. **Finance role** — No returns nav (by design); finance users use orders/inventory reports if needed later.
6. **Real-time** — No websocket refresh; relies on React Query invalidation after mutations.

---

## Verification

```bash
cd frontend && npx tsc --noEmit
```

Manual smoke:

1. `/returns` with tenant company → list loads.
2. Create return with 2+ lines → detail shows lines.
3. Confirm → open **Process** → receive, inspect, post → complete from detail or process footer.
