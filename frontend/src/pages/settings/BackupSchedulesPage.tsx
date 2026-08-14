import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';

import {
  BackupsApi,
  type BackupSchedule,
  type CreateBackupScheduleInput,
} from '../../api/backups';
import { BackupScheduleModal } from '../../components/backups/BackupScheduleModal';
import { Button } from '../../components/Button';
import { Column, DataTable } from '../../components/DataTable';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { useAuth } from '../../auth/AuthContext';
import { useBackupOperationContext } from '../../context/BackupOperationContext';
import { useBackupAdminAccess } from '../../hooks/useBackupAdminAccess';
import { formatBackupTimestamp } from '../../lib/backup-display';
import {
  formatScheduleFrequency,
  formatScheduleTime,
  getNextBackupScheduleRun,
} from '../../lib/backup-schedule-display';
import { localizedScheduleStoragePolicyLabel } from '../../lib/ui-labels/settings-backup';
import { defaultHomePath } from '../../lib/rbac';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Badge } from '@ds';

export function BackupSchedulesPage() {
  const { user } = useAuth();
  const { canRead, canMutate } = useBackupAdminAccess();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useWmsTranslation();
  const { createScheduleRequestId } = useBackupOperationContext();
  const lastCreateScheduleRequestRef = useRef(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BackupSchedule | null>(null);

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

  useEffect(() => {
    if (createScheduleRequestId <= 0) return;
    if (createScheduleRequestId === lastCreateScheduleRequestRef.current) return;
    lastCreateScheduleRequestRef.current = createScheduleRequestId;
    if (!canMutate) return;
    setEditing(null);
    setModalOpen(true);
  }, [canMutate, createScheduleRequestId]);

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
        header: t(['Storage policy', 'سياسة التخزين']),
        accessor: (row) => localizedScheduleStoragePolicyLabel(row.storagePolicy, t),
      },
      {
        header: t(['Enabled', 'مفعّل']),
        accessor: (row) => (
          <Badge tone={row.enabled ? 'success' : 'neutral'} dot>
            {row.enabled ? t(['Yes', 'نعم']) : t(['No', 'لا'])}
          </Badge>
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
              variant={row.enabled ? 'danger' : 'brand'}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                toggleMutation.mutate({ id: row.id, enabled: !row.enabled });
              }}
              loading={toggleMutation.isPending}
            >
              {row.enabled ? t(['Disable', 'تعطيل']) : t(['Enable', 'تفعيل'])}
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
      <div className="[&>div]:rounded-xl [&>div]:border [&>div]:border-border [&>div]:bg-surface-panel [&>div]:shadow-soft">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={schedulesQuery.isLoading}
          empty={t(['No schedules configured yet.', 'لا توجد جداول بعد.'])}
        />
      </div>

      {canMutate ? (
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
      ) : null}
    </div>
  );
}
