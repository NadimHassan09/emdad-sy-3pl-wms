import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext';
import { Button } from '../Button';

type Props = {
  t: (en: string, ar: string) => string;
  /** When set, links admins directly to the operator user record. */
  operatorUserId?: string;
};

function isAdminRole(role: string | undefined): boolean {
  return role === 'super_admin' || role === 'wh_manager';
}

export function WorkerProfileOnboardingBanner({ t, operatorUserId }: Props) {
  const { user } = useAuth();
  const admin = isAdminRole(user?.role);
  const manageHref = operatorUserId
    ? `/users/warehouse_users/${operatorUserId}`
    : '/users/warehouse_users';

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p>
        {t(
          'Blind cycle count execution requires a warehouse operator account with an active linked worker profile.',
          'يتطلب تنفيذ الجرد الأعمى حساب مشغل مستودع مرتبط بملف عامل نشط.',
        )}
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-amber-900">
        <li>
          {t(
            'Sign in as a warehouse user with the Worker role, or ask an admin to create one.',
            'سجّل الدخول كمستخدم مستودع بدور عامل، أو اطلب من المسؤول إنشاء حساب.',
          )}
        </li>
        <li>
          {t(
            'An admin must open Users → Warehouse users, edit the operator, and provision or link a worker profile with operational roles.',
            'يجب على المسؤول فتح المستخدمين → مستخدمو المستودع، وتعديل المشغل، وإنشاء أو ربط ملف عامل بأدوار تشغيلية.',
          )}
        </li>
        <li>
          {t(
            'The operator signs out and back in so /auth/me includes workerId, then returns to My cycle counts.',
            'يسجّل المشغل الخروج ثم الدخول حتى يتضمن /auth/me معرف العامل، ثم يعود إلى مهام الجرد.',
          )}
        </li>
      </ol>
      {admin ? (
        <Link to={manageHref}>
          <Button variant="secondary" className="mt-1">
            {t('Manage warehouse users', 'إدارة مستخدمي المستودع')}
          </Button>
        </Link>
      ) : null}
    </div>
  );
}
