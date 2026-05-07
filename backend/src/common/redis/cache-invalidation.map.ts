/**
 * Central map of Redis key prefixes (logical namespaces before `RedisService.keyPrefix`).
 * Invalidate the same prefixes from every mutation path that touches that domain so caches stay coherent.
 */
export const CACHE_PREFIX = {
  tasks: 'tasks:',
  workflows: 'workflows:',
  inventory: 'inventory:',
  ledger: 'ledger:',
  products: 'products:',
  locations: 'locations:',
} as const;

export type CachePrefix = (typeof CACHE_PREFIX)[keyof typeof CACHE_PREFIX];

/** Which prefixes to drop for high-level application events. */
export const INVALIDATION_BY_TRIGGER = {
  warehouseTaskOrWorkflowUi: [CACHE_PREFIX.tasks, CACHE_PREFIX.workflows] as const,
  stockOrLedger: [CACHE_PREFIX.inventory, CACHE_PREFIX.ledger] as const,
  taskAndStock: [
    CACHE_PREFIX.tasks,
    CACHE_PREFIX.workflows,
    CACHE_PREFIX.inventory,
    CACHE_PREFIX.ledger,
  ] as const,
  products: [CACHE_PREFIX.products] as const,
  locationTrees: [CACHE_PREFIX.locations] as const,
} as const;
