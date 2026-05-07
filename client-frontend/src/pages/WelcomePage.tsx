import type { ReactElement } from 'react';

import { useAuth } from '../auth/AuthContext';

function roleLabel(role: string): string {
  if (role === 'client_staff') return 'Client staff';
  if (role === 'client_admin') return 'Client administrator';
  return role;
}

export function WelcomePage(): ReactElement {
  const { user } = useAuth();

  const displayName = user?.fullName?.trim() || user?.email || 'Client';

  return (
    <main className="main">
      <div className="card">
        <h1 className="card__title">Welcome, {displayName}</h1>

        {user ? (
          <dl className="details">
            <div className="details__row">
              <dt>Name</dt>
              <dd>{user.fullName || '—'}</dd>
            </div>
            <div className="details__row">
              <dt>Email</dt>
              <dd>{user.email ?? '—'}</dd>
            </div>
            <div className="details__row">
              <dt>Role</dt>
              <dd>{roleLabel(user.role)}</dd>
            </div>
            <div className="details__row">
              <dt>Company</dt>
              <dd>{user.companyName || '—'}</dd>
            </div>
          </dl>
        ) : (
          <p className="muted">Loading your profile…</p>
        )}
      </div>
    </main>
  );
}
