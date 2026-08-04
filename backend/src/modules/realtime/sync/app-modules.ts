/** Application module ids — Architecture 2.2 sync units (not API endpoints). */
export const APP_MODULES = [
  'inbound',
  'outbound',
  'oms',
  'inventory',
  'tasks',
  'products',
  'returns',
  'cycle_count',
  'adjustments',
  'transfers',
  'dashboard',
  'billing',
  'clients',
  'users',
  'notifications',
  'documents',
  'forms',
  'backups',
  'cod',
  'audit',
  'session',
  'presence',
  'warehouses',
  'locations',
] as const;

export type AppModuleId = (typeof APP_MODULES)[number];

export type SyncDomain = 'client' | 'admin';
