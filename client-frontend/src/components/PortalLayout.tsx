import { useEffect, useState, type ReactElement } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthContext';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return 'sidebar__link' + (isActive ? ' sidebar__link--active' : '');
}

export function PortalLayout(): ReactElement {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'AR'>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('client-ui-language') : null;
    return saved === 'AR' ? 'AR' : 'EN';
  });

  useEffect(() => {
    const isArabicUi = language === 'AR';
    document.documentElement.dir = isArabicUi ? 'rtl' : 'ltr';
    document.documentElement.lang = 'en';
    window.localStorage.setItem('client-ui-language', language);
    window.dispatchEvent(new CustomEvent('client-ui-language-changed', { detail: { language } }));
  }, [language]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  async function onLogout(): Promise<void> {
    await logout();
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  const sidebarNav = (
    <nav className="sidebar__nav">
      <NavLink className={navLinkClass} to="/" end>
        Home
      </NavLink>
      <NavLink className={navLinkClass} to="/products">
        Products
      </NavLink>
      <NavLink className={navLinkClass} to="/inbound-orders">
        Inbound
      </NavLink>
      <NavLink className={navLinkClass} to="/outbound-orders">
        Outbound
      </NavLink>
      <NavLink className={navLinkClass} to="/stock">
        Stock
      </NavLink>
    </nav>
  );

  return (
    <div key={language} className="page page--app">
      <header className="topbar topbar--app">
        <div className="topbar__lead">
          <button
            type="button"
            className="topbar__menu-button"
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
          >
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            </svg>
          </button>
          <span className="topbar__brand">Client portal</span>
        </div>
        <div className="topbar__actions">
          <label className="topbar__lang">
            <span className="topbar__lang-label">Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value === 'AR' ? 'AR' : 'EN')}
              aria-label="Language direction selector"
              className="topbar__lang-select"
            >
              <option value="EN">EN</option>
              <option value="AR">AR</option>
            </select>
          </label>
          <button className="btn btn--ghost" type="button" onClick={() => void onLogout()}>
            Sign out
          </button>
        </div>
      </header>
      <div className="app-shell">
        <aside className="sidebar sidebar--desktop" aria-label="Main">
          {sidebarNav}
        </aside>

        {navOpen ? (
          <div className="sidebar-overlay" role="dialog" aria-modal="true">
            <button
              type="button"
              className="sidebar-overlay__backdrop"
              aria-label="Close menu"
              onClick={() => setNavOpen(false)}
            />
            <aside className="sidebar sidebar--mobile" aria-label="Main">
              {sidebarNav}
            </aside>
          </div>
        ) : null}

        <section className="app-main">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
