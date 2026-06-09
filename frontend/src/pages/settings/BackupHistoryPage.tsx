import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  BackupsApi,
  type BackupDetail,
  type BackupJobStatus,
  type BackupSummary,
  type CreateBackupInput,
  type ListBackupsParams,
} from '../../api/backups';
import { useAuth } from '../../auth/AuthContext';
import { BackupAuditPanel } from '../../components/backups/BackupAuditPanel';
import { BackupDetailModal } from '../../components/backups/BackupDetailModal';
import { CreateBackupModal } from '../../components/backups/CreateBackupModal';
import { Button } from '../../components/Button';
import { Column, DataTable } from '../../components/DataTable';
import { FilterPanel } from '../../components/FilterPanel';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useBackupAdminAccess } from '../../hooks/useBackupAdminAccess';
import { useBackupRunningStatusPoll } from '../../hooks/useBackupRunningStatusPoll';
import { useFilters } from '../../hooks/useFilters';
import {
  backupCreatedByLabel,
  backupStatusBadgeClass,
  formatBackupBytes,
  formatBackupStorage,
  formatBackupTimestamp,
  isBackupDownloadable,
  shouldShowBackupProgress,
} from '../../lib/backup-display';
import { defaultHomePath } from '../../lib/rbac';
import {
  localizedBackupStatusFilterOptions,
  localizedBackupStatusLabel,
  localizedBackupTypeFilterOptions,
  localizedBackupTypeLabel,
} from '../../lib/ui-labels/settings-backup';
import { useWmsTranslation } from '../../lib/ui-i18n';

type BackupHistoryFilters = {
  search: string;
  type: string;
  status: string;
};

export function BackupHistoryPage() {
  const { user } = useAuth();
  const { canRead, canMutate } = useBackupAdminAccess();
  const isSuperAdmin = user?.role === 'super_admin';
  const queryClient = useQueryClient();

  const { t } = useWmsTranslation();
  const typeOptions = useMemo(() => localizedBackupTypeFilterOptions(t), [t]);
  const statusOptions = useMemo(() => localizedBackupStatusFilterOptions(t), [t]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailSeed, setDetailSeed] = useState<BackupSummary | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeCreateJobId, setActiveCreateJobId] = useState<string | null>(null);
  const handledCreateTerminalRef = useRef<string | null>(null);
  const toast = useToast();

  const initialFilters = useMemo<BackupHistoryFilters>(
    () => ({ search: '', type: '', status: '' }),
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

  const listParams = useMemo<ListBackupsParams>(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      search: appliedFilters.search.trim() || undefined,
      type: (appliedFilters.type as ListBackupsParams['type']) || undefined,
      status: (appliedFilters.status as BackupJobStatus) || undefined,
    }),
    [appliedFilters, page, pageSize],
  );

  const listQuery = useQuery({
    queryKey: QK.backups.list({ mode: 'server', ...listParams }),
    queryFn: () => BackupsApi.list(listParams),
    enabled: canRead,
    staleTime: 15_000,
    refetchInterval: activeCreateJobId ? 3_000 : false,
  });

  const createStatusQuery = useQuery({
    queryKey: QK.backups.status(activeCreateJobId ?? 'none'),
    queryFn: () => BackupsApi.status(activeCreateJobId!),
    enabled: !!activeCreateJobId,
    refetchInterval: 2_000,
    staleTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateBackupInput) => BackupsApi.create(body),
    onSuccess: (result) => {
      setCreateModalOpen(false);
      handledCreateTerminalRef.current = null;
      setActiveCreateJobId(result.jobId);
      toast.success(t(['Backup started', 'بدأ النسخ الاحتياطي']));
      void queryClient.invalidateQueries({ queryKey: QK.backups.all });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  useEffect(() => {
    const status = createStatusQuery.data?.status;
    if (!activeCreateJobId || !status) return;
    if (status !== 'completed' && status !== 'failed') return;
    if (handledCreateTerminalRef.current === activeCreateJobId) return;
    handledCreateTerminalRef.current = activeCreateJobId;

    if (status === 'completed') {
      toast.success(t(['Backup completed successfully', 'اكتمل النسخ الاحتياطي بنجاح']));
      void queryClient.invalidateQueries({ queryKey: QK.backups.all });
      void queryClient.invalidateQueries({ queryKey: QK.backups.auditRecent });
      void queryClient.invalidateQueries({ queryKey: QK.backups.health });
      const timer = window.setTimeout(() => setActiveCreateJobId(null), 4_000);
      return () => window.clearTimeout(timer);
    }

    toast.error(
      createStatusQuery.data?.errorMessage ??
        t(['Backup failed', 'فشل النسخ الاحتياطي']),
    );
    void queryClient.invalidateQueries({ queryKey: QK.backups.all });
    void queryClient.invalidateQueries({ queryKey: QK.backups.auditRecent });
    return undefined;
  }, [
    activeCreateJobId,
    createStatusQuery.data?.errorMessage,
    createStatusQuery.data?.status,
    queryClient,
    t,
    toast,
  ]);

  const baseRows = listQuery.data?.items ?? [];
  const { mergedRows, isPolling } = useBackupRunningStatusPoll(baseRows);
  const total = listQuery.data?.total ?? 0;

  const detailQuery = useQuery({
    queryKey: QK.backups.detail(detailId ?? ''),
    queryFn: () => BackupsApi.getById(detailId!),
    enabled: !!detailId,
  });

  const openDetails = useCallback((row: BackupSummary) => {
    setDetailId(row.id);
    setDetailSeed(row);
  }, []);

  const closeDetails = useCallback(() => {
    setDetailId(null);
    setDetailSeed(null);
  }, []);

  const handleDownload = useCallback(
    async (row: BackupSummary) => {
      if (!isSuperAdmin) return;
      setDownloadingId(row.id);
      try {
        await BackupsApi.download(row.id, row.label ? `${row.label}.dump` : null);
        toast.success(t(['Download started', 'بدأ التنزيل']));
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : t(['Download failed', 'فشل التنزيل']),
        );
      } finally {
        setDownloadingId(null);
      }
    },
    [isSuperAdmin, t, toast],
  );

  const columns = useMemo<Column<BackupSummary>[]>(() => {
    const cols: Column<BackupSummary>[] = [
      {
        header: t(['Created At', 'تاريخ الإنشاء']),
        accessor: (row) => (
          <span className="whitespace-nowrap text-sm text-slate-800">
            {formatBackupTimestamp(row.createdAt)}
          </span>
        ),
      },
      {
        header: t(['Type', 'النوع']),
        accessor: (row) => (
          <span className="text-sm text-slate-700">{localizedBackupTypeLabel(row.type, t)}</span>
        ),
      },
      {
        header: t(['Status', 'الحالة']),
        accessor: (row) => (
          <span className="inline-flex flex-col gap-1">
            <span
              className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${backupStatusBadgeClass(row.status)}`}
            >
              {localizedBackupStatusLabel(row.status, t)}
            </span>
            {shouldShowBackupProgress(row) ? (
              <span className="text-xs text-slate-500">{row.progressPercent}%</span>
            ) : null}
          </span>
        ),
      },
      {
        header: t(['Size', 'الحجم']),
        accessor: (row) => (
          <span className="text-sm tabular-nums text-slate-700">
            {formatBackupBytes(row.bytesWritten)}
          </span>
        ),
      },
      {
        header: t(['Created By', 'أنشأه']),
        accessor: (row) => (
          <span className="text-sm text-slate-700">{backupCreatedByLabel(row)}</span>
        ),
      },
      {
        header: t(['Storage', 'التخزين']),
        accessor: (row) => (
          <span className="text-sm text-slate-600">{formatBackupStorage(row.manifest)}</span>
        ),
      },
      {
        header: t(['Actions', 'إجراءات']),
        accessor: (row) => (
          <div className="flex flex-wrap gap-2">
            {isSuperAdmin && isBackupDownloadable(row) ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={downloadingId === row.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDownload(row);
                }}
              >
                {downloadingId === row.id
                  ? t(['Downloading…', 'جارٍ التنزيل…'])
                  : t(['Download', 'تنزيل'])}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                openDetails(row);
              }}
            >
              {t(['Details', 'التفاصيل'])}
            </Button>
          </div>
        ),
      },
    ];
    return cols;
  }, [downloadingId, handleDownload, isSuperAdmin, openDetails, t]);

  if (!canRead) {
    return <Navigate to={defaultHomePath(user?.role)} replace />;
  }

  const detailRow: BackupDetail | null = detailQuery.data ?? (detailSeed as BackupDetail | null);

  const createStatus = createStatusQuery.data;
  const showCreateProgress =
    !!activeCreateJobId &&
    createStatus &&
    (createStatus.status === 'pending' || createStatus.status === 'running');
  const showCreateSuccess =
    !!activeCreateJobId && createStatus?.status === 'completed';
  const showCreateFailure =
    !!activeCreateJobId && createStatus?.status === 'failed';

  return (
    <div className="space-y-4">
      <FilterPanel
        title={t(['Backup History', 'سجل النسخ الاحتياطي'])}
        onApply={handleApply}
        onReset={handleReset}
        loading={listQuery.isFetching}
        applyLabel={t(['Apply filters', 'تطبيق التصفية'])}
        resetLabel={t(['Reset filters', 'إعادة تعيين'])}
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <TextField
            label={t(['Search', 'بحث'])}
            value={draftFilters.search}
            onChange={(e) => setDraft({ search: e.target.value })}
            placeholder={t(['ID, label, email…', 'المعرّف، التسمية، البريد…'])}
          />
          <SelectField
            label={t(['Type', 'النوع'])}
            value={draftFilters.type}
            onChange={(e) => setDraft({ type: e.target.value as ListBackupsParams['type'] | '' })}
            options={[...typeOptions]}
          />
          <SelectField
            label={t(['Status', 'الحالة'])}
            value={draftFilters.status}
            onChange={(e) => setDraft({ status: e.target.value as BackupJobStatus | '' })}
            options={[...statusOptions]}
          />
        </div>
      </FilterPanel>

      {showCreateProgress ? (
        <div
          className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
          data-testid="create-backup-progress"
          role="status"
        >
          <p className="font-medium">
            {t(['Creating backup…', 'جارٍ إنشاء النسخة الاحتياطية…'])}{' '}
            {createStatus.progressPercent}%
          </p>
          <p className="mt-1 text-xs text-sky-800">
            {t(['Job ID:', 'معرّف المهمة:'])}{' '}
            <code className="rounded bg-white/80 px-1 py-0.5">{activeCreateJobId}</code>
          </p>
        </div>
      ) : null}

      {showCreateSuccess ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          data-testid="create-backup-success"
          role="status"
        >
          <p className="font-medium">
            {t(['Backup completed successfully.', 'اكتمل النسخ الاحتياطي بنجاح.'])}
          </p>
          <p className="mt-1 text-xs">
            {t(['History refreshed automatically.', 'تم تحديث السجل تلقائياً.'])}
          </p>
        </div>
      ) : null}

      {showCreateFailure ? (
        <div
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          data-testid="create-backup-failure"
          role="alert"
        >
          <p className="font-medium">{t(['Backup failed.', 'فشل النسخ الاحتياطي.'])}</p>
          {createStatus?.errorMessage ? (
            <p className="mt-1 text-xs">{createStatus.errorMessage}</p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={() => setActiveCreateJobId(null)}
          >
            {t(['Dismiss', 'إغلاق'])}
          </Button>
        </div>
      ) : null}

      {isPolling ? (
        <p className="text-xs text-emerald-700">
          {t(['Live status polling active for running jobs.', 'تحديث مباشر لحالة المهام الجارية.'])}
        </p>
      ) : null}

      <DataTable
        title={t(['Backups', 'النسخ الاحتياطية'])}
        description={t([
          `${total} backup(s) — manual, scheduled, upload, and pre-snapshot only`,
          `${total} نسخة احتياطية — يدوي ومجدول ورفع ولقطة قبل العملية فقط`,
        ])}
        actions={
          canMutate ? (
            <Button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              disabled={!!activeCreateJobId && showCreateProgress}
              data-testid="create-backup-btn"
            >
              {t(['Create backup', 'إنشاء نسخة احتياطية'])}
            </Button>
          ) : null
        }
        columns={columns}
        rows={mergedRows}
        rowKey={(row) => row.id}
        loading={listQuery.isLoading}
        empty={t(['No backup jobs match your filters.', 'لا توجد مهام نسخ احتياطي مطابقة.'])}
        onRowClick={openDetails}
        serverPagination={{
          total,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
          pageSizeOptions: [10, 20, 50],
        }}
      />

      <BackupDetailModal
        open={!!detailId}
        onClose={closeDetails}
        row={detailRow}
        loading={detailQuery.isLoading && !detailSeed}
        labels={{
          title: t(['Backup details', 'تفاصيل النسخة الاحتياطية']),
          close: t(['Close', 'إغلاق']),
          loading: t(['Loading…', 'جارٍ التحميل…']),
          overview: t(['Overview', 'نظرة عامة']),
          technical: t(['Technical', 'تقني']),
          error: t(['Error', 'خطأ']),
        }}
      />

      {canMutate ? (
        <CreateBackupModal
          open={createModalOpen}
          loading={createMutation.isPending}
          onClose={() => {
            if (!createMutation.isPending) setCreateModalOpen(false);
          }}
          onSubmit={(body) => createMutation.mutate(body)}
        />
      ) : null}

      {isSuperAdmin ? <BackupAuditPanel /> : null}
    </div>
  );
}
