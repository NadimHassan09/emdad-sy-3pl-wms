# Phase 8.4 — Returns Integrity & Abuse Protection

**Status:** Implemented  
**Builds on:** Phase 8.1 (foundation), 8.2 (workflow/inventory), 8.3 (frontend)

---

## Goal

Harden returns against quantity abuse, confirm races, and ambiguous list/create payloads — and complete the **returns dashboard columns** (products, quantities, disposition) via list summaries.

---

## Backend protections

| Protection | Implementation |
|------------|----------------|
| **Duplicate line buckets in one create** | `assertUniqueReturnLineBuckets()` — rejects duplicate `outboundOrderLineId` or `productId+lotId` in a single payload |
| **Max lines per return** | `MAX_RETURN_LINES_PER_ORDER = 50`; `@ArrayMaxSize` on `CreateReturnOrderDto.lines` |
| **Confirm race (same outbound)** | `confirm()` runs in `$transaction` with `lockOutboundOrderRow` (`SELECT … FOR UPDATE` on `outbound_orders`) before quota re-check |
| **Quota re-check in transaction** | `ReturnQuantityValidation.assertWithinShippedLimits(…, tx)` uses the same transaction client for historical sums |
| **Outbound return quota API** | `GET /return-orders/outbound-quota/:outboundId` — per-line shipped / already returned / remaining |
| **List line summaries** | `GET /return-orders` returns `summary` per row (SKU summary, totals, disposition mix) without full line graphs |

### Files

- `return-line-integrity.util.ts` — duplicate buckets, list summary builder
- `return-quantity.validation.ts` — `getOutboundReturnQuota`, optional `tx` on quota methods
- `returns.service.ts` — create guard, transactional confirm, enriched list
- `returns.controller.ts` — `outbound-quota` route **before** `:id`

---

## Frontend protections & UX

| Area | Behavior |
|------|----------|
| **List table** | Products, qty (`received / expected` when partial), disposition from `summary` |
| **Create modal** | Fetches outbound quota; caps qty to `remaining`; blocks duplicate line picks; max 50 lines; toasts on client validation failures |
| **Create submit** | Disabled while mutation pending (`loading` prop) |

### Files

- `frontend/src/lib/return-list-summary.ts` — format helpers
- `ReturnsListPage.tsx` — full table columns
- `NewReturnModal.tsx` — quota + duplicate guards
- `frontend/src/api/returns.ts` — `summary`, `getOutboundQuota`

---

## API additions

```
GET /api/return-orders/outbound-quota/:outboundId?excludeReturnOrderId=
```

Response (per shipped outbound line):

```json
{
  "outboundOrderId": "...",
  "orderNumber": "OUT-…",
  "status": "shipped",
  "lines": [{
    "outboundOrderLineId": "...",
    "sku": "SKU-1",
    "shippedQuantity": "10",
    "alreadyReturned": "3",
    "remaining": "7"
  }]
}
```

List item now includes:

```json
"summary": {
  "lineCount": 2,
  "productSummary": "SKU-A, SKU-B",
  "totalExpected": "15",
  "totalReceived": "10",
  "dispositionSummary": "restock"
}
```

(`dispositionSummary` may be `null`, a single disposition, or `"mixed"`.)

---

## Operational assumptions

- Quota includes returns in `draft`, `confirmed`, `receiving`, `inspecting`, and **`completed`** (anti re-return abuse from 8.1).
- Unlinked returns (no outbound) still have no shipped cap; duplicate product rows in one payload are blocked.
- Confirm lock serializes only per **outbound order**; unrelated outbounds confirm in parallel.

---

## Remaining limitations

1. **Create without outbound** — no shipped quota preview (by design).
2. **Lot on create** — lot required for lot-tracked products at API level; UI lot picker still future work.
3. **Global rate limit** — relies on app-wide throttling (Phase 3.2), not returns-specific.
4. **Serializable isolation** — row lock on outbound is sufficient for confirm races; extreme cross-table races may need stricter isolation later.

---

## Verification

```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

Manual:

1. Link outbound → create modal shows remaining per line.
2. Try duplicate outbound line in one create → 400 from API; toast from UI.
3. Two draft returns near shipped cap → second confirm fails with quota message.
4. List shows SKU summary and quantities.
