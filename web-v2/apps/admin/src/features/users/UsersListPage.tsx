import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus, User } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { ConfirmDialog, DataTable, PageHeader, SearchInput, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { toast } from 'sonner'
import { UsersApi, type CreateUserPayload, type UpdateUserPayload, type UserListRow } from '@/api/users'
import { getApiBaseUrl } from '@/api/apiBaseUrl'
import { getAccessToken } from '@/auth/authStorage'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useFilters } from '@/hooks/useFilters'
import { useServerPagination } from '@/hooks/useServerPagination'
import { useDebounced } from '@/lib/useDebounced'
import { adminMediaSrc } from '@/lib/admin-media'
import {
  canEditExistingUsers,
  canManageTargetRole,
} from '@/lib/rbac'
import { workerProfileStatusText } from '@/lib/worker-profile'
import { CreateUserDialog, EditUserDialog } from './UserFormDialogs'
import { UserActivityBadge, UserStatusBadge, formatLastLogin, userRoleLabel } from './users-ui'

export type UsersPageVariant = 'warehouse' | 'client'

function variantToApiKind(variant: UsersPageVariant): 'system' | 'client' {
  return variant === 'warehouse' ? 'system' : 'client'
}

const USERS_PAGE_SIZE = 20
const USERS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

function UsersListContent({ variant }: { variant: UsersPageVariant }) {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user: actor } = useAuth()
  const actorRole = actor?.role
  const canEditUsers = canEditExistingUsers(actorRole)
  const apiKind = variantToApiKind(variant)

  const { draftFilters, appliedFilters, setDraft, applyPatch } = useFilters({ search: '' })
  const debouncedSearch = useDebounced(draftFilters.search, 300)

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserListRow | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<UserListRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserListRow | null>(null)

  useEffect(() => {
    if (debouncedSearch === appliedFilters.search) return
    applyPatch({ search: debouncedSearch })
  }, [debouncedSearch, appliedFilters.search, applyPatch])

  const listParams = useMemo(
    () => ({
      kind: apiKind,
      search: appliedFilters.search.trim() || undefined,
    }),
    [apiKind, appliedFilters.search],
  )

  const pagination = useServerPagination<UserListRow>({
    filterKey: listParams,
    queryKey: QK.users.list(listParams),
    fetchPage: (offset, limit) => UsersApi.list({ ...listParams, offset, limit }),
    defaultPageSize: USERS_PAGE_SIZE,
    pageSizeOptions: USERS_PAGE_SIZE_OPTIONS,
  })

  const presenceQuery = useQuery({
    queryKey: QK.presenceOnlineUsers,
    queryFn: async () => {
      const token = getAccessToken()
      if (!token) return new Set<string>()
      const res = await fetch(`${getApiBaseUrl()}/realtime/presence/online`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })
      if (!res.ok) return new Set<string>()
      const body = (await res.json()) as { data?: { userIds?: string[] } }
      return new Set(body.data?.userIds ?? [])
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    initialData: () => qc.getQueryData<Set<string>>(QK.presenceOnlineUsers),
    initialDataUpdatedAt: () => qc.getQueryState(QK.presenceOnlineUsers)?.dataUpdatedAt,
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['users', 'list'], exact: false })
    void qc.invalidateQueries({ queryKey: QK.workers.all })
  }

  const createMut = useMutation({
    mutationFn: (payload: CreateUserPayload) => UsersApi.create(payload),
    onSuccess: () => {
      toast.success(t('User created.', 'تم إنشاء المستخدم.'))
      setCreateOpen(false)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserPayload }) => UsersApi.update(id, body),
    onSuccess: () => {
      toast.success(t('User saved.', 'تم الحفظ.'))
      setEditUser(null)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const suspendMut = useMutation({
    mutationFn: (id: string) => UsersApi.suspend(id),
    onSuccess: () => {
      toast.success(t('User suspended.', 'تم الإيقاف.'))
      setSuspendTarget(null)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const removeMut = useMutation({
    mutationFn: (id: string) => UsersApi.remove(id),
    onSuccess: () => {
      toast.success(t('User deleted.', 'تم الحذف.'))
      setDeleteTarget(null)
      setEditUser(null)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const openEdit = (u: UserListRow) => {
    if (!canEditUsers || !canManageTargetRole(actorRole, u.role)) {
      toast.error(t('You cannot edit this account.', 'لا يمكنك تعديل هذا الحساب.'))
      return
    }
    setEditUser(u)
  }

  const detailBase = variant === 'warehouse' ? '/users/warehouse_users' : '/users/client_users'

  const columns = useMemo<ColumnDef<UserListRow>[]>(() => {
    const cols: ColumnDef<UserListRow>[] = [
      {
        id: 'name',
        header: t('Name', 'الاسم'),
        cell: ({ row }) => {
          const avatarSrc = adminMediaSrc(row.original.avatarUrl)
          return (
            <div className="flex items-center gap-3">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="size-9 shrink-0 rounded-lg border object-cover" />
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <User className="size-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold">{row.original.fullName}</div>
                <div className="truncate text-xs text-muted-foreground">{row.original.email}</div>
              </div>
            </div>
          )
        },
      },
      {
        id: 'phone',
        header: t('Phone', 'الهاتف'),
        meta: { priority: 2 },
        cell: ({ row }) => row.original.phone ?? '—',
      },
      {
        id: 'role',
        header: t('Role', 'الدور'),
        cell: ({ row }) => userRoleLabel(row.original.role, isArabic),
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <UserStatusBadge status={row.original.status} isArabic={isArabic} />,
      },
    ]

    if (variant === 'warehouse') {
      cols.push({
        id: 'worker',
        header: t('Worker profile', 'ملف العامل'),
        meta: { priority: 3 },
        cell: ({ row }) => {
          if (row.original.role !== 'wh_operator') return '—'
          return workerProfileStatusText(row.original.workerProfile, row.original.status, t)
        },
      })
    } else {
      cols.push({
        id: 'company',
        header: t('Company', 'الشركة'),
        meta: { priority: 2 },
        cell: ({ row }) => row.original.companyName ?? '—',
      })
    }

    cols.push(
      {
        id: 'login',
        header: t('Last login', 'آخر دخول'),
        meta: { priority: 3 },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatLastLogin(row.original.lastLoginAt, locale)}</span>
        ),
      },
      {
        id: 'activity',
        header: t('Activity', 'النشاط'),
        meta: { priority: 3 },
        cell: ({ row }) => (
          <UserActivityBadge
            userId={row.original.id}
            status={row.original.status}
            lastActivityAt={row.original.lastActivityAt}
            onlineUserIds={presenceQuery.data}
            isArabic={isArabic}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        meta: { align: 'end', cardAction: true, hideInCard: true },
        cell: ({ row }) => {
          const u = row.original
          const manageable = canManageTargetRole(actorRole, u.role)
          const showEdit = canEditUsers && manageable
          const showSuspend = manageable && u.status === 'active'
          const showDelete = manageable
          if (!showEdit && !showSuspend && !showDelete) return null
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('Actions', 'إجراءات')} onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {showEdit ? (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      openEdit(u)
                    }}
                  >
                    {t('Edit', 'تعديل')}
                  </DropdownMenuItem>
                ) : null}
                {showSuspend ? (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      setSuspendTarget(u)
                    }}
                  >
                    {t('Suspend', 'إيقاف')}
                  </DropdownMenuItem>
                ) : null}
                {showDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(u)
                      }}
                    >
                      {t('Delete', 'حذف')}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    )

    return cols
  }, [variant, isArabic, locale, actorRole, canEditUsers, presenceQuery.data])

  const errMsg = pagination.error instanceof Error ? pagination.error.message : null
  const pageTitle =
    variant === 'warehouse' ? t('Warehouse users', 'مستخدمو المستودع') : t('Client users', 'مستخدمو العملاء')

  return (
    <div className="space-y-4">
      <PageHeader
        title={pageTitle}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            {t('New user', 'مستخدم جديد')}
          </Button>
        }
      />

      {errMsg ? (
        <Alert variant="destructive">
          <AlertDescription>{errMsg}</AlertDescription>
        </Alert>
      ) : null}

      <SearchInput
        value={draftFilters.search}
        onChange={(v) => setDraft({ search: v })}
        placeholder={t('Search by name or email…', 'ابحث…')}
      />

      <DataTable
        columns={columns}
        data={pagination.rows}
        getRowId={(u) => u.id}
        loading={pagination.isInitialLoading}
        empty={
          variant === 'warehouse'
            ? t('No warehouse users yet.', 'لا مستخدمو مستودع.')
            : t('No client users yet.', 'لا مستخدمو عملاء.')
        }
        pagination={pagination.serverPagination}
        onRowClick={(u) => navigate(`${detailBase}/${u.id}`)}
      />

      <CreateUserDialog
        open={createOpen}
        kind={apiKind}
        actorRole={actorRole}
        onClose={() => setCreateOpen(false)}
        loading={createMut.isPending}
        onSubmit={(payload) => createMut.mutate(payload)}
      />

      <EditUserDialog
        user={editUser}
        actorRole={actorRole}
        onClose={() => setEditUser(null)}
        loading={updateMut.isPending}
        onSubmit={(id, body) => updateMut.mutate({ id, body })}
      />

      <ConfirmDialog
        open={!!suspendTarget}
        onOpenChange={(v) => !v && setSuspendTarget(null)}
        title={t('Suspend user?', 'إيقاف المستخدم؟')}
        description={
          suspendTarget
            ? t(`Suspend "${suspendTarget.email}"?`, `إيقاف "${suspendTarget.email}"؟`)
            : ''
        }
        confirmLabel={t('Suspend', 'إيقاف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        intent="danger"
        loading={suspendMut.isPending}
        onConfirm={() => {
          if (suspendTarget) suspendMut.mutate(suspendTarget.id)
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={t('Delete user?', 'حذف المستخدم؟')}
        description={
          deleteTarget
            ? t(
                `Permanently delete "${deleteTarget.email}"? This may fail if related data exists.`,
                `حذف "${deleteTarget.email}" نهائياً؟`,
              )
            : ''
        }
        confirmLabel={t('Delete', 'حذف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        intent="danger"
        loading={removeMut.isPending}
        onConfirm={() => {
          if (deleteTarget) removeMut.mutate(deleteTarget.id)
        }}
      />
    </div>
  )
}

export function WarehouseUsersPage() {
  return <UsersListContent variant="warehouse" />
}

export function ClientUsersPage() {
  return <UsersListContent variant="client" />
}
