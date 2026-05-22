/**

 * Admin Layout — premium shell (reference design).

 *

 *   AppShell

 *     Topbar — logo + user actions

 *     AppShell.Body

 *       Sidebar — flat pill navigation (no nested sections)

 *       AppShell.Main

 */



import { Suspense, useEffect, useState } from 'react';

import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { SectionSubNavCard } from './SectionSubNavCard';



import { RequireRouteAccess } from '../auth/RequireRouteAccess';
import { useAuth } from '../auth/AuthContext';
import { defaultHomePath, navItemsForRole } from '../lib/rbac';

import { WorkflowUxProvider } from '../workflow/WorkflowUxContext';

import {

  AppShell,

  MobileSidebarOverlay,

  PageLoadFallback,

  Sidebar,

  SidebarBrand,

  SidebarLink,

  SidebarNav,

  Topbar,

  TopbarMobileMenuButton,

  TopbarNotifications,

  TopbarUserMenu,

  LanguageSwitchOverlay,

  renderSidebarNavIcon,

  useUiLanguage,

  type TopbarNotificationItem,

} from '@ds';

import { useNotifications } from '../hooks/useNotifications';

import { notificationHref } from '../services/notificationsService';



function sidebarLabel(label: string, isArabic: boolean): string {

  if (!isArabic) return label;

  const ar: Record<string, string> = {

    Dashboard: 'لوحة التحكم',

    Reports: 'التقارير',

    Orders: 'الطلبات',

    Inventory: 'المخزون',

    Tasks: 'المهام',

    Products: 'المنتجات',

    Locations: 'المواقع التخزينية',

    Customers: 'العملاء',

    Users: 'المستخدمون',

    'Sign out': 'تسجيل الخروج',

  };

  return ar[label] ?? label;

}



function friendlyRole(role: string): string {

  const m: Record<string, string> = {

    super_admin: 'Super admin',

    wh_manager: 'Admin',

    wh_operator: 'Worker',

    finance: 'Finance',

    client_admin: 'Client admin',

    client_staff: 'Client staff',

  };

  return m[role] ?? role;

}



function displayName(user: { fullName?: string; email?: string | null }): string {

  return user.fullName?.trim() || user.email || 'Account';

}



interface FlatNavItem {

  label: string;

  iconKey: string;

  to: string;

  active: (pathname: string, search: string) => boolean;

}



function buildFlatNav(t: (s: string) => string, role: string | undefined): FlatNavItem[] {
  return navItemsForRole(role).map((item) => ({
    label: t(item.labelKey),
    iconKey: item.iconKey,
    to: item.to,
    active: (p) => item.match(p),
  }));
}



function SidebarNavContent({

  items,

  pathname,

  search,

  navigate,

  onLinkClick,

}: {

  items: FlatNavItem[];

  pathname: string;

  search: string;

  navigate: (to: string) => void;

  onLinkClick?: () => void;

}) {

  return (

    <SidebarNav>

      {items.map((item) => {
        const active = item.active(pathname, search);
        return (
          <SidebarLink
            key={item.to}
            href={item.to}
            isActive={active}
            icon={renderSidebarNavIcon(item.iconKey)}
            onClick={(e) => {
              e.preventDefault();
              navigate(item.to);
              onLinkClick?.();
            }}
          >
            {item.label}
          </SidebarLink>
        );
      })}

    </SidebarNav>

  );

}



export function Layout() {

  const { user, logout } = useAuth();

  const navigate = useNavigate();

  const { pathname, search } = useLocation();



  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { language, setLanguage, isArabic, isSwitching } = useUiLanguage({
    storageKey: 'wms-ui-language',
    eventName: 'wms-ui-language-changed',
  });

  const t = (label: string) => sidebarLabel(label, isArabic);



  useEffect(() => {

    setMobileNavOpen(false);

  }, [pathname, search]);



  const homePath = defaultHomePath(user?.role);

  const navItems = buildFlatNav(t, user?.role);

  const notifications = useNotifications();

  function formatNotificationTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return isArabic ? 'الآن' : 'Just now';
    if (mins < 60) return isArabic ? `منذ ${mins} د` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return isArabic ? `منذ ${hours} س` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return isArabic ? `منذ ${days} ي` : `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  async function onNotificationClick(item: TopbarNotificationItem): Promise<void> {
    if (!item.isRead) {
      await notifications.markRead(item.id);
    }
    const full = notifications.items.find((n) => n.id === item.id);
    const href = full ? notificationHref(full) : undefined;
    if (href) navigate(href);
  }

  async function handleLogout() {

    await logout();

    navigate('/login', { replace: true });

  }



  const navContent = (

    <SidebarNavContent

      items={navItems}

      pathname={pathname}

      search={search}

      navigate={navigate}

      onLinkClick={() => setMobileNavOpen(false)}

    />

  );



  return (

    <>

      <LanguageSwitchOverlay open={isSwitching} language={language} />

      <div key={language} className="h-dvh max-h-dvh overflow-hidden">

      <AppShell>

        <AppShell.SkipNav />



        <AppShell.Body>

          <Sidebar>
            <SidebarBrand
              logo={
                <Link
                  to={homePath}
                  className="flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
                  aria-label="EMDAD WMS — Home"
                >
                  <img
                    src="/emdad-logo.png"
                    alt="EMDAD WMS"
                    className="h-8 w-auto object-contain brightness-0 invert sm:h-9"
                  />
                </Link>
              }
            />
            {navContent}
          </Sidebar>

          <MobileSidebarOverlay open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
            <SidebarBrand
              logo={
                <Link
                  to={homePath}
                  className="flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
                  aria-label="EMDAD WMS — Dashboard"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <img
                    src="/emdad-logo.png"
                    alt="EMDAD WMS"
                    className="h-8 w-auto object-contain brightness-0 invert sm:h-9"
                  />
                </Link>
              }
            />
            {navContent}

            <div className="mt-auto p-4 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>

              <button

                type="button"

                onClick={() => void handleLogout()}

                className="flex items-center justify-center gap-2 w-full rounded-2xl px-4 py-3 text-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"

                style={{ color: '#fca5a5' }}

                onMouseEnter={(e) => {

                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.15)';

                }}

                onMouseLeave={(e) => {

                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '';

                }}

              >

                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">

                  <path d="M13 4h3v12h-3M8 10l4 4m0-4l-4 4M4 16V4" strokeLinecap="round" />

                </svg>

                {t('Sign out')}

              </button>

            </div>

          </MobileSidebarOverlay>

          <AppShell.Column>
            <Topbar>
              <Topbar.Start>
                <TopbarMobileMenuButton onClick={() => setMobileNavOpen(true)} />
                <Link
                  to={homePath}
                  className="flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 md:hidden"
                  aria-label="EMDAD WMS — Home"
                >
                  <img
                    src="/emdad-logo.png"
                    alt="EMDAD WMS"
                    className="h-8 w-auto object-contain brightness-0 invert"
                  />
                </Link>
              </Topbar.Start>

              <Topbar.End>
                {user && (
                  <>
                    <TopbarNotifications
                      items={notifications.items}
                      unreadCount={notifications.unreadCount}
                      loading={notifications.isLoading}
                      title={isArabic ? 'الإشعارات' : 'Notifications'}
                      emptyLabel={isArabic ? 'لا توجد إشعارات' : 'No notifications yet'}
                      markAllReadLabel={isArabic ? 'تعليم الكل كمقروء' : 'Mark all read'}
                      formatTime={formatNotificationTime}
                      onMarkAllRead={() => void notifications.markAllRead()}
                      onItemClick={(item) => void onNotificationClick(item)}
                    />
                    <TopbarUserMenu
                      name={displayName(user)}
                      role={friendlyRole(user.role)}
                      connected
                      language={language}
                      onLanguageChange={setLanguage}
                      onSignOut={() => void handleLogout()}
                      signOutLabel={t('Sign out')}
                      languageLabel={isArabic ? 'اللغة' : 'Language'}
                    />
                  </>
                )}
              </Topbar.End>
            </Topbar>

            <AppShell.Main>
              <WorkflowUxProvider>
                <SectionSubNavCard isArabic={isArabic} />

                <Suspense fallback={<PageLoadFallback />}>
                  <RequireRouteAccess>
                    <Outlet />
                  </RequireRouteAccess>
                </Suspense>
              </WorkflowUxProvider>
            </AppShell.Main>
          </AppShell.Column>
        </AppShell.Body>

      </AppShell>

    </div>

    </>

  );

}


