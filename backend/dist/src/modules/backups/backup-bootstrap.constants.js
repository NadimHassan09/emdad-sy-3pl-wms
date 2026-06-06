"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FACTORY_RESET_TRUNCATE_TABLES = exports.STORAGE_SETTINGS_ID = exports.DRIVE_RETENTION_CLEANUP_RESOURCE_ID = exports.BACKUP_HEALTH_RESOURCE_ID = exports.RETENTION_CLEANUP_RESOURCE_ID = exports.SUPER_ADMIN_EMAIL = exports.SUPER_ADMIN_ID = void 0;
exports.SUPER_ADMIN_ID = '00000000-0000-4000-8000-0000000000ab';
exports.SUPER_ADMIN_EMAIL = 'superadmin@emdad.example';
exports.RETENTION_CLEANUP_RESOURCE_ID = '00000000-0000-4000-8000-0000000000c1';
exports.BACKUP_HEALTH_RESOURCE_ID = '00000000-0000-4000-8000-0000000000c2';
exports.DRIVE_RETENTION_CLEANUP_RESOURCE_ID = '00000000-0000-4000-8000-0000000000c3';
exports.STORAGE_SETTINGS_ID = '00000000-0000-4000-8000-0000000000d1';
exports.FACTORY_RESET_TRUNCATE_TABLES = [
    'task_events',
    'task_assignments',
    'warehouse_tasks',
    'workflow_nodes',
    'workflow_instances',
    'cycle_count_variances',
    'cycle_count_lines',
    'cycle_counts',
    'cycle_count_schedules',
    'return_order_lines',
    'return_orders',
    'outbound_order_lines',
    'outbound_orders',
    'inbound_order_lines',
    'inbound_orders',
    'inventory_ledger',
    'current_stock',
    'stock_adjustments',
    'packages',
    'lots',
    'products',
    'notifications',
    'auth_refresh_sessions',
    'user_company_access',
    'workers',
    'audit_logs',
];
//# sourceMappingURL=backup-bootstrap.constants.js.map