import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Download, KeyRound, MoreHorizontal, Plus, RefreshCw } from 'lucide-react'
import { formatDateTime, useUiPreferences } from '@emdad/core'
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthContext'
import { isProductionClientPortal } from '@/lib/production-client-portal'
import { isClientAdmin } from '@/lib/rbac'
import {
  downloadClientApiDocs,
  fetchClientApis,
  regenerateClientApiSecret,
  revokeClientApi,
  setClientApiEnabled,
  type ClientApiCredential,
  type ClientApiSecretOnce,
} from '@/services/clientApisService'
import { ApiCreateDialog } from './ApiCreateDialog'
import { ApiSecretOnceDialog } from './ApiSecretOnceDialog'
import { ApiStatusBadge, CLIENT_APIS_QUERY_KEY, scopeLabel } from './apis-ui'

export function ApisPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canCreate = isClientAdmin(user?.role) && !isProductionClientPortal()
  const [createOpen, setCreateOpen] = useState(false)
  const [secretOnce, setSecretOnce] = useState<ClientApiSecretOnce | null>(null)
  const [revokeId, setRevokeId] = useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: CLIENT_APIS_QUERY_KEY,
    queryFn: fetchClientApis,
  })

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: CLIENT_APIS_QUERY_KEY })

  const regenerateMut = useMutation({
    mutationFn: (id: string) => regenerateClientApiSecret(id),
    onSuccess: (row) => {
      setSecretOnce(row)
      invalidate()
      toast.success(t('Secret regenerated.', 'تم إعادة إنشاء السر.'))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setClientApiEnabled(id, enabled),
    onSuccess: () => {
      invalidate()
      toast.success(t('API status updated.', 'تم تحديث حالة الواجهة.'))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeClientApi(id),
    onSuccess: () => {
      setRevokeId(null)
      invalidate()
      toast.success(t('API key revoked.', 'تم إلغاء المفتاح.'))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const rows = listQuery.data ?? []

  const columns = useMemo<ColumnDef<ClientApiCredential>[]>(
    () => [
      {
        id: 'name',
        header: t('Name', 'الاسم'),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
        meta: { priority: 1, className: 'min-w-32' },
      },
      {
        id: 'scope',
        header: t('Type', 'النوع'),
        cell: ({ row }) => scopeLabel(row.original.scope, isArabic),
        meta: { priority: 1, className: 'min-w-28' },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => (
          <ApiStatusBadge status={row.original.status} isArabic={isArabic} />
        ),
        meta: { priority: 1, className: 'min-w-24' },
      },
      {
        id: 'created',
        header: t('Created', 'تاريخ الإنشاء'),
        cell: ({ row }) => formatDateTime(row.original.createdAt, locale),
        meta: { priority: 2, className: 'min-w-32' },
      },
      {
        id: 'lastUsed',
        header: t('Last used', 'آخر استخدام'),
        cell: ({ row }) =>
          row.original.lastUsedAt
            ? formatDateTime(row.original.lastUsedAt, locale)
            : t('Never', 'لم يُستخدم'),
        meta: { priority: 3, hideInCard: true, className: 'min-w-32' },
      },
      {
        id: 'key',
        header: t('Key', 'المفتاح'),
        cell: ({ row }) => (
          <span className="font-mono text-xs" dir="ltr">
            {row.original.maskedKey}
          </span>
        ),
        meta: { priority: 2, className: 'min-w-36' },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const r = row.original
          const revoked = r.status === 'revoked'
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-9">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">{t('Actions', 'إجراءات')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    void downloadClientApiDocs(r.id, r.scope).catch((err: Error) =>
                      toast.error(err.message),
                    )
                  }
                >
                  <Download className="size-4" />
                  {t('Download documentation', 'تنزيل التوثيق')}
                </DropdownMenuItem>
                {!revoked ? (
                  <>
                    <DropdownMenuItem
                      disabled={regenerateMut.isPending}
                      onClick={() => regenerateMut.mutate(r.id)}
                    >
                      <RefreshCw className="size-4" />
                      {t('Regenerate secret', 'إعادة إنشاء السر')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={toggleMut.isPending}
                      onClick={() =>
                        toggleMut.mutate({ id: r.id, enabled: r.status !== 'active' })
                      }
                    >
                      {t(r.status === 'active' ? 'Disable' : 'Enable', r.status === 'active' ? 'إيقاف' : 'تفعيل')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setRevokeId(r.id)}
                    >
                      {t('Revoke', 'إلغاء')}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        meta: { cardAction: true, align: 'end' },
      },
    ],
    [isArabic, locale, regenerateMut, t, toggleMut],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('APIs', 'واجهات البرمجة')}
        description={t(
          'Credentials for stores, ERPs, and custom apps',
          'مفاتيح للمتاجر وأنظمة ERP والتطبيقات الخارجية',
        )}
        actions={
          canCreate ? (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t('Create API', 'إنشاء واجهة')}
            </Button>
          ) : null
        }
      />

      {listQuery.isError ? (
        <ErrorState
          title={t('Could not load APIs', 'تعذر تحميل الواجهات')}
          description={(listQuery.error as Error).message}
          retryLabel={t('Retry', 'إعادة المحاولة')}
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {!listQuery.isPending && !listQuery.isError && rows.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={t('No APIs yet.', 'لا توجد واجهات بعد.')}
          description={t(
            'Create a key for Shopify, your website, or an ERP.',
            'أنشئ مفتاحاً لشوبيفاي أو موقعك أو نظام ERP.',
          )}
          action={
            canCreate ? (
              <Button type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                {t('Create API', 'إنشاء واجهة')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.id}
          loading={listQuery.isPending}
          empty={t('No APIs yet.', 'لا توجد واجهات بعد.')}
        />
      )}

      <ApiCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setSecretOnce}
      />
      <ApiSecretOnceDialog secret={secretOnce} onClose={() => setSecretOnce(null)} />

      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(o) => !o && setRevokeId(null)}
        intent="danger"
        title={t('Revoke API key?', 'إلغاء مفتاح API؟')}
        description={t(
          'External systems will stop working immediately.',
          'ستتوقف الأنظمة الخارجية فوراً.',
        )}
        confirmLabel={t('Revoke', 'إلغاء')}
        cancelLabel={t('Cancel', 'إلغاء')}
        loading={revokeMut.isPending}
        onConfirm={() => {
          if (revokeId) revokeMut.mutate(revokeId)
        }}
      />
    </div>
  )
}
