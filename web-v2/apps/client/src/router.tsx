import { lazy, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, useParams } from 'react-router'
import { RequireAuth } from '@/auth/RequireAuth'
import { PortalLayout } from '@/layout/PortalLayout'
import { AccountStatusPage } from '@/pages/AccountStatusPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { NotMigratedYet } from '@/pages/NotMigratedYet'
import { triggerAppUpdate } from '@/hooks/useUpdateDetector'
import manifest from './routes.manifest.json'

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

const ClientDashboardPage = lazyPage(() => import('@/features/dashboard/ClientDashboardPage'), 'ClientDashboardPage')

const ProductsListPage = lazyPage(() => import('@/features/products/ProductsListPage'), 'ProductsListPage')
const ProductCreatePage = lazyPage(() => import('@/features/products/ProductCreatePage'), 'ProductCreatePage')
const ProductDetailPage = lazyPage(() => import('@/features/products/ProductDetailPage'), 'ProductDetailPage')
const ProductEditPage = lazyPage(() => import('@/features/products/ProductEditPage'), 'ProductEditPage')

const InboundListPage = lazyPage(() => import('@/features/inbound/InboundListPage'), 'InboundListPage')
const InboundCreatePage = lazyPage(() => import('@/features/inbound/InboundCreatePage'), 'InboundCreatePage')
const InboundDetailPage = lazyPage(() => import('@/features/inbound/InboundDetailPage'), 'InboundDetailPage')

const OutboundListPage = lazyPage(() => import('@/features/outbound/OutboundListPage'), 'OutboundListPage')
const OutboundCreatePage = lazyPage(() => import('@/features/outbound/OutboundCreatePage'), 'OutboundCreatePage')
const OutboundDetailPage = lazyPage(() => import('@/features/outbound/OutboundDetailPage'), 'OutboundDetailPage')
const OutboundReturnsListPage = lazyPage(
  () => import('@/features/returns/OutboundReturnsListPage'),
  'OutboundReturnsListPage',
)
const OutboundReturnCreatePage = lazyPage(
  () => import('@/features/returns/OutboundReturnCreatePage'),
  'OutboundReturnCreatePage',
)
const OutboundReturnDetailPage = lazyPage(
  () => import('@/features/returns/OutboundReturnDetailPage'),
  'OutboundReturnDetailPage',
)

const EcommerceOrdersListPage = lazyPage(
  () => import('@/features/oms/EcommerceOrdersListPage'),
  'EcommerceOrdersListPage',
)
const EcommerceOrderCreatePage = lazyPage(
  () => import('@/features/oms/EcommerceOrderCreatePage'),
  'EcommerceOrderCreatePage',
)
const EcommerceOrderDetailPage = lazyPage(
  () => import('@/features/oms/EcommerceOrderDetailPage'),
  'EcommerceOrderDetailPage',
)
const OmsReturnsListPage = lazyPage(() => import('@/features/oms/OmsReturnsListPage'), 'OmsReturnsListPage')
const OmsReturnCreatePage = lazyPage(() => import('@/features/oms/OmsReturnCreatePage'), 'OmsReturnCreatePage')
const OmsReturnDetailPage = lazyPage(() => import('@/features/oms/OmsReturnDetailPage'), 'OmsReturnDetailPage')
const CodReportsPage = lazyPage(() => import('@/features/oms/CodReportsPage'), 'CodReportsPage')

const BillingPage = lazyPage(() => import('@/features/billing/BillingPage'), 'BillingPage')
const InvoicesListPage = lazyPage(() => import('@/features/billing/InvoicesListPage'), 'InvoicesListPage')
const InvoiceDetailPage = lazyPage(() => import('@/features/billing/InvoiceDetailPage'), 'InvoiceDetailPage')
const ApisPage = lazyPage(() => import('@/features/apis/ApisPage'), 'ApisPage')
const NotificationsPage = lazyPage(
  () => import('@/features/notifications/NotificationsPage'),
  'NotificationsPage',
)
const ProfilePage = lazyPage(() => import('@/features/profile/ProfilePage'), 'ProfilePage')

/** Native (rebuilt) screens, keyed by manifest path. Everything else is a redirect or <NotMigratedYet/>. */
const NATIVE: Record<string, ReactNode> = {
  '/dashboard': <ClientDashboardPage />,
  '/products': <ProductsListPage />,
  '/products/new': <ProductCreatePage />,
  '/products/:id': <ProductDetailPage />,
  '/products/:id/edit': <ProductEditPage />,
  '/inbound-orders': <InboundListPage />,
  '/inbound-orders/new': <InboundCreatePage />,
  '/inbound-orders/:id': <InboundDetailPage />,
  '/outbound-orders': <OutboundListPage />,
  '/outbound-orders/new': <OutboundCreatePage />,
  '/outbound-orders/:id': <OutboundDetailPage />,
  '/outbound-orders/returns': <OutboundReturnsListPage />,
  '/outbound-orders/returns/new': <OutboundReturnCreatePage />,
  '/outbound-orders/returns/:id': <OutboundReturnDetailPage />,
  '/ecommerce-orders': <EcommerceOrdersListPage />,
  '/ecommerce-orders/new': <EcommerceOrderCreatePage />,
  '/ecommerce-orders/:id': <EcommerceOrderDetailPage />,
  '/ecommerce-orders/returns': <OmsReturnsListPage />,
  '/ecommerce-orders/returns/new': <OmsReturnCreatePage />,
  '/ecommerce-orders/returns/:id': <OmsReturnDetailPage />,
  '/my-profits': <CodReportsPage />,
  '/billing': <BillingPage />,
  '/invoices': <InvoicesListPage />,
  '/invoices/:id': <InvoiceDetailPage />,
  '/apis': <ApisPage />,
  '/notifications': <NotificationsPage />,
  '/profile': <ProfilePage />,
  '*': <NotFoundPage />,
}

type ManifestRoute = { path: string; status: 'native' | 'redirect' | 'notMigrated'; redirectTo?: string }

/** Redirect that carries `:params` from the matched path (e.g. /returns/:id → /ecommerce-orders/returns/:id). */
function RedirectWithParams({ to }: { to: string }) {
  const params = useParams()
  const target = to.replace(/:(\w+)/g, (_, k: string) => encodeURIComponent(params[k] ?? ''))
  return <Navigate to={target} replace />
}

function elementFor(r: ManifestRoute): ReactNode {
  if (r.status === 'native') return NATIVE[r.path] ?? <NotMigratedYet />
  if (r.status === 'redirect' && r.redirectTo) return <RedirectWithParams to={r.redirectTo} />
  return <NotMigratedYet />
}

const OUTSIDE_LAYOUT = new Set(['/login', '/account-inactive'])
const routes = (manifest.routes as ManifestRoute[]).filter((r) => !OUTSIDE_LAYOUT.has(r.path))

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/account-inactive', element: <AccountStatusPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <PortalLayout />
      </RequireAuth>
    ),
    children: routes.map((r) =>
      r.path === '/' ? { index: true, element: elementFor(r) } : { path: r.path.replace(/^\//, ''), element: elementFor(r) },
    ),
  },
])
