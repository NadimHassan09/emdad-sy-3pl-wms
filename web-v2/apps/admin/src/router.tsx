import { lazy, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, useParams } from 'react-router'
import { RequireAuth } from '@/auth/RequireAuth'
import { RoleHomeRedirect } from '@/auth/RoleHomeRedirect'
import { AdminLayout } from '@/layout/AdminLayout'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { NotMigratedYet } from '@/pages/NotMigratedYet'
import { triggerAppUpdate } from '@/hooks/useUpdateDetector'
import manifest from './routes.manifest.json'
import { REPORT_CENTER_PATHS } from '@/lib/reports/report-paths'

/** Lazy page; a failed chunk (new deploy) triggers the update dialog instead of a blank screen. */
function lazyPage<M extends Record<string, ComponentType>>(loader: () => Promise<M>, name: keyof M) {
  return lazy(async () => {
    try {
      const mod = await loader()
      return { default: mod[name] }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('dynamically imported module') || msg.includes('Loading chunk') || msg.includes('Failed to fetch')) triggerAppUpdate()
      throw err
    }
  })
}

const DashboardOverviewPage = lazyPage(() => import('@/features/dashboard/DashboardOverviewPage'), 'DashboardOverviewPage')
const OmsDashboardPage = lazyPage(() => import('@/features/oms/OmsDashboardPage'), 'OmsDashboardPage')
const OmsOrdersListPage = lazyPage(() => import('@/features/oms/OmsOrdersListPage'), 'OmsOrdersListPage')
const OmsOrderCreatePage = lazyPage(() => import('@/features/oms/OmsOrderCreatePage'), 'OmsOrderCreatePage')
const OmsOrderDetailPage = lazyPage(() => import('@/features/oms/OmsOrderDetailPage'), 'OmsOrderDetailPage')
const OmsWaybillPage = lazyPage(() => import('@/features/oms/OmsWaybillPage'), 'OmsWaybillPage')
const OmsCodPage = lazyPage(() => import('@/features/oms/OmsCodPage'), 'OmsCodPage')
const OmsCodDetailPage = lazyPage(() => import('@/features/oms/OmsCodDetailPage'), 'OmsCodDetailPage')
const OmsReturnsPage = lazyPage(() => import('@/features/oms/OmsReturnsPage'), 'OmsReturnsPage')
const OmsBatchesPage = lazyPage(() => import('@/features/oms/OmsBatchesPage'), 'OmsBatchesPage')
const OmsBatchDetailPage = lazyPage(() => import('@/features/oms/OmsBatchDetailPage'), 'OmsBatchDetailPage')
const OmsReturnDetailPage = lazyPage(() => import('@/features/oms/OmsReturnDetailPage'), 'OmsReturnDetailPage')
const OmsReturnPlanEditPage = lazyPage(() => import('@/features/oms/OmsReturnPlanEditPage'), 'OmsReturnPlanEditPage')
const OutboundListPage = lazyPage(() => import('@/features/outbound/OutboundListPage'), 'OutboundListPage')
const OutboundOrderFormPage = lazyPage(() => import('@/features/outbound/OutboundOrderFormPage'), 'OutboundOrderFormPage')
const OutboundDetailPage = lazyPage(() => import('@/features/outbound/OutboundDetailPage'), 'OutboundDetailPage')
const InventoryStockPage = lazyPage(() => import('@/features/inventory/InventoryStockPage'), 'InventoryStockPage')
const InventoryProductDetailPage = lazyPage(
  () => import('@/features/inventory/InventoryProductDetailPage'),
  'InventoryProductDetailPage',
)
const InventoryLedgerPage = lazyPage(() => import('@/features/inventory/InventoryLedgerPage'), 'InventoryLedgerPage')
const InventoryLedgerReferencePage = lazyPage(
  () => import('@/features/inventory/InventoryLedgerReferencePage'),
  'InventoryLedgerReferencePage',
)
const InventoryLedgerEntryPage = lazyPage(
  () => import('@/features/inventory/InventoryLedgerEntryPage'),
  'InventoryLedgerEntryPage',
)
const AdjustmentsListPage = lazyPage(() => import('@/features/inventory/AdjustmentsListPage'), 'AdjustmentsListPage')
const AdjustmentDetailPage = lazyPage(() => import('@/features/inventory/AdjustmentDetailPage'), 'AdjustmentDetailPage')
const InboundListPage = lazyPage(() => import('@/features/inbound/InboundListPage'), 'InboundListPage')
const InboundOrderFormPage = lazyPage(() => import('@/features/inbound/InboundOrderFormPage'), 'InboundOrderFormPage')
const InboundDetailPage = lazyPage(() => import('@/features/inbound/InboundDetailPage'), 'InboundDetailPage')
const TasksListPage = lazyPage(() => import('@/features/tasks/TasksListPage'), 'TasksListPage')
const TaskDetailPage = lazyPage(() => import('@/features/tasks/TaskDetailPage'), 'TaskDetailPage')
const CycleCountListPage = lazyPage(() => import('@/features/cycle-count/CycleCountListPage'), 'CycleCountListPage')
const CycleCountMyTasksPage = lazyPage(
  () => import('@/features/cycle-count/CycleCountMyTasksPage'),
  'CycleCountMyTasksPage',
)
const CycleCountDetailPage = lazyPage(() => import('@/features/cycle-count/CycleCountDetailPage'), 'CycleCountDetailPage')
const CycleCountExecutePage = lazyPage(
  () => import('@/features/cycle-count/CycleCountExecutePage'),
  'CycleCountExecutePage',
)
const ProductsListPage = lazyPage(() => import('@/features/products/ProductsListPage'), 'ProductsListPage')
const ProductDetailPage = lazyPage(() => import('@/features/products/ProductDetailPage'), 'ProductDetailPage')
const LocationsPage = lazyPage(() => import('@/features/locations/LocationsPage'), 'LocationsPage')
const WarehousesPage = lazyPage(() => import('@/features/warehouses/WarehousesPage'), 'WarehousesPage')
const ReturnsListPage = lazyPage(() => import('@/features/wms-returns/ReturnsListPage'), 'ReturnsListPage')
const ReturnDetailPage = lazyPage(() => import('@/features/wms-returns/ReturnDetailPage'), 'ReturnDetailPage')
const ReturnProcessPage = lazyPage(() => import('@/features/wms-returns/ReturnProcessPage'), 'ReturnProcessPage')
const ContractsGrnPage = lazyPage(() => import('@/features/contracts/ContractsGrnPage'), 'ContractsGrnPage')
const ContractsDnPage = lazyPage(() => import('@/features/contracts/ContractsDnPage'), 'ContractsDnPage')
const FinalContractPage = lazyPage(() => import('@/features/contracts/FinalContractPage'), 'FinalContractPage')
const FormsPage = lazyPage(() => import('@/features/forms/FormsPage'), 'FormsPage')
const ShippingCompaniesPage = lazyPage(
  () => import('@/features/shipping/ShippingCompaniesPage'),
  'ShippingCompaniesPage',
)
const InternalTransferPage = lazyPage(
  () => import('@/features/inventory/InternalTransferPage'),
  'InternalTransferPage',
)
const BillingDashboardPage = lazyPage(
  () => import('@/features/billing/BillingDashboardPage'),
  'BillingDashboardPage',
)
const BillingPlansPage = lazyPage(() => import('@/features/billing/BillingPlansPage'), 'BillingPlansPage')
const BillingPlanCreatePage = lazyPage(
  () => import('@/features/billing/BillingPlanCreatePage'),
  'BillingPlanCreatePage',
)
const BillingPlanEditPage = lazyPage(
  () => import('@/features/billing/BillingPlanEditPage'),
  'BillingPlanEditPage',
)
const BillingPlanDetailPage = lazyPage(
  () => import('@/features/billing/BillingPlanDetailPage'),
  'BillingPlanDetailPage',
)
const BillingPlanTemplatesPage = lazyPage(
  () => import('@/features/billing/BillingPlanTemplatesPage'),
  'BillingPlanTemplatesPage',
)
const BillingInvoicesPage = lazyPage(
  () => import('@/features/billing/BillingInvoicesPage'),
  'BillingInvoicesPage',
)
const BillingInvoiceDetailPage = lazyPage(
  () => import('@/features/billing/BillingInvoiceDetailPage'),
  'BillingInvoiceDetailPage',
)
const ClientsListPage = lazyPage(() => import('@/features/clients/ClientsListPage'), 'ClientsListPage')
const CompanyDetailPage = lazyPage(() => import('@/features/clients/CompanyDetailPage'), 'CompanyDetailPage')
const WarehouseUsersPage = lazyPage(() => import('@/features/users/UsersListPage'), 'WarehouseUsersPage')
const ClientUsersPage = lazyPage(() => import('@/features/users/UsersListPage'), 'ClientUsersPage')
const WarehouseUserDetailPage = lazyPage(
  () => import('@/features/users/UserDetailPage'),
  'WarehouseUserDetailPage',
)
const ClientUserDetailPage = lazyPage(() => import('@/features/users/UserDetailPage'), 'ClientUserDetailPage')
const ProfilePage = lazyPage(() => import('@/features/profile/ProfilePage'), 'ProfilePage')
const NotificationsPage = lazyPage(() => import('@/features/notifications/NotificationsPage'), 'NotificationsPage')
const AuditLogsPage = lazyPage(() => import('@/features/audit-logs/AuditLogsPage'), 'AuditLogsPage')
const BackupHistoryPage = lazyPage(() => import('@/features/backups/BackupHistoryPage'), 'BackupHistoryPage')
const BackupSchedulesPage = lazyPage(() => import('@/features/backups/BackupSchedulesPage'), 'BackupSchedulesPage')
const BackupRetentionPage = lazyPage(() => import('@/features/backups/BackupRetentionPage'), 'BackupRetentionPage')
const BackupHealthPage = lazyPage(() => import('@/features/backups/BackupHealthPage'), 'BackupHealthPage')
const BackupGoogleDrivePage = lazyPage(
  () => import('@/features/backups/BackupGoogleDrivePage'),
  'BackupGoogleDrivePage',
)
const ReportPage = lazyPage(() => import('@/features/reports/ReportPage'), 'ReportPage')

const REPORT_NATIVE_ROUTES = Object.fromEntries(
  REPORT_CENTER_PATHS.map((path) => [path, <ReportPage key={path} />]),
) as Record<string, ReactNode>

/** Native (rebuilt) screens, keyed by manifest path. Everything else is a redirect or <NotMigratedYet/>. */
const NATIVE: Record<string, ReactNode> = {
  '/': <RoleHomeRedirect />,
  '/*': <NotFoundPage />,
  '/dashboard/overview': <DashboardOverviewPage />,
  '/oms/dashboard': <OmsDashboardPage />,
  '/orders/oms': <OmsOrdersListPage />,
  '/orders/oms/new': <OmsOrderCreatePage />,
  '/orders/oms/:id': <OmsOrderDetailPage />,
  '/orders/oms/:id/waybill': <OmsWaybillPage />,
  '/oms/orders/:id': <OmsOrderDetailPage />,
  '/oms/orders/:id/waybill': <OmsWaybillPage />,
  '/oms/cod': <OmsCodPage />,
  '/oms/cod/:id': <OmsCodDetailPage />,
  '/oms/returns': <OmsReturnsPage />,
  '/oms/batches': <OmsBatchesPage />,
  '/oms/batches/:id': <OmsBatchDetailPage />,
  '/oms/returns/:id': <OmsReturnDetailPage />,
  '/oms/returns/:id/edit': <OmsReturnPlanEditPage />,
  '/orders/inbound': <InboundListPage />,
  '/orders/inbound/new': <InboundOrderFormPage />,
  '/orders/inbound/:id/edit': <InboundOrderFormPage />,
  '/orders/inbound/:id': <InboundDetailPage />,
  '/orders/outbound': <OutboundListPage />,
  '/orders/outbound/new': <OutboundOrderFormPage />,
  '/orders/outbound/:id/edit': <OutboundOrderFormPage />,
  '/orders/outbound/:id': <OutboundDetailPage />,
  '/inventory/stock': <InventoryStockPage />,
  '/inventory/product/:productId': <InventoryProductDetailPage />,
  '/inventory/ledger': <InventoryLedgerPage />,
  '/inventory/ledger/:referenceType/:referenceId': <InventoryLedgerReferencePage />,
  '/inventory/ledger/line/:ledgerId/:createdAt': <InventoryLedgerEntryPage />,
  '/inventory/adjustments': <AdjustmentsListPage />,
  '/inventory/adjustments/:id': <AdjustmentDetailPage />,
  '/tasks': <TasksListPage />,
  '/tasks/:id': <TaskDetailPage />,
  '/cycle-count': <CycleCountListPage />,
  '/cycle-count/my-tasks': <CycleCountMyTasksPage />,
  '/cycle-count/:id': <CycleCountDetailPage />,
  '/cycle-count/:id/execute': <CycleCountExecutePage />,
  '/products': <ProductsListPage />,
  '/products/:sku': <ProductDetailPage />,
  '/locations': <LocationsPage />,
  '/warehouses': <WarehousesPage />,
  '/returns': <ReturnsListPage />,
  '/returns/:id': <ReturnDetailPage />,
  '/returns/:id/process': <ReturnProcessPage />,
  '/billing/dashboard': <BillingDashboardPage />,
  '/billing/plans': <BillingPlansPage />,
  '/billing/plans/new': <BillingPlanCreatePage />,
  '/billing/plans/:clientId/edit': <BillingPlanEditPage />,
  '/billing/plans/:clientId': <BillingPlanDetailPage />,
  '/billing/templates': <BillingPlanTemplatesPage />,
  '/billing/invoices': <BillingInvoicesPage />,
  '/billing/invoices/:id': <BillingInvoiceDetailPage />,
  '/clients': <ClientsListPage />,
  '/clients/:id': <CompanyDetailPage />,
  '/users/warehouse_users': <WarehouseUsersPage />,
  '/users/warehouse_users/:id': <WarehouseUserDetailPage />,
  '/users/client_users': <ClientUsersPage />,
  '/users/client_users/:id': <ClientUserDetailPage />,
  '/profile': <ProfilePage />,
  '/notifications': <NotificationsPage />,
  '/audit-logs': <AuditLogsPage />,
  '/backups': <BackupHistoryPage />,
  '/backups/schedules': <BackupSchedulesPage />,
  '/backups/retention': <BackupRetentionPage />,
  '/backups/health': <BackupHealthPage />,
  '/backups/google-drive': <BackupGoogleDrivePage />,
  '/contracts/grn': <ContractsGrnPage />,
  '/contracts/dn': <ContractsDnPage />,
  '/contracts/final-contract': <FinalContractPage />,
  '/forms': <FormsPage />,
  '/shipping/companies': <ShippingCompaniesPage />,
  '/internal': <InternalTransferPage />,
  ...REPORT_NATIVE_ROUTES,
}

type ManifestRoute = { path: string; status: 'native' | 'redirect' | 'notMigrated'; redirectTo?: string }

/** Redirect that substitutes `:params` from the matched path. */
function RedirectWithParams({ to }: { to: string }) {
  const params = useParams()
  const target = to.replace(/:(\w+)/g, (_, k: string) => encodeURIComponent(params[k] ?? ''))
  return <Navigate to={target} replace />
}

const routes = (manifest.routes as ManifestRoute[]).filter((r) => r.path !== '/login')

function elementFor(r: ManifestRoute): ReactNode {
  if (r.status === 'native') return NATIVE[r.path] ?? <NotMigratedYet />
  if (r.status === 'redirect' && r.redirectTo) return <RedirectWithParams to={r.redirectTo} />
  return <NotMigratedYet />
}

/** Data router (needed by the realtime module sync + future `useBlocker`). */
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    children: routes.map((r) =>
      r.path === '/' ? { index: true, element: elementFor(r) } : { path: r.path.replace(/^\//, ''), element: elementFor(r) },
    ),
  },
])
