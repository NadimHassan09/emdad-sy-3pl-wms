/**
 * Topbar — sticky application chrome bar.
 *
 * Light glass surface (Client Portal) — --topbar-* tokens.
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
import { Button } from './Button';
import { cn } from './cn';
import { FILTER_RESET_BUTTON_CLASS } from './filter-button-styles';
import {
  clampTopbarDropdownLeft,
  topbarDropdownTop,
} from './topbar-dropdown-utils';

const MENU_WIDTH = 240;

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
        'z-[var(--z-topbar)] w-full shrink-0',
        'flex min-h-[var(--topbar-h)] items-center gap-2',
        'px-4 py-2 sm:px-6',
        transparent ? 'bg-transparent' : 'backdrop-blur-md',
        className,
      )}
      style={
        transparent
          ? undefined
          : {
              backgroundColor: 'var(--topbar-bg)',
              borderBottom: '1px solid var(--topbar-border)',
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
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30',
      )}
      style={{
        backgroundColor: 'var(--topbar-hover-bg)',
        color: 'var(--topbar-text-muted)',
        border: '1px solid var(--topbar-border)',
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
// TopbarThemeToggle — light/dark switch
// ─────────────────────────────────────────────────────────────────────────────

interface TopbarThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
  lightLabel?: string;
  darkLabel?: string;
}

export function TopbarThemeToggle({
  isDark,
  onToggle,
  lightLabel = 'Switch to light mode',
  darkLabel = 'Switch to dark mode',
}: TopbarThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? lightLabel : darkLabel}
      title={isDark ? lightLabel : darkLabel}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
        'transition-colors duration-fast',
        'hover:bg-surface-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30',
      )}
    >
      <i
        className={cn('fa-solid text-[15px]', isDark ? 'fa-sun' : 'fa-moon')}
        style={{ color: 'var(--topbar-icon)' }}
        aria-hidden="true"
      />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TopbarUserMenu — profile trigger + portaled dropdown
// ─────────────────────────────────────────────────────────────────────────────

export interface TopbarUserMenuProps {
  name: string;
  role?: string;
  /** Profile photo URL — when set, replaces the default avatar icon. */
  avatarUrl?: string | null;
  connected?: boolean;
  language?: 'EN' | 'AR';
  onLanguageChange?: (lang: 'EN' | 'AR') => void | Promise<void>;
  onProfile?: () => void;
  profileLabel?: string;
  onSignOut?: () => void;
  signOutLabel?: string;
  languageLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function UserAvatar({
  connected,
  avatarUrl,
  name,
}: {
  connected?: boolean;
  avatarUrl?: string | null;
  name?: string;
}) {
  const initial = (name?.trim()?.charAt(0) || '?').toUpperCase();
  return (
    <div className="relative shrink-0">
      <div
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full"
        style={{
          background: avatarUrl
            ? 'transparent'
            : 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          border: '1.5px solid rgba(16,185,129,0.25)',
        }}
        aria-hidden="true"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-bold leading-none">{initial}</span>
        )}
      </div>
      {connected && (
        <span
          className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full border-2"
          style={{ borderColor: '#ffffff', backgroundColor: '#10b981' }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function clampMenuLeft(triggerRect: DOMRect, menuWidth: number): number {
  return clampTopbarDropdownLeft(triggerRect, menuWidth);
}

function TopbarUserMenuDropdown({
  menuId,
  name,
  role,
  language,
  onLanguageChange,
  onProfile,
  profileLabel,
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
  onLanguageChange?: (lang: 'EN' | 'AR') => void | Promise<void>;
  onProfile?: () => void;
  profileLabel: string;
  onSignOut?: () => void;
  signOutLabel: string;
  languageLabel: string;
  position: { top: number; left: number };
  onClose: () => void;
}) {
  const showLanguage = language !== undefined && onLanguageChange !== undefined;
  const showProfile = onProfile !== undefined;
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
          'border border-border bg-surface-panel',
          'shadow-xl',
          'animate-[fadein_120ms_ease-out]',
        )}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        {/* Account header */}
        <div className="border-b border-border-subtle bg-surface-card-muted px-4 py-3">
          <p className="text-sm font-semibold text-text-strong truncate">{name}</p>
          {role && <p className="mt-0.5 text-xs text-text-muted truncate">{role}</p>}
        </div>

        {showProfile && (
          <div role="none" className="border-b border-border-subtle p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClose();
                onProfile();
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start',
                'text-sm font-medium text-text-strong',
                'transition-colors duration-fast',
                'hover:bg-surface-hover',
              )}
            >
              <i className="fa-solid fa-user text-xs text-text-muted" aria-hidden="true" />
              {profileLabel}
            </button>
          </div>
        )}

        {showLanguage && (
          <div role="none" className="border-b border-border-subtle px-3 py-3">
            <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-text-faint">
              {languageLabel}
            </p>
            <div
              role="group"
              aria-label={languageLabel}
              className="flex gap-1.5 rounded-xl bg-surface-sunken p-1"
            >
              {(['EN', 'AR'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  role="menuitemradio"
                  aria-checked={language === lang}
                  onClick={() => {
                    onClose();
                    void onLanguageChange(lang);
                  }}
                  className={cn(
                    'flex-1 rounded-lg py-2 text-xs font-semibold transition-all duration-fast',
                    language === lang
                      ? 'bg-surface-panel text-link shadow-sm ring-1 ring-border'
                      : 'text-text-muted hover:text-text-strong',
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        )}

        {showSignOut && (
          <div className="border-t border-border-subtle p-3">
            <Button
              type="button"
              role="menuitem"
              variant="danger"
              size="md"
              block
              className={`${FILTER_RESET_BUTTON_CLASS} h-[34px] !py-0`}
              onClick={() => {
                onClose();
                onSignOut();
              }}
            >
              {signOutLabel}
            </Button>
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
  avatarUrl,
  connected = true,
  language,
  onLanguageChange,
  onProfile,
  profileLabel = 'Profile',
  onSignOut,
  signOutLabel = 'Sign out',
  languageLabel = 'Language',
  open: openProp,
  onOpenChange,
}: TopbarUserMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;

    function updatePosition() {
      const rect = triggerRef.current!.getBoundingClientRect();
      setMenuPos({
        top: topbarDropdownTop(rect),
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

  const showMenu =
    open &&
    (onLanguageChange !== undefined || onSignOut !== undefined || onProfile !== undefined);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'flex items-center gap-2.5 rounded-xl py-1.5 pe-2 ps-1.5',
          'transition-colors duration-fast',
          'hover:bg-surface-hover',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30',
          open && 'bg-surface-hover',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
      >
        <UserAvatar connected={connected} avatarUrl={avatarUrl} name={name} />
        <div className="hidden min-w-0 sm:flex sm:flex-col items-start text-start max-w-[160px]">
          <span
            className="truncate w-full text-sm font-medium leading-tight"
            style={{ color: 'var(--topbar-text)' }}
          >
            {name}
          </span>
          {role && (
            <span
              className="truncate w-full text-xs leading-tight"
              style={{ color: 'var(--topbar-text-muted)' }}
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
          style={{ color: 'var(--topbar-text-muted)' }}
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
          onProfile={onProfile}
          profileLabel={profileLabel}
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
        backgroundColor: 'var(--topbar-hover-bg)',
        color: 'var(--topbar-text)',
        border: '1px solid var(--topbar-border)',
        borderRadius: '8px',
      }}
    >
      <option value="EN">EN</option>
      <option value="AR">AR</option>
    </select>
  );
}
