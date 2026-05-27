# Sprint 2 Integration Tests

**Status:** Implemented (focused reliability integration suite)  
**Date:** 2026-05-27  
**Scope:** Targeted transactional integration tests for Sprint 2 guarantees using real Prisma DB transactions.

---

## Test Files Added

- `backend/src/integration-tests/sprint2/reliability-test-helpers.ts`
- `backend/src/integration-tests/sprint2/sprint2-reliability.integration.ts`

## Script Added

- `backend/package.json`
  - `test:integration:sprint2`:  
    `ts-node --transpile-only src/integration-tests/sprint2/sprint2-reliability.integration.ts`

---

## Tests Added (10 Required Scenarios)

1. **concurrent pick.start()**
   - Runs two `start()` calls concurrently on same pick task
   - Verifies `quantity_reserved` is not doubled

2. **duplicate pick.complete()**
   - Replays `complete()` on an already completed pick
   - Verifies idempotent no-op behavior

3. **duplicate dispatch.complete()**
   - Replays `complete()` on an already completed dispatch
   - Verifies idempotent no-op behavior

4. **orphan reservation release**
   - Uses blocked task `resolveBlocked(cancel_remaining)`
   - Verifies orphaned pick reservations are released

5. **dispatch cancel reservation cleanup**
   - Cancels dispatch with completed pick reservations in workflow
   - Verifies reservation release to zero

6. **pick fail reservation cleanup**
   - Fails in-progress pick holding reservations
   - Verifies reservation release and cleanup path

7. **reopen -> re-reserve flow**
   - Fails pick, reopens, starts again
   - Verifies re-reserve occurs once (no stacking)

8. **inventory consistency validate endpoint path (service-level)**
   - Calls `InventoryConsistencyService.validateForUser(...)` with clean fixture
   - Verifies zero critical findings

9. **reservation invariant rollback**
   - Attempts over-reserve beyond available
   - Verifies transaction throws and reserved quantity rolls back

10. **websocket replay safety**
    - Completes in-progress pick, replays completion
    - Verifies realtime completion emit count remains single-shot

---

## Guarantees Covered

- `quantity_reserved` correctness under concurrent start and cleanup paths
- idempotent task completion behavior (pick/dispatch replay)
- reservation release correctness (cancel, fail, cancel_remaining)
- rollback correctness on failed reserve mutation
- workflow lifecycle integrity for fail/reopen/start
- consistency validator integration path
- replay safety for realtime side-effects

---

## Concurrency Scenarios Simulated

- Same-task concurrent `pick.start()` race
- Duplicate completion replay patterns (`pick.complete`, `dispatch.complete`)
- Reservation cleanup interactions with blocked/cancel transitions

All scenarios execute against real DB transactions via `PrismaService` + production service methods.

---

## Runtime Result (Current Environment)

`npm run test:integration:sprint2` result:

- PASS concurrent pick.start()
- PASS duplicate pick.complete()
- PASS duplicate dispatch.complete()
- PASS orphan reservation release (cancel_remaining)
- PASS dispatch cancel reservation cleanup
- PASS pick fail reservation cleanup
- PASS reopen -> re-reserve flow
- PASS inventory consistency validate
- PASS reservation invariant rollback
- PASS websocket replay safety

---

## Remaining Untested Areas

These are not covered by this focused suite and should be added in next phase if needed:

- Multi-workflow dispatch contention across overlapping stock tuples (high parallel load)
- Full websocket room isolation with real socket clients (tenant channel-level integration)
- End-to-end HTTP guard stack behavior (currently service-level integration focus)
- Recovery path with `WorkflowRecoveryService.recoverWorkflowInstance` action batches
- DB-level deadlock retry strategy under sustained parallel workers

---

## CI Recommendations

1. Add a dedicated CI job:
   - bootstrap test DB
   - run migrations
   - run `npm run test:integration:sprint2`

2. Run this suite on:
   - PRs touching workflow/inventory/task modules
   - nightly reliability regression

3. Keep the suite deterministic:
   - isolated fixture IDs
   - full cleanup per test
   - no shared mutable global state between scenarios

