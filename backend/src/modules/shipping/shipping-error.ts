/** Field the admin can edit on the same shipping screen. Never a bare "neighborhood". */
export type ShippingFieldId =
  | 'senderName'
  | 'senderPhone'
  | 'senderNeighborhood'
  | 'senderAddress'
  | 'receiverName'
  | 'receiverPhone'
  | 'receiverNeighborhood'
  | 'addressLine1'
  | 'shippingPayer'
  | 'codAmount'
  | 'currency'
  | 'weight'
  | 'deliveryType'
  | 'provider'
  | 'service';

export type ShippingErrorCategory =
  | 'validation'
  | 'configuration'
  | 'availability'
  | 'auth'
  | 'provider'
  | 'internal'
  | 'ambiguous';

export type ShippingFailure = {
  code: string;
  category: ShippingErrorCategory;
  field: ShippingFieldId | null;
  recoverable: boolean;
  retrySafe: boolean;
  message: string;
  messageAr: string;
  currentValue: string | null;
  requiredAction: string;
  requiredActionAr: string;
  correlationId: string;
};

export type ShippingErrorContext = {
  providerCode?: string | null;
  correlationId?: string | null;
  payer?: string | null;
  codAmount?: number | null;
  codCurrency?: string | null;
  originalAmount?: number | null;
  originalCurrency?: string | null;
  fxRate?: number | null;
  quoteCurrency?: string | null;
  receiverNeighborhood?: string | null;
  senderNeighborhood?: string | null;
};

function correlation(ctx: ShippingErrorContext): string {
  return ctx.correlationId?.trim() || `ship-${Date.now().toString(36)}`;
}

function collectionLabel(ctx: ShippingErrorContext, collectionCurrency: string): string {
  const sent =
    ctx.codAmount != null ? `${ctx.codAmount} ${collectionCurrency || ctx.codCurrency || ''}`.trim() : collectionCurrency;
  if (ctx.originalAmount == null) return sent;
  const rate = ctx.fxRate != null ? ` @ ${ctx.fxRate}` : '';
  return `${ctx.originalAmount} ${ctx.originalCurrency ?? ''} → ${sent}${rate}`.trim();
}

function failure(
  partial: Omit<ShippingFailure, 'correlationId'> & { correlationId?: string },
  ctx: ShippingErrorContext,
): ShippingFailure {
  return { ...partial, correlationId: partial.correlationId ?? correlation(ctx) };
}

export function phoneTail(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length <= 3 ? digits : digits.slice(-3);
}

/** True when the HTTP call may have created a shipment we did not observe. */
export function isAmbiguousCarrierFailure(raw: string): boolean {
  return /timeout|timed out|etimedout|econnaborted|econnreset|socket hang up|aborted|504|gateway timeout/i.test(
    raw,
  );
}

export function classifyShippingError(raw: string, ctx: ShippingErrorContext = {}): ShippingFailure {
  const text = raw.trim() || 'Carrier shipment failed.';
  const cod = ctx.codCurrency?.trim().toUpperCase() || '';

  if (isAmbiguousCarrierFailure(text)) {
    return failure(
      {
        code: 'SHIPMENT_AMBIGUOUS',
        category: 'ambiguous',
        field: null,
        recoverable: true,
        retrySafe: false,
        message:
          'The carrier did not confirm failure. The shipment may already exist. Do not send again until you confirm the carrier has no shipment for this reference.',
        messageAr:
          'شركة الشحن لم تؤكد فشل الإرسال. قد تكون الشحنة أُنشئت. لا تعِد الإرسال قبل التأكد أن الشركة لا تملك شحنة لهذا المرجع.',
        currentValue: null,
        requiredAction: 'Confirm no shipment exists for this reference, then retry.',
        requiredActionAr: 'أكّد أن لا شحنة لهذا المرجع، ثم أعد المحاولة.',
      },
      ctx,
    );
  }

  if (/collection is not supported|COD capability is not verified|exchange rate is available/i.test(text)) {
    return failure(
      {
        code: 'SHIPMENT_CURRENCY',
        category: 'validation',
        field: 'currency',
        recoverable: true,
        retrySafe: true,
        message: text,
        messageAr: text,
        currentValue: collectionLabel(ctx, cod),
        requiredAction: 'Use a collection currency the provider accepts.',
        requiredActionAr: 'استخدم عملة تحصيل تقبلها الشركة.',
      },
      ctx,
    );
  }

  if (/cod currency|currency mismatch|does not match .*quote/i.test(text)) {
    return failure(
      {
        code: 'SHIPMENT_CURRENCY',
        category: 'validation',
        field: 'currency',
        recoverable: true,
        retrySafe: true,
        message: text,
        messageAr: text,
        currentValue: collectionLabel(ctx, cod),
        requiredAction: 'Choose a collection currency this service supports. Do not match it to the shipping-fee currency.',
        requiredActionAr: 'اختر عملة تحصيل تدعمها هذه الخدمة. لا تطابقها مع عملة سعر الشحن.',
      },
      ctx,
    );
  }

  if (/whole province|parent_id|محافظة كاملة|recipient\.area_id|area_id is a whole|Missing (city|neighborhood)/i.test(text)) {
    const missing = /Missing (city|neighborhood)/i.exec(text)?.[1]?.toLowerCase() ?? null;
    return failure(
      {
        code: 'SHIPMENT_RECEIVER_NEIGHBORHOOD',
        category: 'validation',
        field: 'receiverNeighborhood',
        recoverable: true,
        retrySafe: true,
        message: text,
        messageAr: text,
        currentValue: ctx.receiverNeighborhood ?? null,
        requiredAction: 'Edit the receiver city or neighbourhood, save, then retry this order only.',
        requiredActionAr: 'عدّل مدينة أو حي المستلم، احفظ، ثم أعد إرسال هذا الطلب فقط.',
      },
      ctx,
    );
  }

  if (/payer as sender|payer.*not available|shipping_paid_by|reseller is not supported|cod_not_allowed/i.test(text)) {
    return failure(
      {
        code: 'SHIPMENT_PAYER',
        category: 'validation',
        field: 'shippingPayer',
        recoverable: true,
        retrySafe: true,
        message: text,
        messageAr: text,
        currentValue: ctx.payer ?? null,
        requiredAction: 'Change the payer for this order, save, then retry.',
        requiredActionAr: 'غيّر الدافع لهذا الطلب، احفظ، ثم أعد الإرسال.',
      },
      ctx,
    );
  }

  if (/sender\.neighbourhood|sender neighbourhood|حي المرسل|senderNeighborhood/i.test(text)) {
    return failure(
      {
        code: 'SHIPMENT_SENDER_NEIGHBORHOOD',
        category: 'validation',
        field: 'senderNeighborhood',
        recoverable: true,
        retrySafe: true,
        message: text,
        messageAr: text,
        currentValue: ctx.senderNeighborhood ?? null,
        requiredAction: 'Set the warehouse neighbourhood or pickup address, save, then retry.',
        requiredActionAr: 'حدّد حي المستودع أو عنوان الاستلام، احفظ، ثم أعد الإرسال.',
      },
      ctx,
    );
  }

  if (/minimum|1000|cod amount|مبلغ التحصيل/i.test(text)) {
    return failure(
      {
        code: 'SHIPMENT_COD',
        category: 'validation',
        field: 'codAmount',
        recoverable: true,
        retrySafe: true,
        message: text,
        messageAr: text,
        currentValue: collectionLabel(ctx, ctx.codCurrency ?? ''),
        requiredAction: 'Correct the COD amount or currency, save, then retry this order.',
        requiredActionAr: 'صحّح مبلغ التحصيل أو عملته، احفظ، ثم أعد إرسال هذا الطلب.',
      },
      ctx,
    );
  }

  if (/phone/i.test(text)) {
    const sender = /sender/i.test(text);
    return failure(
      {
        code: sender ? 'SHIPMENT_SENDER_PHONE' : 'SHIPMENT_RECEIVER_PHONE',
        category: 'validation',
        field: sender ? 'senderPhone' : 'receiverPhone',
        recoverable: true,
        retrySafe: true,
        message: text,
        messageAr: text,
        currentValue: null,
        requiredAction: 'Edit the phone, save, then retry this order.',
        requiredActionAr: 'عدّل رقم الهاتف، احفظ، ثم أعد إرسال هذا الطلب.',
      },
      ctx,
    );
  }

  if (/receiver name|full_name|customer name/i.test(text)) {
    return failure(
      {
        code: 'SHIPMENT_RECEIVER_NAME',
        category: 'validation',
        field: 'receiverName',
        recoverable: true,
        retrySafe: true,
        message: text,
        messageAr: text,
        currentValue: null,
        requiredAction: 'Edit the receiver name, save, then retry.',
        requiredActionAr: 'عدّل اسم المستلم، احفظ، ثم أعد الإرسال.',
      },
      ctx,
    );
  }

  return failure(
    {
      code: 'SHIPMENT_PROVIDER',
      category: 'provider',
      field: null,
      recoverable: false,
      retrySafe: true,
      message: text,
      messageAr: text,
      currentValue: null,
      requiredAction: 'Review the carrier message. Retry only if the cause is fixed.',
      requiredActionAr: 'راجع رسالة الشركة. أعد الإرسال فقط بعد معالجة السبب.',
    },
    ctx,
  );
}

/** Flat string fields that survive the production exception filter. */
export function shippingFailureFields(error: ShippingFailure): Record<string, string> {
  return {
    shippingField: error.field ?? '',
    category: error.category,
    recoverable: error.recoverable ? 'true' : 'false',
    retrySafe: error.retrySafe ? 'true' : 'false',
    currentValue: error.currentValue ?? '',
    requiredAction: error.requiredAction,
    requiredActionAr: error.requiredActionAr,
    messageAr: error.messageAr,
    correlationId: error.correlationId,
  };
}

export function readableShippingError(error: ShippingFailure, arabic: boolean): string {
  return arabic ? error.messageAr : error.message;
}

const PACK_RE = /\n\[\[se:(\{.*\})\]\]\s*$/;

/** Human message plus a parseable field block for screens that only receive lastErrorSafe. */
export function packShippingError(error: ShippingFailure): string {
  return `${error.message}\n[[se:${JSON.stringify(shippingFailureFields(error))}]]`;
}

export function unpackShippingError(text: string | null | undefined): Record<string, string> | null {
  const match = (text ?? '').match(PACK_RE);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function visibleShippingError(text: string | null | undefined): string {
  return (text ?? '').replace(PACK_RE, '').trim();
}

/** Gate a new createShipment. A created row or an unconfirmed ambiguous attempt blocks it. */
export function mayCreateShipment(input: {
  hasCreated: boolean;
  ambiguousOutstanding: boolean;
  acknowledged: boolean;
}): { allow: boolean; reason: 'created' | 'ambiguous' | 'ok' } {
  if (input.hasCreated) return { allow: false, reason: 'created' };
  if (input.ambiguousOutstanding && !input.acknowledged) {
    return { allow: false, reason: 'ambiguous' };
  }
  return { allow: true, reason: 'ok' };
}
