import type { QueryKey } from '@tanstack/react-query';

import type { ClientAppModuleId } from './module-route-map';

export const CLIENT_MODULE_QUERY_KEYS: Record<ClientAppModuleId, readonly QueryKey[]> = {
  inbound: [['client', 'inbound-orders'], ['client', 'inbound-orders-chunk']],
  outbound: [['client', 'outbound-orders'], ['client', 'outbound-orders-chunk']],
  oms: [
    ['client', 'ecommerce-orders'],
    ['client', 'outbound-orders'],
    ['client', 'outbound-orders-chunk'],
  ],
  inventory: [['client', 'stock'], ['client', 'products']],
  products: [['client', 'products']],
  returns: [['client', 'returns'], ['client', 'oms-returns']],
  dashboard: [['client', 'dashboard']],
  billing: [['client', 'billing'], ['client', 'invoices']],
  notifications: [['client', 'notifications'], ['client', 'dashboard', 'notifications']],
  cod: [['client', 'cod-report'], ['client', 'my-profits']],
  session: [['client', 'auth'], ['client', 'me']],
};
