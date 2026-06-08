import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { LoginScreen } from '@ds';
import { useAuth } from '../auth/AuthContext';
import { getLoginErrorMessage } from '../utils/loginError';

export function LoginPage(): ReactElement {
  const { user, bootstrapped, login } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('client-ui-language') === 'AR' ||
      document.documentElement.dir === 'rtl');

  if (bootstrapped && user) {
    return <Navigate to={from === '/login' ? '/dashboard' : from} replace />;
  }

  if (!bootstrapped) {
    return (
      <LoginScreen
        brandName="EMDAD"
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

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(getLoginErrorMessage(err, isArabic));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LoginScreen
      brandName={isArabic ? 'بوابة العملاء' : 'EMDAD Client Portal'}
      title={isArabic ? 'تسجيل الدخول إلى حسابك' : 'Log in to your account'}
      subtitle={
        isArabic
          ? 'مرحباً بعودتك! سجّل الدخول لمتابعة الطلبات والمخزون.'
          : 'Welcome back! Sign in to track orders and inventory.'
      }
      heroTitle={isArabic ? 'إدارة التنفيذ بثقة' : 'Fulfillment you can trust'}
      heroDescription={
        isArabic
          ? 'اطّلع على الطلبات والمخزون في مكان واحد. تجربة موحّدة لفرق العملاء.'
          : 'View orders and stock in one place. A consistent experience for your client team.'
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
