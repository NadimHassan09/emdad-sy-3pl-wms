import { Suspense } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { AppShell, Link, type ShellLabels } from '@emdad/ui'
import { DropdownMenuItem } from '@emdad/ui/ui/dropdown-menu'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { UserRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { RequireRouteAccess } from '@/auth/RequireRouteAccess'
import { adminMediaSrc } from '@/lib/admin-media'
import { buildNavGroups } from '@/nav'
import { NotificationsMenu } from './NotificationsMenu'

const ROLE_EN: Record<string, string> = { super_admin: 'Super admin', wh_manager: 'Admin', wh_operator: 'Worker', finance: 'Finance' }
const ROLE_AR: Record<string, string> = { super_admin: 'مدير النظام', wh_manager: 'مسؤول', wh_operator: 'عامل', finance: 'المالية' }

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { isArabic, dir, theme, toggleLanguage, toggleTheme } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const labels: ShellLabels = {
    portal: t('Admin portal', 'بوابة الإدارة'),
    search: t('Quick jump', 'انتقال سريع'),
    searchPlaceholder: t('Jump to page…', 'انتقل إلى صفحة…'),
    noResults: t('No results', 'لا توجد نتائج'),
    navigation: t('Navigation', 'التنقل'),
    toggleLanguage: t('Switch language', 'تغيير اللغة'),
    toggleTheme: t('Switch theme', 'تبديل المظهر'),
    toggleSidebar: t('Toggle sidebar', 'تبديل الشريط الجانبي'),
    logout: t('Sign out', 'تسجيل الخروج'),
    skipToContent: t('Skip to content', 'تخطي إلى المحتوى'),
  }

  return (
    <AppShell
      dir={dir}
      labels={labels}
      groups={buildNavGroups(user?.role, isArabic)}
      user={{
        name: user?.fullName?.trim() || user?.email || t('Account', 'الحساب'),
        email: user?.email ?? undefined,
        roleLabel: user ? ((isArabic ? ROLE_AR : ROLE_EN)[user.role] ?? user.role) : undefined,
        avatarUrl: adminMediaSrc(user?.avatarUrl) ?? undefined,
      }}
      languageLabel={isArabic ? 'EN' : 'عربي'}
      isDark={theme === 'dark'}
      onToggleLanguage={toggleLanguage}
      onToggleTheme={toggleTheme}
      onLogout={() => {
        void logout().finally(() => navigate('/login', { replace: true }))
      }}
      actions={<NotificationsMenu />}
      menuItems={
        <DropdownMenuItem asChild>
          <Link to="/profile">
            <UserRound aria-hidden />
            {t('Profile', 'الملف الشخصي')}
          </Link>
        </DropdownMenuItem>
      }
    >
      <RequireRouteAccess>
        <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
          <Outlet />
        </Suspense>
      </RequireRouteAccess>
    </AppShell>
  )
}
