/**
 * Client Portal Layout — premium shell (matches admin reference design).
 */

import { Suspense, useEffect, useState, type ReactElement } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthContext';
import { clientNavForRole } from '../lib/rbac';
import { SectionSubNavCard } from './SectionSubNavCard';
import {
  AppShell,
  MobileSidebarOverlay,
  PageLoadFallback,
  Sidebar,
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
import { useClientNotifications } from '../hooks/useClientNotifications';
import { clientNotificationHref } from '../services/clientNotificationsService';

interface NavItem {
  label: string;
  labelAr: string;
  iconKey: string;
  to: string;
  exact?: boolean;
}

export function PortalLayout(): ReactElement {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { language, setLanguage, isArabic, isSwitching } = useUiLanguage({
    storageKey: 'client-ui-language',
    eventName: 'client-ui-language-changed',
  });

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  async function onLogout(): Promise<void> {
    await logout();
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  function isActive(item: NavItem): boolean {
    if (item.exact) return pathname === item.to;
    return pathname.startsWith(item.to);
  }

  const navItems = clientNavForRole(user?.role);

  const navContent = (
    <SidebarNav>
      {navItems.map((item) => {
        const active = isActive(item);
        return (
          <SidebarLink
            key={item.to}
            href={item.to}
            isActive={active}
            icon={renderSidebarNavIcon(item.iconKey)}
            onClick={(e) => {
              e.preventDefault();
              navigate(item.to);
            }}
          >
            {isArabic ? item.labelAr : item.label}
          </SidebarLink>
        );
      })}
    </SidebarNav>
  );

  const displayName = (user as { fullName?: string; email?: string } | null)?.fullName
    || (user as { fullName?: string; email?: string } | null)?.email
    || 'Account';

  const portalTitle = isArabic ? 'بوابة العميل' : 'Client Portal';

  const notifications = useClientNotifications();

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
    const href = full ? clientNotificationHref(full) : undefined;
    if (href) navigate(href);
  }

  return (
    <>
      <LanguageSwitchOverlay open={isSwitching} language={language} />
      <div key={language} className="h-dvh max-h-dvh overflow-hidden">
      <AppShell>
        <AppShell.SkipNav />

        <AppShell.Body>
          <Sidebar>{navContent}</Sidebar>

          <MobileSidebarOverlay open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
            {navContent}
          </MobileSidebarOverlay>

          <AppShell.Column>
            <Topbar>
              <Topbar.Start>
                <TopbarMobileMenuButton onClick={() => setMobileNavOpen(true)} />
                <h1
                  className="text-lg sm:text-xl font-semibold tracking-tight truncate"
                  style={{ color: 'var(--sidebar-text)' }}
                >
                  {portalTitle}
                </h1>
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
                    name={displayName}
                    connected
                    language={language}
                    onLanguageChange={setLanguage}
                    onSignOut={() => void onLogout()}
                    signOutLabel={isArabic ? 'تسجيل الخروج' : 'Sign out'}
                    languageLabel={isArabic ? 'اللغة' : 'Language'}
                  />
                  </>
                )}
              </Topbar.End>
            </Topbar>

            <AppShell.Main>
              <SectionSubNavCard isArabic={isArabic} />
              <Suspense fallback={<PageLoadFallback />}>
                <Outlet />
              </Suspense>
            </AppShell.Main>
          </AppShell.Column>
        </AppShell.Body>
      </AppShell>
    </div>
    </>
  );
}
