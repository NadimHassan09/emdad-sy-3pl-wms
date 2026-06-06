/** Seed IDs preserved across factory reset (must match prisma/seed.ts). */
export const SUPER_ADMIN_ID = '00000000-0000-4000-8000-0000000000ab';
export const SUPER_ADMIN_EMAIL = 'superadmin@emdad.example';

/** Stable audit resource id for retention cleanup summary events. */
export const RETENTION_CLEANUP_RESOURCE_ID = '00000000-0000-4000-8000-0000000000c1';

/** Stable audit resource id for backup health alert events. */
export const BACKUP_HEALTH_RESOURCE_ID = '00000000-0000-4000-8000-0000000000c2';

/** Stable audit resource id for Google Drive retention cleanup summary events. */
export const DRIVE_RETENTION_CLEANUP_RESOURCE_ID = '00000000-0000-4000-8000-0000000000c3';

/** Singleton row id for backup_storage_settings (audit-safe UUID). */
export const STORAGE_SETTINGS_ID = '00000000-0000-4000-8000-0000000000d1';

/**
 * Business tables truncated during factory reset (public schema).
 * Order: children first; CASCADE handles remaining FKs where supported.
 */
export const FACTORY_RESET_TRUNCATE_TABLES = [
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
] as const;
