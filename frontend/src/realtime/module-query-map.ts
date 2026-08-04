import type { QueryKey } from '@tanstack/react-query';

import { QK } from '../constants/query-keys';
import type { AdminAppModuleId } from './module-route-map';

/** Query key prefixes owned by each admin module (dispose + refetch). */
export const ADMIN_MODULE_QUERY_KEYS: Record<AdminAppModuleId, readonly QueryKey[]> = {
  inbound: [QK.inboundOrders, ['inbound-orders-chunk'], ['workflow-timeline'], QK.workflows.all],
  outbound: [
    QK.outboundOrders,
    ['outbound-orders-chunk'],
    ['workflow-timeline'],
    QK.workflows.all,
  ],
  oms: [
    QK.omsOrders,
    ['oms-orders-chunk'],
    QK.omsDashboard,
    ['oms-returns'],
    ['oms-returns-chunk'],
  ],
  inventory: [
    QK.inventoryStock,
    ['inventory-stock-chunk'],
    QK.inventoryStockByProduct,
    ['inventory-stock-by-product-chunk'],
    QK.ledger,
    ['ledger-chunk'],
    ['availability'],
  ],
  tasks: [QK.tasks.all, QK.workers.all],
  products: [QK.products, ['products-chunk']],
  returns: [QK.returns.all, ['oms-returns'], ['oms-returns-chunk']],
  cycle_count: [QK.cycleCount.all],
  adjustments: [QK.adjustments],
  transfers: [['internal-transfers'], QK.inventoryStock],
  dashboard: [QK.dashboardOverview, QK.dashboardOpenOrdersCharts],
  billing: [
    QK.billing.all,
    ['billing-plans-chunk'],
    ['billing-invoices-chunk'],
  ],
  clients: [QK.companies],
  users: [QK.users.all, ['users', 'list']],
  notifications: [QK.notifications.all],
  documents: [
    QK.contracts,
    QK.contractsGrn,
    QK.contractsDn,
    QK.contractsFinalContract,
    ['contracts-grn-chunk'],
    ['contracts-dn-chunk'],
    ['final-contracts-chunk'],
  ],
  forms: [QK.forms.all],
  backups: [QK.backups.all],
  cod: [['oms-cod'], ['oms-cod-records'], ['oms-cod-records-chunk'], ['cod']],
  audit: [QK.auditLogs.all],
  session: [['auth'], ['me']],
  presence: [QK.presenceOnlineUsers],
  warehouses: [QK.warehouses],
  locations: [QK.locations.all, ['locations-children-chunk']],
};
