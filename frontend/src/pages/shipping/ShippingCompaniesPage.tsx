import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
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

/** The platform stores the rate in old pounds per USD; the screen shows and takes new pounds (1 new = 100 old). */
const OLD_PER_NEW = 100;

function FxRateCard({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { t } = useWmsTranslation();
  const [rate, setRate] = useState('');
  const [refreshHours, setRefreshHours] = useState('6');
  const [staleHours, setStaleHours] = useState('24');
  const [minChange, setMinChange] = useState('0.5');
  const [autoKind, setAutoKind] = useState<'builtin' | 'custom'>('builtin');
  const [customUrl, setCustomUrl] = useState('');
  const [customJsonPath, setCustomJsonPath] = useState('usd.syp');
  const [customRateUnit, setCustomRateUnit] = useState<'old_syp' | 'new_syp'>('old_syp');
  const [customAuthHeaderName, setCustomAuthHeaderName] = useState('');
  const [customAuthHeaderValue, setCustomAuthHeaderValue] = useState('');
  const query = useQuery({
    queryKey: ['shipping', 'fx'],
    queryFn: () => ShippingApi.getFx(),
  });
  useEffect(() => {
    if (query.data?.manualRate != null) setRate(String(query.data.manualRate / OLD_PER_NEW));
  }, [query.data?.manualRate]);
  useEffect(() => {
    if (!query.data) return;
    setRefreshHours(String(query.data.refreshHours));
    setStaleHours(String(query.data.staleHours));
    setMinChange(String(query.data.minChangePercent));
    setAutoKind(query.data.autoSourceKind ?? 'builtin');
    setCustomUrl(query.data.custom?.url ?? '');
    setCustomJsonPath(query.data.custom?.jsonPath || 'usd.syp');
    setCustomRateUnit(query.data.custom?.rateUnit ?? 'old_syp');
    setCustomAuthHeaderName(query.data.custom?.authHeaderName ?? '');
    // Never hydrate the secret from the server — it is not returned.
    setCustomAuthHeaderValue('');
  }, [
    query.data?.refreshHours,
    query.data?.staleHours,
    query.data?.minChangePercent,
    query.data?.autoSourceKind,
    query.data?.custom?.url,
    query.data?.custom?.jsonPath,
    query.data?.custom?.rateUnit,
    query.data?.custom?.authHeaderName,
  ]);
  const thresholds = () => ({
    refreshHours: Number(refreshHours),
    staleHours: Number(staleHours),
    minChangePercent: Number(minChange),
  });
  const customPayload = () => ({
    autoSourceKind: autoKind,
    customUrl: customUrl.trim() || undefined,
    customJsonPath: customJsonPath.trim() || undefined,
    customRateUnit,
    customAuthHeaderName: customAuthHeaderName.trim() || undefined,
    // Omit when blank so a previously stored secret is kept.
    ...(customAuthHeaderValue.trim()
      ? { customAuthHeaderValue: customAuthHeaderValue.trim() }
      : {}),
  });
  const done = (message: string) => () => {
    toast.success(message);
    void queryClient.invalidateQueries({ queryKey: ['shipping', 'fx'] });
  };
  const saveManual = useMutation({
    mutationFn: () =>
      ShippingApi.saveFx({ mode: 'manual', manualRate: Number(rate) * OLD_PER_NEW, ...thresholds() }),
    onSuccess: done(t(['Manual rate saved. Automatic updates are off.', 'تم حفظ السعر اليدوي. التحديث التلقائي متوقف.'])),
    onError: (err: Error) => toast.error(err.message),
  });
  const saveAuto = useMutation({
    mutationFn: () =>
      ShippingApi.saveFx({ mode: 'automatic', ...thresholds(), ...customPayload() }),
    onSuccess: done(
      autoKind === 'custom'
        ? t(['Custom API updates are on.', 'تم تشغيل التحديث من الـ API الخارجي.'])
        : t(['Automatic updates are on.', 'تم تشغيل التحديث التلقائي.']),
    ),
    onError: (err: Error) => toast.error(err.message),
  });
  const testSource = useMutation({
    mutationFn: () => ShippingApi.testFxSource(customPayload()),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error || t(['Source check failed.', 'فشل فحص المصدر.']));
        return;
      }
      toast.success(`${result.source}: 1 USD = ${((result.rate ?? 0) / OLD_PER_NEW).toFixed(2)} new SYP`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const fx = query.data;
  const newRate = fx?.activeRate != null ? fx.activeRate / OLD_PER_NEW : null;
  return (
    <SectionContainer
      title={t(['Exchange rates', 'أسعار الصرف'])}
      description={t([
        'Clients and invoices use USD only. The pound is used with carriers. 1 new SYP = 100 old SYP is fixed. Choose a manual rate, the built-in market feed, or your own HTTPS JSON API.',
        'العملاء والفواتير بالدولار فقط. الليرة تُستخدم مع شركات الشحن. 1 ليرة جديدة = 100 قديمة ثابتة. اختر سعرًا يدويًا، أو المصدر المدمج، أو API خارجي HTTPS خاص بك.',
      ])}
    >
      {query.isLoading ? (
        <p className="text-sm text-text-muted">{t(['Loading…', 'جارٍ التحميل…'])}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-text-body">
            {t(['Active rate', 'السعر الحالي'])}:{' '}
            <strong>
              {newRate != null
                ? `1 USD = ${newRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${t(['new SYP', 'ليرة جديدة'])} = ${(fx?.activeRate ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t(['old SYP', 'ليرة قديمة'])}`
                : '—'}
            </strong>
            {' · '}
            {fx?.mode === 'automatic'
              ? fx.autoSourceKind === 'custom'
                ? t(['Custom API', 'API خارجي'])
                : t(['Automatic', 'تلقائي'])
              : t(['Manual', 'يدوي'])}
            {fx?.stale ? ` · ${t(['Stale', 'قديم'])}` : ''}
            {fx?.usable ? '' : ` · ${t(['Not usable for conversion', 'غير صالح للتحويل'])}`}
          </p>
          <p className="text-sm text-text-muted">
            {t(['Source', 'المصدر'])}: {fx?.activeSource || '—'}
            {' · '}
            {t(['Last success', 'آخر نجاح'])}: {formatTimestamp(fx?.lastSuccessfulAt)}
          </p>
          {fx?.lastError ? <p className="text-sm text-status-danger-fg">{fx.lastError}</p> : null}
          {canEdit ? (
            <form
              className="space-y-3"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                saveManual.mutate();
              }}
            >
              <div className="flex flex-wrap items-end gap-2">
                <TextField
                  label={t(['Manual rate (new SYP per 1 USD)', 'سعر يدوي (ليرة جديدة لكل دولار)'])}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  inputMode="decimal"
                />
                <Button type="submit" disabled={saveManual.isPending}>
                  {t(['Save manual rate', 'حفظ السعر اليدوي'])}
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <TextField
                  label={t(['Ask the source every (hours)', 'اسأل المصدر كل (ساعات)'])}
                  value={refreshHours}
                  onChange={(e) => setRefreshHours(e.target.value)}
                  inputMode="numeric"
                />
                <TextField
                  label={t(['Reject a rate older than (hours)', 'ارفض سعرًا أقدم من (ساعات)'])}
                  value={staleHours}
                  onChange={(e) => setStaleHours(e.target.value)}
                  inputMode="numeric"
                />
                <TextField
                  label={t(['Change only if it moves by (%)', 'غيّر فقط إذا تحرك بنسبة (%)'])}
                  value={minChange}
                  onChange={(e) => setMinChange(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <fieldset className="space-y-2 rounded-md border border-border p-3">
                <legend className="px-1 text-sm font-medium text-text-body">
                  {t(['Automatic source', 'مصدر التحديث التلقائي'])}
                </legend>
                <div className="flex flex-wrap gap-4 text-sm text-text-body">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="fx-auto-kind"
                      checked={autoKind === 'builtin'}
                      onChange={() => setAutoKind('builtin')}
                    />
                    {t(['Built-in market feed', 'المصدر المدمج'])}
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="fx-auto-kind"
                      checked={autoKind === 'custom'}
                      onChange={() => setAutoKind('custom')}
                    />
                    {t(['Custom HTTPS JSON API', 'API خارجي (HTTPS JSON)'])}
                  </label>
                </div>
                {autoKind === 'custom' ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <TextField
                      label={t(['API URL (HTTPS)', 'رابط الـ API (HTTPS)'])}
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://example.com/rates.json"
                    />
                    <TextField
                      label={t(['JSON path to rate', 'مسار السعر داخل الـ JSON'])}
                      value={customJsonPath}
                      onChange={(e) => setCustomJsonPath(e.target.value)}
                      placeholder="usd.syp"
                    />
                    <label className="block text-sm text-text-body">
                      <span className="mb-1 block text-text-muted">
                        {t(['Rate unit in the response', 'وحدة السعر في الرد'])}
                      </span>
                      <select
                        className="w-full rounded-md border border-border bg-surface-card px-3 py-2"
                        value={customRateUnit}
                        onChange={(e) =>
                          setCustomRateUnit(e.target.value as 'old_syp' | 'new_syp')
                        }
                      >
                        <option value="old_syp">
                          {t(['Old SYP per 1 USD', 'ليرة قديمة لكل دولار'])}
                        </option>
                        <option value="new_syp">
                          {t(['New SYP per 1 USD (×100 stored)', 'ليرة جديدة لكل دولار (×100 عند الحفظ)'])}
                        </option>
                      </select>
                    </label>
                    <TextField
                      label={t(['Auth header name (optional)', 'اسم هيدر المصادقة (اختياري)'])}
                      value={customAuthHeaderName}
                      onChange={(e) => setCustomAuthHeaderName(e.target.value)}
                      placeholder="Authorization"
                    />
                    <TextField
                      label={
                        fx?.custom?.authConfigured
                          ? t([
                              'Auth header value (leave blank to keep stored secret)',
                              'قيمة هيدر المصادقة (اتركه فارغًا للإبقاء على السر المخزّن)',
                            ])
                          : t(['Auth header value (optional)', 'قيمة هيدر المصادقة (اختياري)'])
                      }
                      value={customAuthHeaderValue}
                      onChange={(e) => setCustomAuthHeaderValue(e.target.value)}
                      type="password"
                      autoComplete="new-password"
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={saveAuto.isPending} onClick={() => saveAuto.mutate()}>
                    {autoKind === 'custom'
                      ? t(['Use custom API', 'استخدام الـ API الخارجي'])
                      : t(['Use built-in source', 'استخدام المصدر المدمج'])}
                  </Button>
                  <Button
                    type="button"
                    disabled={testSource.isPending}
                    onClick={() => testSource.mutate()}
                  >
                    {t(['Test source', 'فحص المصدر'])}
                  </Button>
                </div>
              </fieldset>
            </form>
          ) : null}
        </div>
      )}
    </SectionContainer>
  );
}

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
  const [webhookSecret, setWebhookSecret] = useState('');
  const [updatedSecret, setUpdatedSecret] = useState('');
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [senaSecretModalOpen, setSenaSecretModalOpen] = useState(false);

  const isSila = provider.code === 'SILA_SY';
  const isSena = provider.code === 'SENA_EXPRESS';
  const isFatih = provider.code === 'FATIH_CARGO';
  const usesApiKeyAuth = isSila || isSena || isFatih;
  const supportsManualWebhookSecret = isSena || isFatih;

  const connectMutation = useMutation({
    mutationFn: () =>
      ShippingApi.connectProvider(provider.code, {
        username,
        password: usesApiKeyAuth ? (password.trim() || 'N/A') : password,
        webhookSecret:
          supportsManualWebhookSecret && webhookSecret.trim() ? webhookSecret.trim() : undefined,
      }),
    onSuccess: () => {
      setUsername('');
      setPassword('');
      setWebhookSecret('');
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

  const stagingWebhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/shipping/webhooks/${provider.code}`
      : `https://staging-admin.emdadsy.com/api/shipping/webhooks/${provider.code}`;

  const updateSenaSecretMutation = useMutation({
    mutationFn: () =>
      ShippingApi.registerWebhook(provider.code, {
        webhookUrl: stagingWebhookUrl,
        secret: updatedSecret.trim(),
      }),
    onSuccess: (result) => {
      setSenaSecretModalOpen(false);
      setUpdatedSecret('');
      toast.success(
        result.message ||
          t(['Webhook secret updated successfully.', 'تم حفظ سر الويب هوك بنجاح.']),
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

  const registerWebhookMutation = useMutation({
    mutationFn: () =>
      ShippingApi.registerWebhook(provider.code, { webhookUrl: stagingWebhookUrl }),
    onSuccess: (result) => {
      setWebhookOpen(false);
      if (!result.ok) {
        toast.error(result.message ?? t(['Webhook registration failed.', 'فشل تسجيل الويب هوك.']));
        return;
      }
      toast.success(
        t([
          result.secretSaved
            ? 'Webhook registered with the carrier. Signing secret stored on the server.'
            : result.message || 'Webhook registered.',
          result.secretSaved
            ? 'تم تسجيل الويب هوك لدى شركة الشحن. تم حفظ سر التوقيع على الخادم.'
            : result.message || 'تم تسجيل الويب هوك.',
        ]),
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
    if (!username.trim() || (!usesApiKeyAuth && !password)) {
      toast.error(
        usesApiKeyAuth
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
            {isSila ? (
              <Button
                variant="secondary"
                loading={registerWebhookMutation.isPending}
                onClick={() => setWebhookOpen(true)}
              >
                {t(['Register webhook', 'تسجيل الويب هوك'])}
              </Button>
            ) : null}
            {supportsManualWebhookSecret ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setUpdatedSecret('');
                  setSenaSecretModalOpen(true);
                }}
              >
                {t(['Configure Webhook Secret', 'ضبط سر الويب هوك'])}
              </Button>
            ) : null}
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
            {usesApiKeyAuth ? t(['API Key', 'مفتاح API']) : t(['Username', 'اسم المستخدم'])}
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-text-strong">
            {provider.connected
              ? provider.usernameMasked ?? '********'
              : t(['Not saved', 'غير محفوظ'])}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {usesApiKeyAuth
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
            label={usesApiKeyAuth ? t(['API Key', 'مفتاح API']) : t(['Username', 'اسم المستخدم'])}
            value={username}
            autoComplete="off"
            placeholder={
              isSila ? 'sila_live_...' : isSena ? 'e.g. sena_api_key_...' : isFatih ? 'fc_live_...' : ''
            }
            onChange={(e) => setUsername(e.target.value)}
          />
          {supportsManualWebhookSecret ? (
            <TextField
              label={t(['Webhook Secret (Optional)', 'سر الويب هوك (اختياري)'])}
              type="password"
              value={webhookSecret}
              autoComplete="new-password"
              placeholder={
                isFatih
                  ? t(['Webhook secret from Fatih store portal', 'سر الويب هوك من لوحة متجر الفاتح'])
                  : t(['Webhook secret from SENA settings', 'سر الويب هوك من إعدادات سينا'])
              }
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          ) : !usesApiKeyAuth ? (
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

      {provider.connected ? (
        <div className="mt-4 rounded-xl border border-border bg-surface-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {t(['Webhook receive URL', 'عنوان استقبال الويب هوك'])}
            </p>
            {supportsManualWebhookSecret && (
              <span
                className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                  provider.webhookRegistered
                    ? 'bg-status-success-bg text-status-success-fg'
                    : 'bg-status-warning-bg text-status-warning-fg'
                }`}
              >
                {provider.webhookRegistered
                  ? t(['Secret Configured', 'السر مُعد'])
                  : t(['No Secret Configured', 'لم يُضبط السر'])}
              </span>
            )}
          </div>
          <p className="mt-1 break-all font-mono text-xs text-text-strong">{stagingWebhookUrl}</p>
          <p className="mt-1 text-xs text-text-muted">
            {isFatih
              ? t([
                  'Copy this URL into Fatih store Webhooks, then save the whsec_ signing secret here.',
                  'انسخ هذا الرابط إلى إشعارات لوحة متجر الفاتح، ثم احفظ سر التوقيع whsec_ هنا.',
                ])
              : isSena
                ? t([
                    'Copy this URL and configure it in SENA merchant dashboard under Settings > API / Webhooks along with your Webhook Secret.',
                    'انسخ هذا الرابط واضبطه في لوحة تحكم تاجر SENA تحت إعدادات الربط والـ Webhook مع سر التوقيع الخاص بك.',
                  ])
                : provider.webhookRegistered
                  ? t(['Signing secret is stored on the server.', 'سر التوقيع محفوظ على الخادم.'])
                  : isSila
                    ? t([
                        'Not registered at Sila yet. Register writes the URL to Sila and stores the secret here.',
                        'غير مسجّل عند صلة بعد. التسجيل يكتب العنوان عند صلة ويحفظ السر هنا.',
                      ])
                    : t([
                        'Babel webhook registration is disabled until dummy receive and signature checks pass.',
                        'تسجيل ويب هوك بابل متوقف حتى نجاح الاستقبال الوهمي والتحقق من التوقيع.',
                      ])}
          </p>
        </div>
      ) : null}

      {canMutate && isSila ? (
        <ConfirmModal
          open={webhookOpen}
          title={t(['Register Sila webhook?', 'تسجيل ويب هوك صلة؟'])}
          confirmLabel={t(['Register at Sila', 'تسجيل عند صلة'])}
          cancelLabel={t(['Cancel', 'إلغاء'])}
          loading={registerWebhookMutation.isPending}
          onConfirm={() => registerWebhookMutation.mutate()}
          onClose={() => setWebhookOpen(false)}
        >
          {t([
            `This posts the staging URL to Sila and stores the signing secret on this server only. URL: ${stagingWebhookUrl}`,
            `سيتم إرسال عنوان الستيجينج إلى صلة وحفظ سر التوقيع على هذا الخادم فقط. العنوان: ${stagingWebhookUrl}`,
          ])}
        </ConfirmModal>
      ) : null}

      {canMutate && supportsManualWebhookSecret ? (
        <ConfirmModal
          open={senaSecretModalOpen}
          title={
            isFatih
              ? t(['Configure Fatih Webhook Secret', 'ضبط سر ويب هوك الفاتح'])
              : t(['Configure SENA Webhook Secret', 'ضبط سر ويب هوك SENA'])
          }
          confirmLabel={t(['Save Secret', 'حفظ السر'])}
          cancelLabel={t(['Cancel', 'إلغاء'])}
          loading={updateSenaSecretMutation.isPending}
          onConfirm={() => updateSenaSecretMutation.mutate()}
          onClose={() => setSenaSecretModalOpen(false)}
        >
          <div className="space-y-3">
            <p className="text-sm text-text-muted">
              {isFatih
                ? t([
                    'Paste the whsec_ signing secret shown once when you add the webhook URL in the Fatih store portal.',
                    'الصق سر التوقيع whsec_ الذي يظهر مرة واحدة عند إضافة رابط الويب هوك في لوحة متجر الفاتح.',
                  ])
                : t([
                    'Enter the Webhook Secret provided by SENA merchant settings. This will be used to verify the x-sena-signature HMAC on incoming events.',
                    'أدخل سر الويب هوك المتاح في إعدادات تاجر SENA للتحقق من توقيع HMAC x-sena-signature على الإشعارات الواردة.',
                  ])}
            </p>
            <TextField
              label={t(['Webhook Secret', 'سر الويب هوك'])}
              type="password"
              value={updatedSecret}
              placeholder={isFatih ? 'whsec_...' : 'e.g. sena_sec_...'}
              onChange={(e) => setUpdatedSecret(e.target.value)}
            />
          </div>
        </ConfirmModal>
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
      {canEditPickup ? (
        <Link to="/shipping/fee-rates" className="text-sm font-medium text-brand-700 hover:underline">
          {t(['Shipping Fee Rate', 'أسعار الشحن للعملاء'])}
        </Link>
      ) : null}
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

      <FxRateCard canEdit={canEditPickup} />

      <PickupAddressCard canEdit={canEditPickup} />

      {(providersQuery.data ?? []).map((provider) => (
        <ProviderCard key={provider.code} provider={provider} canMutate={canMutate} />
      ))}
    </div>
  );
}
