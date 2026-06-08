import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import {
  BackupsApi,
  type BackupSchedule,
  type CreateBackupScheduleInput,
} from '../../api/backups';
import { BackupScheduleModal } from '../../components/backups/BackupScheduleModal';
import { Button } from '../../components/Button';
import { Column, DataTable } from '../../components/DataTable';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PANEL_CARD_CLASS, PANEL_TITLE_CLASS } from '../../components/FilterPanel';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useBackupAdminAccess } from '../../hooks/useBackupAdminAccess';
import { formatBackupTimestamp } from '../../lib/backup-display';
import {
  formatScheduleFrequency,
  formatScheduleTime,
  getNextBackupScheduleRun,
} from '../../lib/backup-schedule-display';
import { defaultHomePath } from '../../lib/rbac';
import { useWmsTranslation } from '../../lib/ui-i18n';

export function BackupSchedulesPage() {
  const { user } = useAuth();
  const { canRead, canMutate } = useBackupAdminAccess();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useWmsTranslation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BackupSchedule | null>(null);
  const [runNowTarget, setRunNowTarget] = useState<BackupSchedule | null>(null);
  const [runNowJobId, setRunNowJobId] = useState<string | null>(null);

  const schedulesQuery = useQuery({
    queryKey: QK.backups.schedules,
    queryFn: () => BackupsApi.listSchedules(),
    enabled: canRead,
  });

  const saveMutation = useMutation({
    mutationFn: (body: CreateBackupScheduleInput & { id?: string }) =>
      body.id
        ? BackupsApi.updateSchedule(body.id, body)
        : BackupsApi.createSchedule(body),
    onSuccess: () => {
      setModalOpen(false);
      setEditing(null);
      toast.success(t(['Schedule saved', 'تم حفظ الجدولة']));
      void queryClient.invalidateQueries({ queryKey: QK.backups.schedules });
      void queryClient.invalidateQueries({ queryKey: QK.backups.health });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      BackupsApi.updateSchedule(id, { enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QK.backups.schedules });
      void queryClient.invalidateQueries({ queryKey: QK.backups.health });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const runNowMutation = useMutation({
    mutationFn: (id: string) => BackupsApi.runScheduleNow(id),
    onSuccess: (result) => {
      setRunNowJobId(result.jobId);
      void queryClient.invalidateQueries({ queryKey: QK.backups.schedules });
      void queryClient.invalidateQueries({ queryKey: QK.backups.all });
    },
    onError: (err: Error) => {
      setRunNowTarget(null);
      toast.error(err.message);
    },
  });

  const rows = useMemo(() => {
    const now = new Date();
    return (schedulesQuery.data?.items ?? []).map((row) => {
      const nextRun = getNextBackupScheduleRun(row, now);
      return {
        ...row,
        nextRunLabel: nextRun ? formatBackupTimestamp(nextRun.toISOString()) : '—',
      };
    });
  }, [schedulesQuery.data]);

  const columns: Column<(typeof rows)[number]>[] = useMemo(() => {
    const cols: Column<(typeof rows)[number]>[] = [
      {
        header: t(['Frequency', 'التكرار']),
        accessor: (row) => formatScheduleFrequency(row.frequency),
      },
      {
        header: t(['Time', 'الوقت']),
        accessor: (row) => formatScheduleTime(row.hour, row.minute),
      },
      {
        header: t(['Retention days', 'أيام الاحتفاظ']),
        accessor: (row) => String(row.retentionDays),
      },
      {
        header: t(['Enabled', 'مفعّل']),
        accessor: (row) => (
          <span className={row.enabled ? 'text-emerald-700' : 'text-slate-500'}>
            {row.enabled ? t(['Yes', 'نعم']) : t(['No', 'لا'])}
          </span>
        ),
      },
      {
        header: t(['Last run', 'آخر تشغيل']),
        accessor: (row) => formatBackupTimestamp(row.lastRunAt),
      },
      {
        header: t(['Next run', 'التشغيل القادم']),
        accessor: (row) => row.nextRunLabel,
      },
    ];

    if (canMutate) {
      cols.push({
        header: t(['Actions', 'إجراءات']),
        accessor: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(row);
                setModalOpen(true);
              }}
            >
              {t(['Edit', 'تعديل'])}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                toggleMutation.mutate({ id: row.id, enabled: !row.enabled });
              }}
              loading={toggleMutation.isPending}
            >
              {row.enabled ? t(['Disable', 'تعطيل']) : t(['Enable', 'تفعيل'])}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setRunNowJobId(null);
                setRunNowTarget(row);
              }}
            >
              {t(['Run now', 'تشغيل الآن'])}
            </Button>
          </div>
        ),
      });
    }

    return cols;
  }, [canMutate, t, toggleMutation.isPending]);

  if (!canRead) {
    return <Navigate to={defaultHomePath(user?.role)} replace />;
  }

  return (
    <div className="space-y-4">
      <section className={PANEL_CARD_CLASS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className={PANEL_TITLE_CLASS}>
            {t(['Scheduled backups', 'النسخ الاحتياطي المجدول'])}
          </h2>
          {canMutate ? (
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              {t(['Create schedule', 'إنشاء جدولة'])}
            </Button>
          ) : null}
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={schedulesQuery.isLoading}
          empty={t(['No schedules configured yet.', 'لا توجد جداول بعد.'])}
        />
      </section>

      {canMutate ? (
        <>
          <BackupScheduleModal
            open={modalOpen}
            schedule={editing}
            loading={saveMutation.isPending}
            onClose={() => {
              if (!saveMutation.isPending) {
                setModalOpen(false);
                setEditing(null);
              }
            }}
            onSubmit={(body) => {
              if (editing) {
                saveMutation.mutate({ ...body, id: editing.id });
              } else {
                saveMutation.mutate(body);
              }
            }}
          />

          <ConfirmModal
            open={!!runNowTarget && !runNowJobId}
            title={t(['Run backup now?', 'تشغيل النسخ الاحتياطي الآن؟'])}
            confirmLabel={t(['Run now', 'تشغيل الآن'])}
            loading={runNowMutation.isPending}
            onConfirm={() => {
              if (runNowTarget) runNowMutation.mutate(runNowTarget.id);
            }}
            onClose={() => {
              if (!runNowMutation.isPending) setRunNowTarget(null);
            }}
          >
            {t([
              'This will start an immediate scheduled backup job.',
              'سيبدأ هذا مهمة نسخ احتياطي مجدولة فوراً.',
            ])}
          </ConfirmModal>

          <ConfirmModal
            open={!!runNowJobId}
            title={t(['Backup started', 'بدأ النسخ الاحتياطي'])}
            confirmLabel={t(['Close', 'إغلاق'])}
            onConfirm={() => {
              setRunNowTarget(null);
              setRunNowJobId(null);
            }}
            onClose={() => {
              setRunNowTarget(null);
              setRunNowJobId(null);
            }}
          >
            <p>
              {t(['Job ID:', 'معرّف المهمة:'])}{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{runNowJobId}</code>
            </p>
            <p className="mt-2">
              <Link to="/settings/backups" className="font-medium text-emerald-700 hover:underline">
                {t(['View in backup history', 'عرض في سجل النسخ الاحتياطي'])}
              </Link>
            </p>
          </ConfirmModal>
        </>
      ) : null}
    </div>
  );
}
