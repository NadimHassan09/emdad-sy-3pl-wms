import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Alert, Badge, Card } from '@ds';

import { AuditLogsApi } from '../../api/audit-logs';
import {
  BackupsApi,
  type BackupDetail,
  type BackupHealthSeverity,
  type BackupJobStatus,
  type BackupSummary,
  type CreateBackupInput,
  type ListBackupsParams,
} from '../../api/backups';
import { useAuth } from '../../auth/AuthContext';
import { BackupDetailModal } from '../../components/backups/BackupDetailModal';
import { CreateBackupModal } from '../../components/backups/CreateBackupModal';
import { BackupUploadModal } from '../../components/backups/BackupUploadModal';
import { BackupRestoreModal } from '../../components/backups/BackupRestoreModal';
import { BackupFactoryResetModal } from '../../components/backups/BackupFactoryResetModal';
import { Button } from '../../components/Button';
import { Column, DataTable } from '../../components/DataTable';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useBackupAdminAccess } from '../../hooks/useBackupAdminAccess';
import { useBackupRunningStatusPoll } from '../../hooks/useBackupRunningStatusPoll';
import { useCachedState } from '../../hooks/useCachedState';
import { useFilters } from '../../hooks/useFilters';
import { useBackupOperationContext } from '../../context/BackupOperationContext';
import { formatAuditActionLabel, formatAuditTimestamp } from '../../lib/audit-log-display';
import { isBackupAuditAction } from '../../lib/backup-audit-actions';
import {
  backupCreatedByLabel,
  backupTypeTone,
  formatBackupBytes,
  formatBackupStorage,
  formatBackupTimestamp,
  formatGdriveSyncStatus,
  isBackupDownloadable,
  shouldShowBackupProgress,
} from '../../lib/backup-display';
import { useDebounced } from '../../lib/useDebounced';
import { isBackupGdriveUiEnabled } from '../../lib/backup-gdrive-ui';
import { defaultHomePath } from '../../lib/rbac';
import {
  localizedBackupHealthStatus,
  localizedBackupStatusFilterOptions,
  localizedBackupStatusLabel,
  localizedBackupStoragePolicyLabel,
  localizedBackupTypeFilterOptions,
  localizedBackupTypeLabel,
} from '../../lib/ui-labels/settings-backup';
import { useWmsTranslation } from '../../lib/ui-i18n';
import type { GdriveSyncStatus } from '../../lib/backup-display';
import type { Tone } from '@ds';

const AUDIT_ACTIVITY_LIMIT = 8;

function formatRelativePast(iso: string | null, isArabic: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return isArabic ? 'الآن' : 'just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return isArabic ? `منذ ${mins} د` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isArabic ? `منذ ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return isArabic ? `منذ ${days} ي` : `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return isArabic ? `منذ ${weeks} أ` : `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return isArabic ? `منذ ${months} ش` : `${months}mo ago`;
}

function formatRelativeFuture(iso: string | null, isArabic: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) return isArabic ? 'الآن' : 'now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return isArabic ? `خلال ${mins} د` : `In ${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) {
    if (remMins === 0) return isArabic ? `خلال ${hours} س` : `In ${hours}h`;
    return isArabic ? `خلال ${hours} س ${remMins} د` : `In ${hours}h ${remMins}m`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (remHours === 0) return isArabic ? `خلال ${days} ي` : `In ${days}d`;
  return isArabic ? `خلال ${days} ي ${remHours} س` : `In ${days}d ${remHours}h`;
}

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

function healthStatusDotClass(status: BackupHealthSeverity): string {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-500';
    case 'warning':
      return 'bg-amber-500';
    case 'critical':
      return 'bg-red-500';
    default:
      return 'bg-neutral-400';
  }
}

function auditActivityIcon(action: string): { icon: string; bgClass: string; textClass: string } {
  const lower = action.toLowerCase();
  if (lower.includes('delete') || lower.includes('cleanup') || lower.includes('remove')) {
    return { icon: 'fa-trash', bgClass: 'bg-orange-50', textClass: 'text-orange-600' };
  }
  if (lower.includes('schedule') || lower.includes('scheduled')) {
    return { icon: 'fa-calendar', bgClass: 'bg-sky-50', textClass: 'text-sky-600' };
  }
  return { icon: 'fa-check', bgClass: 'bg-emerald-50', textClass: 'text-emerald-600' };
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

  const { t, isArabic } = useWmsTranslation();
  const typeOptions = useMemo(() => localizedBackupTypeFilterOptions(t), [t]);
  const statusOptions = useMemo(() => localizedBackupStatusFilterOptions(t), [t]);

  const [page, setPage] = useCachedState('page', 1);
  const [pageSize, setPageSize] = useCachedState('pageSize', 20);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailSeed, setDetailSeed] = useState<BackupSummary | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [factoryResetModalOpen, setFactoryResetModalOpen] = useState(false);
  const [activeCreateJobId, setActiveCreateJobId] = useState<string | null>(null);
  const handledCreateTerminalRef = useRef<string | null>(null);
  const lastCreateRequestRef = useRef(0);
  const lastUploadRequestRef = useRef(0);
  const lastRestoreRequestRef = useRef(0);
  const lastFactoryResetRequestRef = useRef(0);
  const toast = useToast();
  const {
    createBackupRequestId,
    setCreateBackupBusy,
    uploadBackupRequestId,
    restoreBackupRequestId,
    factoryResetRequestId,
  } = useBackupOperationContext();

  const initialFilters = useMemo<BackupHistoryFilters>(
    () => ({ search: '', type: '', status: '' }),
    [],
  );

  const { draftFilters, appliedFilters, setDraft, applyPatch } = useFilters(initialFilters);

  const debouncedSearch = useDebounced(draftFilters.search, 300);

  useEffect(() => {
    if (debouncedSearch === appliedFilters.search) return;
    applyPatch({ search: debouncedSearch });
    setPage(1);
  }, [debouncedSearch, appliedFilters.search, applyPatch, setPage]);

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

  const healthQuery = useQuery({
    queryKey: QK.backups.health,
    queryFn: () => BackupsApi.getHealth(),
    enabled: canRead,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const auditActivityQuery = useQuery({
    queryKey: QK.backups.auditRecent,
    queryFn: async () => {
      const result = await AuditLogsApi.list({
        limit: 50,
        offset: 0,
        sort_by: 'created_at',
        sort_dir: 'desc',
      });
      return result.items
        .filter((row) => isBackupAuditAction(row.action))
        .slice(0, AUDIT_ACTIVITY_LIMIT);
    },
    enabled: canRead && isSuperAdmin,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const listQuery = useQuery({
    queryKey: QK.backups.list({ mode: 'server', ...listParams }),
    queryFn: () => BackupsApi.list(listParams),
    enabled: canRead,
    staleTime: 15_000,
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
          <Badge tone={backupTypeTone(row.type)} size="xs">
            {localizedBackupTypeLabel(row.type, t)}
          </Badge>
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
        accessor: (row) =>
          isSuperAdmin && isBackupDownloadable(row) ? (
            <Button
              size="sm"
              variant="brand"
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
          ) : (
            <span className="text-sm text-text-muted">—</span>
          ),
      },
    ];
    return cols;
  }, [downloadingId, handleDownload, isSuperAdmin, t]);

  const health = healthQuery.data;
  const disk = health?.diskStorage;
  const emdadUsedBytes = disk?.usedBytes ?? 0;
  const reservedBytes = disk?.reservedBytes ?? 0;
  const storageAvailableBytes = disk?.availableBytes ?? 0;
  const storageTotalBytes = disk?.totalBytes ?? 0;
  const occupiedBytes = Math.max(0, storageTotalBytes - storageAvailableBytes);
  const storageOccupiedPct =
    storageTotalBytes > 0
      ? Math.min(100, Math.round((occupiedBytes / storageTotalBytes) * 1000) / 10)
      : 0;

  const createStatus = createStatusQuery.data;
  const showCreateProgress =
    !!activeCreateJobId &&
    createStatus &&
    (createStatus.status === 'pending' || createStatus.status === 'running');
  const showCreateSuccess =
    !!activeCreateJobId && createStatus?.status === 'completed';
  const showCreateFailure =
    !!activeCreateJobId && createStatus?.status === 'failed';

  useEffect(() => {
    if (createBackupRequestId <= 0) return;
    if (createBackupRequestId === lastCreateRequestRef.current) return;
    lastCreateRequestRef.current = createBackupRequestId;
    if (!canMutate) return;
    if (showCreateProgress) return;
    setCreateModalOpen(true);
  }, [canMutate, createBackupRequestId, showCreateProgress]);

  useEffect(() => {
    if (uploadBackupRequestId <= 0) return;
    if (uploadBackupRequestId === lastUploadRequestRef.current) return;
    lastUploadRequestRef.current = uploadBackupRequestId;
    if (!canMutate) return;
    setUploadModalOpen(true);
  }, [canMutate, uploadBackupRequestId]);

  useEffect(() => {
    if (restoreBackupRequestId <= 0) return;
    if (restoreBackupRequestId === lastRestoreRequestRef.current) return;
    lastRestoreRequestRef.current = restoreBackupRequestId;
    if (!canMutate) return;
    setRestoreModalOpen(true);
  }, [canMutate, restoreBackupRequestId]);

  useEffect(() => {
    if (factoryResetRequestId <= 0) return;
    if (factoryResetRequestId === lastFactoryResetRequestRef.current) return;
    lastFactoryResetRequestRef.current = factoryResetRequestId;
    if (!canMutate) return;
    setFactoryResetModalOpen(true);
  }, [canMutate, factoryResetRequestId]);

  useEffect(() => {
    setCreateBackupBusy(Boolean(showCreateProgress));
    return () => setCreateBackupBusy(false);
  }, [setCreateBackupBusy, showCreateProgress]);

  if (!canRead) {
    return <Navigate to={defaultHomePath(user?.role)} replace />;
  }

  const detailRow: BackupDetail | null = detailQuery.data ?? (detailSeed as BackupDetail | null);

  return (
    <div className="space-y-4">
      {/* Top metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card padding="md" className="bg-emerald-50/60">
          <p className="text-xs font-medium text-emerald-700">
            {t(['Backup Health', 'صحة النسخ الاحتياطي'])}
          </p>
          {healthQuery.isLoading ? (
            <p className="mt-2 text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
          ) : health ? (
            <>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${healthStatusDotClass(health.healthStatus)}`}
                  aria-hidden
                />
                <span className="text-lg font-semibold capitalize text-emerald-700">
                  {localizedBackupHealthStatus(health.healthStatus, t)}
                </span>
              </div>
              <Link
                to="/backups/health"
                className="mt-3 inline-block text-xs font-medium text-emerald-700 hover:underline"
              >
                {t(['View Health Details', 'عرض تفاصيل الصحة'])}
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-muted">—</p>
          )}
        </Card>

        <Card padding="md">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
              <i
                className="fa-solid fa-calendar-check text-emerald-600"
                aria-hidden
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-muted">
                {t(['Last Successful Backup', 'آخر نسخة ناجحة'])}
              </p>
              <p className="mt-1 text-sm font-semibold text-text-strong">
                {formatBackupTimestamp(health?.lastSuccessfulBackupAt ?? null)}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {formatRelativePast(health?.lastSuccessfulBackupAt ?? null, isArabic)}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50">
              <i className="fa-solid fa-clock text-sky-600" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-muted">
                {t(['Next Scheduled Backup', 'النسخة المجدولة القادمة'])}
              </p>
              <p className="mt-1 text-sm font-semibold text-text-strong">
                {formatBackupTimestamp(health?.nextScheduledBackupAt ?? null)}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {formatRelativeFuture(health?.nextScheduledBackupAt ?? null, isArabic)}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50">
              <i className="fa-solid fa-database text-violet-600" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-text-muted">
                {t(['Total Backups', 'إجمالي النسخ'])}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-text-strong">
                {health?.backupCount ?? '—'}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {t(['All completed.', 'جميعها مكتملة.'])}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50">
              <i className="fa-solid fa-chart-pie text-orange-600" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-text-muted">
                {t(['Storage Used', 'التخزين المستخدم'])}
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-text-strong">
                {disk ? formatBackupBytes(occupiedBytes) : '—'}{' '}
                <span className="font-normal text-text-muted">
                  {t(['of', 'من'])} {disk ? formatBackupBytes(storageTotalBytes) : '—'}
                </span>
              </p>
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
                role="progressbar"
                aria-valuenow={storageOccupiedPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-orange-500 transition-all"
                  style={{ width: `${storageOccupiedPct}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Full-width filters card; controls stay left-clustered */}
      <Card padding="md">
        <div className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-64 sm:max-w-xs">
            <i
              className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-faint"
              aria-hidden
            />
            <input
              value={draftFilters.search}
              onChange={(e) => setDraft({ search: e.target.value })}
              placeholder={t(['ID, label, email…', 'المعرّف، التسمية، البريد…'])}
              className="input-premium w-full rounded-lg border border-border-strong bg-surface-sunken py-2 pl-9 pr-4 text-sm text-text-strong placeholder:text-text-faint"
            />
          </div>
          <select
            value={draftFilters.type}
            onChange={(e) => {
              applyPatch({ type: e.target.value as ListBackupsParams['type'] | '' });
              setPage(1);
            }}
            aria-label={t(['Type', 'النوع'])}
            className="input-premium w-full rounded-lg border border-border-strong bg-surface-sunken px-3 py-2 text-sm text-text-body sm:w-auto"
          >
            {typeOptions.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={draftFilters.status}
            onChange={(e) => {
              applyPatch({ status: e.target.value as BackupJobStatus | '' });
              setPage(1);
            }}
            aria-label={t(['Status', 'الحالة'])}
            className="input-premium w-full rounded-lg border border-border-strong bg-surface-sunken px-3 py-2 text-sm text-text-body sm:w-auto"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {(showCreateProgress || showCreateSuccess || showCreateFailure || isPolling) && (
        <div className="space-y-3">
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
                  {createStatus?.errorMessage ? (
                    <p className="mt-1 text-xs">{createStatus.errorMessage}</p>
                  ) : null}
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
              {t([
                'Live status polling active for running jobs.',
                'تحديث مباشر لحالة المهام الجارية.',
              ])}
            </p>
          ) : null}
        </div>
      )}

      {/* Main grid */}
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <div className="flex min-h-[28rem] flex-col lg:col-span-2 lg:min-h-full">
          <div className="flex min-h-0 flex-1 flex-col [&>div]:flex [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col [&>div]:rounded-xl [&>div]:border [&>div]:border-border [&>div]:bg-surface-panel [&>div]:shadow-soft">
            <DataTable
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
          </div>
        </div>

        <div className="space-y-4">
          <Card padding="md">
            <h3 className="text-sm font-semibold text-text-strong">
              {t(['Backup Activity (Latest)', 'نشاط النسخ (الأحدث)'])}
            </h3>
            {isSuperAdmin ? (
              auditActivityQuery.isLoading ? (
                <p className="mt-3 text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
              ) : auditActivityQuery.data && auditActivityQuery.data.length > 0 ? (
                <ul className="mt-3 divide-y divide-border-subtle">
                  {auditActivityQuery.data.map((row) => {
                    const { icon, bgClass, textClass } = auditActivityIcon(row.action);
                    return (
                      <li key={row.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bgClass}`}
                        >
                          <i className={`fa-solid ${icon} text-xs ${textClass}`} aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-strong">
                            {formatAuditActionLabel(row.action)}
                          </p>
                          <p className="truncate text-xs text-text-muted">
                            {row.actorEmail}
                          </p>
                          <time
                            className="text-xs text-text-faint"
                            dateTime={row.createdAt}
                          >
                            {formatAuditTimestamp(row.createdAt)}
                          </time>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-text-muted">
                  {t(['No backup audit events yet.', 'لا توجد أحداث تدقيق بعد.'])}
                </p>
              )
            ) : (
              <p className="mt-3 text-sm text-text-muted">
                {t([
                  'Audit activity is available to super administrators only.',
                  'نشاط التدقيق متاح لمدير النظام فقط.',
                ])}
              </p>
            )}
          </Card>

          <Card padding="md">
            <h3 className="text-sm font-semibold text-text-strong">
              {t(['Storage Overview', 'نظرة على التخزين'])}
            </h3>
            <div className="mt-4 flex flex-col items-center">
              <div
                className="relative flex h-28 w-28 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(#f97316 ${storageOccupiedPct}%, var(--surface-sunken, #e2e8f0) ${storageOccupiedPct}%)`,
                }}
              >
                <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-surface-card">
                  <span className="text-lg font-bold tabular-nums text-text-strong">
                    {disk ? `${storageOccupiedPct}%` : '—'}
                  </span>
                  <span className="text-[10px] text-text-muted">{t(['Used', 'مستخدم'])}</span>
                </div>
              </div>
              <dl className="mt-4 w-full space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-text-muted">
                    {t(['Used (Emdad)', 'مستخدم (إمداد)'])}
                  </dt>
                  <dd className="font-semibold tabular-nums text-text-strong">
                    {disk ? formatBackupBytes(emdadUsedBytes) : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-text-muted">
                    {t(['Reserved', 'محجوز'])}
                  </dt>
                  <dd className="font-semibold tabular-nums text-text-strong">
                    {disk ? formatBackupBytes(reservedBytes) : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-text-muted">{t(['Available', 'متاح'])}</dt>
                  <dd className="font-semibold tabular-nums text-text-strong">
                    {disk ? formatBackupBytes(storageAvailableBytes) : '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-text-muted">{t(['Total', 'الإجمالي'])}</dt>
                  <dd className="font-semibold tabular-nums text-text-strong">
                    {disk ? formatBackupBytes(storageTotalBytes) : '—'}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs font-medium text-emerald-600">
                {t(['Storage Location: Local only', 'موقع التخزين: محلي فقط'])}
              </p>
            </div>
          </Card>
        </div>
      </div>

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
        <>
          <CreateBackupModal
            open={createModalOpen}
            loading={createMutation.isPending}
            onClose={() => {
              if (!createMutation.isPending) setCreateModalOpen(false);
            }}
            onSubmit={(body) => createMutation.mutate(body)}
          />
          <BackupUploadModal
            open={uploadModalOpen}
            onClose={() => setUploadModalOpen(false)}
            onSuccess={() => {
              void queryClient.invalidateQueries({ queryKey: QK.backups.all });
              toast.success(t(['Backup uploaded', 'تم رفع النسخة الاحتياطية']));
            }}
          />
          <BackupRestoreModal
            open={restoreModalOpen}
            onClose={() => setRestoreModalOpen(false)}
          />
          <BackupFactoryResetModal
            open={factoryResetModalOpen}
            onClose={() => setFactoryResetModalOpen(false)}
          />
        </>
      ) : null}
    </div>
  );
}
