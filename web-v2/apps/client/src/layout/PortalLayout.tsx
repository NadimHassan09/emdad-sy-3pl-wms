import { Suspense, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { UserRound } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { AppShell, Link, type ShellLabels } from '@emdad/ui'
import { DropdownMenuItem } from '@emdad/ui/ui/dropdown-menu'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { useAuth } from '@/auth/AuthContext'
import { RequireRouteAccess } from '@/auth/RequireRouteAccess'
import { BillingRestrictionBanner, ClientRoleAccessBanner } from '@/components/Banners'
import { useClientNotifications } from '@/hooks/useClientNotifications'
import { clientMediaSrc } from '@/lib/client-media'
import { resolveClientPageTitle } from '@/lib/page-titles'
import { buildClientNavGroups } from '@/nav'
import { NotificationsMenu } from './NotificationsMenu'

export function PortalLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { pathname } = useLocation()
  const { isArabic, dir, theme, toggleLanguage, toggleTheme } = useUiPreferences()
  const { unreadCount } = useClientNotifications()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  useEffect(() => {
    const title = resolveClientPageTitle(pathname)
    document.title = `${isArabic ? title.ar : title.en} · ${t('Client Portal', 'بوابة العميل')}`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isArabic])

  const labels: ShellLabels = {
    portal: t('Client portal', 'بوابة العميل'),
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
      groups={buildClientNavGroups(user?.role, isArabic, unreadCount)}
      user={{
        name: user?.fullName?.trim() || user?.email || t('Account', 'الحساب'),
        email: user?.companyName?.trim() || user?.email || undefined,
        roleLabel: user ? (user.role === 'client_admin' ? t('Administrator', 'مدير عميل') : t('Staff', 'موظف')) : undefined,
        avatarUrl: clientMediaSrc(user?.avatarUrl) ?? undefined,
      }}
      languageLabel={isArabic ? 'EN' : 'عربي'}
      isDark={theme === 'dark'}
      onToggleLanguage={toggleLanguage}
      onToggleTheme={toggleTheme}
      onLogout={() => {
        void logout().finally(() => {
          queryClient.clear()
          navigate('/login', { replace: true })
        })
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
      <div className="mb-4 space-y-3 empty:hidden">
        <ClientRoleAccessBanner />
        <BillingRestrictionBanner />
      </div>
      <RequireRouteAccess>
        <Suspense fallback={<Skeleton className="mt-3 h-96 rounded-xl" />}>
          <Outlet />
        </Suspense>
      </RequireRouteAccess>
    </AppShell>
  )
}
