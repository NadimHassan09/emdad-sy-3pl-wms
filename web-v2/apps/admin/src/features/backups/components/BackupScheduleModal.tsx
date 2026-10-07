import { useEffect, useMemo, useState } from 'react'
import { useUiPreferences } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
import { Checkbox } from '@emdad/ui/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import {
  type BackupSchedule,
  type BackupScheduleFrequency,
  type BackupStoragePolicyValue,
  type CreateBackupScheduleInput,
} from '@/api/backups'
import {
  localizedScheduleFrequencyOptions,
  localizedScheduleStoragePolicyOptions,
} from '@/lib/settings-backup-labels'

type Props = {
  open: boolean
  schedule: BackupSchedule | null
  loading?: boolean
  onClose: () => void
  onSubmit: (body: CreateBackupScheduleInput) => void
}

type FormState = {
  frequency: BackupScheduleFrequency
  hour: string
  minute: string
  retentionDays: string
  storagePolicy: string
  enabled: boolean
}

function defaultForm(): FormState {
  return {
    frequency: 'daily',
    hour: '2',
    minute: '0',
    retentionDays: '7',
    storagePolicy: '',
    enabled: true,
  }
}

function validateForm(form: FormState): string | null {
  const hour = Number(form.hour)
  const minute = Number(form.minute)
  const retentionDays = Number(form.retentionDays)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return 'Hour must be between 0 and 23.'
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return 'Minute must be between 0 and 59.'
  if (!Number.isInteger(retentionDays) || retentionDays < 1) return 'Retention days must be at least 1.'
  return null
}

export function BackupScheduleModal({ open, schedule, loading, onClose, onSubmit }: Props) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const frequencyOptions = useMemo(() => localizedScheduleFrequencyOptions(t), [isArabic])
  const storagePolicyOptions = useMemo(() => localizedScheduleStoragePolicyOptions(t), [isArabic])
  const [form, setForm] = useState<FormState>(defaultForm)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (schedule) {
      setForm({
        frequency: schedule.frequency,
        hour: String(schedule.hour),
        minute: String(schedule.minute),
        retentionDays: String(schedule.retentionDays),
        storagePolicy: schedule.storagePolicy ?? '',
        enabled: schedule.enabled,
      })
    } else {
      setForm(defaultForm())
    }
    setError(null)
  }, [open, schedule])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validateForm(form)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    onSubmit({
      frequency: form.frequency,
      hour: Number(form.hour),
      minute: Number(form.minute),
      retentionDays: Number(form.retentionDays),
      storagePolicy: form.storagePolicy ? (form.storagePolicy as BackupStoragePolicyValue) : null,
      enabled: form.enabled,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {schedule ? t('Edit schedule', 'تعديل الجدولة') : t('Create schedule', 'إنشاء جدولة')}
          </DialogTitle>
        </DialogHeader>
        <form id="backup-schedule-form" className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>{t('Frequency', 'التكرار')}</Label>
            <Select
              value={form.frequency}
              onValueChange={(v) => setForm((prev) => ({ ...prev, frequency: v as BackupScheduleFrequency }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {frequencyOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sched-hour">{t('Hour (0–23)', 'الساعة (0–23)')}</Label>
              <Input
                id="sched-hour"
                type="number"
                min={0}
                max={23}
                value={form.hour}
                onChange={(e) => setForm((prev) => ({ ...prev, hour: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sched-minute">{t('Minute (0–59)', 'الدقيقة (0–59)')}</Label>
              <Input
                id="sched-minute"
                type="number"
                min={0}
                max={59}
                value={form.minute}
                onChange={(e) => setForm((prev) => ({ ...prev, minute: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sched-retention">{t('Retention days', 'أيام الاحتفاظ')}</Label>
            <Input
              id="sched-retention"
              type="number"
              min={1}
              value={form.retentionDays}
              onChange={(e) => setForm((prev) => ({ ...prev, retentionDays: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Storage policy', 'سياسة التخزين')}</Label>
            <Select
              value={form.storagePolicy || '__default__'}
              onValueChange={(v) =>
                setForm((prev) => ({ ...prev, storagePolicy: v === '__default__' ? '' : v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {storagePolicyOptions.map((opt) => (
                  <SelectItem key={opt.value || 'default'} value={opt.value || '__default__'}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.enabled} onCheckedChange={(v) => setForm((prev) => ({ ...prev, enabled: v === true }))} />
            {t('Enabled', 'مفعّل')}
          </label>
          {error ? <p className="text-sm text-tone-danger-fg">{error}</p> : null}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="submit" form="backup-schedule-form" disabled={loading}>
            {schedule ? t('Save', 'حفظ') : t('Create', 'إنشاء')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
