/**
 * Admin Dashboard — route prefix → AppModuleId (Architecture 2.2).
 * Longest-prefix match wins (not only first segment when nested).
 */
export type AdminAppModuleId =
  | 'inbound'
  | 'outbound'
  | 'oms'
  | 'inventory'
  | 'tasks'
  | 'products'
  | 'returns'
  | 'cycle_count'
  | 'adjustments'
  | 'transfers'
  | 'dashboard'
  | 'billing'
  | 'clients'
  | 'users'
  | 'notifications'
  | 'documents'
  | 'forms'
  | 'backups'
  | 'cod'
  | 'audit'
  | 'session'
  | 'presence'
  | 'warehouses'
  | 'locations';

/** Longest prefix first. */
export const ADMIN_ROUTE_MODULE_MAP: ReadonlyArray<{ prefix: string; module: AdminAppModuleId }> = [
  { prefix: 'orders/inbound', module: 'inbound' },
  { prefix: 'orders/outbound', module: 'outbound' },
  { prefix: 'orders/oms', module: 'oms' },
  { prefix: 'inventory/adjustments', module: 'adjustments' },
  { prefix: 'oms/cod', module: 'cod' },
  { prefix: 'oms/returns', module: 'returns' },
  { prefix: 'oms', module: 'oms' },
  { prefix: 'inbound', module: 'inbound' },
  { prefix: 'outbound', module: 'outbound' },
  { prefix: 'inventory', module: 'inventory' },
  { prefix: 'adjustments', module: 'adjustments' },
  { prefix: 'tasks', module: 'tasks' },
  { prefix: 'products', module: 'products' },
  { prefix: 'returns', module: 'returns' },
  { prefix: 'cycle-count', module: 'cycle_count' },
  { prefix: 'internal', module: 'transfers' },
  { prefix: 'dashboard', module: 'dashboard' },
  { prefix: 'billing', module: 'billing' },
  { prefix: 'clients', module: 'clients' },
  { prefix: 'companies', module: 'clients' },
  { prefix: 'users', module: 'users' },
  { prefix: 'warehouse-users', module: 'users' },
  { prefix: 'client-users', module: 'users' },
  { prefix: 'notifications', module: 'notifications' },
  { prefix: 'contracts', module: 'documents' },
  { prefix: 'forms', module: 'forms' },
  { prefix: 'settings', module: 'backups' },
  { prefix: 'audit', module: 'audit' },
  { prefix: 'warehouses', module: 'warehouses' },
  { prefix: 'locations', module: 'locations' },
  { prefix: 'reports', module: 'dashboard' },
];

export const ADMIN_ALWAYS_ACTIVE: readonly AdminAppModuleId[] = [
  'session',
  'notifications',
];

export function resolveAdminActiveModule(pathname: string): AdminAppModuleId | null {
  const clean = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!clean) return 'dashboard';
  for (const row of ADMIN_ROUTE_MODULE_MAP) {
    if (clean === row.prefix || clean.startsWith(`${row.prefix}/`)) {
      return row.module;
    }
  }
  const first = clean.split('/')[0] ?? '';
  const hit = ADMIN_ROUTE_MODULE_MAP.find((r) => r.prefix === first);
  return hit?.module ?? null;
}
