import { useState } from 'react';

import { OutboundApi } from '../../api/outbound';

export type ShipmentFieldError = {
  message: string;
  messageAr: string;
  field: string;
  currentValue: string;
  requiredAction: string;
  requiredActionAr: string;
  recoverable: boolean;
  retrySafe: boolean;
  category: string;
};

const FIELD_LABELS: Record<string, { en: string; ar: string }> = {
  senderName: { en: 'Sender name', ar: 'اسم المرسل' },
  senderPhone: { en: 'Sender phone', ar: 'هاتف المرسل' },
  senderNeighborhood: { en: 'Sender neighbourhood', ar: 'حي المرسل' },
  senderAddress: { en: 'Sender address', ar: 'عنوان المرسل' },
  receiverName: { en: 'Receiver name', ar: 'اسم المستلم' },
  receiverPhone: { en: 'Receiver phone', ar: 'هاتف المستلم' },
  receiverNeighborhood: { en: 'Receiver neighbourhood', ar: 'حي المستلم' },
  addressLine1: { en: 'Address line', ar: 'سطر العنوان' },
  shippingPayer: { en: 'Payer', ar: 'الدافع' },
  codAmount: { en: 'COD amount', ar: 'مبلغ التحصيل' },
  currency: { en: 'COD currency', ar: 'عملة التحصيل' },
  weight: { en: 'Weight', ar: 'الوزن' },
  deliveryType: { en: 'Delivery type', ar: 'نوع التسليم' },
  provider: { en: 'Carrier', ar: 'شركة الشحن' },
  service: { en: 'Service', ar: 'الخدمة' },
};

function readFields(err: unknown): Record<string, string> | null {
  if (!err || typeof err !== 'object' || !('fields' in err)) return null;
  const fields = (err as { fields?: unknown }).fields;
  if (!fields || typeof fields !== 'object') return null;
  return fields as Record<string, string>;
}

export function parseShipmentError(err: unknown, fallback: string): ShipmentFieldError {
  const fields = readFields(err);
  const message = err instanceof Error ? err.message : fallback;
  return {
    message,
    messageAr: fields?.messageAr || message,
    field: fields?.shippingField || '',
    currentValue: fields?.currentValue || '',
    requiredAction: fields?.requiredAction || '',
    requiredActionAr: fields?.requiredActionAr || '',
    recoverable: fields?.recoverable !== 'false',
    retrySafe: fields?.retrySafe !== 'false',
    category: fields?.category || 'provider',
  };
}

export function parsePackedShipmentError(text: string | null | undefined): ShipmentFieldError | null {
  const raw = text ?? '';
  const match = raw.match(/\n\[\[se:(\{.*\})\]\]\s*$/);
  const message = raw.replace(/\n\[\[se:\{.*\}\]\]\s*$/, '').trim();
  if (!match) {
    if (!message) return null;
    return {
      message,
      messageAr: message,
      field: '',
      currentValue: '',
      requiredAction: '',
      requiredActionAr: '',
      recoverable: false,
      retrySafe: true,
      category: 'provider',
    };
  }
  try {
    const fields = JSON.parse(match[1]) as Record<string, string>;
    return {
      message,
      messageAr: fields.messageAr || message,
      field: fields.shippingField || '',
      currentValue: fields.currentValue || '',
      requiredAction: fields.requiredAction || '',
      requiredActionAr: fields.requiredActionAr || '',
      recoverable: fields.recoverable !== 'false',
      retrySafe: fields.retrySafe !== 'false',
      category: fields.category || 'provider',
    };
  } catch {
    return null;
  }
}

type Props = {
  outboundOrderId: string;
  companyId?: string;
  error: ShipmentFieldError;
  isArabic?: boolean;
  busy?: boolean;
  onRetry: (opts: { acknowledgeNoExternalShipment?: boolean }) => void;
};

export function ShipmentErrorActions({
  outboundOrderId,
  companyId,
  error,
  isArabic,
  busy,
  onRetry,
}: Props) {
  const [value, setValue] = useState(error.currentValue);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const label = FIELD_LABELS[error.field];
  const problem = isArabic ? error.messageAr || error.message : error.message;
  const action = isArabic ? error.requiredActionAr || error.requiredAction : error.requiredAction;
  const ambiguous = error.category === 'ambiguous' || error.retrySafe === false;
  const editable =
    ['receiverName', 'receiverPhone', 'receiverNeighborhood', 'addressLine1', 'shippingPayer', 'codAmount', 'currency', 'weight', 'deliveryType'].includes(
      error.field,
    ) && !ambiguous;

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const body: Record<string, unknown> = {};
    if (error.field === 'receiverName') body.recipientName = value;
    if (error.field === 'receiverPhone') body.recipientPhone = value;
    if (error.field === 'receiverNeighborhood' || error.field === 'addressLine1') body.addressLine1 = value;
    if (error.field === 'shippingPayer') body.shippingPayer = value;
    if (error.field === 'currency') body.codCollectionCurrency = value;
    if (error.field === 'codAmount') body.codAmount = Number(value);
    if (error.field === 'weight') body.shippingWeightKg = Number(value);
    if (error.field === 'deliveryType') body.shippingDeliveryType = value === 'hub' ? 'hub' : 'address';
    try {
      await OutboundApi.saveShippingDetails(
        outboundOrderId,
        body as Parameters<typeof OutboundApi.saveShippingDetails>[1],
        companyId,
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
      return;
    }
    setSaving(false);
    onRetry({});
  };

  return (
    <div className="mt-2 max-w-sm space-y-1 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">
      <p>
        <span className="font-semibold">{isArabic ? 'المشكلة' : 'Problem'}: </span>
        {problem}
      </p>
      {label ? (
        <p>
          <span className="font-semibold">{isArabic ? 'الحقل' : 'Field'}: </span>
          {isArabic ? label.ar : label.en}
        </p>
      ) : null}
      {error.currentValue ? (
        <p>
          <span className="font-semibold">{isArabic ? 'القيمة الحالية' : 'Current value'}: </span>
          {error.currentValue}
        </p>
      ) : null}
      {action ? (
        <p>
          <span className="font-semibold">{isArabic ? 'المطلوب' : 'Required action'}: </span>
          {action}
        </p>
      ) : null}
      {editable ? (
        error.field === 'shippingPayer' ? (
          <select
            className="w-full rounded border border-rose-200 bg-white px-2 py-1"
            value={value || 'sender'}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="sender">{isArabic ? 'المرسل' : 'Sender'}</option>
            <option value="receiver">{isArabic ? 'المستلم' : 'Receiver'}</option>
            <option value="reseller">{isArabic ? 'الوسيط' : 'Reseller'}</option>
          </select>
        ) : error.field === 'currency' ? (
          <select
            className="w-full rounded border border-rose-200 bg-white px-2 py-1"
            value={value || 'USD'}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="USD">USD</option>
            <option value="SYP">SYP</option>
          </select>
        ) : (
          <input
            className="w-full rounded border border-rose-200 bg-white px-2 py-1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )
      ) : null}
      {ambiguous ? (
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>
            {isArabic
              ? 'تأكدت أن شركة الشحن لا تملك شحنة لهذا المرجع'
              : 'I confirmed the carrier has no shipment for this reference'}
          </span>
        </label>
      ) : null}
      {saveError ? <p>{saveError}</p> : null}
      <div className="flex gap-2">
        {editable ? (
          <button
            type="button"
            className="rounded bg-rose-700 px-2 py-1 text-white disabled:opacity-50"
            disabled={busy || saving || !value.trim()}
            onClick={() => void save()}
          >
            {isArabic ? 'حفظ وإعادة الإرسال' : 'Save and retry'}
          </button>
        ) : (
          <button
            type="button"
            className="rounded bg-rose-700 px-2 py-1 text-white disabled:opacity-50"
            disabled={busy || saving || (ambiguous && !confirmed)}
            onClick={() => onRetry({ acknowledgeNoExternalShipment: ambiguous ? confirmed : undefined })}
          >
            {isArabic ? 'إعادة الإرسال' : 'Retry'}
          </button>
        )}
      </div>
    </div>
  );
}
