import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/ToastProvider';
import { queryClient } from './lib/queryClient';
import { RealtimeProvider } from './realtime/RealtimeProvider';
import { getApiBaseUrl } from './api/apiBaseUrl';
import { router } from './router';
import { socketHttpOrigin } from './realtime/socketBaseUrl';
import { AppUpdateModal } from './components/AppUpdateModal';
import { triggerAppUpdate } from './hooks/useUpdateDetector';
import './styles.css';

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    if (
      msg.includes('dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch')
    ) {
      triggerAppUpdate();
    }
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = reason instanceof Error ? reason.message : String(reason ?? '');
    if (
      msg.includes('dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch')
    ) {
      triggerAppUpdate();
    }
  });
}

if (import.meta.env.DEV) {
  const api = getApiBaseUrl();
  const socket = socketHttpOrigin();
  // eslint-disable-next-line no-console
  console.info(`[wms] API ${api} · realtime ${socket}/realtime`);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RealtimeProvider>
            <AppUpdateModal />
            <RouterProvider router={router} />
          </RealtimeProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
