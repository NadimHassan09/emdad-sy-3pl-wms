/**
 * AppShell — the outer layout scaffolding for both admin and client apps.
 *
 * Structure:
 *   <AppShell>
 *     <AppShell.SkipNav />
 *     <AppShell.Body>           ← flex row with shell gutter gap
 *       <Sidebar />             ← full-height column (logo in SidebarBrand)
 *       <AppShell.Column>       ← topbar + scrollable main
 *         <Topbar />
 *         <AppShell.Main>{page content}</AppShell.Main>
 *       </AppShell.Column>
 *     </AppShell.Body>
 *   </AppShell>
 *
 * Constraint: the sidebar is rendered by the consuming layout file (not
 * directly here) because the navigation structure is app-specific.
 * AppShell just provides the viewport container and body flex context.
 *
 * RTL: the sidebar naturally flips to the end side when dir="rtl" is set
 * on <html> because the flex layout reverses via logical properties.
 * Both sidebar and main use `overflow-hidden / overflow-auto` on the right
 * axes so horizontal table overflow works inside the main area.
 */

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

// ─────────────────────────────────────────────────────────────────────────────
// AppShell root
// ─────────────────────────────────────────────────────────────────────────────

interface AppShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function AppShell({ children, className, ...rest }: AppShellProps) {
  return (
    <div
      data-app-shell
      className={cn(
        'flex h-dvh max-h-dvh w-full flex-col overflow-hidden',
        'bg-[var(--surface-page)] p-2 sm:p-2.5',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppShell.SkipNav — keyboard-only skip link for screen readers & power users
// ─────────────────────────────────────────────────────────────────────────────

AppShell.SkipNav = function AppShellSkipNav() {
  return (
    <a
      href="#main-content"
      className={cn(
        // visually hidden until focused
        'sr-only',
        // when focused: render as a floating pill above the topbar
        'focus:not-sr-only focus:fixed focus:top-3 focus:start-3',
        'focus:z-[9999] focus:px-4 focus:py-2',
        'focus:bg-brand-600 focus:text-white focus:text-sm focus:font-medium',
        'focus:rounded-lg focus:shadow-lg focus:outline-none',
        'focus:ring-2 focus:ring-brand-300',
      )}
    >
      Skip to main content
    </a>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AppShell.Body — sidebar (full height) + column (topbar + main)
// ─────────────────────────────────────────────────────────────────────────────

AppShell.Body = function AppShellBody({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden md:flex-row md:gap-4',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
};

// AppShell.Column — stacks topbar above scrollable main (right of sidebar)
// ─────────────────────────────────────────────────────────────────────────────

AppShell.Column = function AppShellColumn({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col gap-2 md:gap-2.5', className)}
      {...rest}
    >
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AppShell.Main — the scrollable content area
// ─────────────────────────────────────────────────────────────────────────────

interface AppShellMainProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /**
   * Inner padding.
   * Default: `p-5 sm:p-6` — consistent operational content padding.
   * Pass `noPad` to disable and let the page control its own padding.
   */
  noPad?: boolean;
}

AppShell.Main = function AppShellMain({
  children,
  className,
  noPad,
  id,
  ...rest
}: AppShellMainProps) {
  return (
    <main
      id={id ?? 'main-content'}
      tabIndex={-1}
      className={cn(
        'relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden',
        'bg-[var(--surface-page)]',
        // Improve focus outline on programmatic focus (skip nav target)
        'focus-visible:outline-none',
        !noPad && 'px-3 py-3 sm:px-4 sm:py-4',
        className,
      )}
      {...rest}
    >
      {children}
    </main>
  );
};
