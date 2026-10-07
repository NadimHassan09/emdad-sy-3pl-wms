import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Building2, MoreHorizontal, Plus } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { DataTable, PageHeader, SearchInput, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  CompaniesApi,
  type CompanyListRow,
  type CreateCompanyPayload,
  type UpdateCompanyPayload,
} from '@/api/companies'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useFilters } from '@/hooks/useFilters'
import { useDebounced } from '@/lib/useDebounced'
import { adminMediaSrc } from '@/lib/admin-media'
import { CreateCompanyDialog, EditCompanyDialog } from './CompanyFormDialogs'
import { CustomerLifecycleDialog } from './CustomerLifecycleDialog'
import { CompanyStatusBadge } from './clients-ui'

type ListFilters = { search: string }

export function ClientsListPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const [searchParams, setSearchParams] = useSearchParams()

  const { draftFilters, appliedFilters, setDraft, applyPatch } = useFilters<ListFilters>({ search: '' })
  const debouncedSearch = useDebounced(draftFilters.search, 300)

  const [createOpen, setCreateOpen] = useState(() => searchParams.get('create') === '1')
  const [editRow, setEditRow] = useState<CompanyListRow | null>(null)
  const [lifecycleRow, setLifecycleRow] = useState<CompanyListRow | null>(null)

  useEffect(() => {
    if (searchParams.get('create') !== '1') return
    setCreateOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('create')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (debouncedSearch === appliedFilters.search) return
    applyPatch({ search: debouncedSearch })
  }, [debouncedSearch, appliedFilters.search, applyPatch])

  const list = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list({ includeAll: true }),
  })

  const filteredRows = useMemo(() => {
    const q = appliedFilters.search.trim().toLowerCase()
    if (!q) return list.data ?? []
    return (list.data ?? []).filter((r) => {
      const haystack = [r.name, r.tradeName, r.contactEmail, r.contactPhone, r.city, r.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [list.data, appliedFilters.search])

  const invalidate = () => void qc.invalidateQueries({ queryKey: QK.companies })

  const createMut = useMutation({
    mutationFn: async ({ payload, logo }: { payload: CreateCompanyPayload; logo: File | null }) => {
      const company = await CompaniesApi.create(payload)
      if (logo) await CompaniesApi.uploadLogo(company.id, logo)
      return company
    },
    onSuccess: () => {
      toast.success(t('Company created.', 'تم إنشاء الشركة.'))
      setCreateOpen(false)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCompanyPayload }) =>
      CompaniesApi.update(id, payload),
    onSuccess: () => {
      toast.success(t('Company saved.', 'تم حفظ الشركة.'))
      setEditRow(null)
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const columns = useMemo<ColumnDef<CompanyListRow>[]>(
    () => [
      {
        id: 'name',
        header: t('Name', 'الاسم'),
        cell: ({ row }) => {
          const logoSrc = adminMediaSrc(row.original.logoUrl)
          return (
            <div className="flex items-center gap-3">
              {logoSrc ? (
                <img src={logoSrc} alt="" className="size-9 shrink-0 rounded-lg border object-cover" />
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Building2 className="size-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold">{row.original.name}</div>
                <div className="truncate text-xs text-muted-foreground">{row.original.tradeName || '—'}</div>
              </div>
            </div>
          )
        },
      },
      {
        id: 'email',
        header: t('Email', 'البريد'),
        meta: { priority: 2 },
        cell: ({ row }) => row.original.contactEmail,
      },
      {
        id: 'city',
        header: t('City', 'المدينة'),
        meta: { priority: 2 },
        cell: ({ row }) => row.original.city ?? '—',
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <CompanyStatusBadge status={row.original.status} isArabic={isArabic} />,
      },
      {
        id: 'actions',
        header: '',
        meta: { align: 'end', cardAction: true, hideInCard: true },
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('Actions', 'إجراءات')} onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setEditRow(row.original)
                }}
              >
                {t('Edit', 'تعديل')}
              </DropdownMenuItem>
              {row.original.status !== 'purged' ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    setLifecycleRow(row.original)
                  }}
                >
                  {t('Manage account status', 'إدارة الحالة')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [isArabic],
  )

  const errMsg = list.error instanceof Error ? list.error.message : null

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Clients', 'العملاء')}
        description={t('Manage client companies', 'إدارة شركات العملاء')}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            {t('New company', 'شركة جديدة')}
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
        placeholder={t('Search name, email, phone, city…', 'ابحث…')}
      />

      <DataTable
        columns={columns}
        data={filteredRows}
        getRowId={(r) => r.id}
        loading={list.isLoading}
        empty={t('No companies yet.', 'لا توجد شركات.')}
        onRowClick={(r) => navigate(`/clients/${r.id}`)}
      />

      <CreateCompanyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        loading={createMut.isPending}
        onSubmit={(payload, logoFile) => createMut.mutate({ payload, logo: logoFile })}
      />

      <EditCompanyDialog
        company={editRow}
        onClose={() => setEditRow(null)}
        loading={updateMut.isPending}
        onSubmit={(id, payload) => updateMut.mutate({ id, payload })}
        onLogoChange={() => {
          invalidate()
          if (editRow) {
            void CompaniesApi.get(editRow.id).then(setEditRow)
          }
        }}
      />

      <CustomerLifecycleDialog
        company={lifecycleRow}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setLifecycleRow(null)}
      />
    </div>
  )
}
