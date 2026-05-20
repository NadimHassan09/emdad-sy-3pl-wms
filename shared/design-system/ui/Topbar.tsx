/**
 * Topbar — the sticky application chrome bar.
 *
 * Phase 5 visual update: dark forest green background (#0f3d2e).
 * TopbarUserMenu: profile avatar opens a portaled dropdown (language + sign out).
 */

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';

const MENU_WIDTH = 240;
const MENU_TOP = 100;
const VIEWPORT_PAD = 16;

// ─────────────────────────────────────────────────────────────────────────────
// Topbar root
// ─────────────────────────────────────────────────────────────────────────────

interface TopbarProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  transparent?: boolean;
}

export function Topbar({ children, transparent, className, ...rest }: TopbarProps) {
  return (
    <header
      data-topbar
      className={cn(
        'z-[var(--z-topbar)] w-full shrink-0 overflow-hidden rounded-2xl md:rounded-3xl',
        'flex min-h-[var(--topbar-h)] items-center gap-3',
        'px-8 py-6',
        transparent ? 'bg-transparent' : '',
        className,
      )}
      style={
        transparent
          ? undefined
          : {
              backgroundColor: 'var(--sidebar-brand-bg)',
              borderBottom: '1px solid var(--sidebar-border)',
            }
      }
      {...rest}
    >
      {children}
    </header>
  );
}

Topbar.Start = function TopbarStart({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex min-w-0 flex-1 items-center gap-2', className)}
      {...rest}
    >
      {children}
    </div>
  );
};

Topbar.End = function TopbarEnd({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex shrink-0 items-center gap-2 ms-auto', className)}
      {...rest}
    >
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TopbarMobileMenuButton
// ─────────────────────────────────────────────────────────────────────────────

interface TopbarMobileMenuButtonProps {
  onClick: () => void;
  label?: string;
}

export function TopbarMobileMenuButton({
  onClick,
  label = 'Open navigation menu',
}: TopbarMobileMenuButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg md:hidden',
        'transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
      )}
      style={{
        backgroundColor: 'var(--sidebar-hover-bg)',
        color: 'var(--sidebar-text)',
        border: '1px solid var(--sidebar-border)',
      }}
    >
      <svg
        viewBox="0 0 20 20"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
      </svg>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TopbarUserMenu — profile trigger + portaled dropdown
// ─────────────────────────────────────────────────────────────────────────────

export interface TopbarUserMenuProps {
  name: string;
  role?: string;
  connected?: boolean;
  language?: 'EN' | 'AR';
  onLanguageChange?: (lang: 'EN' | 'AR') => void;
  onSignOut?: () => void;
  signOutLabel?: string;
  languageLabel?: string;
}

function UserAvatar({ connected }: { connected?: boolean }) {
  return (
    <div className="relative shrink-0">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          border: '1.5px solid rgba(255,255,255,0.25)',
        }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 16a6 6 0 0 1 12 0" />
        </svg>
      </div>
      {connected && (
        <span
          className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full border-2"
          style={{ borderColor: 'var(--sidebar-brand-bg)', backgroundColor: '#10b981' }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function clampMenuLeft(triggerRect: DOMRect, menuWidth: number): number {
  const isRtl = document.documentElement.dir === 'rtl';
  let left: number;

  if (isRtl) {
    left = triggerRect.left;
  } else {
    left = triggerRect.right - menuWidth;
  }

  const maxLeft = window.innerWidth - menuWidth - VIEWPORT_PAD;
  return Math.max(VIEWPORT_PAD, Math.min(left, maxLeft));
}

function TopbarUserMenuDropdown({
  menuId,
  name,
  role,
  language,
  onLanguageChange,
  onSignOut,
  signOutLabel,
  languageLabel,
  position,
  onClose,
}: {
  menuId: string;
  name: string;
  role?: string;
  language?: 'EN' | 'AR';
  onLanguageChange?: (lang: 'EN' | 'AR') => void;
  onSignOut?: () => void;
  signOutLabel: string;
  languageLabel: string;
  position: { top: number; left: number };
  onClose: () => void;
}) {
  const showLanguage = language !== undefined && onLanguageChange !== undefined;
  const showSignOut = onSignOut !== undefined;

  return createPortal(
    <>
      {/* Backdrop — tap outside to close */}
      <button
        type="button"
        className="fixed inset-0 z-[calc(var(--z-dropdown)-1)] cursor-default bg-transparent"
        aria-label="Close menu"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        id={menuId}
        role="menu"
        className={cn(
          'fixed z-[var(--z-dropdown)]',
          'w-[240px] max-w-[calc(100vw-2rem)]',
          'overflow-hidden rounded-2xl',
          'border border-neutral-200/90 bg-white',
          'shadow-xl shadow-neutral-900/10',
          'animate-[fadein_120ms_ease-out]',
        )}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        {/* Account header */}
        <div className="border-b border-neutral-100 bg-neutral-50/80 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900 truncate">{name}</p>
          {role && <p className="mt-0.5 text-xs text-neutral-500 truncate">{role}</p>}
        </div>

        {showLanguage && (
          <div role="none" className="border-b border-neutral-100 px-3 py-3">
            <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              {languageLabel}
            </p>
            <div
              role="group"
              aria-label={languageLabel}
              className="flex gap-1.5 rounded-xl bg-neutral-100 p-1"
            >
              {(['EN', 'AR'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  role="menuitemradio"
                  aria-checked={language === lang}
                  onClick={() => onLanguageChange(lang)}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-xs font-semibold transition-all duration-fast',
                    language === lang
                      ? 'bg-white text-brand-700 shadow-sm ring-1 ring-neutral-200/80'
                      : 'text-neutral-600 hover:text-neutral-900',
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        )}

        {showSignOut && (
          <div className="p-2">
            <button
              type="button"
              role="menuitem"
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5',
                'text-sm font-medium text-danger-600',
                'transition-colors duration-fast',
                'hover:bg-danger-50 active:bg-danger-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-200',
              )}
              onClick={() => {
                onClose();
                onSignOut();
              }}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-50">
                <svg
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="M13 4h3v12h-3M8 10l4 4m0-4l-4 4M4 16V4" strokeLinecap="round" />
                </svg>
              </span>
              {signOutLabel}
            </button>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}

export function TopbarUserMenu({
  name,
  role,
  connected = true,
  language,
  onLanguageChange,
  onSignOut,
  signOutLabel = 'Sign out',
  languageLabel = 'Language',
}: TopbarUserMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function updatePosition() {
      const rect = triggerRef.current!.getBoundingClientRect();
      setMenuPos({
        top: MENU_TOP,
        left: clampMenuLeft(rect, MENU_WIDTH),
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const showMenu = open && (onLanguageChange !== undefined || onSignOut !== undefined);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'flex items-center gap-2.5 rounded-xl py-1.5 pe-2 ps-1.5',
          'transition-colors duration-fast',
          'hover:bg-white/10',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
          open && 'bg-white/10',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <UserAvatar connected={connected} />
        <div className="hidden min-w-0 sm:flex sm:flex-col items-start text-start max-w-[160px]">
          <span
            className="truncate w-full text-sm font-medium leading-tight"
            style={{ color: 'var(--sidebar-text)' }}
          >
            {name}
          </span>
          {role && (
            <span
              className="truncate w-full text-xs leading-tight"
              style={{ color: 'var(--sidebar-text-muted)' }}
            >
              {role}
            </span>
          )}
        </div>
        <svg
          viewBox="0 0 12 12"
          className={cn(
            'hidden sm:block h-3 w-3 shrink-0 transition-transform duration-fast',
            open && 'rotate-180',
          )}
          style={{ color: 'var(--sidebar-text-muted)' }}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {showMenu && (
        <TopbarUserMenuDropdown
          menuId={menuId}
          name={name}
          role={role}
          language={language}
          onLanguageChange={onLanguageChange}
          onSignOut={onSignOut}
          signOutLabel={signOutLabel}
          languageLabel={languageLabel}
          position={menuPos}
          onClose={close}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TopbarLanguageToggle — standalone (legacy)
// ─────────────────────────────────────────────────────────────────────────────

interface TopbarLanguageToggleProps {
  value: 'EN' | 'AR';
  onChange: (lang: 'EN' | 'AR') => void;
}

export function TopbarLanguageToggle({ value, onChange }: TopbarLanguageToggleProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value === 'AR' ? 'AR' : 'EN')}
      aria-label="Language direction selector"
      className="h-8 px-2 text-xs font-semibold rounded-lg transition-colors duration-fast focus:outline-none"
      style={{
        backgroundColor: 'var(--sidebar-hover-bg)',
        color: 'var(--sidebar-text)',
        border: '1px solid var(--sidebar-border)',
        borderRadius: '8px',
      }}
    >
      <option value="EN">EN</option>
      <option value="AR">AR</option>
    </select>
  );
}
