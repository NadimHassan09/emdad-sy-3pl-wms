import type { ReactElement } from 'react';
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

  async function onLogout(): Promise<void> {
    await logout();
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  return (
    <div className="page">
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
        <button className="btn btn--ghost" type="button" onClick={() => void onLogout()}>
          Sign out
        </button>
      </header>

      <Outlet />
    </div>
  );
}
