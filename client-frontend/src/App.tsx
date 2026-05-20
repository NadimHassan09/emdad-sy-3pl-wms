import { lazy, type ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';

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
const InboundOrdersPage     = lazyPage(() => import('./pages/InboundOrdersPage'),     'InboundOrdersPage');
const InboundOrderDetailPage = lazyPage(() => import('./pages/InboundOrderDetailPage'), 'InboundOrderDetailPage');
const OutboundOrdersPage    = lazyPage(() => import('./pages/OutboundOrdersPage'),    'OutboundOrdersPage');
const OutboundOrderDetailPage = lazyPage(() => import('./pages/OutboundOrderDetailPage'), 'OutboundOrderDetailPage');
const ProductsPage          = lazyPage(() => import('./pages/ProductsPage'),          'ProductsPage');
const StockPage             = lazyPage(() => import('./pages/StockPage'),             'StockPage');
const WelcomePage           = lazyPage(() => import('./pages/WelcomePage'),           'WelcomePage');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: true },
  },
});

function AppRoutes(): ReactElement {
  const navigate = useNavigate();
  return (
    <AuthProvider onSessionInvalid={() => navigate('/login', { replace: true })}>
      <RealtimeProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <PortalLayout />
              </RequireAuth>
            }
          >
            <Route
              index
              element={
                <RequireRouteAccess>
                  <WelcomePage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="products"
              element={
                <RequireRouteAccess>
                  <ProductsPage />
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
              path="outbound-orders/:id"
              element={
                <RequireRouteAccess>
                  <OutboundOrderDetailPage />
                </RequireRouteAccess>
              }
            />
            <Route
              path="stock"
              element={
                <RequireRouteAccess>
                  <StockPage />
                </RequireRouteAccess>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
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
