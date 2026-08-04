import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Badge } from '@ds';

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
  formatBackupBytes,
  formatBackupStorage,
  formatBackupTimestamp,
  formatGdriveSyncStatus,
  isBackupDownloadable,
  shouldShowBackupProgress,
} from '../../lib/backup-display';
import { isBackupGdriveUiEnabled } from '../../lib/backup-gdrive-ui';
import { defaultHomePath } from '../../lib/rbac';
import {
  localizedBackupStatusFilterOptions,
  localizedBackupStatusLabel,
  localizedBackupStoragePolicyLabel,
  localizedBackupTypeFilterOptions,
  localizedBackupTypeLabel,
} from '../../lib/ui-labels/settings-backup';
import { useWmsTranslation } from '../../lib/ui-i18n';
import type { GdriveSyncStatus } from '../../lib/backup-display';
import type { Tone } from '@ds';

function backupStatusTone(status: BackupJobStatus): Tone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
      return 'info';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

function gdriveSyncTone(status: GdriveSyncStatus): Tone {
  switch (status) {
    case 'synced':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

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
    // Slow safety net while create runs; realtime `backup.job.progress` is primary.
    refetchInterval: activeCreateJobId ? 15_000 : false,
  });

  const createStatusQuery = useQuery({
    queryKey: QK.backups.status(activeCreateJobId ?? 'none'),
    queryFn: () => BackupsApi.status(activeCreateJobId!),
    enabled: !!activeCreateJobId,
    refetchInterval: 15_000,
    staleTime: 5_000,
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
          <span className="whitespace-nowrap text-sm text-text-body">
            {formatBackupTimestamp(row.createdAt)}
          </span>
        ),
      },
      {
        header: t(['Type', 'النوع']),
        accessor: (row) => (
          <span className="text-sm text-text-body">{localizedBackupTypeLabel(row.type, t)}</span>
        ),
      },
      {
        header: t(['Status', 'الحالة']),
        accessor: (row) => (
          <span className="inline-flex flex-col gap-1">
            <Badge tone={backupStatusTone(row.status)} size="xs">
              {localizedBackupStatusLabel(row.status, t)}
            </Badge>
            {shouldShowBackupProgress(row) ? (
              <span className="text-xs text-text-muted">{row.progressPercent}%</span>
            ) : null}
          </span>
        ),
      },
      {
        header: t(['Size', 'الحجم']),
        accessor: (row) => (
          <span className="text-sm tabular-nums text-text-body">
            {formatBackupBytes(row.bytesWritten)}
          </span>
        ),
      },
      {
        header: t(['Created By', 'أنشأه']),
        accessor: (row) => (
          <span className="text-sm text-text-body">{backupCreatedByLabel(row)}</span>
        ),
      },
      {
        header: t(['Storage', 'التخزين']),
        accessor: (row) => (
          <span className="text-sm text-text-muted">
            {row.storagePolicy
              ? localizedBackupStoragePolicyLabel(row.storagePolicy, t)
              : formatBackupStorage(row.manifest)}
          </span>
        ),
      },
      ...(isBackupGdriveUiEnabled()
        ? [
            {
              header: t(['Drive sync', 'مزامنة Drive']),
              accessor: (row: BackupSummary) => {
                const label = formatGdriveSyncStatus(row.gdriveSyncStatus, row.storagePolicy);
                if (label === 'N/A' || label === '—') {
                  return <span className="text-sm text-text-muted">{label}</span>;
                }
                return (
                  <Badge tone={gdriveSyncTone(row.gdriveSyncStatus)} size="xs">
                    {label}
                  </Badge>
                );
              },
            } satisfies Column<BackupSummary>,
          ]
        : []),
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
      </FilterPanel>

      {showCreateProgress ? (
        <Alert
          variant="info"
          data-testid="create-backup-progress"
          title={`${t(['Creating backup…', 'جارٍ إنشاء النسخة الاحتياطية…'])} ${createStatus.progressPercent}%`}
          description={
            <>
              {t(['Job ID:', 'معرّف المهمة:'])}{' '}
              <code className="rounded bg-surface-card px-1 py-0.5">{activeCreateJobId}</code>
            </>
          }
        />
      ) : null}

      {showCreateSuccess ? (
        <Alert
          variant="success"
          data-testid="create-backup-success"
          title={t(['Backup completed successfully.', 'اكتمل النسخ الاحتياطي بنجاح.'])}
          description={t(['History refreshed automatically.', 'تم تحديث السجل تلقائياً.'])}
        />
      ) : null}

      {showCreateFailure ? (
        <Alert
          variant="error"
          data-testid="create-backup-failure"
          title={t(['Backup failed.', 'فشل النسخ الاحتياطي.'])}
          description={
            <>
              {createStatus?.errorMessage ? <p className="mt-1 text-xs">{createStatus.errorMessage}</p> : null}
              <Button
                type="button"
                size="sm"
                variant="danger"
                className="mt-2"
                onClick={() => setActiveCreateJobId(null)}
              >
                {t(['Dismiss', 'إغلاق'])}
              </Button>
            </>
          }
        />
      ) : null}

      {isPolling ? (
        <p className="text-xs text-text-link">
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
              variant="brand"
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
