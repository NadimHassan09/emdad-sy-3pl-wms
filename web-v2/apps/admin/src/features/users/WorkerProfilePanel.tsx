import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useUiPreferences } from '@emdad/core'
import { StatusBadge } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { Checkbox } from '@emdad/ui/ui/checkbox'
import { Combobox } from '@emdad/ui/ui/combobox'
import { Label } from '@emdad/ui/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { toast } from 'sonner'
import { UsersApi, type UserListRow } from '@/api/users'
import { WarehousesApi } from '@/api/warehouses'
import { WorkersApi } from '@/api/workers'
import { QK } from '@/constants/query-keys'
import { useDefaultWarehouseId } from '@/hooks/useDefaultWarehouse'
import {
  DEFAULT_WORKER_ROLES,
  WORKER_ROLE_OPTIONS,
  workerProfileStatusText,
  type WorkerOperationalRole,
} from '@/lib/worker-profile'

export function WorkerProfilePanel({
  user,
  compact = false,
}: {
  user: UserListRow
  compact?: boolean
}) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()
  const { warehouseId: defaultWarehouseId } = useDefaultWarehouseId()

  const profileQuery = useQuery({
    queryKey: [...QK.users.detail(user.id), 'worker-profile'],
    queryFn: () => UsersApi.getWorkerProfile(user.id),
    enabled: user.kind === 'system' && user.role === 'wh_operator',
    initialData: user.workerProfile,
  })

  const [warehouseId, setWarehouseId] = useState('')
  const [roles, setRoles] = useState<WorkerOperationalRole[]>(DEFAULT_WORKER_ROLES)
  const [linkWorkerId, setLinkWorkerId] = useState('')
  const [mode, setMode] = useState<'create' | 'link'>('create')

  const warehousesQuery = useQuery({
    queryKey: QK.warehouses,
    queryFn: () => WarehousesApi.list(),
  })

  const unlinkedWorkersQuery = useQuery({
    queryKey: [...QK.workers.all, 'unlinked'],
    queryFn: () => WorkersApi.listUnlinked(),
    enabled: !profileQuery.data && mode === 'link',
  })

  const profile = profileQuery.data ?? user.workerProfile

  useEffect(() => {
    if (!profile) return
    setWarehouseId(profile.warehouseId ?? '')
    if (profile.roles.length) setRoles(profile.roles as WorkerOperationalRole[])
  }, [profile?.id, profile?.warehouseId, profile?.roles.join(',')])

  const warehouseOptions = useMemo(
    () => [
      { value: '', label: t('Tenant-wide (all warehouses)', 'كل المستودعات') },
      ...(warehousesQuery.data ?? []).map((w) => ({
        value: w.id,
        label: `${w.code} — ${w.name}`,
      })),
    ],
    [warehousesQuery.data, isArabic],
  )

  const saveMut = useMutation({
    mutationFn: () =>
      UsersApi.upsertWorkerProfile(user.id, {
        warehouseId: warehouseId.trim() || null,
        roles,
        ...(mode === 'link' && linkWorkerId ? { linkWorkerId } : {}),
      }),
    onSuccess: (saved) => {
      toast.success(t('Worker profile saved.', 'تم حفظ ملف العامل.'))
      qc.setQueryData([...QK.users.detail(user.id), 'worker-profile'], saved)
      void qc.invalidateQueries({ queryKey: QK.users.detail(user.id) })
      void qc.invalidateQueries({ queryKey: ['users', 'list'] })
      void qc.invalidateQueries({ queryKey: QK.workers.all })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!profile && mode === 'link' && !linkWorkerId) {
      toast.error(t('Select an unlinked worker profile.', 'اختر ملف عامل غير مرتبط.'))
      return
    }
    if (!profile && mode === 'create' && roles.length === 0) {
      toast.error(t('Choose at least one operational role.', 'اختر دوراً واحداً على الأقل.'))
      return
    }
    saveMut.mutate()
  }

  if (user.kind !== 'system' || user.role !== 'wh_operator') return null

  const statusText = workerProfileStatusText(profile, user.status, t)
  const statusTone =
    statusText === t('Linked', 'مرتبط') ? 'success' : statusText === t('Not linked', 'غير مرتبط') ? 'warning' : 'neutral'

  return (
    <section className={`overflow-hidden rounded-xl border bg-card shadow-sm ${compact ? 'p-4' : 'p-6'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t('Worker profile', 'ملف العامل')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('Required for task assignment and cycle count.', 'مطلوب لتكليف المهام والجرد.')}
          </p>
        </div>
        <StatusBadge tone={statusTone}>{statusText}</StatusBadge>
      </div>

      {profile ? (
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t('Profile ID', 'معرف الملف')}</dt>
            <dd className="font-mono text-xs">{profile.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('Warehouse', 'المستودع')}</dt>
            <dd>
              {profile.warehouseCode
                ? `${profile.warehouseCode} — ${profile.warehouseName ?? ''}`
                : t('Tenant-wide', 'كل المستودعات')}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">{t('Roles', 'الأدوار')}</dt>
            <dd>{profile.roles.join(', ') || '—'}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-tone-warning-fg">
          {t('No worker profile linked yet.', 'لا يوجد ملف عامل مرتبط بعد.')}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t pt-4">
        {!profile ? (
          <div className="space-y-1.5">
            <Label>{t('Setup mode', 'وضع الإعداد')}</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as 'create' | 'link')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create">{t('Create new profile', 'إنشاء ملف جديد')}</SelectItem>
                <SelectItem value="link">{t('Link existing profile', 'ربط ملف موجود')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {!profile && mode === 'link' ? (
          <div className="space-y-1.5">
            <Label>{t('Unlinked worker', 'عامل غير مرتبط')}</Label>
            <Combobox
              value={linkWorkerId}
              onChange={setLinkWorkerId}
              options={(unlinkedWorkersQuery.data ?? []).map((w) => ({
                value: w.id,
                label: w.displayName,
              }))}
              placeholder={t('Search worker…', 'ابحث…')}
              emptyLabel={t('No unlinked workers.', 'لا عمال غير مرتبطين.')}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label>{t('Home warehouse', 'المستودع الرئيسي')}</Label>
          <Select
            value={warehouseId || defaultWarehouseId || '__all__'}
            onValueChange={(v) => setWarehouseId(v === '__all__' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {warehouseOptions.map((o) => (
                <SelectItem key={o.value || '__all__'} value={o.value || '__all__'}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-medium">{t('Operational roles', 'الأدوار التشغيلية')}</legend>
          <div className="flex flex-wrap gap-3">
            {WORKER_ROLE_OPTIONS.map((opt) => {
              const checked = roles.includes(opt.value)
              return (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => {
                      setRoles((cur) =>
                        checked ? cur.filter((r) => r !== opt.value) : [...cur, opt.value],
                      )
                    }}
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex justify-end">
          <Button type="submit" disabled={saveMut.isPending}>
            {profile ? t('Update profile', 'تحديث') : t('Provision profile', 'إنشاء الملف')}
          </Button>
        </div>
      </form>
    </section>
  )
}
