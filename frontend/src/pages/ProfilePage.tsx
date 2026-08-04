import { type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

import { AppPageHeader, Card } from '@ds';
import { useAuth } from '../auth/AuthContext';
import { canAccessPath } from '../lib/rbac';
import { useWmsTranslation } from '../lib/ui-i18n';
import { CopyEmailButton } from '../components/CopyEmailButton';

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

function initialsFromName(name: string | undefined | null, email: string | null | undefined): string {
  const source = name?.trim() || email?.trim() || '';
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

const SUPPORT_EMAIL = 'support@emdadsy.com';

export function ProfilePage(): ReactElement {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isArabic, t: tr } = useWmsTranslation();
  const label = (en: string, ar: string) => tr([en, ar]);

  const showSettings = canAccessPath(user?.role, '/settings');
  const displayName = user?.fullName?.trim() || user?.email || '—';

  return (
    <div className="space-y-5 animate-enter max-w-3xl">
      <AppPageHeader
        icon="fa-user"
        title={label('Profile', 'الملف الشخصي')}
        description={label('Your account and preferences', 'حسابك وتفضيلاتك')}
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
          <div className="relative -mt-10 mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-surface-panel text-xl font-bold text-brand-700 shadow-lg dark:text-brand-400"
              aria-hidden="true"
            >
              {initialsFromName(user?.fullName, user?.email)}
            </div>
            <span
              className="mb-1 inline-flex items-center gap-1.5 self-start rounded-lg border border-border bg-surface-sunken px-3 py-1.5 text-xs font-medium text-text-muted sm:self-auto"
              title={label(
                'Profile details are managed by your administrator.',
                'تفاصيل الملف الشخصي يُديرها المسؤول.',
              )}
            >
              <i className="fa-solid fa-lock text-[10px]" aria-hidden="true" />
              {label('Read-only account', 'حساب للقراءة فقط')}
            </span>
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

        {showSettings ? (
          <Card
            padding="lg"
            interactive
            className="cursor-pointer"
            role="link"
            tabIndex={0}
            onClick={() => navigate('/settings')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate('/settings');
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 dark:bg-white/5">
                <i className="fa-solid fa-gear text-brand-600 dark:text-brand-400" />
              </div>
              <i className="fa-solid fa-arrow-right text-xs text-text-faint rtl:rotate-180" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-text-strong">
              {label('Settings', 'الإعدادات')}
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              {label(
                'Backups, retention, and system settings.',
                'النسخ الاحتياطي والاحتفاظ وإعدادات النظام.',
              )}
            </p>
          </Card>
        ) : null}
      </div>

      <Card padding="lg">
        <h3 className="text-sm font-semibold text-text-strong">
          {label('Need help?', 'تحتاج مساعدة؟')}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          {label(
            'Contact support for access changes or account questions.',
            'تواصل مع الدعم لتغييرات الوصول أو أسئلة الحساب.',
          )}
        </p>
        <CopyEmailButton
          copyText={SUPPORT_EMAIL}
          copiedLabel={label('Copied', 'تم النسخ')}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 no-underline transition-colors hover:bg-brand-100 dark:bg-white/5 dark:text-brand-400 dark:hover:bg-white/10 cursor-pointer"
        >
          <i className="fa-solid fa-envelope text-[10px]" aria-hidden="true" />
          {label('Contact support', 'تواصل مع الدعم')}
        </CopyEmailButton>
      </Card>
    </div>
  );
}
