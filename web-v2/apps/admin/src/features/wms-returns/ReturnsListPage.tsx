import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { formatDate, useUiPreferences } from '@emdad/core'
import { DataTable, EmptyState, PageHeader, ResetFiltersButton, useNavigate } from '@emdad/ui'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ReturnsApi, type ReturnOrderListItem, type ReturnOrderStatus } from '@/api/returns'
import { QK } from '@/constants/query-keys'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import { useFilters } from '@/hooks/useFilters'
import { TASK_LIST_DEFAULT_PAGE_SIZE, useServerPagination } from '@/hooks/useServerPagination'
import { useTenantCompanyId } from '@/hooks/useTenantCompanyId'
import { formatReturnListDisposition, formatReturnListQuantities } from '@/lib/return-list-summary'
import { NewReturnDialog } from './NewReturnDialog'
import { ReturnOrderStatusBadge } from './wms-returns-ui'

type FilterDraft = { status: string; orderSearch: string; createdFrom: string; createdTo: string }

export function ReturnsListPage() {
  const { isArabic, locale } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const companyId = useTenantCompanyId()
  const { warehouseId: wid } = useDefaultWarehouseId()
  const [createOpen, setCreateOpen] = useState(false)

  const initial = useMemo<FilterDraft>(
    () => ({ status: '', orderSearch: '', createdFrom: '', createdTo: '' }),
    [],
  )
  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters(initial)

  const listParams = useMemo(
    () => ({
      companyId: companyId || undefined,
      status: (appliedFilters.status as ReturnOrderStatus) || undefined,
      orderSearch: appliedFilters.orderSearch.trim() || undefined,
      createdFrom: appliedFilters.createdFrom || undefined,
      createdTo: appliedFilters.createdTo || undefined,
    }),
    [appliedFilters, companyId],
  )

  const pagination = useServerPagination<ReturnOrderListItem>({
    filterKey: listParams,
    queryKey: QK.returns.list(listParams),
    fetchPage: (offset, limit) => ReturnsApi.list({ ...listParams, offset, limit }),
    enabled: !!companyId,
    defaultPageSize: TASK_LIST_DEFAULT_PAGE_SIZE,
  })

  const createMut = useMutation({
    mutationFn: ReturnsApi.create,
    onSuccess: (order) => {
      toast.success(t('Return created.', 'تم إنشاء الإرجاع.'))
      qc.invalidateQueries({ queryKey: QK.returns.all })
      setCreateOpen(false)
      navigate(`/returns/${order.id}`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const columns = useMemo<ColumnDef<ReturnOrderListItem>[]>(
    () => [
      {
        id: 'orderNumber',
        header: t('Return #', 'رقم الإرجاع'),
        cell: ({ row }) => (
          <Link to={`/returns/${row.original.id}`} className="font-mono text-sm font-semibold text-primary hover:underline">
            {row.original.orderNumber}
          </Link>
        ),
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => <ReturnOrderStatusBadge status={row.original.status} isArabic={isArabic} />,
      },
      {
        id: 'products',
        header: t('Products', 'المنتجات'),
        cell: ({ row }) => (
          <span className="text-sm" title={row.original.summary?.productSummary}>
            {row.original.summary?.productSummary ?? '—'}
          </span>
        ),
      },
      {
        id: 'qty',
        header: t('Qty', 'الكمية'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{formatReturnListQuantities(row.original.summary)}</span>
        ),
      },
      {
        id: 'outbound',
        header: t('Outbound', 'الصادر'),
        cell: ({ row }) =>
          row.original.originalOutbound ? (
            <Link
              to={`/orders/outbound/${row.original.originalOutbound.id}`}
              className="font-mono text-sm text-primary hover:underline"
            >
              {row.original.originalOutbound.orderNumber}
            </Link>
          ) : (
            '—'
          ),
      },
      {
        id: 'disposition',
        header: t('Disposition', 'التصرف'),
        cell: ({ row }) => (
          <span className="text-sm">{formatReturnListDisposition(row.original.summary, isArabic)}</span>
        ),
      },
      {
        id: 'created',
        header: t('Created', 'أُنشئ'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">{formatDate(row.original.createdAt, locale)}</span>
        ),
      },
      {
        id: 'process',
        header: '',
        cell: ({ row }) => {
          const r = row.original
          const canProcess =
            r.status === 'confirmed' || r.status === 'receiving' || r.status === 'inspecting'
          if (!canProcess) return null
          return (
            <Button size="sm" asChild>
              <Link to={`/returns/${r.id}/process`}>{t('Process', 'معالجة')}</Link>
            </Button>
          )
        },
      },
    ],
    [isArabic, locale],
  )

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('All', 'الكل') },
      { value: 'draft', label: t('Draft', 'مسودة') },
      { value: 'confirmed', label: t('Confirmed', 'مؤكد') },
      { value: 'receiving', label: t('Receiving', 'استلام') },
      { value: 'inspecting', label: t('Inspecting', 'فحص') },
      { value: 'completed', label: t('Completed', 'مكتمل') },
      { value: 'cancelled', label: t('Cancelled', 'ملغي') },
    ],
    [isArabic], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Returns', 'الإرجاعات')}
        description={t('Warehouse return orders (WMS).', 'أوامر إرجاع المستودع.')}
        actions={
          <Button disabled={!companyId || !wid} onClick={() => setCreateOpen(true)}>
            {t('New return', 'إرجاع جديد')}
          </Button>
        }
      />

      {!companyId ? (
        <Alert>
          <AlertTitle>{t('Client scope required', 'يلزم نطاق العميل')}</AlertTitle>
          <AlertDescription>
            {t('Sign in with a tenant company to list returns.', 'سجّل الدخول بنطاق عميل لعرض الإرجاعات.')}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label>{t('Status', 'الحالة')}</Label>
          <Select
            value={draftFilters.status || '__all__'}
            onValueChange={(v) => setDraft({ status: v === '__all__' ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => (
                <SelectItem key={o.value || '__all__'} value={o.value || '__all__'}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 lg:col-span-2">
          <Label>{t('Search', 'بحث')}</Label>
          <Input
            value={draftFilters.orderSearch}
            onChange={(e) => setDraft({ orderSearch: e.target.value })}
            placeholder={t('Return #, reference…', 'رقم الإرجاع، مرجع…')}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('Created from', 'من')}</Label>
          <Input type="date" value={draftFilters.createdFrom} onChange={(e) => setDraft({ createdFrom: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('Created to', 'إلى')}</Label>
          <Input type="date" value={draftFilters.createdTo} onChange={(e) => setDraft({ createdTo: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => applyFilters()}>
          {t('Apply', 'تطبيق')}
        </Button>
        <ResetFiltersButton label={t('Reset', 'إعادة تعيين')} onClick={() => resetFilters()} />
      </div>

      <DataTable<ReturnOrderListItem>
        columns={columns}
        data={pagination.rows}
        getRowId={(r) => r.id}
        loading={pagination.isInitialLoading}
        empty={<EmptyState title={t('No returns match.', 'لا إرجاعات مطابقة.')} />}
        pagination={{
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: pagination.total,
          onPageChange: pagination.serverPagination.onPageChange,
          onPageSizeChange: pagination.serverPagination.onPageSizeChange,
        }}
      />

      {wid ? (
        <NewReturnDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          loading={createMut.isPending}
          warehouseId={wid}
          defaultCompanyId={companyId}
          onSubmit={(input) => createMut.mutate(input)}
        />
      ) : null}
    </div>
  )
}
