/** Centralised React Query keys — keep invalidations aligned with fetches. */
export const QK = {
  products: ['products'] as const,
  companies: ['companies'] as const,
  users: ['users'] as const,
  warehouses: ['warehouses'] as const,
  inventoryStock: ['inventory', 'stock'] as const,
  /** Stock rows for one location (locations page drill-in). */
  inventoryStockByLocation: (locationId: string, warehouseId: string) =>
    ['inventory', 'stock', 'location', locationId, warehouseId] as const,
  /** Aggregated totals per product (main inventory grid). */
  inventoryStockByProduct: ['inventory', 'stock-by-product'] as const,
  ledger: ['inventory', 'ledger'] as const,
  ledgerDetail: (warehouseId: string, referenceType: string, referenceId: string) =>
    ['inventory', 'ledger', 'detail', warehouseId, referenceType, referenceId] as const,
  ledgerEntry: (warehouseId: string, ledgerId: string, createdAt: string) =>
    ['inventory', 'ledger', 'entry', warehouseId, ledgerId, createdAt] as const,
  inboundOrders: ['inbound-orders'] as const,
  outboundOrders: ['outbound-orders'] as const,
  notifications: ['notifications'] as const,
  dashboardOverview: ['dashboard', 'overview'] as const,
  dashboardOpenOrdersCharts: ['dashboard', 'open-orders-charts'] as const,
  presenceOnlineUsers: ['presence', 'online-users'] as const,
  reports: {
    all: ['reports'] as const,
    preview: (reportId: string, params: Record<string, unknown>) =>
      ['reports', reportId, params] as const,
  },
  adjustments: ['adjustments'] as const,
  availability: (productId: string, companyId: string) =>
    ['availability', productId, companyId] as const,
  locations: {
    all: ['locations'] as const,
    children: (
      warehouseId: string,
      parentId: string | null,
      filters: Record<string, unknown>,
    ) => ['locations', 'children', warehouseId, parentId ?? 'root', filters] as const,
    lookup: (warehouseId: string, search: string) =>
      ['locations', 'lookup', warehouseId, search] as const,
    byId: (id: string) => ['locations', 'detail', id] as const,
    putawayLookup: (warehouseId: string, taskType: string, search: string) =>
      ['locations', 'lookup', 'putaway', warehouseId, taskType, search] as const,
  },
  /** @deprecated Full tree — do not use on Locations page */
  locationsTree: (warehouseId: string) => ['locations', 'tree', warehouseId] as const,
  locationsPurgeContext: (warehouseId: string) => ['locations', 'purge-context', warehouseId] as const,
  locationsFlat: (warehouseId: string, includeArchived: boolean) =>
    ['locations', 'flat', warehouseId, includeArchived] as const,
  locationsFlatAll: (includeArchived: boolean) =>
    ['locations', 'flat', 'all', includeArchived] as const,

  tasks: {
    all: ['tasks'] as const,
    list: (filters: Record<string, unknown>) => ['tasks', 'list', filters] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
    byWorker: (workerId: string, filters?: Record<string, unknown>) =>
      ['tasks', 'worker', workerId, filters ?? {}] as const,
  },
  workflows: {
    all: ['workflows'] as const,
    instance: (id: string) => ['workflows', 'instance', id] as const,
    byOrderRef: (refType: 'inbound_order' | 'outbound_order', orderId: string) =>
      ['workflows', 'order', refType, orderId] as const,
    timeline: (refType: 'inbound_order' | 'outbound_order', orderId: string) =>
      ['workflows', 'timeline', refType, orderId] as const,
    /** Order workflow card; align invalidations with literal `workflow-timeline` prefix. */
    workflowTimelineByRef: (referenceId: string) => ['workflow-timeline', referenceId] as const,
  },
  workers: {
    all: ['workers'] as const,
    detail: (id: string) => ['workers', id] as const,
    workload: (id: string) => ['workers', id, 'workload'] as const,
    load: (warehouseId: string | 'none') => ['workers', 'load', warehouseId] as const,
  },
  auditLogs: {
    all: ['audit-logs'] as const,
    policy: ['audit-logs', 'policy'] as const,
    list: (params: Record<string, unknown>) => ['audit-logs', 'list', params] as const,
    detail: (id: string) => ['audit-logs', 'detail', id] as const,
  },
  returns: {
    all: ['return-orders'] as const,
    list: (params: Record<string, unknown>) => ['return-orders', 'list', params] as const,
    detail: (id: string) => ['return-orders', 'detail', id] as const,
    outboundQuota: (outboundId: string) => ['return-orders', 'outbound-quota', outboundId] as const,
  },
  backups: {
    all: ['backups'] as const,
    list: (params: Record<string, unknown>) => ['backups', 'list', params] as const,
    restorable: ['backups', 'restorable'] as const,
    detail: (id: string) => ['backups', 'detail', id] as const,
    status: (id: string) => ['backups', 'status', id] as const,
    activeOperation: ['backups', 'operations', 'active'] as const,
    auditRecent: ['backups', 'audit', 'recent'] as const,
    schedules: ['backups', 'schedules'] as const,
    retentionPolicies: ['backups', 'retention', 'policies'] as const,
    retentionPreview: ['backups', 'retention', 'preview'] as const,
    health: ['backups', 'health'] as const,
    healthAudit: ['backups', 'audit', 'health'] as const,
    storagePolicy: ['backups', 'storage-policy'] as const,
    googleDrive: ['integrations', 'google-drive'] as const,
  },
  cycleCount: {
    all: ['cycle-count'] as const,
    list: (params: Record<string, unknown>) => ['cycle-count', 'list', params] as const,
    detail: (id: string) => ['cycle-count', 'detail', id] as const,
    variances: (countId: string) => ['cycle-count', 'variances', countId] as const,
    productHistory: (warehouseId: string, filters: Record<string, unknown>) =>
      ['cycle-count', 'product-history', warehouseId, filters] as const,
    schedules: (warehouseId: string) => ['cycle-count', 'schedules', warehouseId] as const,
    reasonCodes: ['cycle-count', 'reason-codes'] as const,
    myTasks: (warehouseId: string) => ['cycle-count', 'my-tasks', warehouseId] as const,
    execution: (id: string) => ['cycle-count', 'execution', id] as const,
  },
  billing: {
    all: ['billing'] as const,
    plans: ['billing', 'plans'] as const,
    cycles: ['billing', 'cycles'] as const,
    capacity: ['billing', 'capacity'] as const,
    invoices: ['billing', 'invoices'] as const,
    expiringSoon: ['billing', 'expiring-soon'] as const,
    overdueClients: ['billing', 'overdue-clients'] as const,
    recentInvoices: ['billing', 'recent-invoices'] as const,
    suspendedAccounts: ['billing', 'suspended-accounts'] as const,
  },
};
