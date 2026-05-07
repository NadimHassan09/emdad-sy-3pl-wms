import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/ToastProvider';
import { queryClient } from './lib/queryClient';
import { RealtimeProvider } from './realtime/RealtimeProvider';
import { router } from './router';
import './styles.css';

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
