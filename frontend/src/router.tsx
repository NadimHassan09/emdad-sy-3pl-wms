import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { RequireAuth } from './auth/RequireAuth';
import { RoleHomeRedirect } from './auth/RoleHomeRedirect';
import { Layout } from './components/Layout';

// ─────────────────────────────────────────────────────────────────────────────
// Lazy page imports — each page becomes a separate JS chunk at build time.
// Suspense boundary lives in Layout.tsx wrapping the <Outlet />.
// ─────────────────────────────────────────────────────────────────────────────

function lazyPage<M extends Record<string, React.ComponentType>>(
  loader: () => Promise<M>,
  name: keyof M,
) {
  return lazy(async () => {
    const mod = await loader();
    return { default: mod[name] };
  });
}

const DashboardOverviewPage   = lazyPage(() => import('./pages/DashboardOverviewPage'),   'DashboardOverviewPage');
const ProductsPage            = lazyPage(() => import('./pages/ProductsPage'),            'ProductsPage');
const ProductDetailPage       = lazyPage(() => import('./pages/ProductDetailPage'),       'ProductDetailPage');
const LocationsPage           = lazyPage(() => import('./pages/LocationsPage'),           'LocationsPage');
const WarehousesPage          = lazyPage(() => import('./pages/WarehousesPage'),          'WarehousesPage');
const InventoryPage           = lazyPage(() => import('./pages/InventoryPage'),           'InventoryPage');
const InventoryProductDetailPage = lazyPage(() => import('./pages/InventoryProductDetailPage'), 'InventoryProductDetailPage');
const InventoryLedgerPage     = lazyPage(() => import('./pages/InventoryLedgerPage'),     'InventoryLedgerPage');
const InventoryLedgerEntryPage = lazyPage(() => import('./pages/InventoryLedgerEntryPage'), 'InventoryLedgerEntryPage');
const InventoryLedgerReferencePage = lazyPage(() => import('./pages/InventoryLedgerReferencePage'), 'InventoryLedgerReferencePage');
const AdjustmentsPage         = lazyPage(() => import('./pages/AdjustmentsPage'),         'AdjustmentsPage');
const AdjustmentDetailPage    = lazyPage(() => import('./pages/AdjustmentDetailPage'),    'AdjustmentDetailPage');
const InboundListPage         = lazyPage(() => import('./pages/InboundListPage'),         'InboundListPage');
const InboundDetailPage       = lazyPage(() => import('./pages/InboundDetailPage'),       'InboundDetailPage');
const OutboundListPage        = lazyPage(() => import('./pages/OutboundListPage'),        'OutboundListPage');
const OutboundDetailPage      = lazyPage(() => import('./pages/OutboundDetailPage'),      'OutboundDetailPage');
const TasksListPage           = lazyPage(() => import('./pages/TasksListPage'),           'TasksListPage');
const TaskDetailPage          = lazyPage(() => import('./pages/TaskDetailPage'),          'TaskDetailPage');
const TaskExecutePage         = lazyPage(() => import('./pages/TaskExecutePage'),         'TaskExecutePage');
const InternalTransferPage    = lazyPage(() => import('./pages/InternalTransferPage'),    'InternalTransferPage');
const ReportsLayout                 = lazyPage(() => import('./pages/reports/ReportsLayout'),                 'ReportsLayout');
const WarehouseAnalysisReportPage = lazyPage(() => import('./pages/reports/WarehouseAnalysisReportPage'), 'WarehouseAnalysisReportPage');
const InventoryReportPage           = lazyPage(() => import('./pages/reports/InventoryReportPage'),           'InventoryReportPage');
const ProductMovesReportPage        = lazyPage(() => import('./pages/reports/ProductMovesReportPage'),        'ProductMovesReportPage');
const WorkerProductivityReportPage  = lazyPage(() => import('./pages/reports/OperationalReportPages'),      'WorkerProductivityReportPage');
const OrderCycleTimeReportPage      = lazyPage(() => import('./pages/reports/OperationalReportPages'),      'OrderCycleTimeReportPage');
const InboundAccuracyReportPage     = lazyPage(() => import('./pages/reports/OperationalReportPages'),      'InboundAccuracyReportPage');
const OutboundFillRateReportPage    = lazyPage(() => import('./pages/reports/OperationalReportPages'),      'OutboundFillRateReportPage');
const SlaComplianceReportPage       = lazyPage(() => import('./pages/reports/OperationalReportPages'),      'SlaComplianceReportPage');
const StockAgingReportPage          = lazyPage(() => import('./pages/reports/InventoryIntelligenceReportPages'), 'StockAgingReportPage');
const LotExpiryReportPage           = lazyPage(() => import('./pages/reports/InventoryIntelligenceReportPages'), 'LotExpiryReportPage');
const CapacityUtilizationReportPage = lazyPage(() => import('./pages/reports/InventoryIntelligenceReportPages'), 'CapacityUtilizationReportPage');
const ReturnRateReportPage          = lazyPage(() => import('./pages/reports/InventoryIntelligenceReportPages'), 'ReturnRateReportPage');
const RevenueByClientReportPage     = lazyPage(() => import('./pages/reports/FinanceReportPages'),           'RevenueByClientReportPage');
const ReceivablesAgingReportPage    = lazyPage(() => import('./pages/reports/FinanceReportPages'),           'ReceivablesAgingReportPage');
const ClientsPage             = lazyPage(() => import('./pages/ClientsPage'),             'ClientsPage');
const CompanyDetailPage       = lazyPage(() => import('./pages/CompanyDetailPage'),       'CompanyDetailPage');
const WarehouseUsersPage      = lazyPage(() => import('./pages/UsersPage'),               'WarehouseUsersPage');
const ClientUsersPage         = lazyPage(() => import('./pages/UsersPage'),               'ClientUsersPage');
const WarehouseUserDetailPage = lazyPage(() => import('./pages/UserDetailPage'),         'WarehouseUserDetailPage');
const ClientUserDetailPage    = lazyPage(() => import('./pages/UserDetailPage'),          'ClientUserDetailPage');
const NotificationsPage         = lazyPage(() => import('./modules/notifications/NotificationsPage'), 'NotificationsPage');
const LoginPage               = lazyPage(() => import('./pages/LoginPage'),               'LoginPage');
const AuditLogsPage           = lazyPage(() => import('./pages/AuditLogsPage'),           'AuditLogsPage');
const SettingsLayout          = lazyPage(() => import('./pages/settings/SettingsLayout'), 'SettingsLayout');
const BackupHistoryPage       = lazyPage(() => import('./pages/settings/BackupHistoryPage'), 'BackupHistoryPage');
const BackupUploadPage        = lazyPage(() => import('./pages/settings/BackupUploadPage'), 'BackupUploadPage');
const BackupRestorePage       = lazyPage(() => import('./pages/settings/BackupRestorePage'), 'BackupRestorePage');
const BackupFactoryResetPage  = lazyPage(() => import('./pages/settings/BackupFactoryResetPage'), 'BackupFactoryResetPage');
const BackupSchedulesPage     = lazyPage(() => import('./pages/settings/BackupSchedulesPage'), 'BackupSchedulesPage');
const BackupRetentionPage     = lazyPage(() => import('./pages/settings/BackupRetentionPage'), 'BackupRetentionPage');
const BackupHealthPage        = lazyPage(() => import('./pages/settings/BackupHealthPage'), 'BackupHealthPage');
const BackupStoragePolicyPage = lazyPage(() => import('./pages/settings/BackupStoragePolicyPage'), 'BackupStoragePolicyPage');
const BackupGoogleDrivePage   = lazyPage(() => import('./pages/settings/BackupGoogleDrivePage'), 'BackupGoogleDrivePage');
const CycleCountListPage      = lazyPage(() => import('./pages/cycle-count/CycleCountListPage'), 'CycleCountListPage');
const CycleCountDetailPage    = lazyPage(() => import('./pages/cycle-count/CycleCountDetailPage'), 'CycleCountDetailPage');
const CycleCountExecutePage   = lazyPage(() => import('./pages/cycle-count/CycleCountExecutePage'), 'CycleCountExecutePage');
const CycleCountMyTasksPage   = lazyPage(() => import('./pages/cycle-count/CycleCountMyTasksPage'), 'CycleCountMyTasksPage');
const ReturnsListPage         = lazyPage(() => import('./pages/returns/ReturnsListPage'), 'ReturnsListPage');
const ReturnDetailPage        = lazyPage(() => import('./pages/returns/ReturnDetailPage'), 'ReturnDetailPage');
const ReturnProcessPage       = lazyPage(() => import('./pages/returns/ReturnProcessPage'), 'ReturnProcessPage');
const BillingPlansPage          = lazyPage(() => import('./pages/billing/BillingPlansPage'), 'BillingPlansPage');
const BillingPlanDetailPage     = lazyPage(() => import('./pages/billing/BillingPlanDetailPage'), 'BillingPlanDetailPage');
const BillingInvoicesPage       = lazyPage(() => import('./pages/billing/BillingInvoicesPage'), 'BillingInvoicesPage');
const BillingInvoiceDetailPage  = lazyPage(() => import('./pages/billing/BillingInvoiceDetailPage'), 'BillingInvoiceDetailPage');
const BillingDashboardPage      = lazyPage(() => import('./pages/billing/BillingDashboardPage'), 'BillingDashboardPage');
const FormsPage                 = lazyPage(() => import('./pages/forms/FormsPage'), 'FormsPage');

/** Data router required for `useBlocker` (task execution exit guard). */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <RoleHomeRedirect /> },
      { path: 'dashboard', element: <Navigate to="/dashboard/overview" replace /> },
      { path: 'dashboard/overview', element: <DashboardOverviewPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/:sku', element: <ProductDetailPage /> },
      { path: 'locations', element: <LocationsPage /> },
      { path: 'warehouses', element: <WarehousesPage /> },
      { path: 'inventory', element: <Navigate to="/inventory/stock" replace /> },
      { path: 'inventory/ledger/line/:ledgerId/:createdAt', element: <InventoryLedgerEntryPage /> },
      { path: 'inventory/ledger/:referenceType/:referenceId', element: <InventoryLedgerReferencePage /> },
      { path: 'inventory/ledger', element: <InventoryLedgerPage /> },
      { path: 'inventory/product/:productId', element: <InventoryProductDetailPage /> },
      { path: 'inventory/stock', element: <InventoryPage /> },
      { path: 'adjustments', element: <Navigate to="/inventory/adjustments" replace /> },
      { path: 'inventory/adjustments', element: <AdjustmentsPage /> },
      { path: 'inventory/adjustments/:id', element: <AdjustmentDetailPage /> },
      { path: 'inbound', element: <Navigate to="/orders/inbound" replace /> },
      { path: 'outbound', element: <Navigate to="/orders/outbound" replace /> },
      { path: 'orders', element: <Navigate to="/orders/inbound" replace /> },
      { path: 'orders/inbound', element: <InboundListPage /> },
      { path: 'orders/inbound/:id', element: <InboundDetailPage /> },
      { path: 'orders/outbound', element: <OutboundListPage /> },
      { path: 'orders/outbound/:id', element: <OutboundDetailPage /> },
      { path: 'tasks', element: <TasksListPage /> },
      { path: 'tasks/:id/execute', element: <TaskExecutePage /> },
      { path: 'tasks/:id', element: <TaskDetailPage /> },
      { path: 'cycle-count', element: <CycleCountListPage /> },
      { path: 'cycle-count/my-tasks', element: <CycleCountMyTasksPage /> },
      { path: 'cycle-count/:id/execute', element: <CycleCountExecutePage /> },
      { path: 'cycle-count/:id', element: <CycleCountDetailPage /> },
      { path: 'returns', element: <ReturnsListPage /> },
      { path: 'returns/:id/process', element: <ReturnProcessPage /> },
      { path: 'returns/:id', element: <ReturnDetailPage /> },
      { path: 'internal', element: <InternalTransferPage /> },
      {
        path: 'reports',
        element: <ReportsLayout />,
        children: [
          { index: true, element: <Navigate to="/reports/warehouse-analysis" replace /> },
          { path: 'warehouse-analysis', element: <WarehouseAnalysisReportPage /> },
          { path: 'inventory', element: <InventoryReportPage /> },
          { path: 'product-moves', element: <ProductMovesReportPage /> },
          { path: 'stock-aging', element: <StockAgingReportPage /> },
          { path: 'lot-expiry', element: <LotExpiryReportPage /> },
          { path: 'capacity-utilization', element: <CapacityUtilizationReportPage /> },
          { path: 'return-rate', element: <ReturnRateReportPage /> },
          { path: 'revenue-by-client', element: <RevenueByClientReportPage /> },
          { path: 'receivables-aging', element: <ReceivablesAgingReportPage /> },
          { path: 'worker-productivity', element: <WorkerProductivityReportPage /> },
          { path: 'order-cycle-time', element: <OrderCycleTimeReportPage /> },
          { path: 'inbound-accuracy', element: <InboundAccuracyReportPage /> },
          { path: 'outbound-fill-rate', element: <OutboundFillRateReportPage /> },
          { path: 'sla-compliance', element: <SlaComplianceReportPage /> },
        ],
      },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'clients/:id', element: <CompanyDetailPage /> },
      { path: 'forms', element: <FormsPage /> },
      { path: 'billing', element: <Navigate to="/billing/dashboard" replace /> },
      { path: 'billing/dashboard', element: <BillingDashboardPage /> },
      { path: 'billing/plans', element: <BillingPlansPage /> },
      { path: 'billing/plans/:clientId', element: <BillingPlanDetailPage /> },
      { path: 'billing/invoices', element: <BillingInvoicesPage /> },
      { path: 'billing/invoices/:id', element: <BillingInvoiceDetailPage /> },
      { path: 'users', element: <Navigate to="/users/warehouse_users" replace /> },
      { path: 'users/warehouse_users', element: <WarehouseUsersPage /> },
      { path: 'users/warehouse_users/:id', element: <WarehouseUserDetailPage /> },
      { path: 'users/client_users', element: <ClientUsersPage /> },
      { path: 'users/client_users/:id', element: <ClientUserDetailPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      {
        path: 'settings',
        element: <SettingsLayout />,
        children: [
          { index: true, element: <Navigate to="/settings/backups" replace /> },
          { path: 'backups', element: <BackupHistoryPage /> },
          { path: 'backups/upload', element: <BackupUploadPage /> },
          { path: 'backups/restore', element: <BackupRestorePage /> },
          { path: 'backups/factory-reset', element: <BackupFactoryResetPage /> },
          { path: 'backups/schedules', element: <BackupSchedulesPage /> },
          { path: 'backups/retention', element: <BackupRetentionPage /> },
          { path: 'backups/health', element: <BackupHealthPage /> },
          { path: 'backups/storage-policy', element: <BackupStoragePolicyPage /> },
          { path: 'backups/google-drive', element: <BackupGoogleDrivePage /> },
        ],
      },
      { path: '*', element: <RoleHomeRedirect /> },
    ],
  },
]);
