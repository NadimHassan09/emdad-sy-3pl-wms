import { useMemo, useState, type ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert, Badge, Button, EmptyState, Modal, Skeleton, TextField } from '@ds';

import { Card } from '../design-v2/Card';
import { ListPageHeader } from '../design-v2/ListPageHeader';
import { isClientArabic } from '../lib/client-ui-language';
import {
  createClientApi,
  downloadClientApiDocs,
  fetchClientApis,
  regenerateClientApiSecret,
  revokeClientApi,
  setClientApiEnabled,
  type ClientApiCredential,
  type ClientApiScope,
  type ClientApiSecretOnce,
} from '../services/clientApisService';

const SCOPE_META: Record<ClientApiScope, { en: string; ar: string; hint: string; hintAr: string }> = {
  oms: {
    en: 'OMS Orders',
    ar: 'طلبات إلكترونية',
    hint: 'Create and read online (OMS) orders.',
    hintAr: 'إنشاء وقراءة الطلبات الإلكترونية.',
  },
  inbound: {
    en: 'Inbound Orders',
    ar: 'طلبات وارد',
    hint: 'Create and read inbound receipts.',
    hintAr: 'إنشاء وقراءة طلبات الوارد.',
  },
  outbound: {
    en: 'Outbound Orders',
    ar: 'طلبات صادر',
    hint: 'Create and read warehouse outbound orders.',
    hintAr: 'إنشاء وقراءة طلبات الصادر.',
  },
};

function tLabel(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    APIs: 'واجهات البرمجة',
    'Credentials for stores, ERPs, and custom apps': 'مفاتيح للمتاجر وأنظمة ERP والتطبيقات الخارجية',
    'Create API': 'إنشاء واجهة',
    'API name': 'اسم الواجهة',
    'API type': 'نوع الواجهة',
    Create: 'إنشاء',
    Cancel: 'إلغاء',
    Active: 'نشط',
    Disabled: 'متوقف',
    Revoked: 'ملغى',
    Name: 'الاسم',
    Type: 'النوع',
    Status: 'الحالة',
    Created: 'تاريخ الإنشاء',
    'Last used': 'آخر استخدام',
    Key: 'المفتاح',
    Actions: 'إجراءات',
    'Download documentation': 'تنزيل التوثيق',
    'Regenerate secret': 'إعادة إنشاء السر',
    Disable: 'إيقاف',
    Enable: 'تفعيل',
    Revoke: 'إلغاء',
    'No APIs yet.': 'لا توجد واجهات بعد.',
    'Create a key for Shopify, your website, or an ERP.':
      'أنشئ مفتاحاً لشوبيفاي أو موقعك أو نظام ERP.',
    'Save this secret now. It will not be shown again.':
      'احفظ هذا السر الآن. لن يظهر مرة أخرى.',
    'API key': 'مفتاح API',
    'API secret': 'سر API',
    Close: 'إغلاق',
    Copy: 'نسخ',
    'Could not load APIs': 'تعذر تحميل الواجهات',
    Retry: 'إعادة المحاولة',
    'Never': 'لم يُستخدم',
    'Revoke this API key? External systems will stop working immediately.':
      'إلغاء هذا المفتاح؟ ستتوقف الأنظمة الخارجية فوراً.',
  };
  return ar[label] ?? label;
}

function formatWhen(value: string | null, isArabic: boolean): string {
  if (!value) return tLabel('Never', isArabic);
  return new Date(value).toLocaleString(isArabic ? 'ar' : 'en');
}

export function ApisPage(): ReactElement {
  const isArabic = isClientArabic();
  const t = (label: string) => tLabel(label, isArabic);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ClientApiScope>('oms');
  const [secretOnce, setSecretOnce] = useState<ClientApiSecretOnce | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['client-apis'],
    queryFn: fetchClientApis,
  });

  const createMut = useMutation({
    mutationFn: () => createClientApi({ name: name.trim(), scope }),
    onSuccess: (row) => {
      setCreateOpen(false);
      setName('');
      setScope('oms');
      setSecretOnce(row);
      void queryClient.invalidateQueries({ queryKey: ['client-apis'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const rows = listQuery.data ?? [];

  const scopeCards = useMemo(() => (['oms', 'inbound', 'outbound'] as ClientApiScope[]), []);

  return (
    <div className="space-y-4">
      <ListPageHeader
        icon="fa-key"
        title={t('APIs')}
        subtitle={t('Credentials for stores, ERPs, and custom apps')}
        actions={
          <Button type="button" onClick={() => { setError(null); setCreateOpen(true); }}>
            {t('Create API')}
          </Button>
        }
      />

        {error ? <Alert variant="error">{error}</Alert> : null}

      {listQuery.isLoading ? (
        <Skeleton className="h-40" />
      ) : listQuery.isError ? (
        <Alert variant="error">
          {t('Could not load APIs')}{' '}
          <Button type="button" variant="ghost" onClick={() => void listQuery.refetch()}>
            {t('Retry')}
          </Button>
        </Alert>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t('No APIs yet.')}
          description={t('Create a key for Shopify, your website, or an ERP.')}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-start text-neutral-500">
                <th className="px-3 py-2 font-medium">{t('Name')}</th>
                <th className="px-3 py-2 font-medium">{t('Type')}</th>
                <th className="px-3 py-2 font-medium">{t('Status')}</th>
                <th className="px-3 py-2 font-medium">{t('Created')}</th>
                <th className="px-3 py-2 font-medium">{t('Last used')}</th>
                <th className="px-3 py-2 font-medium">{t('Key')}</th>
                <th className="px-3 py-2 font-medium">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ApiRow
                  key={row.id}
                  row={row}
                  t={t}
                  isArabic={isArabic}
                  onSecret={setSecretOnce}
                  onError={setError}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('Create API')}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button
              type="button"
              disabled={!name.trim() || createMut.isPending}
              onClick={() => { setError(null); createMut.mutate(); }}
            >
              {t('Create')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextField
            label={t('API name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shopify OMS"
          />
          <div>
            <div className="mb-2 text-sm font-medium">{t('API type')}</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {scopeCards.map((value) => {
                const meta = SCOPE_META[value];
                const selected = scope === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setScope(value)}
                    className={`rounded-lg border p-3 text-start ${
                      selected ? 'border-emerald-700 bg-emerald-50' : 'border-neutral-200'
                    }`}
                  >
                    <div className="font-medium">{isArabic ? meta.ar : meta.en}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {isArabic ? meta.hintAr : meta.hint}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!secretOnce}
        onClose={() => setSecretOnce(null)}
        title={t('API secret')}
        footer={
          <div className="flex justify-end">
            <Button type="button" onClick={() => setSecretOnce(null)}>
              {t('Close')}
            </Button>
          </div>
        }
      >
        {secretOnce ? (
          <div className="space-y-3">
            <Alert variant="warning">{t('Save this secret now. It will not be shown again.')}</Alert>
            <TextField label={t('API key')} value={secretOnce.apiKey} readOnly />
            <TextField label={t('API secret')} value={secretOnce.apiSecret} readOnly />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function ApiRow({
  row,
  t,
  isArabic,
  onSecret,
  onError,
}: {
  row: ClientApiCredential;
  t: (label: string) => string;
  isArabic: boolean;
  onSecret: (row: ClientApiSecretOnce) => void;
  onError: (message: string | null) => void;
}): ReactElement {
  const queryClient = useQueryClient();
  const tone =
    row.status === 'active' ? 'success' : row.status === 'disabled' ? 'warning' : 'danger';

  const run = async (fn: () => Promise<unknown>) => {
    try {
      onError(null);
      await fn();
      void queryClient.invalidateQueries({ queryKey: ['client-apis'] });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Request failed');
    }
  };

  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2">{row.name}</td>
      <td className="px-3 py-2">{isArabic ? SCOPE_META[row.scope].ar : SCOPE_META[row.scope].en}</td>
      <td className="px-3 py-2">
        <Badge tone={tone}>{t(row.status === 'active' ? 'Active' : row.status === 'disabled' ? 'Disabled' : 'Revoked')}</Badge>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">{formatWhen(row.createdAt, isArabic)}</td>
      <td className="px-3 py-2 whitespace-nowrap">{formatWhen(row.lastUsedAt, isArabic)}</td>
      <td className="px-3 py-2 font-mono text-xs">{row.maskedKey}</td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="ghost"
            onClick={() => void run(() => downloadClientApiDocs(row.id, row.scope))}
          >
            {t('Download documentation')}
          </Button>
          {row.status !== 'revoked' ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  void run(async () => {
                    onSecret(await regenerateClientApiSecret(row.id));
                  })
                }
              >
                {t('Regenerate secret')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void run(() => setClientApiEnabled(row.id, row.status !== 'active'))}
              >
                {t(row.status === 'active' ? 'Disable' : 'Enable')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (
                    !window.confirm(
                      t('Revoke this API key? External systems will stop working immediately.'),
                    )
                  ) {
                    return;
                  }
                  void run(() => revokeClientApi(row.id));
                }}
              >
                {t('Revoke')}
              </Button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
