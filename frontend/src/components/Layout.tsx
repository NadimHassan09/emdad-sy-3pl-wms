/**
 * Admin Layout — DS2 shell, aligned with Client Portal's `PortalLayout.tsx`.
 *
 *   AppShell
 *     Topbar — quick-jump search, theme toggle, notifications, user menu
 *     AppShell.Body
 *       Sidebar — flat + WMS/OMS grouped nav (RBAC-filtered via navItemsForRole)
 *       AppShell.Main
 *
 * Visual language, tokens, and chrome primitives are inherited from
 * `shared/design-system-next` (see docs/design-system/emdad-ds2-reference.md).
 * Nav IA and RBAC filtering are preserved as-is — only presentation changed.
 */
import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { RequireRouteAccess } from '../auth/RequireRouteAccess';
import { useAuth } from '../auth/AuthContext';
import { defaultHomePath, navItemsForRole } from '../lib/rbac';

import { WorkflowUxProvider } from '../workflow/WorkflowUxContext';
import { SectionSubNavCard } from './SectionSubNavCard';
import {
  SectionNavOwnershipProvider,
  useSectionNavOwned,
} from './section-nav-ownership';

import {
  AppShell,
  MobileSidebarOverlay,
  PageLoadFallback,
  Sidebar,
  SidebarBrand,
  SidebarLink,
  SidebarNav,
  SidebarSection,
  Topbar,
  TopbarMobileMenuButton,
  TopbarNotifications,
  TopbarThemeToggle,
  TopbarUserMenu,
  UiSwitchOverlay,
  cn,
  renderSidebarNavIcon,
  useUiLanguage,
  useUiTheme,
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
    WMS: 'إدارة المستودع',
    OMS: 'إدارة الطلبات',
    Inbound: 'الوارد',
    Outbound: 'الصادر',
    'OMS Dashboard': 'لوحة OMS',
    'OMS Orders': 'طلبات OMS',
    COD: 'COD',
    'OMS Returns': 'مرتجعات OMS',
    Inventory: 'المخزون',
    Tasks: 'المهام',
    'Cycle count': 'الجرد الدوري',
    Returns: 'الإرجاعات',
    Products: 'المنتجات',
    Locations: 'المواقع التخزينية',
    Warehouses: 'المستودعات',
    Customers: 'العملاء',
    Clients: 'العملاء',
    Forms: 'النماذج',
    Users: 'المستخدمون',
    'Audit logs': 'سجل التدقيق',
    Notifications: 'الإشعارات',
    Settings: 'الإعدادات',
    Contracts: 'العقود',
    Billing: 'الفوترة',
    Profile: 'الملف الشخصي',
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
  group: 'wms' | 'oms' | null;
  active: (pathname: string, search: string) => boolean;
}

function buildFlatNav(t: (s: string) => string, role: string | undefined): FlatNavItem[] {
  return navItemsForRole(role).map((item) => ({
    label: t(item.labelKey),
    iconKey: item.iconKey,
    to: item.to,
    group: item.group ?? null,
    active: (p) => item.match(p),
  }));
}

function renderNavLink(
  item: FlatNavItem,
  pathname: string,
  search: string,
  navigate: (to: string) => void,
  onLinkClick?: () => void,
) {
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
}

function SidebarNavContent({
  items,
  pathname,
  search,
  navigate,
  onLinkClick,
  t,
}: {
  items: FlatNavItem[];
  pathname: string;
  search: string;
  navigate: (to: string) => void;
  onLinkClick?: () => void;
  t: (s: string) => string;
}) {
  const ungrouped = items.filter((i) => !i.group);
  const wmsItems = items.filter((i) => i.group === 'wms');
  const omsItems = items.filter((i) => i.group === 'oms');
  const wmsOpen = wmsItems.some((i) => i.active(pathname, search));
  const omsOpen = omsItems.some((i) => i.active(pathname, search));

  return (
    <SidebarNav>
      {ungrouped.map((item) => renderNavLink(item, pathname, search, navigate, onLinkClick))}
      {wmsItems.length > 0 ? (
        <SidebarSection
          label={t('WMS')}
          icon={renderSidebarNavIcon('Warehouses')}
          defaultOpen={wmsOpen || true}
        >
          {wmsItems.map((item) => renderNavLink(item, pathname, search, navigate, onLinkClick))}
        </SidebarSection>
      ) : null}
      {omsItems.length > 0 ? (
        <SidebarSection
          label={t('OMS')}
          icon={renderSidebarNavIcon('Orders')}
          defaultOpen={omsOpen || true}
        >
          {omsItems.map((item) => renderNavLink(item, pathname, search, navigate, onLinkClick))}
        </SidebarSection>
      ) : null}
    </SidebarNav>
  );
}

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [onClose]);
  return ref;
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [topbarPanel, setTopbarPanel] = useState<'notifications' | 'user' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const { language, setLanguage, isArabic, isSwitching: isLanguageSwitching } = useUiLanguage({
    storageKey: 'wms-ui-language',
    eventName: 'wms-ui-language-changed',
    minLoadingMs: 700,
  });
  const {
    isDark,
    toggle: toggleTheme,
    isSwitching: isThemeSwitching,
    switchingTo,
  } = useUiTheme({ storageKey: 'admin-ui-theme', minLoadingMs: 700 });

  const transitionOverlayOpen = isLanguageSwitching || isThemeSwitching;
  const transitionOverlayCopy = (() => {
    if (isThemeSwitching) {
      const toDark = (switchingTo ?? (isDark ? 'light' : 'dark')) === 'dark';
      if (isArabic) {
        return {
          title: toDark ? 'جاري التبديل إلى الوضع الداكن…' : 'جاري التبديل إلى الوضع الفاتح…',
          hint: 'يتم تحديث المظهر',
        };
      }
      return {
        title: toDark ? 'Switching to dark mode…' : 'Switching to light mode…',
        hint: 'Updating appearance',
      };
    }
    if (isArabic) {
      return { title: 'جاري تحميل اللغة…', hint: 'يتم تحديث الواجهة' };
    }
    return { title: 'Loading language…', hint: 'Updating interface' };
  })();

  const t = (label: string) => sidebarLabel(label, isArabic);

  const searchRef = useOutsideClose(() => setSearchOpen(false));
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMobileNavOpen(false);
    setSearchOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') setSearchOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const homePath = defaultHomePath(user?.role);
  const navItems = buildFlatNav(t, user?.role);
  const notifications = useNotifications();

  const isMacShortcut =
    typeof navigator !== 'undefined' &&
    (/Mac|iPhone|iPad|iPod/i.test(navigator.platform) || /Mac OS X|Macintosh/i.test(navigator.userAgent));
  const quickJumpHint = isMacShortcut ? '⌘K' : 'Ctrl+K';

  const qNorm = searchQuery.trim().toLowerCase();
  const filteredNavItems = qNorm
    ? navItems.filter((item) => item.label.toLowerCase().includes(qNorm))
    : navItems;

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

  function go(to: string) {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(to);
    setMobileNavOpen(false);
  }

  const navContent = (
    <SidebarNavContent
      items={navItems}
      pathname={pathname}
      search={search}
      navigate={navigate}
      onLinkClick={() => setMobileNavOpen(false)}
      t={t}
    />
  );

  return (
    <>
      <UiSwitchOverlay
        open={transitionOverlayOpen}
        title={transitionOverlayCopy.title}
        hint={transitionOverlayCopy.hint}
      />
      <div id="admin-root" key={language} className="h-dvh max-h-dvh overflow-hidden">
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
                      className="h-7 w-auto object-contain brightness-0 invert"
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
                      className="h-7 w-auto object-contain brightness-0 invert"
                    />
                  </Link>
                }
              />
              {navContent}

              <div className="mt-auto p-3 border-t" style={{ borderColor: 'var(--sidebar-border)' }}>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className={cn(
                    'flex items-center justify-center gap-2 w-full rounded-xl px-4 py-3 text-sm font-semibold',
                    'transition-colors duration-fast',
                    'border border-danger-600 bg-danger-600 text-white',
                    'hover:border-danger-700 hover:bg-danger-700 hover:text-white',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30',
                  )}
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M13 4h3v12h-3M8 10l4 4m0-4l-4 4M4 16V4" strokeLinecap="round" />
                  </svg>
                  {t('Sign out')}
                </button>
              </div>
            </MobileSidebarOverlay>

            <AppShell.Column>
              <Topbar className="sticky top-0">
                <Topbar.Start>
                  <TopbarMobileMenuButton onClick={() => setMobileNavOpen(true)} />
                  <Link
                    to={homePath}
                    className="flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 md:hidden"
                    aria-label="EMDAD WMS — Home"
                  >
                    <img src="/emdad-logo.png" alt="EMDAD WMS" className="h-8 w-auto object-contain" />
                  </Link>

                  <div className="relative w-full max-w-md hidden sm:block" ref={searchRef}>
                    <i
                      className="fa-solid fa-magnifying-glass absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-sm"
                      style={{ color: 'var(--topbar-icon)' }}
                    />
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSearchOpen(true);
                      }}
                      onFocus={() => setSearchOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const hit = filteredNavItems[0];
                          if (hit) go(hit.to);
                        }
                      }}
                      placeholder={isArabic ? 'انتقال سريع إلى الصفحات...' : 'Quick jump to pages...'}
                      className={cn(
                        'w-full pl-9 rtl:pl-4 rtl:pr-12 pr-12 py-2 rounded-lg text-sm transition-all',
                        'bg-surface-hover border border-transparent text-text-strong placeholder:text-text-faint',
                        'focus:bg-surface-panel focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)] focus:outline-none',
                      )}
                      aria-label={isArabic ? 'انتقال سريع' : 'Quick jump'}
                      aria-expanded={searchOpen}
                      aria-controls="admin-global-search-results"
                      role="combobox"
                      autoComplete="off"
                    />
                    <kbd
                      dir="ltr"
                      className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-[10px] font-sans font-medium text-text-faint bg-surface-panel border border-border rounded px-1.5 py-0.5 pointer-events-none"
                    >
                      {quickJumpHint}
                    </kbd>
                    {searchOpen ? (
                      <div
                        id="admin-global-search-results"
                        role="listbox"
                        className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-border bg-surface-panel shadow-xl"
                      >
                        <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-text-faint border-b border-border-subtle">
                          {isArabic ? 'انتقال سريع' : 'Quick jump'}
                        </p>
                        <ul className="max-h-72 overflow-y-auto py-1">
                          {filteredNavItems.length === 0 ? (
                            <li className="px-3 py-4 text-center text-xs text-text-faint">
                              {isArabic ? 'لا توجد نتائج' : 'No matching pages'}
                            </li>
                          ) : (
                            filteredNavItems.map((item) => (
                              <li key={item.to} role="option">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-text-body hover:bg-surface-hover rtl:text-right focus-visible:outline-none focus-visible:shadow-focus"
                                  onClick={() => go(item.to)}
                                >
                                  <span className="w-4 text-center text-text-faint">
                                    {renderSidebarNavIcon(item.iconKey)}
                                  </span>
                                  <span className="font-medium">{item.label}</span>
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </Topbar.Start>

                <Topbar.End>
                  {user && (
                    <>
                      <TopbarThemeToggle
                        isDark={isDark}
                        onToggle={toggleTheme}
                        lightLabel={isArabic ? 'الوضع الفاتح' : 'Switch to light mode'}
                        darkLabel={isArabic ? 'الوضع الداكن' : 'Switch to dark mode'}
                      />

                      <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

                      <TopbarNotifications
                        items={notifications.items}
                        unreadCount={notifications.unreadCount}
                        loading={notifications.isLoading}
                        title={isArabic ? 'الإشعارات' : 'Notifications'}
                        emptyLabel={isArabic ? 'لا توجد إشعارات' : 'No notifications yet'}
                        markAllReadLabel={isArabic ? 'تعليم الكل كمقروء' : 'Mark all read'}
                        viewAllLabel={isArabic ? 'عرض الكل' : 'View all'}
                        viewAllHref="/notifications"
                        formatTime={formatNotificationTime}
                        onMarkAllRead={() => void notifications.markAllRead()}
                        onItemClick={(item) => void onNotificationClick(item)}
                        open={topbarPanel === 'notifications'}
                        onOpenChange={(next) => setTopbarPanel(next ? 'notifications' : null)}
                      />
                      <TopbarUserMenu
                        name={displayName(user)}
                        role={friendlyRole(user.role)}
                        connected
                        language={language}
                        onLanguageChange={setLanguage}
                        onProfile={() => navigate('/profile')}
                        profileLabel={t('Profile')}
                        onSignOut={() => void handleLogout()}
                        signOutLabel={t('Sign out')}
                        languageLabel={isArabic ? 'اللغة' : 'Language'}
                        open={topbarPanel === 'user'}
                        onOpenChange={(next) => setTopbarPanel(next ? 'user' : null)}
                      />
                    </>
                  )}
                </Topbar.End>
              </Topbar>

              <AppShell.Main>
                <WorkflowUxProvider>
                  <SectionNavOwnershipProvider>
                    <MainWithOptionalSectionNav isArabic={isArabic} />
                  </SectionNavOwnershipProvider>
                </WorkflowUxProvider>
              </AppShell.Main>
            </AppShell.Column>
          </AppShell.Body>
        </AppShell>
      </div>
    </>
  );
}

function MainWithOptionalSectionNav({ isArabic }: { isArabic: boolean }) {
  const sectionNavOwned = useSectionNavOwned();
  return (
    <>
      {!sectionNavOwned ? <SectionSubNavCard isArabic={isArabic} /> : null}
      <Suspense fallback={<PageLoadFallback />}>
        <RequireRouteAccess>
          <Outlet />
        </RequireRouteAccess>
      </Suspense>
    </>
  );
}
