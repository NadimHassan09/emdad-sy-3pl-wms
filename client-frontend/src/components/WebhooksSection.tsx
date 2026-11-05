import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert, Badge, Button, Modal, Skeleton, TextField } from '@ds';

import { Card } from '../design-v2/Card';
import {
  createWebhook,
  deleteWebhook,
  fetchWebhookDeliveries,
  fetchWebhooks,
  rotateWebhookSecret,
  setWebhookEnabled,
  testWebhook,
  type ClientWebhook,
  type ClientWebhookWithSecret,
} from '../services/clientWebhooksService';

export function WebhooksSection({ isArabic }: { isArabic: boolean }) {
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [secretOnce, setSecretOnce] = useState<ClientWebhookWithSecret | null>(null);
  const [logFor, setLogFor] = useState<ClientWebhook | null>(null);

  const list = useQuery({ queryKey: ['client-webhooks'], queryFn: fetchWebhooks });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['client-webhooks'] });
  const fail = (e: Error) => setError(e.message);

  const create = useMutation({
    mutationFn: () => createWebhook(url.trim()),
    onSuccess: (row) => { setUrl(''); setSecretOnce(row); setError(null); refresh(); },
    onError: fail,
  });
  const rotate = useMutation({
    mutationFn: (id: string) => rotateWebhookSecret(id),
    onSuccess: (row) => { setSecretOnce(row); refresh(); },
    onError: fail,
  });
  const toggle = useMutation({
    mutationFn: (w: ClientWebhook) => setWebhookEnabled(w.id, !w.isActive),
    onSuccess: refresh,
    onError: fail,
  });
  const test = useMutation({ mutationFn: (id: string) => testWebhook(id), onSuccess: refresh, onError: fail });
  const remove = useMutation({ mutationFn: (id: string) => deleteWebhook(id), onSuccess: refresh, onError: fail });

  const deliveries = useQuery({
    queryKey: ['client-webhook-deliveries', logFor?.id],
    queryFn: () => fetchWebhookDeliveries(logFor!.id),
    enabled: !!logFor,
  });

  return (
    <Card className="space-y-3 p-4">
      <div>
        <h2 className="text-base font-semibold">{t('Webhooks', 'ويب هوك')}</h2>
        <p className="text-sm text-neutral-500">
          {t(
            'We send a signed message to your server when an order is created or its status changes. Use the signing secret to check the X-Emdad-Signature header.',
            'نرسل رسالة موقّعة إلى خادمك عند إنشاء الطلب أو تغيّر حالته. استخدم مفتاح التوقيع للتحقق من الهيدر X-Emdad-Signature.',
          )}
        </p>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); setError(null); create.mutate(); }}
      >
        <div className="min-w-[18rem] flex-1">
          <TextField
            label={t('Webhook address (https)', 'عنوان الويب هوك (https)')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-site.com/emdad-webhook"
          />
        </div>
        <Button type="submit" disabled={!url.trim() || create.isPending}>{t('Add', 'إضافة')}</Button>
      </form>

      {list.isLoading ? (
        <Skeleton className="h-16" />
      ) : (list.data ?? []).length === 0 ? (
        <p className="text-sm text-neutral-500">{t('No webhook addresses yet.', 'لا توجد عناوين ويب هوك بعد.')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-start text-neutral-500">
                <th className="px-3 py-2 font-medium">{t('Address', 'العنوان')}</th>
                <th className="px-3 py-2 font-medium">{t('Status', 'الحالة')}</th>
                <th className="px-3 py-2 font-medium">{t('Last success', 'آخر نجاح')}</th>
                <th className="px-3 py-2 font-medium">{t('Actions', 'إجراءات')}</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((w) => (
                <tr key={w.id} className="border-b last:border-0">
                  <td className="px-3 py-2 break-all">{w.url}</td>
                  <td className="px-3 py-2">
                    <Badge tone={w.isActive ? 'success' : 'neutral'}>
                      {w.isActive ? t('Active', 'نشط') : t('Disabled', 'متوقف')}
                    </Badge>
                    {w.consecutiveFailures > 0 ? (
                      <div className="text-xs text-red-600">
                        {w.consecutiveFailures} {t('failures in a row', 'إخفاقات متتالية')}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{w.lastSuccessAt ? new Date(w.lastSuccessAt).toLocaleString() : '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" variant="ghost" onClick={() => test.mutate(w.id)}>{t('Send test', 'إرسال تجربة')}</Button>
                      <Button type="button" variant="ghost" onClick={() => setLogFor(w)}>{t('Log', 'السجل')}</Button>
                      <Button type="button" variant="ghost" onClick={() => toggle.mutate(w)}>
                        {w.isActive ? t('Disable', 'إيقاف') : t('Enable', 'تفعيل')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(t('Create a new signing secret? The old one stops working.', 'إنشاء مفتاح توقيع جديد؟ المفتاح القديم سيتوقف.'))) rotate.mutate(w.id);
                        }}
                      >
                        {t('New secret', 'مفتاح جديد')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(t('Delete this webhook address?', 'حذف عنوان الويب هوك؟'))) remove.mutate(w.id);
                        }}
                      >
                        {t('Delete', 'حذف')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!secretOnce}
        onClose={() => setSecretOnce(null)}
        title={t('Signing secret', 'مفتاح التوقيع')}
        footer={<Button type="button" onClick={() => setSecretOnce(null)}>{t('I copied it', 'نسخته')}</Button>}
      >
        <p className="mb-2 text-sm">{t('Copy this secret now. It is not shown again.', 'انسخ هذا المفتاح الآن، لن يظهر مرة أخرى.')}</p>
        <code className="block break-all rounded bg-neutral-100 p-2 text-sm dark:bg-neutral-800">{secretOnce?.secret}</code>
      </Modal>

      <Modal
        open={!!logFor}
        onClose={() => setLogFor(null)}
        title={t('Delivery log', 'سجل الإرسال')}
        footer={<Button type="button" onClick={() => setLogFor(null)}>{t('Close', 'إغلاق')}</Button>}
      >
        {deliveries.isLoading ? (
          <Skeleton className="h-20" />
        ) : (deliveries.data ?? []).length === 0 ? (
          <p className="text-sm">{t('Nothing sent yet.', 'لم يُرسل شيء بعد.')}</p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
            {(deliveries.data ?? []).map((d) => (
              <li key={d.id} className="flex flex-wrap justify-between gap-2 border-b py-1">
                <span>{d.event}{d.orderNumber ? ` · ${d.orderNumber}` : ''}</span>
                <span>{d.status} · {d.attempts}× {d.lastHttpStatus ? `· HTTP ${d.lastHttpStatus}` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </Card>
  );
}
