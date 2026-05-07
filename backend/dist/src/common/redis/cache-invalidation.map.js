"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVALIDATION_BY_TRIGGER = exports.CACHE_PREFIX = void 0;
exports.CACHE_PREFIX = {
    tasks: 'tasks:',
    workflows: 'workflows:',
    inventory: 'inventory:',
    ledger: 'ledger:',
    products: 'products:',
    locations: 'locations:',
};
exports.INVALIDATION_BY_TRIGGER = {
    warehouseTaskOrWorkflowUi: [exports.CACHE_PREFIX.tasks, exports.CACHE_PREFIX.workflows],
    stockOrLedger: [exports.CACHE_PREFIX.inventory, exports.CACHE_PREFIX.ledger],
    taskAndStock: [
        exports.CACHE_PREFIX.tasks,
        exports.CACHE_PREFIX.workflows,
        exports.CACHE_PREFIX.inventory,
        exports.CACHE_PREFIX.ledger,
    ],
    products: [exports.CACHE_PREFIX.products],
    locationTrees: [exports.CACHE_PREFIX.locations],
};
//# sourceMappingURL=cache-invalidation.map.js.map