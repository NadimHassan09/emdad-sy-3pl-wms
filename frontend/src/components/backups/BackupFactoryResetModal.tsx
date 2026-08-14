import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert } from '@ds';

import { BackupsApi } from '../../api/backups';
import { useBackupOperationContext } from '../../context/BackupOperationContext';
import { QK } from '../../constants/query-keys';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Button } from '../Button';
import { ConfirmModal } from '../ConfirmModal';
import { Modal } from '../Modal';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';

const FACTORY_RESET_PHRASE = 'FACTORY RESET';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function BackupFactoryResetModal({ open, onClose }: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { setTrackedJobId } = useBackupOperationContext();
  const { t } = useWmsTranslation();

  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [createPreSnapshot, setCreatePreSnapshot] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmPhrase('');
      setCreatePreSnapshot(true);
      setConfirmOpen(false);
    }
  }, [open]);

  const resetMutation = useMutation({
    mutationFn: () =>
      BackupsApi.factoryReset({
        confirmPhrase: FACTORY_RESET_PHRASE,
        createPreSnapshot,
      }),
    onSuccess: (result) => {
      setTrackedJobId(result.resetJobId);
      setConfirmOpen(false);
      setConfirmPhrase('');
      toast.success(t(['Factory reset started', 'بدأت إعادة ضبط المصنع']));
      void queryClient.invalidateQueries({ queryKey: QK.backups.all });
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const phraseOk = confirmPhrase.trim() === FACTORY_RESET_PHRASE;
  const busy = resetMutation.isPending;

  return (
    <>
      <Modal
        open={open}
        onClose={() => {
          if (!busy && !confirmOpen) onClose();
        }}
        title={t(['Factory Reset', 'إعادة ضبط المصنع'])}
        widthClass="max-w-xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              {t(['Cancel', 'إلغاء'])}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={!phraseOk || busy}
              onClick={() => setConfirmOpen(true)}
            >
              {t(['Factory reset database', 'إعادة ضبط المصنع لقاعدة البيانات'])}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert
            variant="error"
            title={t(['Danger zone — Factory reset', 'منطقة خطرة — إعادة ضبط المصنع'])}
            description={t([
              'Truncates all business data and re-seeds defaults. Super admin account is preserved. This action is irreversible without a pre-reset snapshot.',
              'يحذف جميع بيانات الأعمال ويعيد البذر الافتراضي. يُحفظ حساب المشرف الأعلى. لا رجعة إلا عبر لقطة ما قبل إعادة الضبط.',
            ])}
          />

          <label className="flex items-center gap-2 text-sm text-text-body">
            <input
              type="checkbox"
              checked={createPreSnapshot}
              onChange={(e) => setCreatePreSnapshot(e.target.checked)}
              className="rounded border-border"
              disabled={busy}
            />
            {t(['Create pre-reset snapshot', 'إنشاء لقطة قبل إعادة الضبط'])}
          </label>

          <TextField
            label={t([
              `Type ${FACTORY_RESET_PHRASE} to confirm`,
              `اكتب ${FACTORY_RESET_PHRASE} للتأكيد`,
            ])}
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder={FACTORY_RESET_PHRASE}
            autoComplete="off"
            disabled={busy}
          />
        </div>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title={t(['Final confirmation', 'تأكيد نهائي'])}
        danger
        loading={busy}
        confirmLabel={t(['Execute factory reset', 'تنفيذ إعادة ضبط المصنع'])}
        cancelLabel={t(['Cancel', 'إلغاء'])}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => resetMutation.mutate()}
      >
        <p className="font-medium text-status-danger-fg">
          {t([
            'This will permanently delete business data on this environment.',
            'سيحذف هذا بيانات الأعمال على هذه البيئة بشكل دائم.',
          ])}
        </p>
      </ConfirmModal>
    </>
  );
}
