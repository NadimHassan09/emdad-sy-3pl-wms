import type { ReactNode } from 'react'
import type { UserListRow } from '@/api/users'
import { workerProfileStatusText } from '@/lib/worker-profile'
import { UserActivityBadge, UserStatusBadge, userRoleLabel } from './users-ui'

function display(v: string | null | undefined): string {
  if (v == null || v === '') return '—'
  return v
}

function prettyDate(iso: string | null | undefined, locale?: string): string {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-sm font-semibold">{value}</div>
    </div>
  )
}

export function UserDetailsCard({
  user,
  variant,
  isArabic,
  locale,
}: {
  user: UserListRow
  variant: 'warehouse' | 'client'
  isArabic: boolean
  locale?: string
}) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  return (
    <section className="overflow-hidden rounded-xl border bg-card p-6 shadow-sm">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-tight">{user.fullName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
      </div>

      <h3 className="mt-6 text-sm font-semibold">{t('User information', 'معلومات المستخدم')}</h3>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t('Role', 'الدور')} value={userRoleLabel(user.role, isArabic)} />
        <Field label={t('Status', 'الحالة')} value={<UserStatusBadge status={user.status} isArabic={isArabic} />} />
        <Field label={t('Phone', 'الهاتف')} value={display(user.phone)} />
        <Field
          label={t('Activity', 'النشاط')}
          value={
            <UserActivityBadge
              userId={user.id}
              status={user.status}
              lastActivityAt={user.lastActivityAt}
              isArabic={isArabic}
            />
          }
        />
        <Field label={t('Last login', 'آخر دخول')} value={prettyDate(user.lastLoginAt, locale)} />
        {variant === 'client' ? (
          <Field label={t('Company', 'الشركة')} value={display(user.companyName)} />
        ) : (
          <>
            <Field label={t('Account type', 'نوع الحساب')} value={t('Warehouse (system)', 'مستودع (نظام)')} />
            {user.role === 'wh_operator' ? (
              <Field
                label={t('Worker profile', 'ملف العامل')}
                value={workerProfileStatusText(user.workerProfile, user.status, t)}
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
