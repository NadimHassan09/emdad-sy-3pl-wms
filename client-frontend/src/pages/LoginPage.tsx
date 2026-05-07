import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { getApiErrorMessage } from '../utils/apiError';

export function LoginPage(): ReactElement {
  const { user, bootstrapped, login } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (bootstrapped && user) {
    return <Navigate to={from === '/login' ? '/' : from} replace />;
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Sign-in failed.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page--centered">
      <div className="card card--narrow">
        <h1 className="card__title">Client portal</h1>
        <p className="card__subtitle">Sign in with your client account.</p>

        <form className="form" onSubmit={onSubmit}>
          {error ? (
            <div className="banner banner--error" role="alert">
              {error}
            </div>
          ) : null}

          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="field__input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <input
              className="field__input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button className="btn btn--primary" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
