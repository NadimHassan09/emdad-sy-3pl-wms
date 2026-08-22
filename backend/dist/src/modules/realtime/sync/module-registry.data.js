"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULE_REGISTRY = void 0;
exports.resolveRegistry = resolveRegistry;
exports.MODULE_REGISTRY = {
    InboundCreated: {
        client: ['inbound', 'inventory', 'dashboard'],
        admin: ['inbound', 'inventory', 'dashboard'],
    },
    InboundUpdated: {
        client: ['inbound', 'dashboard'],
        admin: ['inbound', 'inventory', 'tasks', 'dashboard'],
    },
    OutboundCreated: {
        client: ['outbound', 'inventory', 'dashboard'],
        admin: ['outbound', 'inventory', 'dashboard'],
    },
    OutboundUpdated: {
        client: ['outbound', 'dashboard'],
        admin: ['outbound', 'inventory', 'tasks', 'dashboard'],
    },
    OmsOrderEvent: {
        client: ['oms', 'outbound', 'dashboard', 'cod'],
        admin: ['oms', 'outbound', 'dashboard', 'cod'],
    },
    OmsReturnEvent: {
        client: ['returns', 'oms', 'dashboard'],
        admin: ['returns', 'oms', 'dashboard'],
    },
    InventoryChanged: {
        client: ['inventory', 'products', 'dashboard'],
        admin: ['inventory', 'dashboard'],
    },
    TaskUpdated: {
        client: [],
        admin: ['tasks', 'dashboard', 'inbound', 'outbound'],
    },
    ProductCreated: {
        client: ['products', 'dashboard'],
        admin: ['products', 'dashboard'],
    },
    ProductUpdated: {
        client: ['products', 'dashboard'],
        admin: ['products', 'dashboard'],
    },
    ProductArchived: {
        client: ['products', 'dashboard'],
        admin: ['products', 'dashboard'],
    },
    ProductDeleted: {
        client: ['products', 'dashboard'],
        admin: ['products', 'dashboard'],
    },
    UserCreated: {
        client: ['users'],
        admin: ['users', 'dashboard'],
    },
    UserUpdated: {
        client: ['users', 'session'],
        admin: ['users'],
    },
    UserDeleted: {
        client: ['users', 'session'],
        admin: ['users'],
    },
    WarehouseCreated: {
        client: [],
        admin: ['warehouses', 'locations', 'dashboard'],
    },
    WarehouseUpdated: {
        client: [],
        admin: ['warehouses', 'locations'],
    },
    LocationCreated: {
        client: [],
        admin: ['locations', 'inventory', 'dashboard'],
    },
    LocationUpdated: {
        client: [],
        admin: ['locations', 'inventory'],
    },
    LocationArchived: {
        client: [],
        admin: ['locations', 'inventory'],
    },
    ReturnCreated: {
        client: ['returns', 'dashboard'],
        admin: ['returns', 'dashboard'],
    },
    ReturnUpdated: {
        client: ['returns', 'dashboard'],
        admin: ['returns', 'dashboard'],
    },
    ReturnConfirmed: {
        client: ['returns', 'inventory', 'dashboard'],
        admin: ['returns', 'inventory', 'dashboard'],
    },
    ReturnCompleted: {
        client: ['returns', 'inventory', 'dashboard'],
        admin: ['returns', 'inventory', 'dashboard'],
    },
    CycleCountCreated: {
        client: [],
        admin: ['cycle_count', 'dashboard'],
    },
    CycleCountUpdated: {
        client: [],
        admin: ['cycle_count', 'tasks', 'dashboard'],
    },
    CycleCountCompleted: {
        client: [],
        admin: ['cycle_count', 'inventory', 'adjustments', 'dashboard'],
    },
    AdjustmentCreated: {
        client: [],
        admin: ['adjustments', 'dashboard'],
    },
    AdjustmentApproved: {
        client: ['inventory', 'dashboard'],
        admin: ['adjustments', 'inventory', 'dashboard'],
    },
    TransferCreated: {
        client: [],
        admin: ['transfers', 'dashboard'],
    },
    TransferCompleted: {
        client: ['inventory', 'dashboard'],
        admin: ['transfers', 'inventory', 'dashboard'],
    },
    AuditLogCreated: {
        client: [],
        admin: ['audit'],
    },
    NotificationCreated: {
        client: ['notifications'],
        admin: ['notifications'],
    },
    NotificationRead: {
        client: ['notifications'],
        admin: ['notifications'],
    },
    NotificationDeleted: {
        client: ['notifications'],
        admin: ['notifications'],
    },
    CompanyLifecycle: {
        client: ['clients', 'billing', 'session', 'dashboard'],
        admin: ['clients', 'billing', 'dashboard'],
    },
    BillingRestriction: {
        client: ['billing', 'session', 'dashboard'],
        admin: ['billing', 'clients', 'dashboard'],
    },
    CodUpdated: {
        client: ['cod', 'oms', 'dashboard'],
        admin: ['cod', 'oms', 'dashboard'],
    },
    DocumentGenerated: {
        client: ['documents'],
        admin: ['documents'],
    },
    DocumentSlotOverride: {
        client: [],
        admin: ['documents'],
    },
    FinalContractChanged: {
        client: ['documents'],
        admin: ['documents'],
    },
    FormSubmitted: {
        client: [],
        admin: ['forms'],
    },
    InvoiceUpdated: {
        client: ['billing', 'dashboard'],
        admin: ['billing', 'dashboard'],
    },
    PlanUpdated: {
        client: ['billing', 'dashboard'],
        admin: ['billing', 'dashboard'],
    },
    BackupJobProgress: {
        client: [],
        admin: ['backups'],
    },
    PresenceOnline: {
        client: [],
        admin: ['presence'],
    },
    PresenceOffline: {
        client: [],
        admin: ['presence'],
    },
    SessionChanged: {
        client: ['session'],
        admin: ['session'],
    },
    DashboardUpdated: {
        client: ['dashboard'],
        admin: ['dashboard'],
    },
};
function resolveRegistry(mutationId) {
    const row = exports.MODULE_REGISTRY[mutationId];
    if (!row) {
        return { client: [], admin: [] };
    }
    return row;
}
//# sourceMappingURL=module-registry.data.js.map