/**
 * Client Portal — route prefix → module id (Architecture 2.2).
 */
export type ClientAppModuleId =
  | 'inbound'
  | 'outbound'
  | 'oms'
  | 'inventory'
  | 'products'
  | 'returns'
  | 'dashboard'
  | 'billing'
  | 'notifications'
  | 'cod'
  | 'session';

export const CLIENT_ROUTE_MODULE_MAP: ReadonlyArray<{ prefix: string; module: ClientAppModuleId }> = [
  { prefix: 'inbound-orders', module: 'inbound' },
  { prefix: 'outbound-orders', module: 'outbound' },
  { prefix: 'ecommerce-orders/returns', module: 'returns' },
  { prefix: 'ecommerce-orders', module: 'oms' },
  { prefix: 'products', module: 'products' },
  { prefix: 'dashboard', module: 'dashboard' },
  { prefix: 'billing', module: 'billing' },
  { prefix: 'invoices', module: 'billing' },
  { prefix: 'my-profits', module: 'cod' },
  { prefix: 'cod-reports', module: 'cod' },
  { prefix: 'notifications', module: 'notifications' },
  { prefix: 'returns', module: 'returns' },
  { prefix: 'profile', module: 'session' },
];

export const CLIENT_ALWAYS_ACTIVE: readonly ClientAppModuleId[] = ['session', 'notifications'];

export function resolveClientActiveModule(pathname: string): ClientAppModuleId | null {
  const clean = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!clean) return 'dashboard';
  for (const row of CLIENT_ROUTE_MODULE_MAP) {
    if (clean === row.prefix || clean.startsWith(`${row.prefix}/`)) {
      return row.module;
    }
  }
  return null;
}
