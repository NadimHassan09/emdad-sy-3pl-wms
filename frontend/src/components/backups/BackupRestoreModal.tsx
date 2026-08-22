import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from '@ds';

import { BackupsApi } from '../../api/backups';
import { useBackupOperationContext } from '../../context/BackupOperationContext';
import { QK } from '../../constants/query-keys';
import {
  backupCreatedByLabel,
  formatBackupBytes,
  formatBackupTimestamp,
  formatBackupType,
} from '../../lib/backup-display';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Button } from '../Button';
import { ConfirmModal } from '../ConfirmModal';
import { Modal } from '../Modal';
import { SelectField } from '../SelectField';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';

const RESTORE_PHRASE = 'RESTORE';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function BackupRestoreModal({ open, onClose }: Props) {
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
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      setSelectedId('');
      setConfirmPhrase('');
      setCreatePreSnapshot(true);
      setConfirmOpen(false);
    }
  }, [open]);

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
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const phraseOk = confirmPhrase.trim() === RESTORE_PHRASE;
  const busy = restoreMutation.isPending;

  return (
    <>
      <Modal
        open={open}
        onClose={() => {
          if (!busy && !confirmOpen) onClose();
        }}
        title={t(['Restore Backup', 'استعادة نسخة احتياطية'])}
        widthClass="max-w-2xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              {t(['Cancel', 'إلغاء'])}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!selectedId || !phraseOk || busy}
              onClick={() => setConfirmOpen(true)}
            >
              {t(['Restore database', 'استعادة قاعدة البيانات'])}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert
            variant="warning"
            title={t(['Warnings', 'تحذيرات'])}
            description={
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
            }
          />

          <SelectField
            label={t(['Select backup', 'اختر النسخة'])}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            options={[{ value: '', label: t(['Choose a backup…', 'اختر نسخة…']) }, ...options]}
            disabled={restorableQuery.isLoading || busy}
          />

          <label className="flex items-center gap-2 text-sm text-text-body">
            <input
              type="checkbox"
              checked={createPreSnapshot}
              onChange={(e) => setCreatePreSnapshot(e.target.checked)}
              className="rounded border-border"
              disabled={busy}
            />
            {t(['Create pre-restore snapshot', 'إنشاء لقطة قبل الاستعادة'])}
          </label>

          {selected ? (
            <dl className="grid gap-2 rounded-lg border border-border-subtle bg-surface-card-muted p-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-text-muted">{t(['Label', 'التسمية'])}</dt>
                <dd className="font-mono">{selected.label ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-text-muted">SHA-256</dt>
                <dd className="break-all font-mono">{selected.manifest?.checksumSha256 ?? '—'}</dd>
              </div>
            </dl>
          ) : null}

          <TextField
            label={t([`Type ${RESTORE_PHRASE} to confirm`, `اكتب ${RESTORE_PHRASE} للتأكيد`])}
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder={RESTORE_PHRASE}
            autoComplete="off"
            disabled={busy}
          />
        </div>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title={t(['Confirm database restore', 'تأكيد استعادة قاعدة البيانات'])}
        danger
        loading={busy}
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
    </>
  );
}
