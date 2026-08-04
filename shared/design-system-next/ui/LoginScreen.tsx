/**
 * LoginScreen — centered card login matching the EMDAD auth mockup.
 * Logistics-tinted backdrop, remembered-account picker, remember-me toggle,
 * and language switcher slot. Never collects or displays a stored password.
 */

import { type FormEvent, type ReactNode, useState } from 'react';
import { cn } from './cn';

export type LoginRememberedAccount = {
  email: string;
  displayName: string;
  avatarUrl?: string | null;
};

export type LoginScreenProps = {
  title: string;
  subtitle: string;
  logoSrc?: string;
  logoAlt?: string;
  /** @deprecated Kept for call-site compatibility; brand mark is the logo. */
  brandName?: string;
  /** @deprecated Split-hero layout removed. */
  heroTitle?: string;
  /** @deprecated Split-hero layout removed. */
  heroDescription?: string;
  submitLabel?: string;
  submittingLabel?: string;
  emailLabel?: string;
  passwordLabel?: string;
  emailPlaceholder?: string;
  rememberLabel?: string;
  accountSectionLabel?: string;
  orLabel?: string;
  loading?: boolean;
  error?: string | null;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  bootSlot?: ReactNode;
  showRemember?: boolean;
  remember?: boolean;
  onRememberChange?: (value: boolean) => void;
  /** Fixed top-end control (language switcher). */
  cornerSlot?: ReactNode;
  /** Saved account chip (no password — profile hint only). */
  rememberedAccount?: LoginRememberedAccount | null;
  onSelectRememberedAccount?: () => void;
  /** Remove the remembered account from this device. */
  onClearRememberedAccount?: () => void;
  /** @deprecated Use onClearRememberedAccount. */
  onUseDifferentAccount?: () => void;
  clearRememberedAccountLabel?: string;
  /** Primary continue CTA under the remembered account (one-click resume). */
  continueLabel?: string;
  /** Optional background image URL (defaults to `/login-bg.jpg`). */
  backgroundSrc?: string;
};

function LoginField({
  id,
  type,
  icon,
  placeholder,
  value,
  onChange,
  autoComplete,
  endAdornment,
  readOnly,
}: {
  id: string;
  type: string;
  icon: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  endAdornment?: ReactNode;
  readOnly?: boolean;
}) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-text-faint"
        aria-hidden="true"
      >
        <i className={cn(icon, 'text-sm')} />
      </span>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required
        readOnly={readOnly}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-xl border border-border bg-surface-panel py-3',
          'ps-10 pe-10 text-sm text-text-strong placeholder:text-text-faint',
          'outline-none transition-[border-color,box-shadow] duration-fast',
          'focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]',
          readOnly && 'bg-surface-sunken/60 text-text-muted',
        )}
      />
      {endAdornment ? (
        <span className="absolute end-2 top-1/2 flex -translate-y-1/2">{endAdornment}</span>
      ) : null}
    </div>
  );
}

function DividerLabel({ children }: { children: ReactNode }) {
  return (
    <div className="relative my-1 flex items-center gap-3" aria-hidden="true">
      <div className="h-px flex-1 bg-border" />
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-text-faint">
        {children}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Avatar({ account }: { account: LoginRememberedAccount }) {
  const initials = account.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || account.email.slice(0, 2).toUpperCase();

  if (account.avatarUrl) {
    return (
      <img
        src={account.avatarUrl}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-brand-100"
      />
    );
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 ring-2 ring-brand-100">
      {initials}
    </span>
  );
}

export function LoginScreen({
  title,
  subtitle,
  logoSrc = '/emdad-logo.png',
  logoAlt = 'EMDAD',
  submitLabel = 'Sign in',
  submittingLabel = 'Signing in…',
  emailLabel = 'Email',
  passwordLabel = 'Password',
  emailPlaceholder = 'you@company.com',
  rememberLabel = 'Remember me for 30 days',
  accountSectionLabel = 'Sign in to your account',
  orLabel = 'OR',
  loading = false,
  error,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  bootSlot,
  showRemember = true,
  remember: remoteRemember,
  onRememberChange,
  cornerSlot,
  rememberedAccount = null,
  onSelectRememberedAccount,
  onClearRememberedAccount,
  onUseDifferentAccount,
  clearRememberedAccountLabel = 'Remove remembered account',
  continueLabel = 'Continue',
  backgroundSrc = '/login-bg.jpg',
}: LoginScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [internalRemember, setInternalRemember] = useState(false);
  const remember = remoteRemember ?? internalRemember;
  const setRemember = (next: boolean) => {
    if (onRememberChange) onRememberChange(next);
    else setInternalRemember(next);
  };

  const clearRemembered = onClearRememberedAccount ?? onUseDifferentAccount;
  const hasRemembered = Boolean(rememberedAccount?.email);

  if (bootSlot) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[var(--surface-page)] px-4 text-sm text-text-body">
        {bootSlot}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      {/* Full-bleed logistics background */}
      <div
        className="absolute inset-0 bg-[#eef7f2] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundSrc})` }}
        aria-hidden="true"
      />

      {cornerSlot ? (
        <div className="absolute top-4 end-4 z-20">{cornerSlot}</div>
      ) : null}

      <div
        className={cn(
          'relative z-10 w-full max-w-[420px] rounded-3xl border border-border/80',
          'bg-white px-6 py-8 shadow-xl shadow-brand-900/10 sm:px-8 sm:py-9',
        )}
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={logoSrc} alt={logoAlt} className="mb-4 h-12 w-auto object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-text-strong">{title}</h1>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-text-muted">{subtitle}</p>
        </div>

        {hasRemembered && rememberedAccount ? (
          <div className="mb-5 space-y-3">
            <DividerLabel>{accountSectionLabel}</DividerLabel>
            <div
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-card',
                'px-3.5 py-3',
              )}
            >
              <button
                type="button"
                onClick={onSelectRememberedAccount}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-3 text-start transition',
                  'rounded-xl focus-visible:outline-none focus-visible:shadow-focus',
                )}
              >
                <Avatar account={rememberedAccount} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text-strong">
                    {rememberedAccount.displayName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-text-muted">
                    {rememberedAccount.email}
                  </span>
                </span>
              </button>
              {clearRemembered ? (
                <button
                  type="button"
                  onClick={clearRemembered}
                  aria-label={clearRememberedAccountLabel}
                  title={clearRememberedAccountLabel}
                  className={cn(
                    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    'text-text-faint transition hover:bg-surface-sunken hover:text-text-strong',
                    'focus-visible:outline-none focus-visible:shadow-focus',
                  )}
                >
                  <i className="fa-solid fa-xmark text-sm" aria-hidden />
                </button>
              ) : null}
            </div>
            {onSelectRememberedAccount ? (
              <button
                type="button"
                onClick={onSelectRememberedAccount}
                disabled={loading}
                className={cn(
                  'flex h-11 w-full items-center justify-center gap-2 rounded-xl',
                  'bg-brand-600 text-sm font-semibold text-white shadow-sm',
                  'transition hover:bg-brand-700',
                  'focus-visible:outline-none focus-visible:shadow-focus',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                )}
              >
                {loading ? submittingLabel : continueLabel}
                {!loading ? <i className="fa-solid fa-arrow-right text-xs rtl:rotate-180" aria-hidden /> : null}
              </button>
            ) : null}
            <DividerLabel>{orLabel}</DividerLabel>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-text-body">
              {emailLabel}
            </label>
            <LoginField
              id="login-email"
              type="email"
              icon="fa-solid fa-envelope"
              placeholder={emailPlaceholder}
              value={email}
              onChange={onEmailChange}
              autoComplete="username"
              readOnly={hasRemembered && email === rememberedAccount?.email}
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 block text-sm font-semibold text-text-body"
            >
              {passwordLabel}
            </label>
            <LoginField
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              icon="fa-solid fa-lock"
              placeholder="••••••••"
              value={password}
              onChange={onPasswordChange}
              autoComplete="current-password"
              endAdornment={
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-text-faint transition hover:text-text-muted"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i
                    className={cn(
                      'text-sm',
                      showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye',
                    )}
                  />
                </button>
              }
            />
          </div>

          {showRemember ? (
            <label className="flex cursor-pointer items-center gap-3 text-sm text-text-muted">
              <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span
                  className={cn(
                    'absolute inset-0 rounded-full transition-colors',
                    remember ? 'bg-brand-600' : 'bg-border-strong',
                  )}
                />
                <span
                  className={cn(
                    'absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    remember && 'translate-x-5 rtl:-translate-x-5',
                  )}
                />
              </span>
              {rememberLabel}
            </label>
          ) : null}

          {error ? (
            <div
              className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2.5 text-sm text-danger-800"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              'mt-1 w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-md',
              'bg-brand-700 transition-[background-color,transform,opacity] duration-fast',
              'hover:bg-brand-800 active:scale-[0.99]',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {loading ? submittingLabel : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
