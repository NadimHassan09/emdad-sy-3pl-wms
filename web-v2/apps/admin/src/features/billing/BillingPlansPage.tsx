import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Building2, MoreHorizontal, Plus, SlidersHorizontal } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import {
  ConfirmDialog,
  DataTable,
  PageHeader,
  ResetFiltersButton,
  SearchInput,
  useNavigate,
} from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@emdad/ui/ui/dropdown-menu'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { BillingApi, type BillingPlanOverviewItem } from '@/api/billing'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useCachedState } from '@/hooks/useCachedState'
import { CHUNK_SIZE_STANDARD, useChunkedServerPagination } from '@/hooks/useChunkedServerPagination'
import { useFilters } from '@/hooks/useFilters'
import { formatDate, formatDecimal } from '@/lib/billing-plan-overview'
import { BillingSubNav } from './BillingSubNav'
import {
  BILLING_CURRENCY,
  DaysRemainingBadge,
  PlanActiveBadge,
  canMutateBilling,
} from './billing-ui'

type ListFilters = {
  search: string
  planStatus: '' | 'active' | 'inactive'
  cycleStartFrom: string
  cycleStartTo: string
  cycleEndFrom: string
  cycleEndTo: string
}

const INITIAL_FILTERS: ListFilters = {
  search: '',
  planStatus: '',
  cycleStartFrom: '',
  cycleStartTo: '',
  cycleEndFrom: '',
  cycleEndTo: '',
}

type PendingAction =
  | { kind: 'renew'; planId: string; name: string; restricted: boolean }
  | { kind: 'suspend'; planId: string; name: string }
  | { kind: 'resume'; planId: string; name: string }

export function BillingPlansPage() {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const canMutate = canMutateBilling(user?.role)

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters<ListFilters>(INITIAL_FILTERS)
  const [advancedOpen, setAdvancedOpen] = useCachedState('billing-plans:advanced-open', false)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const serverFilters = useMemo(
    () => ({
      search: appliedFilters.search.trim() || undefined,
      planStatus: appliedFilters.planStatus || undefined,
      cycleStartFrom: appliedFilters.cycleStartFrom || undefined,
      cycleStartTo: appliedFilters.cycleStartTo || undefined,
      expiryFrom: appliedFilters.cycleEndFrom || undefined,
      expiryTo: appliedFilters.cycleEndTo || undefined,
      sort_by: 'createdAt' as const,
      sort_dir: 'desc' as const,
    }),
    [appliedFilters],
  )

  const pagination = useChunkedServerPagination<BillingPlanOverviewItem>({
    chunkSize: CHUNK_SIZE_STANDARD,
    filterKey: serverFilters,
    fetchChunk: (offset, limit) => BillingApi.listPlansPage({ ...serverFilters, offset, limit }),
    rtQueryKeyPrefix: QK.billing.plans,
    chunkQueryKeyPrefix: 'billing-plans-chunk',
  })

  const invalidatePlans = () => {
    void qc.invalidateQueries({ queryKey: QK.billing.plans })
    void qc.invalidateQueries({ queryKey: QK.billing.capacity })
    void qc.invalidateQueries({ queryKey: QK.companies })
  }

  const suspendMut = useMutation({
    mutationFn: (planId: string) => BillingApi.suspendPlan(planId),
    onSuccess: () => {
      toast.success(t('Billing plan suspended.', 'تم إيقاف خطة الفوترة.'))
      invalidatePlans()
      setPending(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resumeMut = useMutation({
    mutationFn: (planId: string) => BillingApi.resumePlan(planId),
    onSuccess: () => {
      toast.success(t('Billing plan resumed.', 'تم استئناف خطة الفوترة.'))
      invalidatePlans()
      setPending(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const renewMut = useMutation({
    mutationFn: (planId: string) => BillingApi.renewPlan(planId),
    onSuccess: (result) => {
      toast.success(
        result.mode === 'reactivated'
          ? t('Plan renewed and access restored.', 'تم تجديد الخطة واستعادة الوصول.')
          : t('Cycle marked for renewal.', 'تم جدولة التجديد عند انتهاء الدورة.'),
      )
      void qc.invalidateQueries({ queryKey: QK.billing.cycles })
      void qc.invalidateQueries({ queryKey: QK.billing.suspendedAccounts })
      void qc.invalidateQueries({ queryKey: QK.billing.overdueClients })
      invalidatePlans()
      setPending(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const columns = useMemo<ColumnDef<BillingPlanOverviewItem>[]>(
    () => [
      {
        id: 'client',
        header: t('Client', 'العميل'),
        accessorFn: (r) => r.companyName,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Building2 className="size-4 text-muted-foreground" aria-hidden />
            </div>
            <span className="truncate font-medium">{row.original.companyName}</span>
          </div>
        ),
        meta: { priority: 1 },
      },
      {
        id: 'daysRemaining',
        header: t('Remaining days', 'الأيام المتبقية'),
        cell: ({ row }) => (
          <DaysRemainingBadge daysRemaining={row.original.daysRemaining} isArabic={isArabic} />
        ),
        meta: { priority: 2 },
      },
      {
        id: 'volume',
        header: t('Reserved volume', 'الحجم المحجوز'),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{formatDecimal(row.original.plan.reservedVolume, 2)} m³</span>
        ),
        meta: { priority: 3 },
      },
      {
        id: 'price',
        header: t('Price', 'السعر'),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {formatDecimal(row.original.plan.fixedSubscriptionFee)} {BILLING_CURRENCY}
          </span>
        ),
        meta: { priority: 2 },
      },
      {
        id: 'cycle',
        header: t('Billing cycle', 'دورة الفوترة'),
        cell: ({ row }) => (
          <span className="text-sm">{row.original.plan.cycleLengthDays} {t('days', 'يوم')}</span>
        ),
        meta: { priority: 3, hideInCard: true },
      },
      {
        id: 'currentCycle',
        header: t('Current cycle', 'الدورة الحالية'),
        cell: ({ row }) => {
          const start = formatDate(row.original.cycleStart)
          const end = formatDate(row.original.cycleEnd)
          if (start === '—' && end === '—') return <span className="text-sm text-muted-foreground">—</span>
          return (
            <span className="text-sm">
              {start} → {end}
            </span>
          )
        },
        meta: { priority: 3, hideInCard: true },
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => (
          <PlanActiveBadge active={row.original.plan.active} isArabic={isArabic} />
        ),
        meta: { priority: 2 },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const r = row.original
          const showRenew =
            canMutate &&
            (r.billingStatus === 'restricted' ||
              r.cycleStatus === 'active' ||
              r.cycleStatus === 'expired' ||
              r.cycleStatus === 'none')
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label={t('Actions', 'إجراءات')}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/billing/plans/${r.companyId}`)}>
                  {t('View', 'عرض')}
                </DropdownMenuItem>
                {canMutate ? (
                  <DropdownMenuItem onClick={() => navigate(`/billing/plans/${r.companyId}/edit`)}>
                    {t('Edit', 'تعديل')}
                  </DropdownMenuItem>
                ) : null}
                {showRenew ? (
                  <DropdownMenuItem
                    onClick={() =>
                      setPending({
                        kind: 'renew',
                        planId: r.plan.id,
                        name: r.companyName,
                        restricted: r.billingStatus === 'restricted' || r.cycleStatus !== 'active',
                      })
                    }
                  >
                    {t('Renew', 'تجديد')}
                  </DropdownMenuItem>
                ) : null}
                {canMutate && r.plan.active ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setPending({ kind: 'suspend', planId: r.plan.id, name: r.companyName })}
                    >
                      {t('Suspend', 'إيقاف')}
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canMutate && !r.plan.active ? (
                  <DropdownMenuItem
                    onClick={() => setPending({ kind: 'resume', planId: r.plan.id, name: r.companyName })}
                  >
                    {t('Resume', 'استئناف')}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        meta: { priority: 1, cardAction: true, align: 'end' },
      },
    ],
    [canMutate, isArabic, navigate, t],
  )

  const advancedCount = [
    appliedFilters.planStatus,
    appliedFilters.cycleStartFrom,
    appliedFilters.cycleStartTo,
    appliedFilters.cycleEndFrom,
    appliedFilters.cycleEndTo,
  ].filter(Boolean).length

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Billing plans', 'خطط الفوترة')}
        description={t(
          'Subscription storage billing by client — reserved volume, price, and cycle.',
          'فوترة تخزين الاشتراك لكل عميل — الحجم المحجوز والسعر ودورة الفوترة.',
        )}
        actions={
          canMutate ? (
            <>
              <Button variant="outline" onClick={() => navigate('/billing/templates')}>
                {t('Plan templates', 'قوالب الخطط')}
              </Button>
              <Button onClick={() => navigate('/billing/plans/new')}>
                <Plus className="size-4" />
                {t('Create plan', 'إنشاء خطة')}
              </Button>
            </>
          ) : undefined
        }
      />
      <BillingSubNav />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <SearchInput
          className="min-w-0 flex-1 sm:max-w-sm"
          placeholder={t('Search client…', 'بحث عن عميل…')}
          value={draftFilters.search}
          onChange={(v) => setDraft({ search: v })}
        />
        <Select
          value={draftFilters.planStatus || '__all__'}
          onValueChange={(v) =>
            setDraft({ planStatus: v === '__all__' ? '' : (v as ListFilters['planStatus']) })
          }
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder={t('Status', 'الحالة')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('All statuses', 'كل الحالات')}</SelectItem>
            <SelectItem value="active">{t('Active', 'نشطة')}</SelectItem>
            <SelectItem value="inactive">{t('Inactive', 'موقوفة')}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setAdvancedOpen(!advancedOpen)}>
          <SlidersHorizontal className="size-4" />
          {t('Filters', 'تصفية')}
          {advancedCount > 0 ? ` (${advancedCount})` : ''}
        </Button>
        <Button onClick={() => applyFilters()}>{t('Apply', 'تطبيق')}</Button>
        <ResetFiltersButton
          label={t('Reset filters', 'إعادة تعيين الفلاتر')}
          onClick={() => {
            resetFilters()
            setAdvancedOpen(false)
          }}
        />
      </div>

      {advancedOpen ? (
        <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>{t('Cycle start from', 'بداية الدورة من')}</Label>
            <Input
              type="date"
              value={draftFilters.cycleStartFrom}
              onChange={(e) => setDraft({ cycleStartFrom: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Cycle start to', 'بداية الدورة إلى')}</Label>
            <Input
              type="date"
              value={draftFilters.cycleStartTo}
              onChange={(e) => setDraft({ cycleStartTo: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Cycle end from', 'نهاية الدورة من')}</Label>
            <Input
              type="date"
              value={draftFilters.cycleEndFrom}
              onChange={(e) => setDraft({ cycleEndFrom: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Cycle end to', 'نهاية الدورة إلى')}</Label>
            <Input
              type="date"
              value={draftFilters.cycleEndTo}
              onChange={(e) => setDraft({ cycleEndTo: e.target.value })}
            />
          </div>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={pagination.rows}
        getRowId={(r) => r.plan.id}
        onRowClick={(r) => navigate(`/billing/plans/${r.companyId}`)}
        loading={pagination.isInitialLoading}
        empty={t('No billing plans match your filters.', 'لا توجد خطط مطابقة.')}
        pagination={pagination.serverPagination}
        labels={{
          rowsPerPage: t('Rows per page', 'صفوف لكل صفحة'),
          of: t('of', 'من'),
          noResults: t('No results', 'لا نتائج'),
          select: t('Select row', 'تحديد الصف'),
          selectAll: t('Select all', 'تحديد الكل'),
        }}
      />

      {pagination.isError ? (
        <p className="text-sm text-destructive">{(pagination.error as Error).message}</p>
      ) : null}

      <ConfirmDialog
        open={pending?.kind === 'renew'}
        onOpenChange={(open) => !open && setPending(null)}
        title={t('Renew billing plan?', 'تجديد خطة الفوترة؟')}
        description={
          pending?.kind === 'renew'
            ? pending.restricted
              ? t(
                  `Renew billing plan for ${pending.name}? This restores access and starts a new cycle.`,
                  `تجديد خطة ${pending.name}؟ سيستعيد الوصول ويبدأ دورة جديدة.`,
                )
              : t(
                  `Mark billing cycle for ${pending.name} for renewal when it expires?`,
                  `جدولة تجديد دورة ${pending.name} عند انتهائها؟`,
                )
            : ''
        }
        confirmLabel={t('Renew', 'تجديد')}
        cancelLabel={t('Cancel', 'إلغاء')}
        onConfirm={() => {
          if (pending?.kind === 'renew') renewMut.mutate(pending.planId)
        }}
        loading={renewMut.isPending}
      />
      <ConfirmDialog
        open={pending?.kind === 'suspend'}
        onOpenChange={(open) => !open && setPending(null)}
        title={t('Suspend plan?', 'إيقاف الخطة؟')}
        description={
          pending?.kind === 'suspend'
            ? t(
                `Suspend billing plan for ${pending.name}? Subscription will be frozen.`,
                `إيقاف خطة ${pending.name}؟ سيتجمّد الاشتراك.`,
              )
            : ''
        }
        confirmLabel={t('Suspend', 'إيقاف')}
        intent="danger"
        cancelLabel={t('Cancel', 'إلغاء')}
        onConfirm={() => {
          if (pending?.kind === 'suspend') suspendMut.mutate(pending.planId)
        }}
        loading={suspendMut.isPending}
      />
      <ConfirmDialog
        open={pending?.kind === 'resume'}
        onOpenChange={(open) => !open && setPending(null)}
        title={t('Resume plan?', 'استئناف الخطة؟')}
        description={
          pending?.kind === 'resume'
            ? t(`Resume billing plan for ${pending.name}?`, `استئناف خطة ${pending.name}؟`)
            : ''
        }
        confirmLabel={t('Resume', 'استئناف')}
        cancelLabel={t('Cancel', 'إلغاء')}
        onConfirm={() => {
          if (pending?.kind === 'resume') resumeMut.mutate(pending.planId)
        }}
        loading={resumeMut.isPending}
      />
    </div>
  )
}
