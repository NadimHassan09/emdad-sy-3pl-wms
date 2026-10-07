import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { UiPreferencesProvider, useUiPreferences } from '@emdad/core'
import { UiProviders } from '@emdad/ui'
import { AuthProvider } from '@/auth/AuthContext'
import { queryClient } from '@/lib/queryClient'
import { RealtimeProvider } from '@/realtime/RealtimeProvider'
import { AppUpdateDialog } from '@/layout/AppUpdateDialog'
import { triggerAppUpdate } from '@/hooks/useUpdateDetector'
import { router } from './router'
import './styles.css'

const isChunkError = (msg: string) => msg.includes('dynamically imported module') || msg.includes('Loading chunk') || msg.includes('Failed to fetch')
window.addEventListener('error', (e) => isChunkError(e?.message || '') && triggerAppUpdate())
window.addEventListener('unhandledrejection', (e) => {
  const r = e?.reason
  if (isChunkError(r instanceof Error ? r.message : String(r ?? ''))) triggerAppUpdate()
})

function Providers({ children }: { children: React.ReactNode }) {
  const { dir, theme } = useUiPreferences()
  return <UiProviders dir={dir} theme={theme}>{children}</UiProviders>
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <UiPreferencesProvider themeStorageKey="admin-ui-theme">
      <QueryClientProvider client={queryClient}>
        <Providers>
          <AuthProvider>
            <RealtimeProvider>
              <AppUpdateDialog />
              <RouterProvider router={router} />
            </RealtimeProvider>
          </AuthProvider>
        </Providers>
      </QueryClientProvider>
    </UiPreferencesProvider>
  </React.StrictMode>,
)
