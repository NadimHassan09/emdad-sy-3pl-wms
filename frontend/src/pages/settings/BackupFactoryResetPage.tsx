import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import { BackupsApi } from '../../api/backups';
import { useAuth } from '../../auth/AuthContext';
import { BackupAuditPanel } from '../../components/backups/BackupAuditPanel';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { useBackupOperationContext } from '../../context/BackupOperationContext';
import { QK } from '../../constants/query-keys';
import { defaultHomePath } from '../../lib/rbac';
import { useWmsTranslation } from '../../lib/ui-i18n';

const FACTORY_RESET_PHRASE = 'FACTORY RESET';

export function BackupFactoryResetPage() {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { setTrackedJobId } = useBackupOperationContext();
  const { t } = useWmsTranslation();

  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [createPreSnapshot, setCreatePreSnapshot] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (user?.role !== 'super_admin') {
    return <Navigate to={defaultHomePath(user?.role)} replace />;
  }

  const phraseOk = confirmPhrase.trim() === FACTORY_RESET_PHRASE;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border-2 border-rose-300 bg-rose-50/40 p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-rose-950">
              {t(['Danger zone — Factory reset', 'منطقة خطرة — إعادة ضبط المصنع'])}
            </h2>
            <p className="mt-2 text-sm text-rose-900/90">
              {t([
                'Truncates all business data and re-seeds defaults. Super admin account is preserved. This action is irreversible without a pre-reset snapshot.',
                'يحذف جميع بيانات الأعمال ويعيد البذر الافتراضي. يُحفظ حساب المشرف الأعلى. لا رجعة إلا عبر لقطة ما قبل إعادة الضبط.',
              ])}
            </p>

            <label className="mt-4 flex items-center gap-2 text-sm text-rose-950">
              <input
                type="checkbox"
                checked={createPreSnapshot}
                onChange={(e) => setCreatePreSnapshot(e.target.checked)}
                className="rounded border-rose-300"
              />
              {t(['Create pre-reset snapshot', 'إنشاء لقطة قبل إعادة الضبط'])}
            </label>

            <TextField
              className="mt-4"
              label={t([
                `Type ${FACTORY_RESET_PHRASE} to confirm`,
                `اكتب ${FACTORY_RESET_PHRASE} للتأكيد`,
              ])}
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={FACTORY_RESET_PHRASE}
              autoComplete="off"
            />

            <Button
              className="mt-4"
              variant="danger"
              disabled={!phraseOk || resetMutation.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              {t(['Factory reset database', 'إعادة ضبط المصنع لقاعدة البيانات'])}
            </Button>
          </div>
        </div>
      </section>

      <BackupAuditPanel />

      <ConfirmModal
        open={confirmOpen}
        title={t(['Final confirmation', 'تأكيد نهائي'])}
        danger
        loading={resetMutation.isPending}
        confirmLabel={t(['Execute factory reset', 'تنفيذ إعادة ضبط المصنع'])}
        cancelLabel={t(['Cancel', 'إلغاء'])}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => resetMutation.mutate()}
      >
        <p className="font-medium text-rose-800">
          {t([
            'This will permanently delete business data on this environment.',
            'سيحذف هذا بيانات الأعمال على هذه البيئة بشكل دائم.',
          ])}
        </p>
      </ConfirmModal>
    </div>
  );
}
