/**
 * Client Portal Layout — @ds AppShell with fixed-dark sidebar + theme-aware topbar.
 * Visual language: approved AIDesigner "Shell/Chrome" pattern (Modern Enterprise Hybrid).
 */
import { Suspense, useEffect, useRef, useState, type ReactElement } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import {
  AppShell,
  MobileSidebarOverlay,
  PageLoadFallback,
  Sidebar,
  SidebarBrand,
  SidebarFooter,
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
  useUiLanguage,
  useUiTheme,
} from '@ds';

import { useAuth } from '../auth/AuthContext';
import { useClientNotifications } from '../hooks/useClientNotifications';
import { clientMediaSrc } from '../lib/client-media';
import { clientNavForRole, type ClientNavItem } from '../lib/rbac';
import { resolveClientPageTitle } from '../lib/page-titles';
import { clientNotificationHref } from '../services/clientNotificationsService';
import { BillingRestrictionBanner } from './BillingRestrictionBanner';
import { ClientRoleAccessBanner } from './ClientRoleAccessBanner';

const NAV_ICONS: Record<string, string> = {
  '/dashboard': 'fa-grid-2',
  '/billing': 'fa-file-invoice-dollar',
  '/invoices': 'fa-file-invoice',
  '/notifications': 'fa-bell',
  '/inbound-orders': 'fa-arrow-down',
  '/outbound-orders': 'fa-arrow-up',
  '/products': 'fa-boxes-stacked',
  '/ecommerce-orders': 'fa-cart-shopping',
  '/my-profits': 'fa-money-bill',
  '/ecommerce-orders/returns': 'fa-rotate-left',
  '/outbound-orders/returns': 'fa-rotate-left',
  '/profile': 'fa-user',
};

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

function NavIcon({ path }: { path: string }): ReactElement {
  return <i className={cn('fa-solid', NAV_ICONS[path] ?? 'fa-circle', 'text-sm')} aria-hidden />;
}

function PortalSidebarLink({
  item,
  active,
  isArabic,
  badge,
  onNavigate,
}: {
  item: ClientNavItem;
  active: boolean;
  isArabic: boolean;
  badge?: number;
  onNavigate: (to: string) => void;
}): ReactElement {
  return (
    <SidebarLink
      href={item.to}
      isActive={active}
      icon={<NavIcon path={item.to} />}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(item.to);
      }}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate">{isArabic ? item.labelAr : item.label}</span>
        {badge ? (
          <span className="bg-brand-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
            {badge}
          </span>
        ) : null}
      </span>
    </SidebarLink>
  );
}

export function PortalLayout(): ReactElement {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const { language, setLanguage, isArabic, isSwitching: isLanguageSwitching } = useUiLanguage({
    storageKey: 'wms-ui-language',
    eventName: 'wms-ui-language-changed',
    fallbackStorageKeys: ['client-ui-language'],
    minLoadingMs: 700,
  });
  const {
    isDark,
    toggle: toggleTheme,
    isSwitching: isThemeSwitching,
    switchingTo,
  } = useUiTheme({ storageKey: 'client-ui-theme', minLoadingMs: 700 });

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

  const searchRef = useOutsideClose(() => setSearchOpen(false));
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMobileNavOpen(false);
    setNotifOpen(false);
    setUserMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const title = resolveClientPageTitle(pathname);
    const label = isArabic ? title.ar : title.en;
    document.title = `${label} · ${isArabic ? 'بوابة العميل' : 'Client Portal'}`;
  }, [pathname, isArabic]);

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

  async function handleLogout() {
    await logout();
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  function isActive(item: ClientNavItem): boolean {
    if (item.exact) return pathname === item.to;
    if (!(pathname === item.to || pathname.startsWith(`${item.to}/`))) return false;
    const longerMatch = navItems.some(
      (other) =>
        other.to.length > item.to.length &&
        (other.to === item.to || other.to.startsWith(`${item.to}/`)) &&
        (pathname === other.to || pathname.startsWith(`${other.to}/`)),
    );
    return !longerMatch;
  }

  function go(to: string) {
    navigate(to);
    setMobileNavOpen(false);
  }

  const navItems = clientNavForRole(user?.role);
  const byPath = (to: string) => navItems.find((n) => n.to === to);
  const dashboardItem = byPath('/dashboard');
  const billingItem = byPath('/billing');
  const invoicesItem = byPath('/invoices');
  const notificationsItem = byPath('/notifications');
  const wmsItems = navItems.filter((n) => n.group === 'wms');
  const omsItems = navItems.filter((n) => n.group === 'oms');
  const notifications = useClientNotifications();
  const displayName = user?.fullName?.trim() || user?.email || 'Account';
  const avatarSrc = clientMediaSrc(user?.avatarUrl);
  const roleDisplay =
    user?.role === 'client_admin' ? (isArabic ? 'مدير عميل' : 'Administrator') : isArabic ? 'موظف' : 'Staff';

  const isMacShortcut =
    typeof navigator !== 'undefined' &&
    (/Mac|iPhone|iPad|iPod/i.test(navigator.platform) ||
      /Mac OS X|Macintosh/i.test(navigator.userAgent));
  const quickJumpHint = isMacShortcut ? '⌘K' : 'Ctrl+K';

  const searchDestinations = [
    {
      to: '/dashboard',
      icon: 'fa-grid-2',
      label: isArabic ? 'لوحة التحكم' : 'Dashboard',
      keywords: ['dashboard', 'home', 'لوحة'],
    },
    {
      to: '/ecommerce-orders',
      icon: 'fa-cart-shopping',
      label: isArabic ? 'الطلبات الإلكترونية' : 'Online orders',
      keywords: ['oms', 'online', 'ecommerce', 'store', 'إلكتروني'],
    },
    {
      to: '/my-profits',
      icon: 'fa-money-bill',
      label: isArabic ? 'الدفع عند الاستلام' : 'Cash on delivery',
      keywords: ['cod', 'cash', 'profits', 'أرباح', 'دفع', 'تحصيل'],
    },
    {
      to: '/ecommerce-orders/returns',
      icon: 'fa-rotate-left',
      label: isArabic ? 'المرتجعات' : 'Returns',
      keywords: ['return', 'مرتجع'],
    },
    {
      to: '/inbound-orders',
      icon: 'fa-arrow-down',
      label: isArabic ? 'الوارد' : 'Inbound orders',
      keywords: ['inbound', 'inb', 'asn', 'وارد'],
    },
    {
      to: '/outbound-orders',
      icon: 'fa-arrow-up',
      label: isArabic ? 'الصادر' : 'Outbound orders',
      keywords: ['outbound', 'out', 'ship', 'صادر'],
    },
    {
      to: '/outbound-orders/returns',
      icon: 'fa-rotate-left',
      label: isArabic ? 'مرتجعات الصادر' : 'Outbound returns',
      keywords: ['return', 'outbound', 'مرتجع', 'صادر'],
    },
    {
      to: '/products',
      icon: 'fa-boxes-stacked',
      label: isArabic ? 'المخزون' : 'Inventory',
      keywords: ['product', 'sku', 'barcode', 'inventory', 'منتج', 'مخزون'],
    },
    {
      to: '/billing',
      icon: 'fa-file-invoice-dollar',
      label: isArabic ? 'الفوترة' : 'Billing',
      keywords: ['billing', 'subscription', 'plan', 'فوترة', 'اشتراك'],
    },
    {
      to: '/invoices',
      icon: 'fa-file-invoice',
      label: isArabic ? 'الفواتير' : 'Invoices',
      keywords: ['invoice', 'inv', 'فاتورة', 'فواتير'],
    },
    {
      to: '/notifications',
      icon: 'fa-bell',
      label: isArabic ? 'الإشعارات' : 'Notifications',
      keywords: ['notification', 'alert', 'إشعار'],
    },
    {
      to: '/profile',
      icon: 'fa-user',
      label: isArabic ? 'الملف الشخصي' : 'Profile',
      keywords: ['profile', 'account', 'ملف'],
    },
  ].filter(
    (d) =>
      d.to === '/profile' ||
      d.to === '/dashboard' ||
      d.to === '/outbound-orders/returns' ||
      navItems.some((n) => n.to === d.to),
  );

  const qNorm = searchQuery.trim().toLowerCase();
  const filteredSearchDestinations = qNorm
    ? searchDestinations.filter(
        (d) =>
          d.label.toLowerCase().includes(qNorm) ||
          d.keywords.some((k) => k.includes(qNorm) || qNorm.includes(k)),
      )
    : searchDestinations;

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return isArabic ? 'الآن' : 'Just now';
    if (mins < 60) return isArabic ? `منذ ${mins} د` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return isArabic ? `منذ ${hours} س` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days < 7
      ? isArabic
        ? `منذ ${days} ي`
        : `${days}d ago`
      : new Date(iso).toLocaleDateString();
  }

  async function openNotification(item: { id: string; isRead: boolean }) {
    if (!item.isRead) await notifications.markRead(item.id);
    const full = notifications.items.find((n) => n.id === item.id);
    const href = full ? clientNotificationHref(full) : undefined;
    if (href) navigate(href);
  }

  const omsOpen = omsItems.some((item) => isActive(item));
  const wmsOpen = wmsItems.some((item) => isActive(item));
  const accountOpen =
    (billingItem ? isActive(billingItem) : false) || (invoicesItem ? isActive(invoicesItem) : false);

  const navContent = (
    <SidebarNav className="space-y-0.5">
      {dashboardItem ? (
        <PortalSidebarLink
          item={dashboardItem}
          active={isActive(dashboardItem)}
          isArabic={isArabic}
          onNavigate={go}
        />
      ) : null}
      {omsItems.length > 0 ? (
        <SidebarSection label={isArabic ? 'المتجر' : 'Store'} defaultOpen={omsOpen || true}>
          {omsItems.map((item) => (
            <PortalSidebarLink
              key={item.to}
              item={item}
              active={isActive(item)}
              isArabic={isArabic}
              onNavigate={go}
            />
          ))}
        </SidebarSection>
      ) : null}
      {wmsItems.length > 0 ? (
        <SidebarSection label={isArabic ? 'المستودع' : 'Warehouse'} defaultOpen={wmsOpen || true}>
          {wmsItems.map((item) => (
            <PortalSidebarLink
              key={item.to}
              item={item}
              active={isActive(item)}
              isArabic={isArabic}
              onNavigate={go}
            />
          ))}
        </SidebarSection>
      ) : null}
      {billingItem || invoicesItem ? (
        <SidebarSection label={isArabic ? 'الحساب' : 'Account'} defaultOpen={accountOpen || true}>
          {billingItem ? (
            <PortalSidebarLink
              item={billingItem}
              active={isActive(billingItem)}
              isArabic={isArabic}
              onNavigate={go}
            />
          ) : null}
          {invoicesItem ? (
            <PortalSidebarLink
              item={invoicesItem}
              active={isActive(invoicesItem)}
              isArabic={isArabic}
              onNavigate={go}
            />
          ) : null}
        </SidebarSection>
      ) : null}
      {notificationsItem ? (
        <PortalSidebarLink
          item={notificationsItem}
          active={isActive(notificationsItem)}
          isArabic={isArabic}
          badge={notifications.unreadCount || undefined}
          onNavigate={go}
        />
      ) : null}
    </SidebarNav>
  );

  const brandLogo = (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)] shrink-0">
        <i className="fa-solid fa-warehouse text-white text-sm" aria-hidden />
      </div>
      <span className="font-bold text-[15px] tracking-tight" style={{ color: '#f4f4f5' }}>
        EMDAD
      </span>
    </div>
  );

  const profileButton = (compact?: boolean) => (
    <button
      type="button"
      onClick={() => go('/profile')}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all focus-visible:outline-none focus-visible:shadow-focus',
        'hover:bg-white/5',
        compact || !pathname.startsWith('/profile') ? 'text-[var(--sidebar-text)]' : 'bg-white/5 text-[var(--sidebar-text)]',
      )}
    >
      <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
        {avatarSrc ? <img src={avatarSrc} alt="" className="w-full h-full object-cover" /> : (displayName || 'A').charAt(0).toUpperCase()}
      </div>
      <div className="text-left rtl:text-right min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--sidebar-text)' }}>{displayName}</div>
        <div className="text-xs truncate" style={{ color: 'var(--sidebar-text-muted)' }}>{roleDisplay}</div>
      </div>
    </button>
  );

  return (
    <>
      <UiSwitchOverlay
        open={transitionOverlayOpen}
        title={transitionOverlayCopy.title}
        hint={transitionOverlayCopy.hint}
      />
      <div id="client-portal-root" key={language} className="h-dvh max-h-dvh overflow-hidden">
        <AppShell>
          <AppShell.SkipNav />

          <AppShell.Body>
            <Sidebar>
              <SidebarBrand className="px-5" logo={brandLogo} />
              {navContent}
              <SidebarFooter className="p-3">{profileButton()}</SidebarFooter>
            </Sidebar>

            <MobileSidebarOverlay open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
              <SidebarBrand className="px-5" logo={brandLogo} />
              {navContent}
              <SidebarFooter className="p-3">{profileButton(true)}</SidebarFooter>
            </MobileSidebarOverlay>

            <AppShell.Column>
              <Topbar className="sticky top-0 z-30">
                <Topbar.Start>
                  <TopbarMobileMenuButton
                    onClick={() => setMobileNavOpen(true)}
                    label={isArabic ? 'فتح القائمة' : 'Open menu'}
                  />
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
                          const q = searchQuery.trim().toLowerCase();
                          const hit = searchDestinations.find(
                            (d) =>
                              d.keywords.some((k) => k.includes(q) || q.includes(k)) ||
                              d.label.toLowerCase().includes(q),
                          );
                          if (hit) {
                            setSearchOpen(false);
                            setSearchQuery('');
                            navigate(hit.to);
                          }
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
                      aria-controls="client-global-search-results"
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
                        id="client-global-search-results"
                        role="listbox"
                        className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-border bg-surface-panel shadow-xl"
                      >
                        <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-text-faint border-b border-border-subtle">
                          {isArabic ? 'انتقال سريع' : 'Quick jump'}
                        </p>
                        <ul className="max-h-72 overflow-y-auto py-1">
                          {filteredSearchDestinations.length === 0 ? (
                            <li className="px-3 py-4 text-center text-xs text-text-faint">
                              {isArabic ? 'لا توجد نتائج' : 'No matching pages'}
                            </li>
                          ) : (
                            filteredSearchDestinations.map((d) => (
                              <li key={d.to} role="option">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-text-body hover:bg-surface-hover rtl:text-right focus-visible:outline-none focus-visible:shadow-focus"
                                  onClick={() => {
                                    setSearchOpen(false);
                                    setSearchQuery('');
                                    navigate(d.to);
                                  }}
                                >
                                  <i className={cn('fa-solid', d.icon, 'w-4 text-center text-text-faint')} />
                                  <span className="font-medium">{d.label}</span>
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
                  <TopbarThemeToggle
                    isDark={isDark}
                    onToggle={toggleTheme}
                    lightLabel={isArabic ? 'الوضع الفاتح' : 'Switch to light mode'}
                    darkLabel={isArabic ? 'الوضع الداكن' : 'Switch to dark mode'}
                  />

                  <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

                  <TopbarNotifications
                    items={notifications.items.map((n) => ({
                      id: n.id,
                      title: n.title,
                      body: n.body,
                      isRead: n.isRead,
                      createdAt: n.createdAt,
                    }))}
                    unreadCount={notifications.unreadCount}
                    loading={notifications.isLoading}
                    title={isArabic ? 'الإشعارات' : 'Notifications'}
                    emptyLabel={isArabic ? 'لا توجد إشعارات' : 'No notifications yet'}
                    markAllReadLabel={isArabic ? 'تعليم الكل كمقروء' : 'Mark all read'}
                    viewAllLabel={isArabic ? 'عرض كل الإشعارات' : 'View all notifications'}
                    onViewAll={() => navigate('/notifications')}
                    onItemClick={(item) => void openNotification(item)}
                    onMarkAllRead={() => void notifications.markAllRead()}
                    formatTime={relativeTime}
                    open={notifOpen}
                    onOpenChange={setNotifOpen}
                  />

                  <TopbarUserMenu
                    name={displayName}
                    role={roleDisplay}
                    language={isArabic ? 'AR' : 'EN'}
                    onLanguageChange={(lang) => void setLanguage(lang)}
                    onSignOut={() => void handleLogout()}
                    signOutLabel={isArabic ? 'تسجيل الخروج' : 'Sign out'}
                    languageLabel={isArabic ? 'اللغة' : 'Language'}
                    open={userMenuOpen}
                    onOpenChange={setUserMenuOpen}
                  />
                </Topbar.End>
              </Topbar>

              <AppShell.Main id="main-content" noPad>
                <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
                  <BillingRestrictionBanner />
                  <ClientRoleAccessBanner />
                  <Suspense fallback={<PageLoadFallback />}>
                    <Outlet />
                  </Suspense>
                </div>
              </AppShell.Main>
            </AppShell.Column>
          </AppShell.Body>
        </AppShell>
      </div>
    </>
  );
}
