import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { PortalLayout } from './components/PortalLayout';
import { RealtimeProvider } from './realtime/RealtimeProvider';
import { LoginPage } from './pages/LoginPage';
import { InboundOrdersPage } from './pages/InboundOrdersPage';
import { InboundOrderDetailPage } from './pages/InboundOrderDetailPage';
import { OutboundOrdersPage } from './pages/OutboundOrdersPage';
import { OutboundOrderDetailPage } from './pages/OutboundOrderDetailPage';
import { ProductsPage } from './pages/ProductsPage';
import { StockPage } from './pages/StockPage';
import { WelcomePage } from './pages/WelcomePage';

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
          <Route index element={<WelcomePage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="inbound-orders" element={<InboundOrdersPage />} />
          <Route path="inbound-orders/:id" element={<InboundOrderDetailPage />} />
          <Route path="outbound-orders" element={<OutboundOrdersPage />} />
          <Route path="outbound-orders/:id" element={<OutboundOrderDetailPage />} />
          <Route path="stock" element={<StockPage />} />
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
