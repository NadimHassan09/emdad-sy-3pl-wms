# Warehouse task handler atomicity

This note describes how mutation paths keep **inventory**, **task state**, and **workflow orchestration** aligned. It is aimed at engineers changing `WarehouseTasksService`, stock effect helpers, or cron jobs that touch the same rows.

## Principles

1. **Single transaction for coupled writes**  
   Any transition that both changes `warehouse_tasks` (or `task_events`) and mutates stock, reservations, or ledger must run inside one `prisma.$transaction` callback. The caller holds a `Prisma.TransactionClient` (`tx`) for all reads and writes.

2. **Orchestration after commit**  
   `WorkflowOrchestrationService` routines that advance nodes or spawn follow-on work should run **after** the transaction commits unless the plan explicitly requires orchestration inside the same TX (rare). Today, `complete`, `cancel`, `skip`, etc. commit task + stock work first, then invoke orchestration.

3. **Idempotency**  
   Handlers that accept idempotency keys (where implemented) must guard duplicate application at the database layer (e.g. unique constraints) or via an explicit idempotency row, not only in memory.

4. **Cache invalidation**  
   After a successful task or stock mutation path, call `CacheInvalidationService.afterTaskMutation()`, `afterStockOrLedgerMutation()`, or `afterTaskAndStockMutation()` as appropriate. See `cache-invalidation.map.ts` for prefix groupings.

## Compensation and recovery

Manual recovery (`WorkflowRecoveryService.recoverWorkflowInstance`) runs compensation actions in a transaction, then `afterTaskAndStockMutation()` when stock is affected. **`dry_run`** avoids all writes and returns a preview only.

## Read models

`GET /tasks/:id` may use a short TTL Redis cache (`TASK_READ_CACHE=true`). Cached payloads are invalidated by the `tasks:` prefix on task/workflow writes. Runnability flags are always computed **after** cache hit so frontier/skill state stays current within the TTL window.
