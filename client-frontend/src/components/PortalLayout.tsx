/**
 * Client Portal Layout — @ds AppShell with dark sidebar + glass topbar.
 */
import { Suspense, useEffect, useRef, useState, type ReactElement } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import {
  AppShell,
  FaIconButton,
  LanguageSwitchOverlay,
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
  cn,
  useUiLanguage,
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
  '/returns': 'fa-rotate-left',
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
      className={
        active
          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/10'
          : undefined
      }
      onClick={(e) => {
        e.preventDefault();
        onNavigate(item.to);
      }}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate">{isArabic ? item.labelAr : item.label}</span>
        {badge ? (
          <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
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
  const { language, setLanguage, isArabic, isSwitching } = useUiLanguage({
    storageKey: 'wms-ui-language',
    eventName: 'wms-ui-language-changed',
    fallbackStorageKeys: ['client-ui-language'],
  });

  const notifRef = useOutsideClose(() => setNotifOpen(false));
  const userMenuRef = useOutsideClose(() => setUserMenuOpen(false));
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
    return item.exact ? pathname === item.to : pathname.startsWith(item.to);
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
  const avatarLetter = (displayName || 'A').charAt(0).toUpperCase();
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
      to: '/returns',
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
  ].filter((d) => d.to === '/profile' || d.to === '/dashboard' || navItems.some((n) => n.to === d.to));

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

  async function openNotification(id: string) {
    const item = notifications.items.find((n) => n.id === id);
    if (item && !item.isRead) await notifications.markRead(id);
    setNotifOpen(false);
    const href = item ? clientNotificationHref(item) : undefined;
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
        <SidebarSection
          label={isArabic ? 'المتجر' : 'Store'}
          defaultOpen={omsOpen || true}
          className="text-slate-500"
        >
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
        <SidebarSection
          label={isArabic ? 'المستودع' : 'Warehouse'}
          defaultOpen={wmsOpen || true}
          className="text-slate-500"
        >
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
        <SidebarSection
          label={isArabic ? 'الحساب' : 'Account'}
          defaultOpen={accountOpen || true}
          className="text-slate-500"
        >
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
      <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
        <i className="fa-solid fa-warehouse text-white text-sm" aria-hidden />
      </div>
      <span className="font-bold text-slate-100 text-lg tracking-tight">EMDAD</span>
    </div>
  );

  const profileButton = (compact?: boolean) => (
    <button
      type="button"
      onClick={() => go('/profile')}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all focus-visible:outline-none focus-visible:shadow-focus',
        compact
          ? 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
          : pathname.startsWith('/profile')
            ? 'bg-white/5 text-slate-100'
            : 'text-slate-400 hover:text-slate-100 hover:bg-white/5',
      )}
    >
      <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
        {avatarSrc ? <img src={avatarSrc} alt="" className="w-full h-full object-cover" /> : avatarLetter}
      </div>
      <div className="text-left rtl:text-right min-w-0">
        <div className="text-sm font-medium text-slate-200 truncate">{displayName}</div>
        <div className="text-xs text-slate-500 truncate">{roleDisplay}</div>
      </div>
    </button>
  );

  return (
    <>
      <LanguageSwitchOverlay open={isSwitching} language={language} />
      <div id="client-portal-root" key={language} className="h-dvh max-h-dvh overflow-hidden">
        <AppShell>
          <AppShell.SkipNav />

          <AppShell.Body>
            <Sidebar className="bg-slate-950 border-slate-800">
              <SidebarBrand className="bg-slate-950 px-5" logo={brandLogo} />
              {navContent}
              <SidebarFooter className="border-slate-800 p-3">{profileButton()}</SidebarFooter>
            </Sidebar>

            <MobileSidebarOverlay open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
              <SidebarBrand className="bg-slate-950 px-5" logo={brandLogo} />
              {navContent}
              <SidebarFooter className="border-slate-800 p-3">{profileButton(true)}</SidebarFooter>
            </MobileSidebarOverlay>

            <AppShell.Column>
              <Topbar className="glass sticky top-0 z-30 border-b border-slate-200/60">
                <Topbar.Start>
                  <TopbarMobileMenuButton
                    onClick={() => setMobileNavOpen(true)}
                    label={isArabic ? 'فتح القائمة' : 'Open menu'}
                  />
                  <div className="relative w-full max-w-md hidden sm:block" ref={searchRef}>
                    <i className="fa-solid fa-magnifying-glass absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
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
                      className="w-full pl-9 rtl:pl-4 rtl:pr-12 pr-12 py-2 bg-slate-100/60 border border-transparent rounded-lg text-sm placeholder:text-slate-400 focus:bg-white input-premium transition-all focus-visible:outline-none focus-visible:shadow-focus"
                      aria-label={isArabic ? 'انتقال سريع' : 'Quick jump'}
                      aria-expanded={searchOpen}
                      aria-controls="client-global-search-results"
                      role="combobox"
                      autoComplete="off"
                    />
                    <kbd
                      dir="ltr"
                      className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-[10px] font-sans font-medium text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5 pointer-events-none"
                    >
                      {quickJumpHint}
                    </kbd>
                    {searchOpen ? (
                      <div
                        id="client-global-search-results"
                        role="listbox"
                        className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-elevated"
                      >
                        <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100">
                          {isArabic ? 'انتقال سريع' : 'Quick jump'}
                        </p>
                        <ul className="max-h-72 overflow-y-auto py-1">
                          {filteredSearchDestinations.length === 0 ? (
                            <li className="px-3 py-4 text-center text-xs text-slate-400">
                              {isArabic ? 'لا توجد نتائج' : 'No matching pages'}
                            </li>
                          ) : (
                            filteredSearchDestinations.map((d) => (
                              <li key={d.to} role="option">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 rtl:text-right focus-visible:outline-none focus-visible:shadow-focus"
                                  onClick={() => {
                                    setSearchOpen(false);
                                    setSearchQuery('');
                                    navigate(d.to);
                                  }}
                                >
                                  <i className={cn('fa-solid', d.icon, 'w-4 text-center text-slate-400')} />
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
                  <div className="relative" ref={notifRef}>
                    <FaIconButton
                      icon="fa-bell"
                      badge={notifications.unreadCount || undefined}
                      active={notifOpen}
                      title={isArabic ? 'الإشعارات' : 'Notifications'}
                      aria-label={
                        isArabic
                          ? `الإشعارات${notifications.unreadCount ? `، ${notifications.unreadCount} غير مقروء` : ''}`
                          : `Notifications${notifications.unreadCount ? `, ${notifications.unreadCount} unread` : ''}`
                      }
                      onClick={() => setNotifOpen((v) => !v)}
                    />
                    {notifOpen ? (
                      <div className="absolute right-0 rtl:right-auto rtl:left-0 top-11 w-80 max-w-[90vw] bg-white rounded-xl border border-slate-200 shadow-elevated z-50 overflow-hidden">
                        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                          <span className="font-semibold text-sm">
                            {isArabic ? 'الإشعارات' : 'Notifications'}
                          </span>
                          <button
                            type="button"
                            onClick={() => void notifications.markAllRead()}
                            className="text-xs text-emerald-600 font-medium hover:underline focus-visible:outline-none focus-visible:shadow-focus rounded"
                          >
                            {isArabic ? 'تعليم الكل كمقروء' : 'Mark all read'}
                          </button>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notifications.items.length === 0 ? (
                            <div className="p-6 text-center text-xs text-slate-400">
                              {isArabic ? 'لا توجد إشعارات' : 'No notifications yet'}
                            </div>
                          ) : (
                            notifications.items.slice(0, 5).map((n) => (
                              <div
                                key={n.id}
                                onClick={() => void openNotification(n.id)}
                                className={cn(
                                  'p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer',
                                  !n.isRead && 'bg-emerald-50/30',
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className={cn(
                                      'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                                      n.isRead ? 'bg-slate-300' : 'bg-emerald-500',
                                    )}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 truncate">{n.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                      {relativeTime(n.createdAt)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            navigate('/notifications');
                          }}
                          className="w-full p-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 border-t border-slate-100 focus-visible:outline-none focus-visible:shadow-focus"
                        >
                          {isArabic ? 'عرض كل الإشعارات' : 'View all notifications'}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

                  <div className="relative" ref={userMenuRef}>
                    <button
                      type="button"
                      onClick={() => setUserMenuOpen((v) => !v)}
                      className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:shadow-focus"
                    >
                      <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                        ) : (
                          avatarLetter
                        )}
                      </div>
                      <span className="text-sm font-medium text-slate-700 hidden md:block max-w-[10rem] truncate">
                        {displayName}
                      </span>
                      <i className="fa-solid fa-chevron-down text-[10px] text-slate-400" />
                    </button>
                    {userMenuOpen ? (
                      <div className="absolute right-0 rtl:right-auto rtl:left-0 top-11 w-56 bg-white rounded-xl border border-slate-200 shadow-elevated z-50 overflow-hidden">
                        <div className="p-3 border-b border-slate-100">
                          <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            navigate('/profile');
                          }}
                          className="w-full text-left rtl:text-right px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 focus-visible:outline-none focus-visible:shadow-focus"
                        >
                          <i className="fa-solid fa-user text-slate-400 w-4" />
                          {isArabic ? 'الملف الشخصي' : 'Profile'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void setLanguage(isArabic ? 'EN' : 'AR')}
                          className="w-full text-left rtl:text-right px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 focus-visible:outline-none focus-visible:shadow-focus"
                        >
                          <i className="fa-solid fa-language text-slate-400 w-4" />
                          {isArabic ? 'English' : 'العربية'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleLogout()}
                          className="w-full text-left rtl:text-right px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-100 focus-visible:outline-none focus-visible:shadow-focus"
                        >
                          <i className="fa-solid fa-arrow-right-from-bracket w-4" />
                          {isArabic ? 'تسجيل الخروج' : 'Sign out'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </Topbar.End>
              </Topbar>

              <AppShell.Main id="main-content" className="bg-slate-50 p-4 md:p-6 lg:p-8" noPad>
                <div className="max-w-7xl mx-auto">
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
