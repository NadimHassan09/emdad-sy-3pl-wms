import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { UsersApi } from '../api/users';
import { PageHeader } from '../components/PageHeader';
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
  const title = variant === 'warehouse' ? 'Warehouse user details' : 'Client user details';

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
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link to={listPath} className="hover:underline">
          ← Back to users
        </Link>
      </div>

      <PageHeader title={title} />

      {userQuery.isPending ? <p className="text-sm text-slate-500">Loading user details…</p> : null}
      {userQuery.isError ? <p className="text-sm text-rose-600">Could not load user details.</p> : null}
      {wrongKind ? (
        <p className="text-sm text-rose-600">This user does not belong on this list.</p>
      ) : null}
      {!userQuery.isPending && !userQuery.isError && !user ? (
        <p className="text-sm text-rose-600">User not found.</p>
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
