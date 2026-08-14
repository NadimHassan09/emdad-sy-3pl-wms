import { useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { AppPageHeader, Card } from '@ds';
import { useAuth } from '../auth/AuthContext';
import {
  getRememberedAccount,
  isPersistSessionEnabled,
  setRememberedAccount,
} from '../auth/authStorage';
import { AuthApi } from '../api/auth';
import { ImageUploadField } from '../components/ImageUploadField';
import { adminMediaSrc } from '../lib/admin-media';
import { canAccessPath } from '../lib/rbac';
import { useWmsTranslation } from '../lib/ui-i18n';

function roleLabel(role: string, isArabic: boolean): string {
  const map: Record<string, [string, string]> = {
    super_admin: ['Super admin', 'مدير النظام'],
    wh_manager: ['Admin', 'مدير'],
    wh_operator: ['Worker', 'عامل'],
    finance: ['Finance', 'مالية'],
  };
  const row = map[role];
  if (!row) return role;
  return isArabic ? row[1] : row[0];
}

function authGroupLabel(group: string | undefined, isArabic: boolean): string {
  if (group === 'ADMIN') return isArabic ? 'إدارة' : 'Admin';
  if (group === 'OPERATOR') return isArabic ? 'تشغيل' : 'Operator';
  return group || '—';
}

export function ProfilePage(): ReactElement {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const { isArabic, t: tr } = useWmsTranslation();
  const label = (en: string, ar: string) => tr([en, ar]);

  const showBackups = canAccessPath(user?.role, '/backups');
  const displayName = user?.fullName?.trim() || user?.email || '—';
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const avatarSrc = adminMediaSrc(user?.avatarUrl, avatarVersion);

  useEffect(() => {
    let cancelled = false;
    void AuthApi.googleStatus()
      .then((s) => {
        if (!cancelled) setGoogleEnabled(Boolean(s.enabled));
      })
      .catch(() => {
        if (!cancelled) setGoogleEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_link') === 'success') {
      setGoogleMessage(
        isArabic ? 'تم ربط حساب Google بنجاح.' : 'Google account linked successfully.',
      );
      setGoogleError(null);
      void refresh();
      params.delete('google_link');
      params.delete('google_error');
      const next = params.toString();
      window.history.replaceState({}, '', next ? `/profile?${next}` : '/profile');
    } else if (params.get('google_link') === 'error') {
      const code = params.get('google_error');
      setGoogleError(
        code === 'google_conflict'
          ? isArabic
            ? 'حساب Google هذا مرتبط بمستخدم آخر، أو حسابك مرتبط بـ Google بالفعل.'
            : 'This Google account is already linked to another user, or your account already has Google linked.'
          : isArabic
            ? 'تعذر ربط حساب Google. حاول مرة أخرى.'
            : 'Could not link Google account. Please try again.',
      );
      params.delete('google_link');
      params.delete('google_error');
      const next = params.toString();
      window.history.replaceState({}, '', next ? `/profile?${next}` : '/profile');
    }
    // Only react to return from Google OAuth redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function syncRememberedAvatar(nextUrl: string | null): Promise<void> {
    if (!isPersistSessionEnabled()) return;
    const remembered = getRememberedAccount();
    if (!remembered) return;
    setRememberedAccount({
      ...remembered,
      avatarUrl: nextUrl ? adminMediaSrc(nextUrl) : null,
    });
  }

  async function unlinkGoogle(): Promise<void> {
    setGoogleBusy(true);
    setGoogleError(null);
    setGoogleMessage(null);
    try {
      await AuthApi.unlinkGoogle();
      await refresh();
      setGoogleMessage(label('Google account unlinked.', 'تم إلغاء ربط حساب Google.'));
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : label('Unlink failed.', 'فشل إلغاء الربط.'));
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-enter">
      <AppPageHeader
        icon="fa-user"
        title={label('Profile', 'الملف الشخصي')}
      />

      <Card padding="none" className="overflow-hidden">
        <div className="h-24 bg-dark-950 relative">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
              backgroundSize: '20px 20px',
            }}
          />
        </div>
        <div className="px-6 pb-6">
          <div className="relative -mt-10 mb-4">
            <div className="rounded-2xl border border-border bg-surface-panel p-3 shadow-lg">
              <ImageUploadField
                label={label('Profile photo', 'صورة الملف الشخصي')}
                previewUrl={avatarSrc}
                rounded="2xl"
                size="lg"
                uploading={uploading}
                isArabic={isArabic}
                onUpload={async (file) => {
                  setAvatarError(null);
                  setUploading(true);
                  try {
                    const res = await AuthApi.uploadAvatar(file);
                    await refresh();
                    setAvatarVersion(Date.now());
                    await syncRememberedAvatar(res.avatarUrl);
                  } catch (err) {
                    setAvatarError(err instanceof Error ? err.message : 'Upload failed.');
                    throw err;
                  } finally {
                    setUploading(false);
                  }
                }}
                onRemove={
                  user?.avatarUrl
                    ? async () => {
                        setAvatarError(null);
                        setUploading(true);
                        try {
                          await AuthApi.deleteAvatar();
                          await refresh();
                          setAvatarVersion(Date.now());
                          await syncRememberedAvatar(null);
                        } finally {
                          setUploading(false);
                        }
                      }
                    : undefined
                }
              />
              {avatarError ? (
                <p className="mt-1 text-xs text-danger-600 dark:text-status-danger-fg">
                  {avatarError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border-subtle bg-surface-sunken p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                {label('Name', 'الاسم')}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-text-strong">{displayName}</div>
            </div>
            <div className="rounded-lg border border-border-subtle bg-surface-sunken p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                {label('Email', 'البريد الإلكتروني')}
              </div>
              <div className="mt-0.5 break-all text-sm font-semibold text-text-strong">
                {user?.email ?? '—'}
              </div>
            </div>
            <div className="rounded-lg border border-border-subtle bg-surface-sunken p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                {label('Role', 'الدور')}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-text-strong">
                {user ? roleLabel(user.role, isArabic) : '—'}
              </div>
            </div>
            <div className="rounded-lg border border-border-subtle bg-surface-sunken p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                {label('Auth group', 'مجموعة الصلاحية')}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-text-strong">
                {authGroupLabel(user?.authGroup, isArabic)}
              </div>
            </div>
            {user?.workerId ? (
              <div className="rounded-lg border border-border-subtle bg-surface-sunken p-3 sm:col-span-2">
                <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                  {label('Worker ID', 'معرّف العامل')}
                </div>
                <div className="mt-0.5 font-mono text-sm font-semibold text-text-strong">
                  {user.workerId}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-xl border border-border bg-surface-sunken p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">
                  {label('Google Sign-In', 'تسجيل الدخول عبر Google')}
                </div>
                <div className="mt-1 text-sm font-semibold text-text-strong">
                  {user?.googleLinked
                    ? label('Linked', 'مرتبط')
                    : label('Not linked', 'غير مرتبط')}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {user?.googleLinked
                    ? label(
                        `Connected as ${user.googleEmail || 'Google account'}. Password sign-in still works.`,
                        `متصل كـ ${user.googleEmail || 'حساب Google'}. تسجيل الدخول بكلمة المرور ما زال يعمل.`,
                      )
                    : googleEnabled
                      ? label(
                          'Link your Google account to sign in without a password.',
                          'اربط حساب Google لتسجيل الدخول بدون كلمة مرور.',
                        )
                      : label(
                          'Google Sign-In is not configured on this server yet.',
                          'تسجيل الدخول عبر Google غير مُعدّ على هذا الخادم بعد.',
                        )}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {user?.googleLinked ? (
                  <button
                    type="button"
                    disabled={googleBusy}
                    onClick={() => void unlinkGoogle()}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-status-danger-border bg-white px-3 text-sm font-semibold text-status-danger-fg transition hover:bg-status-danger-bg disabled:opacity-60"
                  >
                    {googleBusy
                      ? label('Working…', 'جارٍ…')
                      : label('Unlink Google', 'إلغاء ربط Google')}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={googleBusy || !googleEnabled}
                    onClick={() => {
                      if (!googleEnabled) {
                        setGoogleError(
                          label(
                            'Google Sign-In is not configured. Contact your administrator.',
                            'تسجيل الدخول عبر Google غير مُعدّ. تواصل مع المسؤول.',
                          ),
                        );
                        return;
                      }
                      window.location.assign(AuthApi.googleLinkUrl());
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <i className="fa-brands fa-google text-xs" aria-hidden />
                    {label('Link Google', 'ربط Google')}
                  </button>
                )}
              </div>
            </div>
            {googleMessage ? (
              <p className="mt-2 text-xs text-status-success-fg">{googleMessage}</p>
            ) : null}
            {googleError ? (
              <p className="mt-2 text-xs text-status-danger-fg">{googleError}</p>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card
          padding="lg"
          interactive
          className="cursor-pointer"
          role="link"
          tabIndex={0}
          onClick={() => navigate('/notifications')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/notifications');
            }
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-info-bg">
              <i className="fa-solid fa-bell text-status-info-fg" />
            </div>
            <i className="fa-solid fa-arrow-right text-xs text-text-faint rtl:rotate-180" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-text-strong">
            {label('Notifications', 'الإشعارات')}
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            {label(
              'View and manage your notifications.',
              'عرض وإدارة إشعاراتك.',
            )}
          </p>
        </Card>

        {showBackups ? (
          <Card
            padding="lg"
            interactive
            className="cursor-pointer"
            role="link"
            tabIndex={0}
            onClick={() => navigate('/backups')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/backups');
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 dark:bg-white/5">
                <i className="fa-solid fa-cloud-arrow-up text-brand-600 dark:text-brand-400" />
              </div>
              <i className="fa-solid fa-arrow-right text-xs text-text-faint rtl:rotate-180" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-text-strong">
              {label('Backups', 'النسخ الاحتياطي')}
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              {label(
                'Backups, retention, and recovery tools.',
                'النسخ الاحتياطي والاحتفاظ وأدوات الاستعادة.',
              )}
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
