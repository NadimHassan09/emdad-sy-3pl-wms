import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { ConfirmDialog, DataTable, EmptyState, PageHeader, SearchInput } from '@emdad/ui'
import { Badge } from '@emdad/ui/ui/badge'
import { Button } from '@emdad/ui/ui/button'
import { Checkbox } from '@emdad/ui/ui/checkbox'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import {
  type UpdateWarehouseInput,
  type Warehouse,
  type WarehouseStatus,
  WarehousesApi,
} from '@/api/warehouses'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useFilters } from '@/hooks/useFilters'
import { canAccessInternalTransfer } from '@/lib/rbac'
import { WarehouseFormDialog } from './WarehouseFormDialog'

type StatusFilter = '' | WarehouseStatus
type ListFilters = { search: string; status: StatusFilter; includeInactive: boolean }

const INITIAL: ListFilters = { search: '', status: '', includeInactive: false }

function filterWarehouses(rows: Warehouse[], filters: ListFilters): Warehouse[] {
  const q = filters.search.trim().toLowerCase()
  return rows.filter((w) => {
    if (filters.status && w.status !== filters.status) return false
    if (!q) return true
    return (
      w.code.toLowerCase().includes(q) ||
      w.name.toLowerCase().includes(q) ||
      (w.city?.toLowerCase().includes(q) ?? false) ||
      w.country.toLowerCase().includes(q)
    )
  })
}

export function WarehousesPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()
  const { user } = useAuth()
  const canMutate = canAccessInternalTransfer(user?.role)

  const { draftFilters, appliedFilters, setDraft, applyFilters } = useFilters<ListFilters>(INITIAL)
  const [openCreate, setOpenCreate] = useState(false)
  const [editWh, setEditWh] = useState<Warehouse | null>(null)
  const [deactivateWh, setDeactivateWh] = useState<Warehouse | null>(null)

  const list = useQuery({
    queryKey: [...QK.warehouses, appliedFilters.includeInactive] as const,
    queryFn: () => WarehousesApi.list(appliedFilters.includeInactive),
  })

  const filteredRows = useMemo(
    () => filterWarehouses(list.data ?? [], appliedFilters),
    [list.data, appliedFilters],
  )

  const invalidate = () => qc.invalidateQueries({ queryKey: QK.warehouses })

  const createMut = useMutation({
    mutationFn: WarehousesApi.create,
    onSuccess: () => {
      toast.success(t('Warehouse created.', 'تم إنشاء المستودع.'))
      invalidate()
      setOpenCreate(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWarehouseInput }) => WarehousesApi.update(id, input),
    onSuccess: () => {
      toast.success(t('Warehouse updated.', 'تم تحديث المستودع.'))
      invalidate()
      setEditWh(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WarehouseStatus }) => WarehousesApi.setStatus(id, status),
    onSuccess: (wh) => {
      toast.success(t(`Warehouse ${wh.code} is ${wh.status}.`, `المستودع ${wh.code}: ${wh.status}.`))
      invalidate()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deactivateMut = useMutation({
    mutationFn: (id: string) => WarehousesApi.deactivate(id),
    onSuccess: (wh) => {
      toast.success(t(`Warehouse ${wh.code} deactivated.`, `تم إيقاف ${wh.code}.`))
      invalidate()
      setDeactivateWh(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const columns = useMemo<ColumnDef<Warehouse>[]>(
    () => [
      {
        id: 'code',
        header: t('Code', 'الرمز'),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.code}</span>,
      },
      { id: 'name', header: t('Name', 'الاسم'), cell: ({ row }) => row.original.name },
      {
        id: 'city',
        header: t('City', 'المدينة'),
        cell: ({ row }) => row.original.city ?? '—',
      },
      { id: 'country', header: t('Country', 'الدولة'), cell: ({ row }) => row.original.country },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'active' ? 'default' : 'secondary'}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: t('Actions', 'إجراءات'),
        cell: ({ row }) => {
          const w = row.original
          if (!canMutate) return '—'
          return (
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="secondary" onClick={() => setEditWh(w)}>
                {t('Edit', 'تعديل')}
              </Button>
              {w.status === 'active' ? (
                <Button size="sm" variant="secondary" onClick={() => setDeactivateWh(w)}>
                  {t('Deactivate', 'إيقاف')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={statusMut.isPending}
                  onClick={() => statusMut.mutate({ id: w.id, status: 'active' })}
                >
                  {t('Activate', 'تفعيل')}
                </Button>
              )}
            </div>
          )
        },
      },
    ],
    [isArabic, canMutate, statusMut.isPending], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Warehouses', 'المستودعات')}
        description={t(
          'Physical warehouse sites used for inventory and workflows.',
          'مواقع المستودعات للمخزون وسير العمل.',
        )}
        actions={
          canMutate ? (
            <Button onClick={() => setOpenCreate(true)}>
              <Plus className="size-4" aria-hidden />
              {t('New warehouse', 'مستودع جديد')}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <SearchInput
          value={draftFilters.search}
          onChange={(v) => setDraft({ search: v })}
          placeholder={t('Code, name, city, country…', 'رمز، اسم، مدينة…')}
          className="max-w-md"
        />
        <div className="space-y-1.5">
          <Label>{t('Status', 'الحالة')}</Label>
          <Select
            value={draftFilters.status || '__all__'}
            onValueChange={(v) => setDraft({ status: (v === '__all__' ? '' : v) as StatusFilter })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('All', 'الكل')}</SelectItem>
              <SelectItem value="active">{t('Active', 'نشط')}</SelectItem>
              <SelectItem value="inactive">{t('Inactive', 'غير نشط')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Checkbox
            checked={draftFilters.includeInactive}
            onCheckedChange={(v) => setDraft({ includeInactive: v === true })}
          />
          {t('Include inactive', 'تضمين غير النشطة')}
        </label>
        <Button variant="secondary" onClick={() => applyFilters()}>
          {t('Apply', 'تطبيق')}
        </Button>
      </div>

      <DataTable<Warehouse>
        columns={columns}
        data={filteredRows}
        getRowId={(w) => w.id}
        loading={list.isLoading}
        empty={<EmptyState title={t('No warehouses match.', 'لا مستودعات مطابقة.')} />}
      />

      {canMutate ? (
        <>
          <WarehouseFormDialog
            mode="create"
            open={openCreate}
            onClose={() => setOpenCreate(false)}
            loading={createMut.isPending}
            onSubmit={(input) => createMut.mutate(input)}
          />
          <WarehouseFormDialog
            mode="edit"
            open={!!editWh}
            warehouse={editWh}
            onClose={() => setEditWh(null)}
            loading={updateMut.isPending}
            onSubmit={(input) => {
              if (editWh) updateMut.mutate({ id: editWh.id, input })
            }}
          />
          <ConfirmDialog
            open={!!deactivateWh}
            title={t('Deactivate warehouse?', 'إيقاف المستودع؟')}
            description={deactivateWh?.code}
            confirmLabel={t('Deactivate', 'إيقاف')}
            cancelLabel={t('Cancel', 'إلغاء')}
            intent="danger"
            loading={deactivateMut.isPending}
            onOpenChange={(o) => !o && !deactivateMut.isPending && setDeactivateWh(null)}
            onConfirm={() => {
              if (deactivateWh) deactivateMut.mutate(deactivateWh.id)
            }}
          />
        </>
      ) : null}
    </div>
  )
}
