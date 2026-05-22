import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { LoginScreen } from '@ds';
import { useAuth } from '../auth/AuthContext';
import { canAccessPath, defaultHomePath } from '../lib/rbac';

export function LoginPage() {
  const { user, booting, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromState = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');

  if (booting) {
    return (
      <LoginScreen
        brandName="EMDAD WMS"
        title=""
        subtitle=""
        heroTitle=""
        heroDescription=""
        email=""
        password=""
        onEmailChange={() => {}}
        onPasswordChange={() => {}}
        onSubmit={() => {}}
        bootSlot={isArabic ? 'جاري التحميل…' : 'Loading…'}
      />
    );
  }

  if (user) {
    const home = defaultHomePath(user.role);
    const target = fromState && canAccessPath(user.role, fromState) ? fromState : home;
    return <Navigate to={target} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await login(email.trim(), password);
      const home = defaultHomePath(loggedIn.role);
      const target = fromState && canAccessPath(loggedIn.role, fromState) ? fromState : home;
      navigate(target, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LoginScreen
      brandName="EMDAD WMS"
      title={isArabic ? 'تسجيل الدخول إلى حسابك' : 'Log in to your account'}
      subtitle={
        isArabic
          ? 'مرحباً بعودتك! سجّل الدخول لإدارة عمليات المستودع.'
          : 'Welcome back! Sign in to manage warehouse operations.'
      }
      heroTitle={
        isArabic ? 'حوّل المخزون إلى حركة' : 'Turn your inventory into motion'
      }
      heroDescription={
        isArabic
          ? 'جودة وتجربة متسقة عبر المنصات والأجهزة. نفّذ عمليات المستودع بسرعة وموثوقية.'
          : 'Consistent quality and experience across platforms and devices. Run warehouse operations faster than ever.'
      }
      submitLabel={isArabic ? 'تسجيل الدخول' : 'Sign in'}
      submittingLabel={isArabic ? 'جاري تسجيل الدخول…' : 'Signing in…'}
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      loading={submitting}
      error={error}
    />
  );
}
