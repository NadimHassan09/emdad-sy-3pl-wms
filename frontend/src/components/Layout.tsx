import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { WorkflowUxProvider } from '../workflow/WorkflowUxContext';

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
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
  const n = user.fullName?.trim();
  if (n) return n;
  return user.email ?? 'Account';
}

const TASK_NAV = [
  { label: 'Receive', taskType: 'receiving' },
  { label: 'Putaway', taskType: 'putaway' },
  { label: 'Pick', taskType: 'pick' },
  { label: 'Pack', taskType: 'pack' },
  { label: 'Delivery', taskType: 'dispatch' },
] as const;

function useTaskSubtypeActiveFromSearch(taskType: string, search: string): boolean {
  const q = new URLSearchParams(search).get('taskType') ?? '';
  return q === taskType;
}
type SidebarSectionKey = 'dashboard' | 'orders' | 'catalog' | 'inventory' | 'tasks' | 'management';

type SidebarChild = {
  label: string;
  to: string;
  active: (pathname: string, search: string) => boolean;
};

type SidebarSection = {
  key: SidebarSectionKey;
  label: string;
  icon: string;
  children: SidebarChild[];
};

function mainToggleClass(active: boolean) {
  return `flex w-full flex-col items-center justify-center gap-1 rounded-md px-2 py-3 text-xs font-medium transition ${
    active
      ? 'bg-[#1a7a44] text-white'
      : 'border border-transparent bg-transparent text-[#1a7a44] hover:bg-slate-100'
  }`;
}

function nestedLinkClass(active: boolean) {
  return `block rounded-md px-3 py-2 text-sm font-medium transition ${
    active ? 'bg-[#1a7a44] text-white' : 'text-slate-700 hover:bg-slate-100'
  }`;
}

function sidebarLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    Dashboard: 'لوحة التحكم',
    Overview: 'نظرة عامة',
    Orders: 'الطلبات',
    Inbound: 'الوارد',
    Outbound: 'الصادر',
    Catalog: 'الكتالوج',
    Products: 'المنتجات',
    Locations: 'المواقع التخزينية',
    Inventory: 'المخزون',
    Stock: 'المخزون الحالي',
    Adjustments: 'تعديلات المخزون',
    Ledger: 'سجل المخزون',
    Tasks: 'المهام',
    'All tasks': 'جميع المهام',
    'Internal transfer': 'نقل داخلي',
    Receive: 'استلام',
    Putaway: 'تخزين',
    Pick: 'التقاط',
    Pack: 'تغليف',
    Delivery: 'تسليم',
    Manage: 'الإدارة',
    Customers: 'العملاء',
    Users: 'المستخدمون',
    Logout: 'تسجيل الخروج',
  };
  return ar[label] ?? label;
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const [openSection, setOpenSection] = useState<SidebarSectionKey | null>('orders');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'AR'>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('wms-ui-language') : null;
    return saved === 'AR' ? 'AR' : 'EN';
  });
  const isRtl = language === 'AR';
  const t = (label: string) => sidebarLabel(label, isRtl);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, search]);

  const showUsers = !user || user.authGroup === 'ADMIN';

  const sections: SidebarSection[] = [
    {
      key: 'dashboard',
      label: t('Dashboard'),
      icon: 'M4 5h5v5H4zM11 5h5v5h-5zM4 12h5v5H4zM11 12h5v5h-5z',
      children: [
        {
          label: t('Overview'),
          to: '/dashboard/overview',
          active: (p) => p === '/dashboard' || p === '/dashboard/overview',
        },
      ],
    },
    {
      key: 'orders',
      label: t('Orders'),
      icon: 'M4 6h12M4 10h8M4 14h10M4 18h6',
      children: [
        { label: t('Inbound'), to: '/orders/inbound', active: (p) => p.startsWith('/orders/inbound') },
        { label: t('Outbound'), to: '/orders/outbound', active: (p) => p.startsWith('/orders/outbound') },
      ],
    },
    {
      key: 'catalog',
      label: t('Catalog'),
      icon: 'M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z',
      children: [
        { label: t('Products'), to: '/products', active: (p) => p.startsWith('/products') },
        { label: t('Locations'), to: '/locations', active: (p) => p.startsWith('/locations') },
      ],
    },
    {
      key: 'inventory',
      label: t('Inventory'),
      icon: 'M4 6h12M4 10h12M4 14h8',
      children: [
        { label: t('Stock'), to: '/inventory/stock', active: (p) => p === '/inventory' || p === '/inventory/stock' },
        { label: t('Adjustments'), to: '/inventory/adjustments', active: (p) => p.startsWith('/inventory/adjustments') },
        { label: t('Ledger'), to: '/inventory/ledger', active: (p) => p.startsWith('/inventory/ledger') },
      ],
    },
    {
      key: 'tasks',
      label: t('Tasks'),
      icon: 'M4 6h12M4 10h12M4 14h8',
      children: [
        {
          label: t('All tasks'),
          to: '/tasks',
          active: (p, s) => p === '/tasks' && !(new URLSearchParams(s).get('taskType') ?? '').trim(),
        },
        { label: t('Internal transfer'), to: '/internal', active: (p) => p === '/internal' },
        ...TASK_NAV.map((t) => ({
          label: sidebarLabel(t.label, isRtl),
          to: `/tasks?taskType=${encodeURIComponent(t.taskType)}`,
          active: (p: string, s: string) => p === '/tasks' && useTaskSubtypeActiveFromSearch(t.taskType, s),
        })),
      ],
    },
    {
      key: 'management',
      label: t('Manage'),
      icon: 'M10 8a3 3 0 100 6 3 3 0 000-6zM4 17a6 6 0 0112 0',
      children: [
        { label: t('Customers'), to: '/clients', active: (p) => p.startsWith('/clients') },
        ...(showUsers ? [{ label: t('Users'), to: '/users', active: (p: string) => p.startsWith('/users') }] : []),
      ],
    },
  ];

  const visibleSection = openSection;
  const visibleChildren = sections.find((section) => section.key === visibleSection)?.children ?? [];

  useEffect(() => {
    const isArabicUi = language === 'AR';
    document.documentElement.dir = isArabicUi ? 'rtl' : 'ltr';
    document.documentElement.lang = 'en';
    window.localStorage.setItem('wms-ui-language', language);
    window.dispatchEvent(new CustomEvent('wms-ui-language-changed', { detail: { language } }));
  }, [language]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const sidebarInner = (
    <>
      <div
        className={`z-10 flex min-w-[120px] flex-col bg-white p-2 transition-[width] duration-300 ${
          visibleSection ? 'w-1/2' : 'w-full'
        } ${isRtl ? 'border-l' : 'border-r'} border-slate-200`}
      >
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {sections.map((section) => {
            const toggled = visibleSection === section.key;
            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setOpenSection((cur) => (cur === section.key ? null : section.key))}
                className={mainToggleClass(toggled)}
              >
                <Icon path={section.icon} />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mt-2 flex w-full flex-col items-center justify-center gap-1 rounded-md px-2 py-3 text-xs font-medium text-rose-700 transition-all duration-300 ease-in-out hover:bg-rose-50 hover:text-rose-800"
        >
          <Icon path="M13 4h3v12h-3M8 10l4 4m0-4l-4 4M4 16V4" />
          <span>{t('Logout')}</span>
        </button>
      </div>

      <div
        className={`absolute top-0 z-0 flex h-full w-1/2 min-w-[120px] flex-col bg-white p-2 transition-transform duration-300 ${
          isRtl ? 'left-0' : 'right-0'
        } ${
          visibleSection ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {visibleSection ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-base font-bold text-slate-800">
                {sections.find((s) => s.key === visibleSection)?.label}
              </div>
              <button
                type="button"
                onClick={() => setOpenSection(null)}
                className="rounded-md p-1.5 text-rose-700 transition-all duration-300 ease-in-out hover:bg-rose-50 hover:text-rose-800"
                aria-label="Close panel"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {visibleChildren.map((child) => (
                <NavLink
                  key={`${visibleSection}-${child.label}`}
                  to={child.to}
                  className={nestedLinkClass(child.active(pathname, search))}
                >
                  {child.label}
                </NavLink>
              ))}
            </nav>
          </>
        ) : (
          <div className="hidden" />
        )}
      </div>
    </>
  );

  return (
    <div key={language} className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:h-20 sm:px-4 md:h-24 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 md:hidden"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            </svg>
          </button>
          <img
            src="/emdad-logo.png"
            alt="EMDAD Logistics & Warehousing"
            className="h-12 w-auto shrink-0 object-contain sm:h-16 md:h-20"
          />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value === 'AR' ? 'AR' : 'EN')}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none ring-emerald-500 focus:border-emerald-500 focus:ring-1"
              aria-label="Language direction selector"
            >
              <option value="EN">EN</option>
              <option value="AR">AR</option>
            </select>
          </label>
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative" title={displayName(user)}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition-all duration-300 ease-in-out hover:bg-slate-50">
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 16a6 6 0 0 1 12 0" />
                  </svg>
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" aria-hidden />
              </div>
              <div className="hidden min-w-0 text-right sm:block">
                <div className="truncate text-sm font-medium text-slate-900">{displayName(user)}</div>
                <div className="truncate text-xs text-slate-500">{friendlyRole(user.role)}</div>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside
          className={`relative hidden shrink-0 overflow-hidden border-slate-200 bg-white transition-[width] duration-300 md:flex md:max-h-none md:border-b-0 ${
            isRtl ? 'md:border-l' : 'md:border-r'
          } ${
            visibleSection ? 'md:w-72' : 'md:w-36'
          }`}
        >
          {sidebarInner}
        </aside>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true">
            <button
              type="button"
              className="absolute inset-0 bg-slate-900/50"
              aria-label="Close menu"
              onClick={() => setMobileNavOpen(false)}
            />
            <div
              className={`relative z-10 flex h-full w-72 max-w-[85vw] overflow-hidden bg-white shadow-xl ${
                isRtl ? 'ml-auto' : 'mr-auto'
              }`}
            >
              {sidebarInner}
            </div>
          </div>
        ) : null}

        <main key={language} className="min-h-0 flex-1 overflow-auto px-3 py-4 transition-all duration-300 sm:px-4 sm:py-5 md:px-6 md:py-6">
          <WorkflowUxProvider>
            <Outlet />
          </WorkflowUxProvider>
        </main>
      </div>
    </div>
  );
}
