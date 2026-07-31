import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { Alert, Card, ListPageHeader, Skeleton } from '@ds';

import { UsersApi } from '../api/users';
import { UserDetailsCard } from '../components/users/UserDetailsCard';
import { WorkerProfilePanel } from '../components/users/WorkerProfilePanel';
import { QK } from '../constants/query-keys';
type UsersPageVariant = 'warehouse' | 'client';

function UserDetailPage({ variant }: { variant: UsersPageVariant }) {
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const { id = '' } = useParams<{ id: string }>();
  const listPath = variant === 'warehouse' ? '/users/warehouse_users' : '/users/client_users';
  const title =
    variant === 'warehouse'
      ? t('Warehouse user details', 'تفاصيل مستخدم المستودع')
      : t('Client user details', 'تفاصيل مستخدم العميل');

  const userQuery = useQuery({
    queryKey: QK.users.detail(id ?? ''),
    queryFn: () => UsersApi.get(id),
    enabled: !!id,
  });

  const user = userQuery.data;
  const wrongKind =
    user &&
    ((variant === 'warehouse' && user.kind !== 'system') ||
      (variant === 'client' && user.kind !== 'client'));

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to={listPath}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
        {t('Back to users', 'العودة إلى المستخدمين')}
      </Link>

      <ListPageHeader
        icon={variant === 'warehouse' ? 'fa-user-gear' : 'fa-user-tie'}
        title={user?.fullName ?? title}
        subtitle={user?.email ?? title}
      />

      {userQuery.isError ? (
        <Alert variant="error" title={t('Could not load user details.', 'تعذّر تحميل تفاصيل المستخدم.')} />
      ) : null}
      {wrongKind ? (
        <Alert
          variant="error"
          title={t('This user does not belong on this list.', 'هذا المستخدم لا ينتمي إلى هذه القائمة.')}
        />
      ) : null}
      {!userQuery.isPending && !userQuery.isError && !user ? (
        <Alert variant="error" title={t('User not found.', 'المستخدم غير موجود.')} />
      ) : null}

      {userQuery.isPending ? (
        <Card className="p-5 sm:p-6">
          <div className="space-y-4" aria-busy="true">
            <Skeleton height={28} width="40%" />
            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <Skeleton height={64} />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </div>
            <Skeleton height={120} />
          </div>
        </Card>
      ) : null}

      {user && !wrongKind ? (
        <div className="space-y-4">
          <UserDetailsCard user={user} variant={variant} />
          {variant === 'warehouse' && user.role === 'wh_operator' ? (
            <WorkerProfilePanel user={user} t={t} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function WarehouseUserDetailPage() {
  return <UserDetailPage variant="warehouse" />;
}

export function ClientUserDetailPage() {
  return <UserDetailPage variant="client" />;
}
