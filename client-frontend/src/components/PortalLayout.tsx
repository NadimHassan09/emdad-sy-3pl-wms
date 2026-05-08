import { useEffect, useState, type ReactElement } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../auth/AuthContext';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return 'topbar__link' + (isActive ? ' topbar__link--active' : '');
}

export function PortalLayout(): ReactElement {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  async function onLogout(): Promise<void> {
    await logout();
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  return (
    <div key={language} className="page">
      <header className="topbar">
        <span className="topbar__brand">Client portal</span>
        <nav className="topbar__nav" aria-label="Main">
          <NavLink className={navLinkClass} to="/" end>
            Home
          </NavLink>
          <NavLink className={navLinkClass} to="/stock">
            Stock
          </NavLink>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
            <span>Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value === 'AR' ? 'AR' : 'EN')}
              aria-label="Language direction selector"
              style={{
                border: '1px solid var(--app-border)',
                background: 'var(--app-input-bg)',
                color: 'var(--app-input-fg)',
                borderRadius: '0.375rem',
                padding: '0.25rem 0.5rem',
              }}
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

      <Outlet />
    </div>
  );
}
