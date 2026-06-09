import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  BackupsApi,
  type BackupStoragePolicyValue,
  type CreateBackupInput,
} from '../../api/backups';
import { QK } from '../../constants/query-keys';
import {
  localizedBackupStoragePolicyLabel,
  localizedBackupStoragePolicyOptions,
} from '../../lib/ui-labels/settings-backup';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { SelectField } from '../SelectField';
import { TextField } from '../TextField';

type Props = {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (body: CreateBackupInput) => void;
};

function requiresDrive(policy: BackupStoragePolicyValue): boolean {
  return policy === 'drive_only' || policy === 'local_and_drive';
}

export function CreateBackupModal({ open, loading, onClose, onSubmit }: Props) {
  const { t } = useWmsTranslation();
  const policyOptions = useMemo(() => localizedBackupStoragePolicyOptions(t), [t]);

  const [label, setLabel] = useState('');
  const [storagePolicy, setStoragePolicy] = useState<BackupStoragePolicyValue>('local_only');
  const [error, setError] = useState<string | null>(null);

  const policyQuery = useQuery({
    queryKey: QK.backups.storagePolicy,
    queryFn: () => BackupsApi.getStoragePolicy(),
    enabled: open,
  });

  const driveQuery = useQuery({
    queryKey: QK.backups.googleDrive,
    queryFn: () => BackupsApi.getGoogleDriveStatus(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setLabel('');
    setError(null);
    if (policyQuery.data) {
      setStoragePolicy(policyQuery.data.effectiveDefaultPolicy);
    }
  }, [open, policyQuery.data]);

  const driveConnected = !!driveQuery.data?.connected;
  const driveEnabled = !!driveQuery.data?.gdriveEnabled;
  const drivePolicyBlocked = requiresDrive(storagePolicy) && (!driveEnabled || !driveConnected);

  const handleSubmit = () => {
    const trimmed = label.trim();
    if (trimmed.length > 200) {
      setError(t(['Label must be 200 characters or fewer.', 'يجب ألا تتجاوز التسمية 200 حرفاً.']));
      return;
    }
    if (drivePolicyBlocked) {
      setError(
        t([
          'Drive storage policies require a connected Google Drive account.',
          'سياسات تخزين Drive تتطلب حساب Google Drive متصلاً.',
        ]),
      );
      return;
    }
    setError(null);
    onSubmit({
      label: trimmed || undefined,
      storagePolicy,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(['Create backup', 'إنشاء نسخة احتياطية'])}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            {t(['Cancel', 'إلغاء'])}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            disabled={drivePolicyBlocked}
            data-testid="create-backup-submit"
          >
            {t(['Create backup', 'إنشاء نسخة احتياطية'])}
          </Button>
        </div>
      }
    >
      <div className="space-y-4" data-testid="create-backup-modal">
        <p className="text-sm text-slate-600">
          {t([
            'Start a manual database backup. Progress appears in backup history.',
            'ابدأ نسخة احتياطية يدوية لقاعدة البيانات. يظهر التقدم في سجل النسخ الاحتياطي.',
          ])}
        </p>

        <TextField
          label={t(['Label (optional)', 'التسمية (اختياري)'])}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t(['e.g. Pre-release snapshot', 'مثال: لقطة قبل الإصدار'])}
          maxLength={200}
          data-testid="create-backup-label"
        />

        <SelectField
          label={t(['Storage policy', 'سياسة التخزين'])}
          value={storagePolicy}
          onChange={(e) => setStoragePolicy(e.target.value as BackupStoragePolicyValue)}
          options={policyOptions.map((opt) => ({
            value: opt.value,
            label:
              requiresDrive(opt.value) && !driveConnected
                ? `${opt.label} (${t(['Drive not connected', 'Drive غير متصل'])})`
                : opt.label,
          }))}
          data-testid="create-backup-policy"
        />

        <p className="text-xs text-slate-500">
          {t(['Selected policy:', 'السياسة المختارة:'])}{' '}
          <span className="font-medium text-slate-700">
            {localizedBackupStoragePolicyLabel(storagePolicy, t)}
          </span>
        </p>

        {drivePolicyBlocked ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t([
              'Connect Google Drive under Settings → Backups → Google Drive before using Drive storage policies.',
              'اربط Google Drive من الإعدادات → النسخ الاحتياطي → Google Drive قبل استخدام سياسات تخزين Drive.',
            ])}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
