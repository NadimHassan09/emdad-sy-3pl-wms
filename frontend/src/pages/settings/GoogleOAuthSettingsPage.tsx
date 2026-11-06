import { useState } from 'react';

import { Alert, Badge } from '@ds';
import { Button } from '../../components/Button';
import { useWmsTranslation } from '../../lib/ui-i18n';
import {
  fetchGoogleOAuthSettings,
  saveGoogleOAuthSettings,
  testGoogleOAuthSettings,
  type GoogleOAuthView,
} from '../../api/adminSettings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const QK = { googleOAuth: ['settings', 'google-oauth'] } as const;

function MaskedInput({
  id,
  placeholder,
  value,
  onChange,
  hasStored,
}: {
  id: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  hasStored: boolean;
}) {
  const [editing, setEditing] = useState(!hasStored);
  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-500">{'●'.repeat(12)}</span>
        <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
          Change
        </Button>
      </div>
    );
  }
  return (
    <input
      id={id}
      type="text"
      className="w-full rounded-md border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
      spellCheck={false}
    />
  );
}

export function GoogleOAuthSettingsPage() {
  const { t } = useWmsTranslation();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<GoogleOAuthView>({
    queryKey: QK.googleOAuth,
    queryFn: fetchGoogleOAuthSettings,
  });

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const saveMut = useMutation({
    mutationFn: () =>
      saveGoogleOAuthSettings({
        ...(clientId.trim() ? { clientId: clientId.trim() } : {}),
        ...(clientSecret.trim() ? { clientSecret: clientSecret.trim() } : {}),
        ...(redirectUri.trim() ? { redirectUri: redirectUri.trim() } : {}),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(QK.googleOAuth, updated);
      setClientId('');
      setClientSecret('');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const testMut = useMutation({
    mutationFn: testGoogleOAuthSettings,
    onSuccess: (updated) => qc.setQueryData(QK.googleOAuth, updated),
  });

  if (isLoading) return <p className="text-sm text-neutral-500">{t(['Loading…', 'جارٍ التحميل…'])}</p>;
  if (error) return <Alert variant="error">{String(error)}</Alert>;

  const d = data!;
  const DEFAULT_REDIRECT =
    typeof window !== 'undefined'
      ? `${window.location.origin.replace('-admin', '-api')}/api/client/sheets/google/callback`
      : '';

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t(['Google OAuth — Sheets Integration', 'Google OAuth — ربط الشيتات'])}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {t(
            [
              'These credentials are used to let clients connect their Google account and sync the inbound, outbound, and OMS sheets with Google Sheets. Credentials are encrypted at rest.',
              'هذه البيانات تُستخدم للسماح للعملاء بربط حساب Google الخاص بهم ومزامنة شيتات الاستلام والصرف والأوردرات مع Google Sheets. البيانات مشفّرة.',
            ],
          )}
        </p>
      </div>

      {/* Current status */}
      <div className="rounded-lg border p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">{t(['Client ID', 'Client ID'])}</span>
          <span className="text-neutral-600 font-mono">
            {d.hasClientId ? (d.clientIdPreview ?? '●●●●●●●●') : <span className="text-neutral-400">{t(['Not set', 'غير محدد'])}</span>}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">{t(['Client Secret', 'Client Secret'])}</span>
          {d.hasClientSecret ? (
            <Badge tone="success">{t(['Saved', 'محفوظ'])}</Badge>
          ) : (
            <Badge tone="warning">{t(['Not set', 'غير محدد'])}</Badge>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">{t(['Redirect URI', 'Redirect URI'])}</span>
          <span className="text-xs text-neutral-500 font-mono break-all text-right max-w-xs">
            {d.redirectUri ?? <span className="text-neutral-400">{t(['Not set', 'غير محدد'])}</span>}
          </span>
        </div>
        {d.lastTestAt && (
          <div className="flex items-center justify-between pt-1 border-t">
            <span className="font-medium">{t(['Last test', 'آخر اختبار'])}</span>
            <div className="flex items-center gap-2">
              <Badge tone={d.lastTestStatus === 'ok' ? 'success' : 'danger'}>
                {d.lastTestStatus === 'ok' ? t(['Passed', 'نجح']) : t(['Failed', 'فشل'])}
              </Badge>
              <span className="text-xs text-neutral-400">
                {new Date(d.lastTestAt).toLocaleString()}
              </span>
            </div>
          </div>
        )}
        {d.lastTestError && d.lastTestStatus === 'error' && (
          <p className="text-xs text-red-600 mt-1">{d.lastTestError}</p>
        )}
      </div>

      {/* Edit form */}
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-medium text-sm">{t(['Update credentials', 'تحديث البيانات'])}</h3>
        <div className="space-y-1">
          <label htmlFor="goa-client-id" className="block text-sm font-medium">
            {t(['Client ID', 'Client ID'])}
            {d.hasClientId ? (
              <span className="ml-2 text-xs text-neutral-400">{t(['(leave blank to keep current)', '(اتركه فارغًا للإبقاء على الحالي)'])}</span>
            ) : null}
          </label>
          <MaskedInput
            id="goa-client-id"
            placeholder="1234567890-abc.apps.googleusercontent.com"
            value={clientId}
            onChange={setClientId}
            hasStored={d.hasClientId}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="goa-client-secret" className="block text-sm font-medium">
            {t(['Client Secret', 'Client Secret'])}
            {d.hasClientSecret ? (
              <span className="ml-2 text-xs text-neutral-400">{t(['(leave blank to keep current)', '(اتركه فارغًا للإبقاء على الحالي)'])}</span>
            ) : null}
          </label>
          <MaskedInput
            id="goa-client-secret"
            placeholder="GOCSPX-…"
            value={clientSecret}
            onChange={setClientSecret}
            hasStored={d.hasClientSecret}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="goa-redirect" className="block text-sm font-medium">
            {t(['Redirect URI', 'Redirect URI'])}
          </label>
          <input
            id="goa-redirect"
            type="url"
            className="w-full rounded-md border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder={DEFAULT_REDIRECT || 'https://staging-api.emdadsy.com/api/client/sheets/google/callback'}
            value={redirectUri || d.redirectUri || ''}
            onChange={(e) => setRedirectUri(e.target.value)}
          />
          <p className="text-xs text-neutral-400">
            {t(
              ['This must exactly match one of the Authorized redirect URIs in the Google Cloud Console.', 'يجب أن يتطابق تمامًا مع أحد Authorized redirect URIs في Google Cloud Console.'],
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || (!clientId.trim() && !clientSecret.trim() && !redirectUri.trim())}
          >
            {saveMut.isPending ? t(['Saving…', 'جارٍ الحفظ…']) : t(['Save credentials', 'حفظ البيانات'])}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending || !d.hasClientId}
          >
            {testMut.isPending ? t(['Testing…', 'جارٍ الاختبار…']) : t(['Test connection', 'اختبار الاتصال'])}
          </Button>
        </div>

        {saveSuccess && (
          <Alert variant="success">{t(['Credentials saved successfully.', 'تم حفظ البيانات بنجاح.'])}</Alert>
        )}
        {saveMut.isError && (
          <Alert variant="error">
            {String((saveMut.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? saveMut.error)}
          </Alert>
        )}
        {testMut.isError && (
          <Alert variant="error">
            {String((testMut.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? testMut.error)}
          </Alert>
        )}
      </div>
    </div>
  );
}
