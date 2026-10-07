import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { PageHeader } from '@emdad/ui'
import { Alert, AlertDescription } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Skeleton } from '@emdad/ui/ui/skeleton'
import { UsersApi } from '@/api/users'
import { QK } from '@/constants/query-keys'
import { UserDetailsCard } from './UserDetailsCard'
import { WorkerProfilePanel } from './WorkerProfilePanel'

export type UsersPageVariant = 'warehouse' | 'client'

function UserDetailView({ variant }: { variant: UsersPageVariant }) {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const { id = '' } = useParams()
  const listPath = variant === 'warehouse' ? '/users/warehouse_users' : '/users/client_users'

  const userQuery = useQuery({
    queryKey: QK.users.detail(id),
    queryFn: () => UsersApi.get(id),
    enabled: !!id,
  })

  const user = userQuery.data
  const wrongKind =
    user &&
    ((variant === 'warehouse' && user.kind !== 'system') ||
      (variant === 'client' && user.kind !== 'client'))

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ms-2 w-fit" asChild>
        <Link to={listPath}>
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {t('Back to users', 'العودة للمستخدمين')}
        </Link>
      </Button>

      <PageHeader title={user?.fullName ?? t('User details', 'تفاصيل المستخدم')} description={user?.email} />

      {userQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{t('Could not load user.', 'تعذر التحميل.')}</AlertDescription>
        </Alert>
      ) : null}
      {wrongKind ? (
        <Alert variant="destructive">
          <AlertDescription>{t('User does not belong on this list.', 'المستخدم لا ينتمي لهذه القائمة.')}</AlertDescription>
        </Alert>
      ) : null}
      {!userQuery.isPending && !userQuery.isError && !user ? (
        <Alert variant="destructive">
          <AlertDescription>{t('User not found.', 'غير موجود.')}</AlertDescription>
        </Alert>
      ) : null}

      {userQuery.isPending ? (
        <div className="space-y-3 rounded-xl border p-6" aria-busy>
          <Skeleton className="h-7 w-2/5" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {user && !wrongKind ? (
        <div className="space-y-4">
          <UserDetailsCard user={user} variant={variant} isArabic={isArabic} locale={locale} />
          {variant === 'warehouse' && user.role === 'wh_operator' ? <WorkerProfilePanel user={user} /> : null}
        </div>
      ) : null}
    </div>
  )
}

export function WarehouseUserDetailPage() {
  return <UserDetailView variant="warehouse" />
}

export function ClientUserDetailPage() {
  return <UserDetailView variant="client" />
}
