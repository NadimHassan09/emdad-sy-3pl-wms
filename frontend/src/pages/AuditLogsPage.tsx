import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { AuditLogsApi, type AuditLogDetail, type AuditLogSummary, type ListAuditLogsParams } from '../api/audit-logs';
import { CompaniesApi } from '../api/companies';
import { useAuth } from '../auth/AuthContext';
import { AuditLogDetailModal } from '../components/audit-logs/AuditLogDetailModal';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { Column, DataTable } from '../components/DataTable';
import { FilterPanel } from '../components/FilterPanel';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { useFilters } from '../hooks/useFilters';
import {
  auditActionBadgeClass,
  auditLogSummaryText,
  formatAuditActionLabel,
  formatAuditRole,
  formatAuditTimestamp,
  truncateMiddle,
} from '../lib/audit-log-display';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';
import { defaultHomePath } from '../lib/rbac';

type AuditLogFilters = {
  search: string;
  companyId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  dateFrom: string;
  dateTo: string;
};

function filtersToParams(
  filters: AuditLogFilters,
  limit: number,
  offset: number,
): ListAuditLogsParams {
  return {
    limit,
    offset,
    search: filters.search.trim() || undefined,
    company_id: filters.companyId.trim() || undefined,
    actor_email: filters.actorEmail.trim() || undefined,
    actor_role: filters.actorRole.trim() || undefined,
    action: filters.action.trim() || undefined,
    resource_type: filters.resourceType.trim() || undefined,
    date_from: filters.dateFrom.trim() || undefined,
    date_to: filters.dateTo.trim() || undefined,
    sort_by: 'created_at',
    sort_dir: 'desc',
  };
}

export function AuditLogsPage() {
  const { user } = useAuth();
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailSeed, setDetailSeed] = useState<AuditLogSummary | null>(null);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

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
  );

  const { draftFilters, appliedFilters, setDraft, applyFilters, resetFilters } =
    useFilters(initialFilters);

  const handleApply = useCallback(() => {
    applyFilters();
    setPage(1);
  }, [applyFilters]);

  const handleReset = useCallback(() => {
    resetFilters();
    setPage(1);
  }, [resetFilters]);

  const listParams = useMemo(
    () => filtersToParams(appliedFilters, pageSize, (page - 1) * pageSize),
    [appliedFilters, page, pageSize],
  );

  const companiesQuery = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const companyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companiesQuery.data ?? []) {
      map.set(c.id, c.name);
    }
    return map;
  }, [companiesQuery.data]);

  const clientFilterOptions = useMemo(
    () => companyFilterComboboxOptions(companiesQuery.data, t('All clients', 'كل العملاء')),
    [companiesQuery.data, isArabic],
  );

  const listQuery = useQuery({
    queryKey: QK.auditLogs.list(listParams as Record<string, unknown>),
    queryFn: () => AuditLogsApi.list(listParams),
    enabled: user?.authGroup === 'ADMIN',
    placeholderData: (prev) => prev,
  });

  const policyQuery = useQuery({
    queryKey: QK.auditLogs.policy,
    queryFn: () => AuditLogsApi.policy(),
    enabled: user?.authGroup === 'ADMIN',
    staleTime: 5 * 60_000,
  });

  const detailQuery = useQuery({
    queryKey: QK.auditLogs.detail(detailId ?? ''),
    queryFn: () => AuditLogsApi.getById(detailId!),
    enabled: !!detailId && user?.authGroup === 'ADMIN',
  });

  const roleOptions = useMemo(
    () => [
      { value: '', label: t('All roles', 'كل الأدوار') },
      { value: 'super_admin', label: t('Super admin', 'مدير عام') },
      { value: 'wh_manager', label: t('Admin', 'مدير') },
      { value: 'wh_operator', label: t('Worker', 'عامل') },
      { value: 'finance', label: t('Finance', 'مالية') },
    ],
    [isArabic],
  );

  const columns: Column<AuditLogSummary>[] = useMemo(
    () => [
      {
        header: t('Timestamp', 'الوقت'),
        accessor: (r) => (
          <span className="whitespace-nowrap font-mono text-xs text-slate-700">
            {formatAuditTimestamp(r.createdAt)}
          </span>
        ),
        width: '168px',
      },
      {
        header: t('Actor', 'المستخدم'),
        accessor: (r) => (
          <div className="min-w-[9rem]">
            <div className="truncate font-medium text-slate-900">{r.actorName || r.actorEmail}</div>
            <div className="truncate text-xs text-slate-500">{r.actorEmail}</div>
          </div>
        ),
      },
      {
        header: t('Role', 'الدور'),
        accessor: (r) => (
          <span className="whitespace-nowrap text-xs text-slate-700">{formatAuditRole(r.actorRole)}</span>
        ),
        width: '100px',
      },
      {
        header: t('Company', 'الشركة'),
        accessor: (r) => (
          <span className="truncate text-xs text-slate-600">
            {r.companyId ? companyNameById.get(r.companyId) ?? truncateMiddle(r.companyId) : t('System', 'النظام')}
          </span>
        ),
        width: '120px',
      },
      {
        header: t('Action', 'الإجراء'),
        accessor: (r) => (
          <span className="font-mono text-xs font-medium text-slate-800">{formatAuditActionLabel(r.action)}</span>
        ),
        width: '140px',
      },
      {
        header: t('Resource', 'المورد'),
        accessor: (r) => (
          <div className="min-w-[7rem]">
            <div className="text-xs text-slate-700">{r.resourceType}</div>
            <div className="font-mono text-[11px] text-slate-500" title={r.resourceId}>
              {truncateMiddle(r.resourceId, 10, 6)}
            </div>
          </div>
        ),
        width: '130px',
      },
      {
        header: t('Summary', 'ملخص'),
        accessor: (r) => (
          <span className="line-clamp-2 text-xs text-slate-600">
            {auditLogSummaryText(r.action, r.resourceType)}
          </span>
        ),
      },
      {
        header: t('Status', 'الحالة'),
        accessor: (r) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset ${auditActionBadgeClass(r.action)}`}
          >
            {auditActionToneLabel(r.action, isArabic)}
          </span>
        ),
        width: '92px',
      },
      {
        header: t('Details', 'التفاصيل'),
        accessor: (r) => (
          <button
            type="button"
            className="whitespace-nowrap text-xs font-medium text-[#1a7a44] hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              setDetailSeed(r);
              setDetailId(r.id);
            }}
          >
            {t('View', 'عرض')}
          </button>
        ),
        width: '72px',
        className: 'text-right',
      },
    ],
    [companyNameById, isArabic],
  );

  if (user && user.authGroup !== 'ADMIN') {
    return <Navigate to={defaultHomePath(user.role)} replace />;
  }

  const errMsg = listQuery.error instanceof Error ? listQuery.error.message : null;
  const detailRow: AuditLogDetail | null = detailQuery.data ?? null;
  const detailCompanyName =
    detailRow?.companyId != null ? companyNameById.get(detailRow.companyId) ?? null : null;

  const exportParams = useMemo(
    (): Parameters<typeof AuditLogsApi.exportDownload>[0] =>
      filtersToParams(appliedFilters, policyQuery.data?.exportMaxRows ?? 500, 0),
    [appliedFilters, policyQuery.data?.exportMaxRows],
  );

  async function handleExport() {
    if (!appliedFilters.dateFrom.trim() || !appliedFilters.dateTo.trim()) {
      toast.error(t('Set date from and date to before export.', 'حدد تاريخ البداية والنهاية قبل التصدير.'));
      return;
    }
    if (policyQuery.data && !policyQuery.data.exportEnabled) {
      toast.error(t('Export is disabled on this environment.', 'التصدير معطل في هذه البيئة.'));
      return;
    }
    setExporting(true);
    try {
      await AuditLogsApi.exportDownload(exportParams);
      toast.success(t('Export downloaded.', 'تم تنزيل التصدير.'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('Export failed.', 'فشل التصدير.'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {errMsg ? <p className="mb-3 text-sm text-rose-600">{errMsg}</p> : null}

      {policyQuery.data ? (
        <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {t(
            `Retention: ${policyQuery.data.retentionDays} days · Query window default ${policyQuery.data.queryDefaultWindowDays}d · Export max ${policyQuery.data.exportMaxRows} rows / ${policyQuery.data.exportMaxDateRangeDays}d range · Count cap ${policyQuery.data.queryCountCap.toLocaleString()}`,
            `الاحتفاظ: ${policyQuery.data.retentionDays} يوم · نافذة الاستعلام ${policyQuery.data.queryDefaultWindowDays} يوم · التصدير ${policyQuery.data.exportMaxRows} صف / ${policyQuery.data.exportMaxDateRangeDays} يوم · حد العد ${policyQuery.data.queryCountCap.toLocaleString()}`,
          )}
        </p>
      ) : null}

      <FilterPanel
        title={t('Audit log filters', 'فلاتر سجل التدقيق')}
        onApply={handleApply}
        onReset={handleReset}
        loading={listQuery.isFetching}
        applyLabel={t('Apply filters', 'تطبيق الفلاتر')}
        resetLabel={t('Reset filters', 'إعادة تعيين الفلاتر')}
      >
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          <TextField
            label={t('Search', 'بحث')}
            value={draftFilters.search}
            onChange={(e) => setDraft({ search: e.target.value })}
            placeholder={t('Action, email, resource…', 'إجراء، بريد، مورد…')}
            className="min-w-[8rem] flex-[1.2] basis-40"
          />
          <Combobox
            label={t('Company', 'الشركة')}
            value={draftFilters.companyId}
            onChange={(v) => setDraft({ companyId: v })}
            options={clientFilterOptions}
            placeholder={t('All clients', 'كل العملاء')}
            className="min-w-[7rem] flex-1 basis-32"
          />
          <TextField
            label={t('Actor email', 'بريد المستخدم')}
            value={draftFilters.actorEmail}
            onChange={(e) => setDraft({ actorEmail: e.target.value })}
            placeholder={t('Exact email', 'بريد مطابق')}
            className="min-w-[7rem] flex-1 basis-32"
          />
          <SelectField
            label={t('Role', 'الدور')}
            name="auditActorRole"
            value={draftFilters.actorRole}
            onChange={(e) => setDraft({ actorRole: e.target.value })}
            options={roleOptions}
            className="min-w-[6.5rem] flex-1 basis-28"
          />
          <TextField
            label={t('Action', 'الإجراء')}
            value={draftFilters.action}
            onChange={(e) => setDraft({ action: e.target.value })}
            placeholder="AUTH_LOGIN_SUCCESS"
            className="min-w-[7rem] flex-1 basis-32 font-mono text-xs"
          />
          <TextField
            label={t('Resource type', 'نوع المورد')}
            value={draftFilters.resourceType}
            onChange={(e) => setDraft({ resourceType: e.target.value })}
            placeholder="user, warehouse_task…"
            className="min-w-[7rem] flex-1 basis-32"
          />
          <TextField
            label={t('Date from', 'من تاريخ')}
            type="date"
            value={draftFilters.dateFrom}
            onChange={(e) => setDraft({ dateFrom: e.target.value })}
            className="min-w-[7rem] max-w-[10.5rem] flex-[0.85] basis-28"
          />
          <TextField
            label={t('Date to', 'إلى تاريخ')}
            type="date"
            value={draftFilters.dateTo}
            onChange={(e) => setDraft({ dateTo: e.target.value })}
            className="min-w-[7rem] max-w-[10.5rem] flex-[0.85] basis-28"
          />
        </div>
      </FilterPanel>

      <DataTable
        title={t('Audit logs', 'سجل التدقيق')}
        description={t(
          'Operational traceability across warehouse actions. Click a row or View for full before/after state.',
          'تتبع تشغيلي لإجراءات المستودع. انقر على صف أو «عرض» لرؤية الحالة قبل/بعد.',
        )}
        actions={
          policyQuery.data?.exportEnabled ? (
            <Button type="button" variant="secondary" loading={exporting} onClick={() => void handleExport()}>
              {t('Export CSV', 'تصدير CSV')}
            </Button>
          ) : null
        }
        columns={columns}
        rows={listQuery.data?.items ?? []}
        rowKey={(r) => `${r.id}:${r.createdAt}`}
        loading={listQuery.isLoading}
        empty={t('No audit events match the current filters.', 'لا توجد أحداث تدقيق مطابقة للفلاتر الحالية.')}
        onRowClick={(r) => {
          setDetailSeed(r);
          setDetailId(r.id);
        }}
        serverPagination={{
          total: listQuery.data?.total ?? 0,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          pageSizeOptions: [25, 50, 100],
        }}
        labels={{
          rowsSuffix: t('rows', 'صف'),
          resultsSuffix: t('results', 'نتيجة'),
          ofWord: t('of', 'من'),
          previous: t('Previous', 'السابق'),
          next: t('Next', 'التالي'),
          rowsPerPageAria: t('Rows per page', 'عدد الصفوف لكل صفحة'),
        }}
      />

      {listQuery.data?.totalCapped ? (
        <p className="mt-2 text-xs text-amber-700">
          {t(
            `Result count capped at ${policyQuery.data?.queryCountCap.toLocaleString() ?? '10,000'}+ matches. Narrow filters or use export with a date range.`,
            `العدد محدود عند ${policyQuery.data?.queryCountCap.toLocaleString() ?? '10000'}+ نتيجة. ضيّق الفلاتر أو صدّر بنطاق تاريخ.`,
          )}
        </p>
      ) : null}

      <AuditLogDetailModal
        open={!!detailId}
        onClose={() => {
          setDetailId(null);
          setDetailSeed(null);
        }}
        row={detailRow}
        loading={detailQuery.isLoading && !detailRow}
        companyName={detailCompanyName}
        labels={{
          title: detailSeed
            ? `${formatAuditActionLabel(detailSeed.action)} · ${truncateMiddle(detailSeed.resourceId, 8, 4)}`
            : t('Audit event', 'حدث تدقيق'),
          close: t('Close', 'إغلاق'),
          loading: t('Loading event details…', 'جاري تحميل تفاصيل الحدث…'),
          actor: t('Actor', 'المستخدم'),
          action: t('Event', 'الحدث'),
          resource: t('Resource', 'المورد'),
          company: t('Company', 'الشركة'),
          timestamp: t('Timestamp', 'الوقت'),
          metadata: t('Metadata', 'البيانات الوصفية'),
          before: t('Before state', 'الحالة قبل'),
          after: t('After state', 'الحالة بعد'),
          ip: t('IP address', 'عنوان IP'),
          userAgent: t('User agent', 'وكيل المستخدم'),
          system: t('System', 'النظام'),
        }}
      />
    </>
  );
}

function auditActionToneLabel(action: string, isArabic: boolean): string {
  const u = action.toUpperCase();
  if (u.includes('FAIL') || u.includes('ERROR')) return isArabic ? 'فشل' : 'Failed';
  if (u.includes('CANCEL') || u.includes('SUSPEND')) return isArabic ? 'تحذير' : 'Warn';
  if (u.includes('SUCCESS') || u.includes('COMPLETE') || u.includes('LOGIN')) {
    return isArabic ? 'نجاح' : 'OK';
  }
  return isArabic ? 'سجل' : 'Log';
}
