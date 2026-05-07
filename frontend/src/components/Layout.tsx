import { useState } from 'react';
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

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  const [openSection, setOpenSection] = useState<SidebarSectionKey | null>('orders');

  const showUsers = !user || user.authGroup === 'ADMIN';

  const sections: SidebarSection[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: 'M4 5h5v5H4zM11 5h5v5h-5zM4 12h5v5H4zM11 12h5v5h-5z',
      children: [
        {
          label: 'Overview',
          to: '/dashboard/overview',
          active: (p) => p === '/dashboard' || p === '/dashboard/overview',
        },
      ],
    },
    {
      key: 'orders',
      label: 'Orders',
      icon: 'M4 6h12M4 10h8M4 14h10M4 18h6',
      children: [
        { label: 'Inbound', to: '/orders/inbound', active: (p) => p.startsWith('/orders/inbound') },
        { label: 'Outbound', to: '/orders/outbound', active: (p) => p.startsWith('/orders/outbound') },
      ],
    },
    {
      key: 'catalog',
      label: 'Catalog',
      icon: 'M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z',
      children: [
        { label: 'Products', to: '/products', active: (p) => p.startsWith('/products') },
        { label: 'Locations', to: '/locations', active: (p) => p.startsWith('/locations') },
      ],
    },
    {
      key: 'inventory',
      label: 'Inventory',
      icon: 'M4 6h12M4 10h12M4 14h8',
      children: [
        { label: 'Stock', to: '/inventory/stock', active: (p) => p === '/inventory' || p === '/inventory/stock' },
        { label: 'Adjustments', to: '/inventory/adjustments', active: (p) => p.startsWith('/inventory/adjustments') },
        { label: 'Ledger', to: '/inventory/ledger', active: (p) => p.startsWith('/inventory/ledger') },
      ],
    },
    {
      key: 'tasks',
      label: 'Tasks',
      icon: 'M4 6h12M4 10h12M4 14h8',
      children: [
        { label: 'All tasks', to: '/tasks', active: (p, s) => p === '/tasks' && !(new URLSearchParams(s).get('taskType') ?? '').trim() },
        { label: 'Internal transfer', to: '/internal', active: (p) => p === '/internal' },
        ...TASK_NAV.map((t) => ({
          label: t.label,
          to: `/tasks?taskType=${encodeURIComponent(t.taskType)}`,
          active: (p: string, s: string) => p === '/tasks' && useTaskSubtypeActiveFromSearch(t.taskType, s),
        })),
      ],
    },
    {
      key: 'management',
      label: 'Manage',
      icon: 'M10 8a3 3 0 100 6 3 3 0 000-6zM4 17a6 6 0 0112 0',
      children: [
        { label: 'Customers', to: '/clients', active: (p) => p.startsWith('/clients') },
        ...(showUsers ? [{ label: 'Users', to: '/users', active: (p: string) => p.startsWith('/users') }] : []),
      ],
    },
  ];

  const visibleSection = openSection;
  const visibleChildren = sections.find((section) => section.key === visibleSection)?.children ?? [];

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-20 flex h-24 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
        <img src="/emdad-logo.png" alt="EMDAD Logistics & Warehousing" className="h-20 w-auto object-contain" />
        {user ? (
          <div className="flex items-center gap-3">
            <div className="relative" title={displayName(user)}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition-all duration-300 ease-in-out hover:bg-slate-50">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 16a6 6 0 0 1 12 0" />
                </svg>
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" aria-hidden />
            </div>
            <div className="min-w-0 text-right">
              <div className="truncate text-sm font-medium text-slate-900">{displayName(user)}</div>
              <div className="truncate text-xs text-slate-500">{friendlyRole(user.role)}</div>
            </div>
          </div>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside
          className={`relative flex max-h-[40vh] w-full shrink-0 overflow-hidden border-b border-slate-200 bg-white transition-[width] duration-300 md:max-h-none md:border-b-0 md:border-r ${
            visibleSection ? 'md:w-72' : 'md:w-36'
          }`}
        >
          <div
            className={`z-10 flex min-w-[120px] flex-col bg-white p-2 transition-[width] duration-300 ${
              visibleSection ? 'w-1/2 border-r border-slate-200' : 'w-full'
            }`}
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
              <span>Logout</span>
            </button>
          </div>

          <div
            className={`absolute right-0 top-0 z-0 flex h-full w-1/2 min-w-[120px] flex-col bg-white p-2 transition-transform duration-300 ${
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
        </aside>

        <main className="min-h-0 flex-1 overflow-auto px-4 py-5 transition-all duration-300 md:px-6 md:py-6">
          <WorkflowUxProvider>
            <Outlet />
          </WorkflowUxProvider>
        </main>
      </div>
    </div>
  );
}
