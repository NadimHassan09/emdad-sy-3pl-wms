import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { UsersApi, type UserListRow } from '../../api/users';
import { WarehousesApi } from '../../api/warehouses';
import { WorkersApi } from '../../api/workers';
import { QK } from '../../constants/query-keys';
import { useDefaultWarehouseId } from '../../hooks/useDefaultWarehouse';
import {
  DEFAULT_WORKER_ROLES,
  WORKER_ROLE_OPTIONS,
  workerProfileStatusText,
  type WorkerOperationalRole,
} from '../../lib/worker-profile';
import { Button } from '../Button';
import { Combobox } from '../Combobox';
import { SelectField } from '../SelectField';
import { useToast } from '../ToastProvider';

type Props = {
  user: UserListRow;
  t: (en: string, ar: string) => string;
  compact?: boolean;
};

export function WorkerProfilePanel({ user, t, compact = false }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const { warehouseId: defaultWarehouseId } = useDefaultWarehouseId();

  const profileQuery = useQuery({
    queryKey: [...QK.users.detail(user.id), 'worker-profile'],
    queryFn: () => UsersApi.getWorkerProfile(user.id),
    enabled: user.kind === 'system' && user.role === 'wh_operator',
    initialData: user.workerProfile,
  });

  const [warehouseId, setWarehouseId] = useState('');
  const [roles, setRoles] = useState<WorkerOperationalRole[]>(DEFAULT_WORKER_ROLES);
  const [linkWorkerId, setLinkWorkerId] = useState('');
  const [mode, setMode] = useState<'create' | 'link'>('create');

  const warehousesQuery = useQuery({
    queryKey: QK.warehouses,
    queryFn: () => WarehousesApi.list(),
  });

  const unlinkedWorkersQuery = useQuery({
    queryKey: [...QK.workers.all, 'unlinked'],
    queryFn: () => WorkersApi.listUnlinked(),
    enabled: !profileQuery.data && mode === 'link',
  });

  const profile = profileQuery.data ?? user.workerProfile;

  useEffect(() => {
    if (!profile) return;
    setWarehouseId(profile.warehouseId ?? '');
    if (profile.roles.length) setRoles(profile.roles as WorkerOperationalRole[]);
  }, [profile?.id, profile?.warehouseId, profile?.roles.join(',')]);

  const warehouseOptions = useMemo(
    () => [
      { value: '', label: t('Tenant-wide (all warehouses)', 'على مستوى العميل (كل المستودعات)') },
      ...(warehousesQuery.data ?? []).map((w) => ({
        value: w.id,
        label: `${w.code} — ${w.name}`,
      })),
    ],
    [warehousesQuery.data, t],
  );

  const saveMut = useMutation({
    mutationFn: () =>
      UsersApi.upsertWorkerProfile(user.id, {
        warehouseId: warehouseId.trim() || null,
        roles,
        ...(mode === 'link' && linkWorkerId ? { linkWorkerId } : {}),
      }),
    onSuccess: (saved) => {
      toast.success(t('Worker profile saved.', 'تم حفظ ملف العامل.'));
      qc.setQueryData([...QK.users.detail(user.id), 'worker-profile'], saved);
      void qc.invalidateQueries({ queryKey: QK.users.detail(user.id) });
      void qc.invalidateQueries({ queryKey: ['users', 'list'], exact: false });
      void qc.invalidateQueries({ queryKey: QK.workers.all });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!profile && mode === 'link' && !linkWorkerId) {
      toast.error(t('Select an unlinked worker profile to link.', 'اختر ملف عامل غير مرتبط.'));
      return;
    }
    if (!profile && mode === 'create' && roles.length === 0) {
      toast.error(t('Choose at least one operational role.', 'اختر دوراً تشغيلياً واحداً على الأقل.'));
      return;
    }
    saveMut.mutate();
  };

  if (user.kind !== 'system' || user.role !== 'wh_operator') {
    return null;
  }

  const statusText = workerProfileStatusText(profile, user.status, t);

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-border-subtle bg-surface-card shadow-sm ${
        compact ? 'p-4' : 'p-6'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-strong">
            {t('Worker profile', 'ملف العامل')}
          </h3>
          <p className="mt-1 text-xs text-text-muted">
            {t(
              'Required for task assignment and blind cycle count execution.',
              'مطلوب لتكليف المهام وتنفيذ الجرد الأعمى.',
            )}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
            statusText === t('Linked', 'مرتبط')
              ? 'bg-status-success-bg text-status-success-fg ring-status-success-border'
              : statusText === t('Not linked', 'غير مرتبط')
                ? 'bg-status-warning-bg text-status-warning-fg ring-status-warning-border'
                : 'bg-surface-card-muted text-text-body ring-border'
          }`}
        >
          {statusText}
        </span>
      </div>

      {profile ? (
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-text-muted">{t('Profile ID', 'معرف الملف')}</dt>
            <dd className="font-mono text-xs text-text-strong">{profile.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">{t('Warehouse', 'المستودع')}</dt>
            <dd className="text-text-strong">
              {profile.warehouseCode
                ? `${profile.warehouseCode} — ${profile.warehouseName ?? ''}`
                : t('Tenant-wide', 'على مستوى العميل')}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-text-muted">{t('Roles', 'الأدوار')}</dt>
            <dd className="text-text-strong">{profile.roles.join(', ') || '—'}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-status-warning-fg">
          {t(
            'No worker profile is linked yet. Provision one below so this operator can execute counts and receive tasks.',
            'لا يوجد ملف عامل مرتبط بعد. أنشئ ملفاً أدناه ليتمكن هذا المشغل من تنفيذ الجرد واستلام المهام.',
          )}
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-border-subtle pt-4">
        {!profile ? (
          <SelectField
            label={t('Setup mode', 'وضع الإعداد')}
            name="worker-setup-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'create' | 'link')}
            options={[
              { value: 'create', label: t('Create new profile', 'إنشاء ملف جديد') },
              { value: 'link', label: t('Link existing profile', 'ربط ملف موجود') },
            ]}
          />
        ) : null}

        {!profile && mode === 'link' ? (
          <Combobox
            label={t('Unlinked worker', 'عامل غير مرتبط')}
            required
            dropdownInFlow
            value={linkWorkerId}
            onChange={setLinkWorkerId}
            options={(unlinkedWorkersQuery.data ?? []).map((w) => ({
              value: w.id,
              label: w.displayName,
              hint: w.roles.map((r) => r.role).join(', '),
            }))}
            placeholder={t('Search worker…', 'ابحث عن عامل…')}
            emptyMessage={t('No unlinked workers in this tenant.', 'لا عمال غير مرتبطين في هذا العميل.')}
          />
        ) : null}

        <SelectField
          label={t('Home warehouse', 'المستودع الرئيسي')}
          name="worker-warehouse"
          value={warehouseId || defaultWarehouseId || ''}
          onChange={(e) => setWarehouseId(e.target.value)}
          options={warehouseOptions}
          hint={t(
            'Leave tenant-wide when the operator works across warehouses.',
            'اتركه على مستوى العميل إذا عمل المشغل عبر المستودعات.',
          )}
        />

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-text-body">
            {t('Operational roles', 'الأدوار التشغيلية')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {WORKER_ROLE_OPTIONS.map((opt) => {
              const checked = roles.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                    checked
                      ? 'border-status-success-border bg-status-success-bg text-status-success-fg'
                      : 'border-border bg-white text-text-body'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => {
                      setRoles((cur) =>
                        checked ? cur.filter((r) => r !== opt.value) : [...cur, opt.value],
                      );
                    }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex justify-end">
          <Button type="submit" variant="brand" loading={saveMut.isPending}>
            {profile ? t('Update profile', 'تحديث الملف') : t('Provision profile', 'إنشاء الملف')}
          </Button>
        </div>
      </form>
    </section>
  );
}
