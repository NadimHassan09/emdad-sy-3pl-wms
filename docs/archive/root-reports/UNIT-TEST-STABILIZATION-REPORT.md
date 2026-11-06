# Unit Test Suite Stabilization — PHASE-3 Report

**Date:** 2026-06-12  
**Branch:** `staging`  
**Scope:** Test files and test tooling only — no production code changes.

## Executive summary

| Metric | Before | After |
|--------|--------|-------|
| Test suites compiling | 17 / 18 | **18 / 18** |
| Test suites passing | 17 / 18 | **18 / 18** |
| Tests passing | 63 | **68** |
| Compile failures | 1 | **0** |
| Runtime failures | 0 (blocked by compile) | **0** |

Command: `cd backend && npm run test`

## Suite audit (18 files)

| File | Status before | Status after |
|------|---------------|--------------|
| `products.service.unit.spec.ts` | **FAIL** (compile + would fail at runtime) | PASS |
| `product-barcode.util.unit.spec.ts` | PASS | PASS |
| `operational-reports.runner.unit.spec.ts` | PASS | PASS |
| `inventory-intelligence-reports.runner.unit.spec.ts` | PASS | PASS |
| `finance-reports.runner.unit.spec.ts` | PASS | PASS |
| `report-export.service.unit.spec.ts` | PASS | PASS |
| `report-permissions.util.unit.spec.ts` | PASS | PASS |
| `report-filters.util.unit.spec.ts` | PASS | PASS |
| `users-list.service.unit.spec.ts` | PASS | PASS |
| `users.worker-profile.service.unit.spec.ts` | PASS | PASS |
| `notifications.service.unit.spec.ts` | PASS | PASS |
| `sla-escalation.service.unit.spec.ts` | PASS | PASS |
| `sla-breach.util.unit.spec.ts` | PASS | PASS |
| `warehouse-tasks-list.service.unit.spec.ts` | PASS | PASS |
| `cycle-count-list.service.unit.spec.ts` | PASS | PASS |
| `returns-list.service.unit.spec.ts` | PASS | PASS |
| `cron-leader.service.unit.spec.ts` | PASS | PASS |
| `login-brute-force.service.unit.spec.ts` | PASS | PASS |

No other suites required changes.

## Failing tests before

### 1. Compile failure — `products.service.unit.spec.ts`

```
TS2554: Expected 5 arguments, but got 4.
ProductsService constructor missing `billingAccess: BillingAccessService`
```

**Root cause:** `ProductsService` gained a 5th constructor dependency (`BillingAccessService`) when operational billing checks were added to `create()`. The unit test `buildService()` helper was not updated.

### 2. Runtime failures (latent after compile fix)

Three tests would have failed once compilation succeeded:

| Test | Error |
|------|-------|
| `create with unique explicit barcode succeeds` | `product.createdAt.toISOString()` — `createdAt` undefined |
| `update barcode to unique value succeeds` | Same — stale minimal product mock |
| `update without changing barcode skips conflict lookup` | Same |

**Root cause:** `ProductsService.create` / `update` now call `productRealtimePayload()`, which requires a full product row including `createdAt`. Mocks only included `{ id, companyId, barcode, sku, status }`.

## Fixes applied

### `backend/src/modules/products/products.service.unit.spec.ts`

1. Added `billingAccessMock()` with:
   - `assertOperationalBilling` → resolves (allows create path)
   - `getOperationalAccess` → active billing stub
2. Passed mock as 5th argument to `ProductsService` constructor.
3. Added `productRow()` helper with fields required by `productRealtimePayload` and audit snapshots (`createdAt`, `name`, `trackingType`, `uom`, etc.).
4. Updated create/update test fixtures to use `productRow()`.

### `backend/package.json`

- Added `"test": "jest --runInBand"` alias (same as `test:unit`) so `npm run test` runs the unit suite as documented in certification.

## Production code

**Unchanged.** All fixes are in test helpers, mocks, and package scripts.

## Final verification

```bash
cd backend
npm run test
```

```
Test Suites: 18 passed, 18 total
Tests:       68 passed, 68 total
```

**Target met:** 100% unit suite compilation success; 100% pass rate.
