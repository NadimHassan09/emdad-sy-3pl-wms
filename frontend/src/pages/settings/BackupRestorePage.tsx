import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { BackupsApi } from '../../api/backups';
import { useAuth } from '../../auth/AuthContext';
import { BackupAuditPanel } from '../../components/backups/BackupAuditPanel';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PANEL_CARD_CLASS, PANEL_TITLE_CLASS } from '../../components/FilterPanel';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { useBackupOperationContext } from '../../context/BackupOperationContext';
import { QK } from '../../constants/query-keys';
import {
  backupCreatedByLabel,
  formatBackupBytes,
  formatBackupTimestamp,
  formatBackupType,
} from '../../lib/backup-display';
import { defaultHomePath } from '../../lib/rbac';
import { useWmsTranslation } from '../../lib/ui-i18n';

const RESTORE_PHRASE = 'RESTORE';

export function BackupRestorePage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { setTrackedJobId } = useBackupOperationContext();
  const { t } = useWmsTranslation();

  const [selectedId, setSelectedId] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [createPreSnapshot, setCreatePreSnapshot] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const restorableQuery = useQuery({
    queryKey: QK.backups.restorable,
    queryFn: () => BackupsApi.listRestorable(),
    enabled: user?.role === 'super_admin',
  });

  const options = useMemo(
    () =>
      (restorableQuery.data ?? []).map((row) => ({
        value: row.id,
        label: `${formatBackupType(row.type)} · ${formatBackupBytes(row.bytesWritten)} · ${formatBackupTimestamp(row.createdAt)} · ${backupCreatedByLabel(row)}`,
      })),
    [restorableQuery.data],
  );

  const selected = restorableQuery.data?.find((r) => r.id === selectedId) ?? null;

  const restoreMutation = useMutation({
    mutationFn: () =>
      BackupsApi.restore(selectedId, {
        confirmPhrase: RESTORE_PHRASE,
        createPreSnapshot,
      }),
    onSuccess: (result) => {
      setTrackedJobId(result.restoreJobId);
      setConfirmOpen(false);
      setConfirmPhrase('');
      toast.success(t(['Restore started', 'بدأت الاستعادة']));
      void queryClient.invalidateQueries({ queryKey: QK.backups.all });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (user?.role !== 'super_admin') {
    return <Navigate to={defaultHomePath(user?.role)} replace />;
  }

  const phraseOk = confirmPhrase.trim() === RESTORE_PHRASE;

  return (
    <div className="space-y-4">
      <section className={PANEL_CARD_CLASS}>
        <h2 className={PANEL_TITLE_CLASS}>{t(['Restore Backup', 'استعادة نسخة احتياطية'])}</h2>

        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-semibold">{t(['Warnings', 'تحذيرات'])}</p>
          <ul className="mt-2 list-disc space-y-1 ps-5">
            <li>
              {t([
                'This replaces the entire database with the selected backup.',
                'يستبدل هذا قاعدة البيانات بالكامل بالنسخة المختارة.',
              ])}
            </li>
            <li>
              {t([
                'All users will be signed out when restore completes.',
                'سيتم تسجيل خروج جميع المستخدمين عند اكتمال الاستعادة.',
              ])}
            </li>
            <li>
              {t([
                'A pre-snapshot rollback backup is created automatically unless disabled.',
                'تُنشأ نسخة ما قبل الاستعادة تلقائياً ما لم يتم تعطيلها.',
              ])}
            </li>
            <li>
              {t([
                'The system enters maintenance mode during restore — only status endpoints respond.',
                'يدخل النظام وضع الصيانة أثناء الاستعادة — تستجيب نقاط الحالة فقط.',
              ])}
            </li>
          </ul>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <SelectField
            label={t(['Select backup', 'اختر النسخة'])}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            options={[{ value: '', label: t(['Choose a backup…', 'اختر نسخة…']) }, ...options]}
            disabled={restorableQuery.isLoading}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={createPreSnapshot}
              onChange={(e) => setCreatePreSnapshot(e.target.checked)}
              className="rounded border-slate-300"
            />
            {t(['Create pre-restore snapshot', 'إنشاء لقطة قبل الاستعادة'])}
          </label>
        </div>

        {selected ? (
          <dl className="mt-4 grid gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t(['Label', 'التسمية'])}</dt>
              <dd className="font-mono">{selected.label ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">SHA-256</dt>
              <dd className="break-all font-mono">{selected.manifest?.checksumSha256 ?? '—'}</dd>
            </div>
          </dl>
        ) : null}

        <TextField
          className="mt-4"
          label={t([`Type ${RESTORE_PHRASE} to confirm`, `اكتب ${RESTORE_PHRASE} للتأكيد`])}
          value={confirmPhrase}
          onChange={(e) => setConfirmPhrase(e.target.value)}
          placeholder={RESTORE_PHRASE}
          autoComplete="off"
        />

        <div className="mt-4">
          <Button
            variant="danger"
            disabled={!selectedId || !phraseOk || restoreMutation.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {t(['Restore database', 'استعادة قاعدة البيانات'])}
          </Button>
        </div>
      </section>

      <BackupAuditPanel />

      <ConfirmModal
        open={confirmOpen}
        title={t(['Confirm database restore', 'تأكيد استعادة قاعدة البيانات'])}
        danger
        loading={restoreMutation.isPending}
        confirmLabel={t(['Start restore', 'بدء الاستعادة'])}
        cancelLabel={t(['Cancel', 'إلغاء'])}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => restoreMutation.mutate()}
      >
        {t([
          `You are about to restore from backup ${selectedId}. This cannot be undone without a pre-snapshot.`,
          `أنت على وشك الاستعادة من النسخة ${selectedId}. لا يمكن التراجع إلا عبر اللقطة السابقة.`,
        ])}
      </ConfirmModal>
    </div>
  );
}
