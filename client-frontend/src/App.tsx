import { lazy, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { RequireRouteAccess } from './auth/RequireRouteAccess';
import { PortalLayout } from './components/PortalLayout';
import { RealtimeProvider } from './realtime/RealtimeProvider';

// ─────────────────────────────────────────────────────────────────────────────
// Lazy page imports — each becomes a separate JS chunk at build time.
// Suspense boundary lives in PortalLayout.tsx wrapping the <Outlet />.
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

const LoginPage             = lazyPage(() => import('./pages/LoginPage'),             'LoginPage');
const AccountStatusPage     = lazyPage(() => import('./pages/AccountStatusPage'),     'AccountStatusPage');
const InboundOrdersPage     = lazyPage(() => import('./pages/InboundOrdersPage'),     'InboundOrdersPage');
const CreateInboundOrderPage = lazyPage(() => import('./pages/CreateInboundOrderPage'), 'CreateInboundOrderPage');
const InboundOrderDetailPage = lazyPage(() => import('./pages/InboundOrderDetailPage'), 'InboundOrderDetailPage');
const OutboundOrdersPage    = lazyPage(() => import('./pages/OutboundOrdersPage'),    'OutboundOrdersPage');
const CreateOutboundOrderPage = lazyPage(() => import('./pages/CreateOutboundOrderPage'), 'CreateOutboundOrderPage');
const OutboundOrderDetailPage = lazyPage(() => import('./pages/OutboundOrderDetailPage'), 'OutboundOrderDetailPage');
const EcommerceOrdersPage   = lazyPage(() => import('./pages/EcommerceOrdersPage'),   'EcommerceOrdersPage');
const CreateEcommerceOrderPage = lazyPage(() => import('./pages/CreateEcommerceOrderPage'), 'CreateEcommerceOrderPage');
const EcommerceOrderDetailPage = lazyPage(() => import('./pages/EcommerceOrderDetailPage'), 'EcommerceOrderDetailPage');
const CodReportsPage          = lazyPage(() => import('./pages/CodReportsPage'),          'CodReportsPage');
const EcommerceReturnsPage    = lazyPage(() => import('./pages/ReturnsListPage'),         'EcommerceReturnsPage');
const OutboundReturnsPage     = lazyPage(() => import('./pages/ReturnsListPage'),         'OutboundReturnsPage');
const CreateEcommerceReturnPage = lazyPage(() => import('./pages/CreateReturnPage'),     'CreateEcommerceReturnPage');
const CreateOutboundReturnPage  = lazyPage(() => import('./pages/CreateReturnPage'),     'CreateOutboundReturnPage');
const ReturnDetailPage        = lazyPage(() => import('./pages/ReturnDetailPage'),        'ReturnDetailPage');
const ProductsPage          = lazyPage(() => import('./pages/ProductsPage'),          'ProductsPage');
const CreateProductPage     = lazyPage(() => import('./pages/CreateProductPage'),     'CreateProductPage');
const EditProductPage       = lazyPage(() => import('./pages/EditProductPage'),       'EditProductPage');
const ProductDetailPage     = lazyPage(() => import('./pages/ProductDetailPage'),     'ProductDetailPage');
const DashboardPage         = lazyPage(() => import('./pages/DashboardPage'),         'DashboardPage');
const BillingPage           = lazyPage(() => import('./pages/BillingPage'),           'BillingPage');
const InvoicesPage          = lazyPage(() => import('./pages/InvoicesPage'),          'InvoicesPage');
const BillingInvoiceDetailPage = lazyPage(() => import('./pages/BillingInvoiceDetailPage'), 'BillingInvoiceDetailPage');
const NotificationsPage       = lazyPage(() => import('./pages/NotificationsPage'),       'NotificationsPage');
const ProfilePage             = lazyPage(() => import('./pages/ProfilePage'),             'ProfilePage');
const ApisPage                = lazyPage(() => import('./pages/ApisPage'),                'ApisPage');
const NotFoundPage            = lazyPage(() => import('./pages/NotFoundPage'),            'NotFoundPage');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: true },
  },
});

function LegacyBillingInvoiceRedirect(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  return <Navigate to={`/invoices/${id}`} replace />;
}

function LegacyReturnRedirect(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  return <Navigate to={`/ecommerce-orders/returns/${id}`} replace />;
}

function AppRoutes(): ReactElement {
  const navigate = useNavigate();
  return (
    <AuthProvider onSessionInvalid={() => navigate('/login', { replace: true })}>
      <RealtimeProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/account-inactive" element={<AccountStatusPage />} />
          <Route
            element={
              <RequireAuth>
                <PortalLayout />
              </RequireAuth>
            }
          >
            <Route
              path="dashboard"
              element={
                <RequireRouteAccess>
                  <DashboardPage />
                </RequireRouteAccess>
              }
            />
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route
              path="products"
              element={
                <RequireRouteAccess>
                  <ProductsPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="products/new"
              element={
                <RequireRouteAccess>
                  <CreateProductPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="products/:id/edit"
              element={
                <RequireRouteAccess>
                  <EditProductPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="products/:id"
              element={
                <RequireRouteAccess>
                  <ProductDetailPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="inbound-orders"
              element={
                <RequireRouteAccess>
                  <InboundOrdersPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="inbound-orders/new"
              element={
                <RequireRouteAccess>
                  <CreateInboundOrderPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="inbound-orders/:id"
              element={
                <RequireRouteAccess>
                  <InboundOrderDetailPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="outbound-orders"
              element={
                <RequireRouteAccess>
                  <OutboundOrdersPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="outbound-orders/new"
              element={
                <RequireRouteAccess>
                  <CreateOutboundOrderPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="outbound-orders/returns"
              element={
                <RequireRouteAccess>
                  <OutboundReturnsPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="outbound-orders/returns/new"
              element={
                <RequireRouteAccess>
                  <CreateOutboundReturnPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="outbound-orders/returns/:id"
              element={
                <RequireRouteAccess>
                  <ReturnDetailPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="outbound-orders/:id"
              element={
                <RequireRouteAccess>
                  <OutboundOrderDetailPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="ecommerce-orders"
              element={
                <RequireRouteAccess>
                  <EcommerceOrdersPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="ecommerce-orders/new"
              element={
                <RequireRouteAccess>
                  <CreateEcommerceOrderPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="ecommerce-orders/returns"
              element={
                <RequireRouteAccess>
                  <EcommerceReturnsPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="ecommerce-orders/returns/new"
              element={
                <RequireRouteAccess>
                  <CreateEcommerceReturnPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="ecommerce-orders/returns/:id"
              element={
                <RequireRouteAccess>
                  <ReturnDetailPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="ecommerce-orders/:id"
              element={
                <RequireRouteAccess>
                  <EcommerceOrderDetailPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="my-profits"
              element={
                <RequireRouteAccess>
                  <CodReportsPage />
                </RequireRouteAccess>
              }
            />
            <Route path="cod-reports" element={<Navigate to="/my-profits" replace />} />
            <Route path="returns" element={<Navigate to="/ecommerce-orders/returns" replace />} />
            <Route path="returns/new" element={<Navigate to="/ecommerce-orders/returns/new" replace />} />
            <Route path="returns/:id" element={<LegacyReturnRedirect />} />
            <Route
              path="billing"
              element={
                <RequireRouteAccess>
                  <BillingPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="invoices"
              element={
                <RequireRouteAccess>
                  <InvoicesPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="invoices/:id"
              element={
                <RequireRouteAccess>
                  <BillingInvoiceDetailPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="apis"
              element={
                <RequireRouteAccess>
                  <ApisPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="billing/invoices/:id"
              element={<LegacyBillingInvoiceRedirect />}
            />
            <Route
              path="notifications"
              element={
                <RequireRouteAccess>
                  <NotificationsPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="profile"
              element={
                <RequireRouteAccess>
                  <ProfilePage />
                </RequireRouteAccess>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </RealtimeProvider>
    </AuthProvider>
  );
}

export default function App(): ReactElement {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppRoutes />
      </QueryClientProvider>
    </BrowserRouter>
  );
}
