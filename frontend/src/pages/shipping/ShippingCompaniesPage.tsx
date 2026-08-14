import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { SectionContainer } from '@ds';

import {
  ShippingApi,
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
      ShippingApi.connectProvider(provider.code, { username, password }),
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

  const onConnect = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error(t(['Username and password are required.', 'اسم المستخدم وكلمة المرور مطلوبان.']));
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
            {t(['Username', 'اسم المستخدم'])}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-text-strong">
            {provider.connected
              ? provider.usernameMasked ?? '********'
              : t(['Not saved', 'غير محفوظ'])}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {t([
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
            label={t(['Username', 'اسم المستخدم'])}
            value={username}
            autoComplete="off"
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label={t(['Password', 'كلمة المرور'])}
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />
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

export function ShippingCompaniesPage() {
  const { user } = useAuth();
  const { t } = useWmsTranslation();
  const canAccess = canAccessShippingAdmin(user?.role);
  const canMutate = canAccess;

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

      {(providersQuery.data ?? []).map((provider) => (
        <ProviderCard key={provider.code} provider={provider} canMutate={canMutate} />
      ))}
    </div>
  );
}
