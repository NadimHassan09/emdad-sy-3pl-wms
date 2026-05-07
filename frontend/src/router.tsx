import { createBrowserRouter, Navigate } from 'react-router-dom';

import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { AdjustmentsPage } from './pages/AdjustmentsPage';
import { InboundDetailPage } from './pages/InboundDetailPage';
import { InboundListPage } from './pages/InboundListPage';
import { InventoryLedgerPage } from './pages/InventoryLedgerPage';
import { InventoryLedgerEntryPage } from './pages/InventoryLedgerEntryPage';
import { InventoryLedgerReferencePage } from './pages/InventoryLedgerReferencePage';
import { InventoryPage } from './pages/InventoryPage';
import { InventoryProductDetailPage } from './pages/InventoryProductDetailPage';
import { LocationsPage } from './pages/LocationsPage';
import { OutboundDetailPage } from './pages/OutboundDetailPage';
import { OutboundListPage } from './pages/OutboundListPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProductsPage } from './pages/ProductsPage';
import { TaskDetailPage } from './pages/TaskDetailPage';
import { TaskExecutePage } from './pages/TaskExecutePage';
import { TasksListPage } from './pages/TasksListPage';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardOverviewPage } from './pages/DashboardOverviewPage';
import { UsersPage } from './pages/UsersPage';
import { LoginPage } from './pages/LoginPage';
import { InternalTransferPage } from './pages/InternalTransferPage';

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
      { index: true, element: <Navigate to="/dashboard/overview" replace /> },
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
      { path: 'inbound', element: <Navigate to="/orders/inbound" replace /> },
      { path: 'outbound', element: <Navigate to="/orders/outbound" replace /> },
      { path: 'orders/inbound', element: <InboundListPage /> },
      { path: 'orders/inbound/:id', element: <InboundDetailPage /> },
      { path: 'orders/outbound', element: <OutboundListPage /> },
      { path: 'orders/outbound/:id', element: <OutboundDetailPage /> },
      { path: 'tasks', element: <TasksListPage /> },
      { path: 'tasks/:id/execute', element: <TaskExecutePage /> },
      { path: 'tasks/:id', element: <TaskDetailPage /> },
      { path: 'internal', element: <InternalTransferPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: '*', element: <Navigate to="/dashboard/overview" replace /> },
    ],
  },
]);
