/**
 * LoginScreen — split-card login layout (form left, branded hero right).
 * Green theme aligned with WMS chrome. No social login or sign-up footer.
 */

import { type FormEvent, type ReactNode, useState } from 'react';
import { cn } from './cn';

export type LoginScreenProps = {
  brandName: string;
  title: string;
  subtitle: string;
  heroTitle: string;
  heroDescription: string;
  logoSrc?: string;
  logoAlt?: string;
  submitLabel?: string;
  submittingLabel?: string;
  emailLabel?: string;
  passwordLabel?: string;
  rememberLabel?: string;
  forgotPasswordLabel?: string;
  loading?: boolean;
  error?: string | null;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  /** Optional slot above the form (e.g. boot loading). */
  bootSlot?: ReactNode;
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
}: {
  id: string;
  type: string;
  icon: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  endAdornment?: ReactNode;
}) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
        aria-hidden="true"
      >
        <i className={cn(icon, 'text-sm')} />
      </span>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-xl border border-neutral-200 bg-neutral-50/80 py-3',
          'ps-10 pe-10 text-sm text-neutral-900 placeholder:text-neutral-400',
          'outline-none transition-[border-color,box-shadow] duration-fast',
          'focus:border-brand-500 focus:bg-white focus:shadow-[0_0_0_3px_rgba(16,185,129,0.15)]',
        )}
      />
      {endAdornment ? (
        <span className="absolute end-2 top-1/2 flex -translate-y-1/2">{endAdornment}</span>
      ) : null}
    </div>
  );
}

export function LoginScreen({
  brandName,
  title,
  subtitle,
  heroTitle,
  heroDescription,
  logoSrc = '/emdad-logo.png',
  logoAlt = 'EMDAD',
  submitLabel = 'Sign in',
  submittingLabel = 'Signing in…',
  emailLabel = 'Email',
  passwordLabel = 'Password',
  rememberLabel = 'Remember me',
  forgotPasswordLabel = 'Forgot password?',
  loading = false,
  error,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  bootSlot,
}: LoginScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  if (bootSlot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] px-4 text-sm text-neutral-600">
        {bootSlot}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] p-4 sm:p-6">
      <div
        className={cn(
          'flex w-full max-w-[920px] flex-col overflow-hidden',
          'rounded-3xl border border-neutral-200/80 bg-white shadow-xl shadow-neutral-900/10',
          'md:min-h-[520px] md:flex-row',
        )}
      >
        {/* ── Form panel ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-10 sm:py-10">
          <div className="mb-6 flex items-center gap-2.5">
            <img src={logoSrc} alt={logoAlt} className="h-9 w-auto object-contain" />
            <span className="text-base font-bold tracking-tight text-neutral-900">{brandName}</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[1.65rem]">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">{subtitle}</p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <div>
              <label htmlFor="login-email" className="sr-only">
                {emailLabel}
              </label>
              <LoginField
                id="login-email"
                type="email"
                icon="fa-solid fa-envelope"
                placeholder={emailLabel}
                value={email}
                onChange={onEmailChange}
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="sr-only">
                {passwordLabel}
              </label>
              <LoginField
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                icon="fa-solid fa-lock"
                placeholder={passwordLabel}
                value={password}
                onChange={onPasswordChange}
                autoComplete="current-password"
                endAdornment={
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-neutral-400 transition hover:text-neutral-600"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={cn('text-sm', showPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye')} />
                  </button>
                }
              />
            </div>

            <div className="flex items-center justify-between gap-2 text-sm">
              <label className="inline-flex cursor-pointer items-center gap-2 text-neutral-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                />
                {rememberLabel}
              </label>
              <button
                type="button"
                className="font-medium text-brand-700 hover:text-brand-800"
                onClick={(e) => e.preventDefault()}
              >
                {forgotPasswordLabel}
              </button>
            </div>

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
                'mt-2 w-full rounded-full py-3.5 text-sm font-semibold text-white shadow-md',
                'transition-[background-color,transform,opacity] duration-fast',
                'hover:bg-[#146135] active:scale-[0.99]',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
              style={{ backgroundColor: '#187440' }}
            >
              {loading ? submittingLabel : submitLabel}
            </button>
          </form>
        </div>

        {/* ── Hero panel ───────────────────────────────────────────────────── */}
        <div
          className={cn(
            'relative hidden flex-1 flex-col justify-between overflow-hidden p-8 md:flex',
            'text-white',
          )}
          style={{
            backgroundColor: '#072019',
            backgroundImage:
              'linear-gradient(145deg, #072019 0%, #0a2d23 42%, #146135 88%, #1a7a44 100%)',
          }}
        >
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm"
            aria-hidden="true"
            tabIndex={-1}
          >
            <i className="fa-solid fa-bolt text-sm text-white" />
          </button>

          <div className="flex flex-1 flex-col items-center justify-center px-2">
            <div
              className={cn(
                'w-full max-w-[240px] rounded-2xl border border-white/20 p-5',
                'bg-white/10 shadow-lg backdrop-blur-md',
              )}
            >
              <div className="space-y-2.5">
                <div className="h-2 w-3/5 rounded-full bg-white/35" />
                <div className="h-2 w-full rounded-full bg-white/20" />
                <div className="h-2 w-4/5 rounded-full bg-white/20" />
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="h-14 rounded-lg bg-white/15" />
                  <div className="h-14 rounded-lg bg-white/25" />
                  <div className="h-14 rounded-lg bg-white/10" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold leading-snug sm:text-2xl">{heroTitle}</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/80">{heroDescription}</p>
            <div className="mt-6 flex items-center justify-center gap-2" aria-hidden="true">
              <span className="h-1.5 w-6 rounded-full bg-white" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
