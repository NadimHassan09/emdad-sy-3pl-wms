/**
 * Sidebar — premium dark enterprise nav sidebar.
 *
 * Visual direction (Phase 5 premium pass):
 *   - Dark forest green vertical gradient (--sidebar-bg-gradient)
 *   - Brand area is transparent over the gradient
 *   - Active items: bright emerald-500 pill with white text + shadow
 *   - Hover items: white/8% tint (subtle depth on dark)
 *   - Section labels: emerald-100/60 small caps
 *   - Dividers: white/8% border
 *   - Footer: deeper tone band with white/8% separator
 *
 * RTL: uses logical CSS properties throughout.
 * Compact mode: icon-only at 56px width.
 */

import {
  type HTMLAttributes,
  type ReactNode,
  useState,
} from 'react';
import { cn } from './cn';

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar container
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarProps extends HTMLAttributes<HTMLElement> {
  collapsed?: boolean;
  children: ReactNode;
}

export function Sidebar({ collapsed, children, className, ...rest }: SidebarProps) {
  return (
    <aside
      data-collapsed={collapsed ? 'true' : undefined}
      data-sidebar
      className={cn(
        'relative z-[var(--z-sidebar)] hidden min-h-0 shrink-0 flex-col self-stretch md:flex',
        'h-full overflow-hidden rounded-xl md:rounded-[var(--radius-card)]',
        'transition-[width] duration-300 ease-emphasis',
        collapsed
          ? 'w-[var(--sidebar-compact-w)] md:w-[var(--sidebar-compact-w)]'
          : 'w-[var(--sidebar-w)] md:w-[var(--sidebar-w)]',
        className,
      )}
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        backgroundImage: 'var(--sidebar-bg-gradient)',
      }}
      {...rest}
    >
      {children}
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SidebarBrand — top area (logo / product name)
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarBrandProps {
  collapsed?: boolean;
  logo?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function SidebarBrand({ collapsed, logo, children, className }: SidebarBrandProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2.5',
        'overflow-hidden whitespace-nowrap',
        'h-11',
        collapsed ? 'px-0' : 'px-3',
        className,
      )}
      style={{ backgroundColor: 'var(--sidebar-brand-bg)' }}
    >
      {logo && (
        <span className="shrink-0 flex items-center justify-center">
          {logo}
        </span>
      )}
      {!collapsed && children && (
        <span
          className="min-w-0 truncate text-sm font-bold tracking-tight"
          style={{ color: 'var(--sidebar-text)' }}
        >
          {children}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SidebarNav — the scrollable nav area
// ─────────────────────────────────────────────────────────────────────────────

export function SidebarNav({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        'flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden',
        'p-2',
        className,
      )}
    >
      {children}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SidebarSection — collapsible navigation group
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarSectionProps {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapsed?: boolean;
  className?: string;
}

export function SidebarSection({
  label,
  icon,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  collapsed,
  className,
}: SidebarSectionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    onOpenChange ? onOpenChange(next) : setUncontrolledOpen(next);
  };

  if (collapsed) {
    return (
      <div className={cn('flex flex-col', className)}>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(
            'flex h-9 w-full items-center justify-center rounded-lg',
            'transition-colors duration-fast ease-standard',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
          )}
          style={{
            color: 'var(--sidebar-icon-muted)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--sidebar-hover-bg)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--sidebar-text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--sidebar-icon-muted)';
          }}
        >
          {icon && <span className="h-4 w-4 shrink-0">{icon}</span>}
        </button>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpen(!isOpen)}
        className={cn(
          'flex h-7 w-full items-center gap-2 rounded-md px-2 mt-1',
          'text-left text-[10px] font-bold uppercase tracking-widest',
          'transition-colors duration-fast ease-standard',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
        )}
        style={{ color: 'var(--sidebar-text-muted)' }}
      >
        {icon && (
          <span className="h-3 w-3 shrink-0" aria-hidden="true" style={{ color: 'var(--sidebar-text-muted)' }}>
            {icon}
          </span>
        )}
        <span className="flex-1 truncate">{label}</span>
        <svg
          width="10" height="10"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className={cn(
            'shrink-0 transition-transform duration-fast ease-standard',
            isOpen && 'rotate-90',
          )}
          style={{ color: 'var(--sidebar-text-muted)' }}
        >
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-0.5 flex flex-col gap-px">
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SidebarLink — a navigation item
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarLinkProps extends HTMLAttributes<HTMLAnchorElement> {
  href: string;
  isActive?: boolean;
  icon?: ReactNode;
  collapsed?: boolean;
  nested?: boolean;
}

export function SidebarLink({
  href,
  isActive,
  icon,
  collapsed,
  nested,
  children,
  className,
  onClick,
  ...rest
}: SidebarLinkProps) {
  const base = cn(
    'flex items-center gap-2 rounded-lg text-[13px] font-medium leading-tight',
    'transition-[background-color,color,box-shadow] duration-fast ease-standard',
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
    collapsed
      ? 'h-7 w-7 justify-center p-0 rounded-md'
      : nested
      ? 'px-2 py-0.5'
      : 'px-2 py-1',
    className,
  );

  const activeStyle = isActive
    ? {
        backgroundColor: 'var(--sidebar-active-bg)',
        color: 'var(--sidebar-active-text)',
        fontWeight: '600',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }
    : {};

  return (
    <a
      href={href}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? String(children) : undefined}
      className={base}
      style={
        isActive
          ? activeStyle
          : { color: 'var(--sidebar-text)' }
      }
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--sidebar-hover-bg)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '';
        }
      }}
      onClick={onClick}
      {...rest}
    >
      {icon && (
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          aria-hidden="true"
          style={{
            color: isActive ? 'rgba(255,255,255,0.95)' : 'var(--sidebar-icon-muted)',
          }}
        >
          {icon}
        </span>
      )}
      {!collapsed && (
        <span className="flex-1 truncate">{children}</span>
      )}
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SidebarDivider
// ─────────────────────────────────────────────────────────────────────────────

export function SidebarDivider({ className }: { className?: string }) {
  return (
    <hr
      className={cn('my-1.5 border-0 border-t', className)}
      style={{ borderColor: 'var(--sidebar-border)' }}
      aria-hidden="true"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SidebarFooter
// ─────────────────────────────────────────────────────────────────────────────

export function SidebarFooter({
  children,
  collapsed,
  className,
}: {
  children?: ReactNode;
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mt-auto flex flex-col gap-1',
        collapsed ? 'p-2 items-center' : 'p-2',
        className,
      )}
      style={{
        backgroundColor: 'transparent',
        borderTop: '1px solid var(--sidebar-border)',
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SidebarCollapseButton
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarCollapseButtonProps {
  collapsed?: boolean;
  onToggle: () => void;
  expandLabel?: string;
  collapseLabel?: string;
}

export function SidebarCollapseButton({
  collapsed,
  onToggle,
  expandLabel = 'Expand sidebar',
  collapseLabel = 'Collapse sidebar',
}: SidebarCollapseButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? expandLabel : collapseLabel}
      title={collapsed ? expandLabel : collapseLabel}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium',
        'transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
        collapsed && 'justify-center px-0 w-9 h-9',
      )}
      style={{ color: 'var(--sidebar-text-muted)' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--sidebar-hover-bg)';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--sidebar-text)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '';
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--sidebar-text-muted)';
      }}
    >
      <svg
        width="14" height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
        className={cn('shrink-0 transition-transform duration-fast', collapsed && 'rotate-180')}
      >
        <path d="M9 2L4 7l5 5" />
        <path d="M5 2L0 7l5 5" transform="translate(4,0)" />
      </svg>
      {!collapsed && <span>Collapse</span>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MobileSidebarOverlay
// ─────────────────────────────────────────────────────────────────────────────

interface MobileSidebarOverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function MobileSidebarOverlay({ open, onClose, children }: MobileSidebarOverlayProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-mob-overlay)] flex md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm"
        aria-label="Close menu"
        onClick={onClose}
      />

      {/* Sidebar panel — same dark green as desktop sidebar */}
      <div
        className={cn(
          'relative z-[var(--z-mob-sidebar)]',
          'flex h-full flex-col',
          'w-[var(--sidebar-w)] max-w-[85vw] overflow-hidden',
          'shadow-2xl',
        )}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          backgroundImage: 'var(--sidebar-bg-gradient)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
