import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SectionContainer } from '@ds';

import {
  ShippingApi,
  type ShippingOriginAddress,
  type ShippingProviderAdminView,
} from '../../api/shipping';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { defaultHomePath } from '../../lib/rbac';
import { useWmsTranslation } from '../../lib/ui-i18n';

function canAccessShippingAdmin(role: string | undefined): boolean {
  return role === 'super_admin' || role === 'wh_manager';
}

function connectionCardClass(connected: boolean): string {
  return connected
    ? 'border-status-success-border bg-status-success-bg text-status-success-fg'
    : 'border-border bg-surface-card-muted text-text-body';
}

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function ProviderCard({
  provider,
  canMutate,
}: {
  provider: ShippingProviderAdminView;
  canMutate: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useWmsTranslation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const connectMutation = useMutation({
    mutationFn: () =>
      ShippingApi.connectProvider(provider.code, {
        username,
        password: provider.code === 'SILA_SY' ? 'N/A' : password,
      }),
    onSuccess: () => {
      setUsername('');
      setPassword('');
      toast.success(
        t([
          `${provider.name} connected.`,
          `تم ربط ${provider.name}.`,
        ]),
      );
      void queryClient.invalidateQueries({ queryKey: QK.shipping.providers });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testMutation = useMutation({
    mutationFn: () => ShippingApi.testProvider(provider.code),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message ?? t(['Connection test failed.', 'فشل اختبار الاتصال.']));
        void queryClient.invalidateQueries({ queryKey: QK.shipping.providers });
        return;
      }
      toast.success(
        result.message?.trim()
          ? result.message
          : t(['Connection OK', 'الاتصال سليم']),
      );
      void queryClient.invalidateQueries({ queryKey: QK.shipping.providers });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => ShippingApi.disconnectProvider(provider.code),
    onSuccess: () => {
      setDisconnectOpen(false);
      toast.success(
        t([
          `${provider.name} disconnected.`,
          `تم فصل ${provider.name}.`,
        ]),
      );
      void queryClient.invalidateQueries({ queryKey: QK.shipping.providers });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isSila = provider.code === 'SILA_SY';

  const onConnect = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || (!isSila && !password)) {
      toast.error(
        isSila
          ? t(['API Key is required.', 'مفتاح API مطلوب.'])
          : t(['Username and password are required.', 'اسم المستخدم وكلمة المرور مطلوبان.']),
      );
      return;
    }
    if (isSila && !username.trim().startsWith('sila_live_')) {
      toast.error(
        t([
          'Sila API key must start with "sila_live_".',
          'يجب أن يبدأ مفتاح Sila API بـ "sila_live_".',
        ]),
      );
      return;
    }
    connectMutation.mutate();
  };

  return (
    <SectionContainer
      title={provider.name}
      description={t([
        `Provider code: ${provider.code}`,
        `رمز المزود: ${provider.code}`,
      ])}
      actions={
        canMutate && provider.connected ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={testMutation.isPending}
              onClick={() => testMutation.mutate()}
            >
              {t(['Test connection', 'اختبار الاتصال'])}
            </Button>
            <Button variant="danger" onClick={() => setDisconnectOpen(true)}>
              {t(['Disconnect', 'فصل'])}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className={`rounded-xl border-2 p-4 ${connectionCardClass(provider.connected)}`}>
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">
            {t(['Connection status', 'حالة الاتصال'])}
          </p>
          <p className="mt-1 text-lg font-semibold">
            {provider.connected
              ? t(['Connected', 'متصل'])
              : t(['Not connected', 'غير متصل'])}
          </p>
          {provider.connectedBy ? (
            <p className="mt-2 text-xs opacity-80">
              {provider.connectedBy.fullName || provider.connectedBy.email}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-surface-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {isSila ? t(['API Key', 'مفتاح API']) : t(['Username', 'اسم المستخدم'])}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-text-strong">
            {provider.connected
              ? provider.usernameMasked ?? '********'
              : t(['Not saved', 'غير محفوظ'])}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {isSila
              ? t(['API key is stored encrypted.', 'يتم تخزين مفتاح API مشفراً.'])
              : t([
                  'Password is never shown after save.',
                  'لا تُعرض كلمة المرور بعد الحفظ.',
                ])}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t(['Last test', 'آخر اختبار'])}
          </p>
          <p className="mt-1 text-sm font-semibold text-text-strong">
            {provider.lastTestStatus ?? '—'}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {formatTimestamp(provider.lastTestedAt)}
          </p>
          {provider.lastErrorSafe ? (
            <p className="mt-2 text-xs text-status-danger-fg">{provider.lastErrorSafe}</p>
          ) : null}
        </div>
      </div>

      {canMutate && !provider.connected ? (
        <form onSubmit={onConnect} className="mt-4 grid gap-3 md:grid-cols-2">
          <TextField
            label={isSila ? t(['API Key', 'مفتاح API']) : t(['Username', 'اسم المستخدم'])}
            value={username}
            autoComplete="off"
            placeholder={isSila ? 'sila_live_...' : ''}
            onChange={(e) => setUsername(e.target.value)}
          />
          {!isSila ? (
            <TextField
              label={t(['Password', 'كلمة المرور'])}
              type="password"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : null}
          <div className="md:col-span-2">
            <Button type="submit" variant="brand" loading={connectMutation.isPending}>
              {t(['Connect', 'ربط'])}
            </Button>
          </div>
        </form>
      ) : null}

      {canMutate ? (
        <ConfirmModal
          open={disconnectOpen}
          title={t(['Disconnect shipping company?', 'فصل شركة الشحن؟'])}
          confirmLabel={t(['Disconnect', 'فصل'])}
          cancelLabel={t(['Cancel', 'إلغاء'])}
          danger
          loading={disconnectMutation.isPending}
          onConfirm={() => disconnectMutation.mutate()}
          onClose={() => setDisconnectOpen(false)}
        >
          {t([
            'Encrypted credentials will be removed. Existing shipments are not deleted.',
            'ستُزال بيانات الاعتماد المشفّرة. لن تُحذف الشحنات الحالية.',
          ])}
        </ConfirmModal>
      ) : null}
    </SectionContainer>
  );
}

function PickupAddressCard({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useWmsTranslation();
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [street, setStreet] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  const query = useQuery({
    queryKey: QK.shipping.originAddress,
    queryFn: () => ShippingApi.getOriginAddress(),
  });

  const saved = query.data;
  useEffect(() => {
    if (!saved) return;
    setContactName(saved.contactName);
    setPhone(saved.phone);
    setCity(saved.city);
    setDistrict(saved.district ?? '');
    setStreet(saved.street);
    setLat(saved.lat != null ? String(saved.lat) : '');
    setLng(saved.lng != null ? String(saved.lng) : '');
  }, [saved]);

  const saveMutation = useMutation({
    mutationFn: () =>
      ShippingApi.saveOriginAddress({
        contactName: contactName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        district: district.trim() || undefined,
        street: street.trim(),
        ...(lat.trim() ? { lat: Number(lat) } : {}),
        ...(lng.trim() ? { lng: Number(lng) } : {}),
      }),
    onSuccess: (row: ShippingOriginAddress) => {
      toast.success(t(['Pickup address saved.', 'تم حفظ عنوان الاستلام.']));
      queryClient.setQueryData(QK.shipping.originAddress, row);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !phone.trim() || !city.trim() || !street.trim()) {
      toast.error(t(['Name, phone, city, and street are required.', 'الاسم والهاتف والمدينة والشارع مطلوبة.']));
      return;
    }
    saveMutation.mutate();
  };

  return (
    <SectionContainer
      title={t(['Pickup address', 'عنوان الاستلام'])}
      description={t([
        'Set once by a super admin. Every shipping company collects the parcel from this address. The customer delivery address stays on the order.',
        'يحدده مدير النظام مرة واحدة. تستلم كل شركات الشحن الشحنة من هذا العنوان. عنوان توصيل العميل يبقى على الطلب.',
      ])}
    >
      {query.isLoading ? (
        <p className="text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
      ) : (
        <form onSubmit={onSave} className="grid gap-3 md:grid-cols-2">
          <TextField
            label={t(['Contact name', 'اسم جهة الاتصال'])}
            value={contactName}
            disabled={!canEdit}
            onChange={(e) => setContactName(e.target.value)}
          />
          <TextField
            label={t(['Phone', 'الهاتف'])}
            value={phone}
            disabled={!canEdit}
            onChange={(e) => setPhone(e.target.value)}
          />
          <TextField
            label={t(['City', 'المدينة'])}
            value={city}
            disabled={!canEdit}
            onChange={(e) => setCity(e.target.value)}
          />
          <TextField
            label={t(['District', 'الحي'])}
            value={district}
            disabled={!canEdit}
            onChange={(e) => setDistrict(e.target.value)}
          />
          <div className="md:col-span-2">
            <TextField
              label={t(['Street', 'الشارع'])}
              value={street}
              disabled={!canEdit}
              onChange={(e) => setStreet(e.target.value)}
            />
          </div>
          <TextField
            label={t(['Latitude', 'خط العرض'])}
            value={lat}
            disabled={!canEdit}
            onChange={(e) => setLat(e.target.value)}
          />
          <TextField
            label={t(['Longitude', 'خط الطول'])}
            value={lng}
            disabled={!canEdit}
            onChange={(e) => setLng(e.target.value)}
          />
          {canEdit ? (
            <div className="md:col-span-2">
              <Button type="submit" variant="brand" loading={saveMutation.isPending}>
                {t(['Save pickup address', 'حفظ عنوان الاستلام'])}
              </Button>
            </div>
          ) : (
            <p className="md:col-span-2 text-sm text-text-muted">
              {t([
                'Only a super admin can change this address.',
                'مدير النظام فقط يمكنه تغيير هذا العنوان.',
              ])}
            </p>
          )}
        </form>
      )}
    </SectionContainer>
  );
}

export function ShippingCompaniesPage() {
  const { user } = useAuth();
  const { t } = useWmsTranslation();
  const canAccess = canAccessShippingAdmin(user?.role);
  const canMutate = canAccess;
  const canEditPickup = user?.role === 'super_admin';

  const providersQuery = useQuery({
    queryKey: QK.shipping.providers,
    queryFn: () => ShippingApi.listProviders(),
    enabled: canAccess,
  });

  if (!canAccess) {
    return <Navigate to={defaultHomePath(user?.role)} replace />;
  }

  return (
    <div className="space-y-4 animate-enter">
      <SectionContainer
        title={t(['Shipping Companies', 'شركات الشحن'])}
        description={t([
          'Connect carrier accounts (e.g. Babel Express). Credentials are stored encrypted; passwords are never shown after save.',
          'اربط حسابات شركات الشحن (مثل Babel Express). تُخزَّن بيانات الاعتماد مشفّرة؛ لا تُعرض كلمات المرور بعد الحفظ.',
        ])}
      >
        {providersQuery.isLoading ? (
          <p className="text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
        ) : providersQuery.isError ? (
          <p className="text-sm text-status-danger-fg">{providersQuery.error.message}</p>
        ) : (providersQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-text-muted">
            {t(['No shipping providers configured.', 'لا توجد شركات شحن مُعدّة.'])}
          </p>
        ) : (
          <p className="text-sm text-text-muted">
            {t([
              `${providersQuery.data!.length} provider(s) available.`,
              `${providersQuery.data!.length} مزود/مزودين متاحين.`,
            ])}
          </p>
        )}
      </SectionContainer>

      <PickupAddressCard canEdit={canEditPickup} />

      {(providersQuery.data ?? []).map((provider) => (
        <ProviderCard key={provider.code} provider={provider} canMutate={canMutate} />
      ))}
    </div>
  );
}
