import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Navigate } from 'react-router'
import { useUiPreferences } from '@emdad/core'
import { DataTable, PageHeader, SearchInput } from '@emdad/ui'
import { StatusBadge } from '@emdad/ui'
import { Alert, AlertDescription } from '@emdad/ui/ui/alert'
import { Button } from '@emdad/ui/ui/button'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { AuditLogsApi, type AuditLogDetail, type AuditLogSummary } from '@/api/audit-logs'
import { CompaniesApi } from '@/api/companies'
import { useAuth } from '@/auth/AuthContext'
import { QK } from '@/constants/query-keys'
import { useCachedState } from '@/hooks/useCachedState'
import { useFilters } from '@/hooks/useFilters'
import {
  auditActionTone,
  auditActionToneLabel,
  auditLogSummaryText,
  formatAuditActionLabel,
  formatAuditRole,
  formatAuditTimestamp,
  truncateMiddle,
} from '@/lib/audit-log-display'
import { auditLogsFiltersToParams, type AuditLogFilters } from '@/lib/audit-logs-filters'
import { companyFilterComboboxOptions } from '@/lib/company-filter-options'
import { defaultHomePath } from '@/lib/rbac'
import { AuditLogDetailDialog } from './AuditLogDetailDialog'

export function AuditLogsPage() {
  const { user } = useAuth()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const [page, setPage] = useCachedState('audit-logs-page', 1)
  const [pageSize, setPageSize] = useCachedState('audit-logs-page-size', 50)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailSeed, setDetailSeed] = useState<AuditLogSummary | null>(null)
  const [exporting, setExporting] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const initialFilters = useMemo<AuditLogFilters>(
    () => ({
      search: '',
      companyId: '',
      actorEmail: '',
      actorRole: '',
      action: '',
      resourceType: '',
      dateFrom: '',
      dateTo: '',
    }),
    [],
  )

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } = useFilters(initialFilters)

  const handleApply = useCallback(() => {
    applyFilters()
    setPage(1)
  }, [applyFilters, setPage])

  const handleReset = useCallback(() => {
    resetFilters()
    setPage(1)
  }, [resetFilters, setPage])

  const listParams = useMemo(
    () => auditLogsFiltersToParams(appliedFilters, pageSize, (page - 1) * pageSize),
    [appliedFilters, page, pageSize],
  )

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  })

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of companiesQuery.data ?? []) map.set(c.id, c.name)
    return map
  }, [companiesQuery.data])

  const clientFilterOptions = useMemo(
    () => companyFilterComboboxOptions(companiesQuery.data, t('All clients', 'كل العملاء')),
    [companiesQuery.data, isArabic],
  )

  const listQuery = useQuery({
    queryKey: QK.auditLogs.list(listParams as Record<string, unknown>),
    queryFn: () => AuditLogsApi.list(listParams),
    enabled: user?.authGroup === 'ADMIN',
    placeholderData: (prev) => prev,
  })

  const policyQuery = useQuery({
    queryKey: QK.auditLogs.policy,
    queryFn: () => AuditLogsApi.policy(),
    enabled: user?.authGroup === 'ADMIN',
    staleTime: 5 * 60_000,
  })

  const detailQuery = useQuery({
    queryKey: QK.auditLogs.detail(detailId ?? ''),
    queryFn: () => AuditLogsApi.getById(detailId!),
    enabled: !!detailId && user?.authGroup === 'ADMIN',
  })

  const exportParams = useMemo(
    (): Parameters<typeof AuditLogsApi.exportDownload>[0] =>
      auditLogsFiltersToParams(appliedFilters, policyQuery.data?.exportMaxRows ?? 500, 0),
    [appliedFilters, policyQuery.data?.exportMaxRows],
  )

  async function handleExport() {
    if (!appliedFilters.dateFrom.trim() || !appliedFilters.dateTo.trim()) {
      toast.error(t('Set date from and date to before export.', 'حدد التاريخ قبل التصدير.'))
      return
    }
    if (policyQuery.data && !policyQuery.data.exportEnabled) {
      toast.error(t('Export is disabled.', 'التصدير معطل.'))
      return
    }
    setExporting(true)
    try {
      await AuditLogsApi.exportDownload(exportParams)
      toast.success(t('Export downloaded.', 'تم التصدير.'))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('Export failed.', 'فشل.'))
    } finally {
      setExporting(false)
    }
  }

  const columns = useMemo<ColumnDef<AuditLogSummary>[]>(
    () => [
      {
        id: 'ts',
        header: t('Timestamp', 'الوقت'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs">{formatAuditTimestamp(row.original.createdAt)}</span>
        ),
      },
      {
        id: 'actor',
        header: t('Actor', 'المستخدم'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{row.original.actorName || row.original.actorEmail}</div>
            <div className="truncate text-xs text-muted-foreground">{row.original.actorEmail}</div>
          </div>
        ),
      },
      {
        id: 'role',
        header: t('Role', 'الدور'),
        meta: { priority: 2 },
        cell: ({ row }) => formatAuditRole(row.original.actorRole, isArabic),
      },
      {
        id: 'company',
        header: t('Company', 'الشركة'),
        meta: { priority: 2 },
        cell: ({ row }) =>
          row.original.companyId
            ? (companyNameById.get(row.original.companyId) ?? truncateMiddle(row.original.companyId))
            : t('System', 'النظام'),
      },
      {
        id: 'action',
        header: t('Action', 'الإجراء'),
        cell: ({ row }) => (
          <span className="font-mono text-xs">{formatAuditActionLabel(row.original.action)}</span>
        ),
      },
      {
        id: 'resource',
        header: t('Resource', 'المورد'),
        meta: { priority: 3 },
        cell: ({ row }) => (
          <div>
            <div className="text-xs">{row.original.resourceType}</div>
            <div className="font-mono text-xs text-muted-foreground">{truncateMiddle(row.original.resourceId, 10, 6)}</div>
          </div>
        ),
      },
      {
        id: 'summary',
        header: t('Summary', 'ملخص'),
        meta: { priority: 3 },
        cell: ({ row }) => (
          <span className="line-clamp-2 text-xs">
            {auditLogSummaryText(row.original.action, row.original.resourceType)}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('Status', 'الحالة'),
        cell: ({ row }) => (
          <StatusBadge tone={auditActionTone(row.original.action)}>
            {auditActionToneLabel(row.original.action, isArabic)}
          </StatusBadge>
        ),
      },
      {
        id: 'view',
        header: '',
        meta: { align: 'end', cardAction: true },
        cell: ({ row }) => (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={(e) => {
              e.stopPropagation()
              setDetailSeed(row.original)
              setDetailId(row.original.id)
            }}
          >
            {t('View', 'عرض')}
          </Button>
        ),
      },
    ],
    [companyNameById, isArabic],
  )

  if (user && user.authGroup !== 'ADMIN') {
    return <Navigate to={defaultHomePath(user.role)} replace />
  }

  const errMsg = listQuery.error instanceof Error ? listQuery.error.message : null
  const detailRow: AuditLogDetail | null = detailQuery.data ?? null
  const detailCompanyName =
    detailRow?.companyId != null ? (companyNameById.get(detailRow.companyId) ?? null) : null

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('Audit logs', 'سجل التدقيق')}
        description={t(
          'Operational traceability across warehouse actions.',
          'تتبع تشغيلي لإجراءات المستودع.',
        )}
        actions={
          policyQuery.data?.exportEnabled ? (
            <Button type="button" variant="outline" disabled={exporting} onClick={() => void handleExport()}>
              {t('Export CSV', 'تصدير CSV')}
            </Button>
          ) : undefined
        }
      />

      {policyQuery.data ? (
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t(
            `Retention: ${policyQuery.data.retentionDays} days · Export max ${policyQuery.data.exportMaxRows} rows`,
            `الاحتفاظ: ${policyQuery.data.retentionDays} يوم`,
          )}
        </p>
      ) : null}

      {errMsg ? (
        <Alert variant="destructive">
          <AlertDescription>{errMsg}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <SearchInput
          value={draftFilters.search}
          onChange={(v) => setDraft({ search: v })}
          placeholder={t('Action, email, resource…', 'بحث…')}
        />
        <Button type="button" variant="ghost" size="sm" onClick={() => setAdvancedOpen((o) => !o)}>
          {advancedOpen ? t('Hide filters', 'إخفاء') : t('Advanced filters', 'فلاتر متقدمة')}
        </Button>
        {advancedOpen ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t('Company', 'الشركة')}</Label>
              <Combobox
                value={draftFilters.companyId}
                onChange={(v) => setDraft({ companyId: v })}
                options={clientFilterOptions}
                placeholder={t('All clients', 'كل العملاء')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Actor email', 'بريد المستخدم')}</Label>
              <Input value={draftFilters.actorEmail} onChange={(e) => setDraft({ actorEmail: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Role', 'الدور')}</Label>
              <Select value={draftFilters.actorRole || '__all__'} onValueChange={(v) => setDraft({ actorRole: v === '__all__' ? '' : v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('All roles', 'كل الأدوار')}</SelectItem>
                  <SelectItem value="super_admin">{t('Super admin', 'مدير عام')}</SelectItem>
                  <SelectItem value="wh_manager">{t('Admin', 'مدير')}</SelectItem>
                  <SelectItem value="wh_operator">{t('Worker', 'عامل')}</SelectItem>
                  <SelectItem value="finance">{t('Finance', 'مالية')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('Action', 'الإجراء')}</Label>
              <Input value={draftFilters.action} onChange={(e) => setDraft({ action: e.target.value })} className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Resource type', 'نوع المورد')}</Label>
              <Input value={draftFilters.resourceType} onChange={(e) => setDraft({ resourceType: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Date from', 'من')}</Label>
              <Input type="date" value={draftFilters.dateFrom} onChange={(e) => setDraft({ dateFrom: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('Date to', 'إلى')}</Label>
              <Input type="date" value={draftFilters.dateTo} onChange={(e) => setDraft({ dateTo: e.target.value })} />
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleApply} disabled={listQuery.isFetching}>
            {t('Apply filters', 'تطبيق')}
          </Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            {t('Reset', 'إعادة')}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={listQuery.data?.items ?? []}
        getRowId={(r) => `${r.id}:${r.createdAt}`}
        loading={listQuery.isLoading}
        empty={t('No audit events match the current filters.', 'لا أحداث مطابقة.')}
        onRowClick={(r) => {
          setDetailSeed(r)
          setDetailId(r.id)
        }}
        pagination={{
          total: listQuery.data?.total ?? 0,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size)
            setPage(1)
          },
          pageSizeOptions: [25, 50, 100],
        }}
      />

      {listQuery.data?.totalCapped ? (
        <p className="text-xs text-tone-warning-fg">
          {t('Result count capped. Narrow filters or export with a date range.', 'العدد محدود — ضيّق الفلاتر.')}
        </p>
      ) : null}

      <AuditLogDetailDialog
        open={!!detailId}
        onClose={() => {
          setDetailId(null)
          setDetailSeed(null)
        }}
        row={detailRow}
        loading={detailQuery.isLoading && !detailRow}
        companyName={detailCompanyName}
        title={
          detailSeed
            ? `${formatAuditActionLabel(detailSeed.action)} · ${truncateMiddle(detailSeed.resourceId, 8, 4)}`
            : t('Audit event', 'حدث')
        }
      />
    </div>
  )
}
