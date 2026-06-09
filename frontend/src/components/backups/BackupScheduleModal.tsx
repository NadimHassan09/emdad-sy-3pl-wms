import { useEffect, useMemo, useState } from 'react';

import {
  type BackupSchedule,
  type BackupScheduleFrequency,
  type BackupStoragePolicyValue,
  type CreateBackupScheduleInput,
} from '../../api/backups';
import {
  localizedScheduleFrequencyOptions,
  localizedScheduleStoragePolicyOptions,
} from '../../lib/ui-labels/settings-backup';
import { useWmsTranslation } from '../../lib/ui-i18n';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { SelectField } from '../SelectField';
import { TextField } from '../TextField';

type Props = {
  open: boolean;
  schedule: BackupSchedule | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (body: CreateBackupScheduleInput) => void;
};

type FormState = {
  frequency: BackupScheduleFrequency;
  hour: string;
  minute: string;
  retentionDays: string;
  storagePolicy: string;
  enabled: boolean;
};

function defaultForm(): FormState {
  return {
    frequency: 'daily',
    hour: '2',
    minute: '0',
    retentionDays: '7',
    storagePolicy: '',
    enabled: true,
  };
}

function validateForm(form: FormState): string | null {
  const hour = Number(form.hour);
  const minute = Number(form.minute);
  const retentionDays = Number(form.retentionDays);

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return 'Hour must be between 0 and 23.';
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return 'Minute must be between 0 and 59.';
  }
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    return 'Retention days must be at least 1.';
  }
  return null;
}

export function BackupScheduleModal({
  open,
  schedule,
  loading,
  onClose,
  onSubmit,
}: Props) {
  const { t } = useWmsTranslation();
  const frequencyOptions = useMemo(() => localizedScheduleFrequencyOptions(t), [t]);
  const storagePolicyOptions = useMemo(() => localizedScheduleStoragePolicyOptions(t), [t]);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (schedule) {
      setForm({
        frequency: schedule.frequency,
        hour: String(schedule.hour),
        minute: String(schedule.minute),
        retentionDays: String(schedule.retentionDays),
        storagePolicy: schedule.storagePolicy ?? '',
        enabled: schedule.enabled,
      });
    } else {
      setForm(defaultForm());
    }
    setError(null);
  }, [open, schedule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSubmit({
      frequency: form.frequency,
      hour: Number(form.hour),
      minute: Number(form.minute),
      retentionDays: Number(form.retentionDays),
      storagePolicy: form.storagePolicy
        ? (form.storagePolicy as BackupStoragePolicyValue)
        : null,
      enabled: form.enabled,
    });
  };

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title={
        schedule
          ? t(['Edit schedule', 'تعديل الجدولة'])
          : t(['Create schedule', 'إنشاء جدولة'])
      }
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            {t(['Cancel', 'إلغاء'])}
          </Button>
          <Button type="submit" form="backup-schedule-form" loading={loading}>
            {schedule ? t(['Save', 'حفظ']) : t(['Create', 'إنشاء'])}
          </Button>
        </>
      }
    >
      <form id="backup-schedule-form" className="space-y-4" onSubmit={handleSubmit}>
        <SelectField
          label={t(['Frequency', 'التكرار'])}
          value={form.frequency}
          options={[...frequencyOptions]}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, frequency: e.target.value as BackupScheduleFrequency }))
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t(['Hour (0–23)', 'الساعة (0–23)'])}
            type="number"
            min={0}
            max={23}
            value={form.hour}
            onChange={(e) => setForm((prev) => ({ ...prev, hour: e.target.value }))}
            required
          />
          <TextField
            label={t(['Minute (0–59)', 'الدقيقة (0–59)'])}
            type="number"
            min={0}
            max={59}
            value={form.minute}
            onChange={(e) => setForm((prev) => ({ ...prev, minute: e.target.value }))}
            required
          />
        </div>

        <TextField
          label={t(['Retention days', 'أيام الاحتفاظ'])}
          type="number"
          min={1}
          value={form.retentionDays}
          onChange={(e) => setForm((prev) => ({ ...prev, retentionDays: e.target.value }))}
          required
        />

        <SelectField
          label={t(['Storage policy', 'سياسة التخزين'])}
          value={form.storagePolicy}
          options={[...storagePolicyOptions]}
          onChange={(e) => setForm((prev) => ({ ...prev, storagePolicy: e.target.value }))}
        />

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          {t(['Enabled', 'مفعّل'])}
        </label>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </form>
    </Modal>
  );
}
