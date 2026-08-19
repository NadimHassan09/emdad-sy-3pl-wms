import { useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Combobox, SelectField, Textarea, TextField, InternationalPhoneInput, RecipientNameInput, createInternationalPhoneValue } from '@ds';
import { FILTER_PRIMARY_BUTTON_CLASS } from '@ds';

import { CascadingAddressSelector } from '../components/CascadingAddressSelector';
import { DeliveryLocationMap } from '../components/DeliveryLocationMap';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { isClientArabic } from '../lib/client-ui-language';
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../lib/order-planning-dates';
import {
  DEFAULT_PHONE_COUNTRY,
  isValidRecipientName,
} from '../../../shared/lib/recipient-contact';
import { fetchProductAvailability } from '../services/clientInventoryService';
import {
  createClientOmsOrder,
  type CreateClientOmsOrderInput,
} from '../services/clientOmsOrdersService';
import {
  fetchClientProducts,
  type ClientProductRow,
} from '../services/clientProductsService';

type DraftLine = { productId: string; requestedQuantity: string; unitPrice: string };

const emptyLine = (): DraftLine => ({ productId: '', requestedQuantity: '1', unitPrice: '' });

function label(text: string, isArabic: boolean): string {
  if (!isArabic) return text;
  const ar: Record<string, string> = {
    'New online order': 'طلب إلكتروني جديد',
    'Create an order from your store channel': 'أنشئ طلباً من قناة متجرك',
    'Back to online orders': 'العودة إلى الطلبات الإلكترونية',
    'Required ship date': 'تاريخ الشحن المطلوب',
    'Recipient name': 'اسم المستلم',
    'Recipient phone': 'هاتف المستلم',
    Governorate: 'المحافظة',
    'City/Region': 'المدينة / المنطقة',
    'Town/Neighborhood': 'البلدة / الحي',
    'Select governorate…': 'اختر المحافظة…',
    'Select city/region…': 'اختر المدينة / المنطقة…',
    'Select town/neighborhood…': 'اختر البلدة / الحي…',
    'Select or type governorate…': 'اختر أو اكتب المحافظة…',
    'Select or type city/region…': 'اختر أو اكتب المدينة / المنطقة…',
    'Select or type town/neighborhood…': 'اختر أو اكتب البلدة / الحي…',
    'Payment method': 'طريقة الدفع',
    Notes: 'ملاحظات',
    Product: 'المنتج',
    'Pick product…': 'اختر المنتج…',
    Qty: 'الكمية',
    Price: 'السعر',
    Remove: 'إزالة',
    '+ Add line': '+ إضافة بند',
    Cancel: 'إلغاء',
    'Submit for approval': 'إرسال للموافقة',
    'Required ship date cannot be before today.': 'لا يمكن أن يكون تاريخ الشحن قبل اليوم.',
    'Add at least one line with quantity and price.': 'أضف بنداً واحداً على الأقل بكمية وسعر.',
    'Exceeds available stock': 'يتجاوز المخزون المتاح',
    Available: 'المتاح',
    'Requested across lines': 'المطلوب عبر البنود',
    'Order cannot be created — insufficient stock:': 'لا يمكن إنشاء الطلب — مخزون غير كافٍ:',
    requested: 'مطلوب',
    available: 'متاح',
    'Insufficient stock for one or more products.': 'مخزون غير كافٍ لمنتج واحد أو أكثر.',
    'Each product line needs a valid price.': 'كل بند يحتاج سعراً صالحاً.',
    'Name can only contain Arabic or English letters and spaces.':
      'الاسم يقبل الحروف العربية أو الإنجليزية والمسافات فقط.',
    'Please enter a valid phone number.': 'يرجى إدخال رقم هاتف صالح.',
    'Shipping information': 'معلومات الشحن',
    'Order details': 'تفاصيل الطلب',
    Products: 'المنتجات',
    'Creating orders is not available for your account right now.':
      'إنشاء الطلبات غير متاح لحسابك حالياً.',
  };
  return ar[text] ?? text;
}

function formatOnHand(p: ClientProductRow): string {
  const n = Number(p.totalOnHand ?? 0);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0';
}

function SectionHeading({ title }: { title: string }): ReactElement {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
      {title}
    </h2>
  );
}

export function CreateEcommerceOrderPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isArabic = isClientArabic();
  const t = (s: string) => label(s, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);

  const [shipDate, setShipDate] = useState(() => localCalendarDateYmd());
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState(() =>
    createInternationalPhoneValue(DEFAULT_PHONE_COUNTRY),
  );
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [deliveryLat, setDeliveryLat] = useState('');
  const [deliveryLng, setDeliveryLng] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ['client', 'products', 'create-oms'],
    queryFn: () => fetchClientProducts({ limit: 200 }),
    enabled: billingAccess.operationalAllowed,
    staleTime: 5 * 60_000,
  });

  const createMut = useMutation({
    mutationFn: createClientOmsOrder,
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'ecommerce-orders'] });
      navigate(`/ecommerce-orders/${order.id}`);
    },
    onError: (err: Error) => setError(err.message || 'Could not submit order.'),
  });

  const productOptions = useMemo(
    () =>
      (products.data?.items ?? []).map((p) => ({
        value: p.id,
        label: `${p.sku} — ${p.name}`,
        hint: `${p.uom} · on hand ${formatOnHand(p)}`,
      })),
    [products.data],
  );

  const distinctProductIds = useMemo(
    () => Array.from(new Set(lines.map((l) => l.productId).filter(Boolean))),
    [lines],
  );

  const availabilityResults = useQueries({
    queries: distinctProductIds.map((pid) => ({
      queryKey: ['client', 'availability', pid],
      queryFn: () => fetchProductAvailability(pid),
      enabled: billingAccess.operationalAllowed && !!pid,
      staleTime: 10_000,
    })),
  });

  const availabilityByProduct = useMemo(() => {
    const m = new Map<string, number>();
    distinctProductIds.forEach((pid, i) => {
      const r = availabilityResults[i]?.data;
      if (r) m.set(pid, Number(r.available));
    });
    return m;
  }, [availabilityResults, distinctProductIds]);

  const requestedByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) {
      if (!l.productId) continue;
      const n = Number(l.requestedQuantity);
      if (!Number.isFinite(n) || n <= 0) continue;
      m.set(l.productId, (m.get(l.productId) ?? 0) + n);
    }
    return m;
  }, [lines]);

  const shortages = useMemo(() => {
    const out: { productId: string; requested: number; available: number }[] = [];
    requestedByProduct.forEach((qty, pid) => {
      const avail = availabilityByProduct.get(pid);
      if (avail !== undefined && qty > avail) {
        out.push({ productId: pid, requested: qty, available: avail });
      }
    });
    return out;
  }, [availabilityByProduct, requestedByProduct]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!billingAccess.operationalAllowed) {
      setError(
        billingAccess.actionBlockedReason ||
          t('Creating orders is not available for your account right now.'),
      );
      return;
    }
    if (!isYmdOnOrAfterLocalToday(shipDate)) {
      setError(t('Required ship date cannot be before today.'));
      return;
    }
    if (shortages.length > 0) {
      setError(t('Insufficient stock for one or more products.'));
      return;
    }

    const payloadLines: CreateClientOmsOrderInput['lines'] = [];
    for (const l of lines) {
      if (!l.productId || !l.requestedQuantity) continue;
      const qty = Number(l.requestedQuantity);
      const unitPrice = Number(l.unitPrice);
      if (!(qty > 0)) continue;
      if (Number.isNaN(unitPrice) || unitPrice < 0) {
        setError(t('Each product line needs a valid price.'));
        return;
      }
      payloadLines.push({ productId: l.productId, requestedQuantity: qty, unitPrice });
    }
    if (payloadLines.length === 0) {
      setError(t('Add at least one line with quantity and price.'));
      return;
    }

    setContactSubmitted(true);
    if (!isValidRecipientName(recipientName)) {
      setError(t('Name can only contain Arabic or English letters and spaces.'));
      return;
    }
    if (!recipientPhone.isEmpty && !recipientPhone.isValid) {
      setError(t('Please enter a valid phone number.'));
      return;
    }

    setError(null);
    createMut.mutate({
      requiredShipDate: shipDate,
      recipientName: recipientName.trim() || undefined,
      recipientPhone: recipientPhone.e164 || undefined,
      shippingPhoneCountry: recipientPhone.countryIso || undefined,
      city: city.trim() || undefined,
      district: district.trim() || undefined,
      addressLine1: addressLine1.trim() || undefined,
      addressLine2: addressLine2.trim() || undefined,
      notes: notes.trim() || undefined,
      paymentMethod: (paymentMethod || undefined) as CreateClientOmsOrderInput['paymentMethod'],
      lines: payloadLines,
    });
  };

  const loading = createMut.isPending;
  const fieldsDisabled = loading || !billingAccess.operationalAllowed;

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-enter">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb">
          <Link
            to="/ecommerce-orders"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 no-underline hover:text-brand-800 hover:underline"
          >
            <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
            {t('Back to online orders')}
          </Link>
        </nav>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-strong">{t('New online order')}</h1>
          <p className="text-sm text-text-muted">{t('Create an order from your store channel')}</p>
        </header>
      </div>

      {!billingAccess.operationalAllowed ? (
        <p
          className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
          role="alert"
        >
          {billingAccess.actionBlockedReason ||
            t('Creating orders is not available for your account right now.')}
        </p>
      ) : null}

      <form id="create-client-oms" onSubmit={submit} className="space-y-10">
        {error ? (
          <p
            className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <section className="space-y-5">
          <SectionHeading title={t('Shipping information')} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <RecipientNameInput
              label={t('Recipient name')}
              value={recipientName}
              onChange={setRecipientName}
              disabled={fieldsDisabled}
              isArabic={isArabic}
              submitted={contactSubmitted}
            />
            <InternationalPhoneInput
              label={t('Recipient phone')}
              value={recipientPhone}
              onChange={setRecipientPhone}
              disabled={fieldsDisabled}
              isArabic={isArabic}
              submitted={contactSubmitted}
            />
            <CascadingAddressSelector
              value={{ city, district, addressLine1 }}
              onChange={(next) => {
                setCity(next.city);
                setDistrict(next.district);
                setAddressLine1(next.addressLine1);
              }}
              cityLabel={t('Governorate')}
              districtLabel={t('City/Region')}
              addressLine1Label={t('Town/Neighborhood')}
              cityPlaceholder={t('Select or type governorate…')}
              districtPlaceholder={t('Select or type city/region…')}
              addressLine1Placeholder={t('Select or type town/neighborhood…')}
              disabled={fieldsDisabled}
            />
            <TextField
              label={t('Street / Detailed Address')}
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              disabled={fieldsDisabled}
              placeholder={t('Street name, building, floor…')}
              className="md:col-span-2"
            />
          </div>
          <DeliveryLocationMap
            lat={deliveryLat}
            lng={deliveryLng}
            onChange={({ lat, lng }) => {
              setDeliveryLat(lat);
              setDeliveryLng(lng);
            }}
            disabled={fieldsDisabled}
            governorate={city}
            city={district}
            neighborhood={addressLine1}
            street={addressLine2}
            onRemovePin={() => {
              setDeliveryLat('');
              setDeliveryLng('');
            }}
          />
        </section>

        <section className="space-y-5">
          <SectionHeading title={t('Order details')} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextField
              label={t('Required ship date')}
              type="date"
              required
              min={localCalendarDateYmd()}
              value={shipDate}
              onChange={(e) => setShipDate(e.target.value)}
              disabled={fieldsDisabled}
            />
            <SelectField
              label={t('Payment method')}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              disabled={fieldsDisabled}
              options={[
                { value: '', label: '—' },
                { value: 'COD', label: 'COD' },
                { value: 'PREPAID', label: 'Prepaid' },
                { value: 'CREDIT', label: 'Credit' },
              ]}
            />
          </div>
          <Textarea
            label={t('Notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            disabled={fieldsDisabled}
          />
        </section>

        <section className="space-y-5">
          <SectionHeading title={t('Products')} />
          <div className="space-y-2">
            {lines.map((line, idx) => {
              const avail = line.productId ? availabilityByProduct.get(line.productId) : undefined;
              const summed = line.productId ? requestedByProduct.get(line.productId) ?? 0 : 0;
              const isShort = avail !== undefined && summed > avail;
              return (
                <div key={idx} className="space-y-1">
                  <div className="grid gap-2 md:grid-cols-[1fr_90px_110px_auto]">
                    <Combobox
                      label={idx === 0 ? t('Product') : undefined}
                      value={line.productId}
                      onChange={(v) =>
                        setLines((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, productId: v } : row)),
                        )
                      }
                      options={productOptions}
                      placeholder={t('Pick product…')}
                      clearable={false}
                      dropdownInFlow
                      disabled={fieldsDisabled}
                    />
                    <TextField
                      label={idx === 0 ? t('Qty') : undefined}
                      value={line.requestedQuantity}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, requestedQuantity: e.target.value } : row,
                          ),
                        )
                      }
                      disabled={fieldsDisabled}
                    />
                    <TextField
                      label={idx === 0 ? t('Price') : undefined}
                      value={line.unitPrice}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, unitPrice: e.target.value } : row,
                          ),
                        )
                      }
                      required
                      disabled={fieldsDisabled}
                    />
                    <div className={idx === 0 ? 'pt-6' : 'pt-1'}>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={lines.length <= 1 || fieldsDisabled}
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        {t('Remove')}
                      </Button>
                    </div>
                  </div>
                  {line.productId && avail !== undefined ? (
                    <div
                      className={`text-xs ${
                        isShort
                          ? 'text-danger-600 dark:text-status-danger-fg'
                          : 'text-brand-700 dark:text-brand-400'
                      }`}
                    >
                      {t('Available')}: {avail.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      {summed > 0 ? (
                        <>
                          {' '}
                          • {t('Requested across lines')}:{' '}
                          {summed.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                          {isShort ? ` — ${t('Exceeds available stock')}` : ''}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={fieldsDisabled}
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              {t('+ Add line')}
            </Button>
          </div>
        </section>

        {shortages.length > 0 ? (
          <div className="rounded-md border border-status-danger-border bg-status-danger-bg p-3 text-xs text-status-danger-fg">
            <strong className="block">{t('Order cannot be created — insufficient stock:')}</strong>
            <ul className="mt-1 list-disc pl-4">
              {shortages.map((s) => {
                const p = products.data?.items.find((x) => x.id === s.productId);
                return (
                  <li key={s.productId}>
                    {p ? `${p.sku} — ${p.name}` : s.productId}: {t('requested')} {s.requested},{' '}
                    {t('available')} {s.available}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-6">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => navigate('/ecommerce-orders')}
          >
            {t('Cancel')}
          </Button>
          <button
            type="submit"
            form="create-client-oms"
            disabled={fieldsDisabled || shortages.length > 0}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            {loading ? (
              <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
            ) : (
              <i className="fa-solid fa-check" aria-hidden="true" />
            )}
            {t('Submit for approval')}
          </button>
        </div>
      </form>
    </div>
  );
}
