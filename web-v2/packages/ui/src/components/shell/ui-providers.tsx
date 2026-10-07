import type { ReactNode } from 'react'
import { Direction } from 'radix-ui'
import { TooltipProvider } from '@ui/components/ui/tooltip'
import { Toaster } from '@ui/components/ui/sonner'

/** Wires Radix direction (menus, popovers, sheets, tooltips mirror in RTL), tooltips and toasts. */
export function UiProviders({ dir, theme, children }: { dir: 'ltr' | 'rtl'; theme: 'light' | 'dark'; children: ReactNode }) {
  return (
    <Direction.Provider dir={dir}>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster theme={theme} position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'} richColors closeButton dir={dir} />
      </TooltipProvider>
    </Direction.Provider>
  )
}
