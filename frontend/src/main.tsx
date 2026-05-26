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
import './styles.css';

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
            <RouterProvider router={router} />
          </RealtimeProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
