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
const ClientsPage             = lazyPage(() => import('./pages/ClientsPage'),             'ClientsPage');
const CompanyDetailPage       = lazyPage(() => import('./pages/CompanyDetailPage'),       'CompanyDetailPage');
const WarehouseUsersPage      = lazyPage(() => import('./pages/UsersPage'),               'WarehouseUsersPage');
const ClientUsersPage         = lazyPage(() => import('./pages/UsersPage'),               'ClientUsersPage');
const WarehouseUserDetailPage = lazyPage(() => import('./pages/UserDetailPage'),         'WarehouseUserDetailPage');
const ClientUserDetailPage    = lazyPage(() => import('./pages/UserDetailPage'),          'ClientUserDetailPage');
const LoginPage               = lazyPage(() => import('./pages/LoginPage'),               'LoginPage');
const AuditLogsPage           = lazyPage(() => import('./pages/AuditLogsPage'),           'AuditLogsPage');
const CycleCountListPage      = lazyPage(() => import('./pages/cycle-count/CycleCountListPage'), 'CycleCountListPage');
const CycleCountDetailPage    = lazyPage(() => import('./pages/cycle-count/CycleCountDetailPage'), 'CycleCountDetailPage');
const CycleCountExecutePage   = lazyPage(() => import('./pages/cycle-count/CycleCountExecutePage'), 'CycleCountExecutePage');
const CycleCountMyTasksPage   = lazyPage(() => import('./pages/cycle-count/CycleCountMyTasksPage'), 'CycleCountMyTasksPage');

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
      { path: 'internal', element: <InternalTransferPage /> },
      {
        path: 'reports',
        element: <ReportsLayout />,
        children: [
          { index: true, element: <Navigate to="/reports/warehouse-analysis" replace /> },
          { path: 'warehouse-analysis', element: <WarehouseAnalysisReportPage /> },
          { path: 'inventory', element: <InventoryReportPage /> },
          { path: 'product-moves', element: <ProductMovesReportPage /> },
        ],
      },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'clients/:id', element: <CompanyDetailPage /> },
      { path: 'users', element: <Navigate to="/users/warehouse_users" replace /> },
      { path: 'users/warehouse_users', element: <WarehouseUsersPage /> },
      { path: 'users/warehouse_users/:id', element: <WarehouseUserDetailPage /> },
      { path: 'users/client_users', element: <ClientUsersPage /> },
      { path: 'users/client_users/:id', element: <ClientUserDetailPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
      { path: '*', element: <RoleHomeRedirect /> },
    ],
  },
]);
