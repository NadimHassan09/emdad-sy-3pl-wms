/** Complete admin + client API endpoint catalog for coverage tracking. */
export type EndpointDef = {
  controller: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  auth: 'admin' | 'client' | 'public' | 'ops';
  /** Minimal body for POST/PATCH when needed */
  body?: unknown;
};

export const ADMIN_ENDPOINTS: EndpointDef[] = [
  // auth
  { controller: 'auth', method: 'POST', path: '/auth/login', auth: 'public', body: { email: 'x', password: 'x' } },
  { controller: 'auth', method: 'GET', path: '/auth/me', auth: 'admin' },
  { controller: 'auth', method: 'POST', path: '/auth/logout', auth: 'admin' },
  // products
  { controller: 'products', method: 'GET', path: '/products', auth: 'admin' },
  { controller: 'products', method: 'GET', path: '/products/next-sku', auth: 'admin' },
  { controller: 'products', method: 'GET', path: '/products/00000000-0000-4000-8000-000000009999', auth: 'admin' },
  // inbound
  { controller: 'inbound-orders', method: 'GET', path: '/inbound-orders', auth: 'admin' },
  { controller: 'inbound-orders', method: 'GET', path: '/inbound-orders/00000000-0000-4000-8000-000000009999', auth: 'admin' },
  // outbound
  { controller: 'outbound-orders', method: 'GET', path: '/outbound-orders', auth: 'admin' },
  { controller: 'outbound-orders', method: 'GET', path: '/outbound-orders/00000000-0000-4000-8000-000000009999', auth: 'admin' },
  // tasks
  { controller: 'tasks', method: 'GET', path: '/tasks', auth: 'admin' },
  { controller: 'tasks', method: 'GET', path: '/tasks/00000000-0000-4000-8000-000000009999', auth: 'admin' },
  // inventory
  { controller: 'inventory', method: 'GET', path: '/inventory/stock', auth: 'admin' },
  { controller: 'inventory', method: 'GET', path: '/inventory/ledger', auth: 'admin' },
  { controller: 'inventory', method: 'GET', path: '/inventory/availability', auth: 'admin' },
  { controller: 'inventory', method: 'GET', path: '/inventory/consistency/validate', auth: 'admin' },
  // locations
  { controller: 'locations', method: 'GET', path: '/locations', auth: 'admin' },
  { controller: 'locations', method: 'GET', path: '/locations/tree', auth: 'admin' },
  // warehouses
  { controller: 'warehouses', method: 'GET', path: '/warehouses', auth: 'admin' },
  { controller: 'warehouses', method: 'GET', path: '/warehouses/next-code', auth: 'admin' },
  // companies
  { controller: 'companies', method: 'GET', path: '/companies', auth: 'admin' },
  { controller: 'companies', method: 'GET', path: '/companies/00000000-0000-4000-8000-000000009999', auth: 'admin' },
  // users
  { controller: 'users', method: 'GET', path: '/users', auth: 'admin' },
  { controller: 'users', method: 'GET', path: '/users/00000000-0000-4000-8000-000000009999', auth: 'admin' },
  // workers
  { controller: 'workers', method: 'GET', path: '/workers', auth: 'admin' },
  { controller: 'workers', method: 'GET', path: '/workers/load', auth: 'admin' },
  // workflows
  { controller: 'workflows', method: 'GET', path: '/workflows/context-settings', auth: 'admin' },
  { controller: 'workflows', method: 'GET', path: '/workflows/instances/by-reference', auth: 'admin' },
  // analytics
  { controller: 'analytics', method: 'GET', path: '/analytics/overview', auth: 'admin' },
  // dashboard
  { controller: 'dashboard', method: 'GET', path: '/dashboard/overview', auth: 'admin' },
  { controller: 'dashboard', method: 'GET', path: '/dashboard/open-orders-charts', auth: 'admin' },
  // notifications
  { controller: 'notifications', method: 'GET', path: '/notifications', auth: 'admin' },
  // adjustments
  { controller: 'adjustments', method: 'GET', path: '/adjustments', auth: 'admin' },
  { controller: 'adjustments', method: 'GET', path: '/adjustments/00000000-0000-4000-8000-000000009999', auth: 'admin' },
  // audit-logs
  { controller: 'audit-logs', method: 'GET', path: '/audit-logs', auth: 'admin' },
  { controller: 'audit-logs', method: 'GET', path: '/audit-logs/policy', auth: 'admin' },
  { controller: 'audit-logs', method: 'GET', path: '/audit-logs/archival-candidates', auth: 'admin' },
  // cycle-count
  { controller: 'cycle-count', method: 'GET', path: '/cycle-count/schedules', auth: 'admin' },
  { controller: 'cycle-count', method: 'GET', path: '/cycle-count/counts', auth: 'admin' },
  { controller: 'cycle-count', method: 'GET', path: '/cycle-count/product-history', auth: 'admin' },
  { controller: 'cycle-count/variances', method: 'GET', path: '/cycle-count/variances/reason-codes', auth: 'admin' },
  { controller: 'cycle-count/variances', method: 'GET', path: '/cycle-count/variances', auth: 'admin' },
  { controller: 'cycle-count/execution', method: 'GET', path: '/cycle-count/execution/tasks', auth: 'admin' },
  // returns
  { controller: 'return-orders', method: 'GET', path: '/return-orders', auth: 'admin' },
  { controller: 'return-orders', method: 'GET', path: '/return-orders/outbound-quota/00000000-0000-4000-8000-000000009999', auth: 'admin' },
  // ops
  { controller: 'ops', method: 'GET', path: '/ops/health/live', auth: 'ops' },
  { controller: 'ops', method: 'GET', path: '/ops/health/ready', auth: 'ops' },
  { controller: 'ops', method: 'GET', path: '/ops/diagnostics', auth: 'ops' },
  { controller: 'ops', method: 'GET', path: '/ops/policy', auth: 'ops' },
];

export const CLIENT_ENDPOINTS: EndpointDef[] = [
  { controller: 'client/auth', method: 'POST', path: '/client/auth/login', auth: 'public', body: { email: 'x', password: 'x' } },
  { controller: 'client/auth', method: 'GET', path: '/client/auth/me', auth: 'client' },
  { controller: 'client/products', method: 'GET', path: '/client/products', auth: 'client' },
  { controller: 'client/stock', method: 'GET', path: '/client/stock', auth: 'client' },
  { controller: 'client/stock', method: 'GET', path: '/client/stock/availability', auth: 'client' },
  { controller: 'client/inbound-orders', method: 'GET', path: '/client/inbound-orders', auth: 'client' },
  { controller: 'client/outbound-orders', method: 'GET', path: '/client/outbound-orders', auth: 'client' },
  { controller: 'client/notifications', method: 'GET', path: '/client/notifications', auth: 'client' },
];

export const CONTROLLER_NAMES = [
  'auth', 'products', 'inbound-orders', 'outbound-orders', 'tasks', 'inventory', 'locations',
  'warehouses', 'companies', 'users', 'workers', 'workflows', 'analytics', 'dashboard',
  'notifications', 'adjustments', 'audit-logs', 'cycle-count', 'cycle-count/variances',
  'cycle-count/execution', 'return-orders', 'ops', 'client/auth', 'client/products',
  'client/stock', 'client/inbound-orders', 'client/outbound-orders', 'client/notifications',
] as const;
