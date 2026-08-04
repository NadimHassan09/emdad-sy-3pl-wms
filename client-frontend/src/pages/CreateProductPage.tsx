import { useState, type FormEvent, type ReactElement } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { Button, Combobox, Textarea, TextField } from '@ds';
import {
  FILTER_FIELD_CONTROL_CLASS,
  FILTER_FIELD_LABEL_CLASS,
  FILTER_FIELD_LABEL_GAP_CLASS,
  FILTER_PRIMARY_BUTTON_CLASS,
} from '@ds';

import { useAuth } from '../auth/AuthContext';
import { ImageUploadField } from '../components/ImageUploadField';
import { useClientOperationalAccess } from '../hooks/useClientOperationalAccess';
import { generateBarcode, generateSku } from '../lib/identifiers';
import { isClientArabic } from '../lib/client-ui-language';
import { isClientAdmin } from '../lib/rbac';
import {
  createClientProduct,
  uploadClientProductImage,
  type CreateClientProductInput,
} from '../services/clientProductsService';

const UOM_OPTIONS = [
  { value: 'piece', label: 'Piece', labelAr: 'قطعة' },
  { value: 'kg', label: 'Kilogram', labelAr: 'كيلوغرام' },
  { value: 'litre', label: 'Litre', labelAr: 'لتر' },
  { value: 'carton', label: 'Carton', labelAr: 'كرتون' },
  { value: 'pallet', label: 'Pallet', labelAr: 'باليت' },
  { value: 'box', label: 'Box', labelAr: 'صندوق' },
  { value: 'roll', label: 'Roll', labelAr: 'لفة' },
];

const GENERATE_BUTTON_CLASS =
  `${FILTER_PRIMARY_BUTTON_CLASS} !h-11 shrink-0 whitespace-nowrap ` +
  '!rounded-l-none !rounded-r-[10px] !border-l-0 px-3 py-0 text-xs sm:text-sm';

const JOINED_INPUT_CLASS =
  `${FILTER_FIELD_CONTROL_CLASS} !rounded-r-none border-r-0 focus:z-10`;

function label(text: string, isArabic: boolean): string {
  if (!isArabic) return text;
  const ar: Record<string, string> = {
    'New product': 'منتج جديد',
    'Add a catalog product to track sellable stock': 'أضف منتجاً في الكتالوج لتتبع المخزون القابل للبيع',
    'Back to inventory': 'العودة إلى المخزون',
    Details: 'التفاصيل',
    Name: 'الاسم',
    SKU: 'رمز SKU',
    Generate: 'إنشاء',
    Barcode: 'الباركود',
    Description: 'الوصف',
    UoM: 'وحدة القياس',
    'Select unit...': 'اختر الوحدة...',
    'Inventory mode': 'وضع المخزون',
    FIFO: 'FIFO',
    'First In First Out': 'الوارد أولاً يخرج أولاً',
    'Recommended for products with no expiration dates':
      'موصى به للمنتجات بلا تواريخ انتهاء',
    FEFO: 'FEFO',
    'First Expiry First Out': 'الأقرب انتهاءً يخرج أولاً',
    'Recommended for products with expiration dates':
      'موصى به للمنتجات ذات تواريخ انتهاء',
    'Product photo': 'صورة المنتج',
    Optional: 'اختياري',
    Cancel: 'إلغاء',
    Create: 'إنشاء',
    'Product created.': 'تم إنشاء المنتج.',
    'Creating products is not available for your account right now.':
      'إنشاء المنتجات غير متاح لحسابك حالياً.',
  };
  return ar[text] ?? text;
}

function SectionHeading({ title }: { title: string }): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
        {title}
      </h2>
    </div>
  );
}

function InputWithGenerate({
  id,
  fieldLabel,
  hint,
  value,
  onChange,
  actionLabel,
  onGenerate,
  disabled,
  inputClassName = '',
}: {
  id: string;
  fieldLabel: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  actionLabel: string;
  onGenerate: () => void;
  disabled?: boolean;
  inputClassName?: string;
}): ReactElement {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block min-w-0">
        <span className={`${FILTER_FIELD_LABEL_CLASS} ${FILTER_FIELD_LABEL_GAP_CLASS}`}>
          {fieldLabel}
        </span>
        <div className="flex items-stretch">
          <input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={`${JOINED_INPUT_CLASS} ${inputClassName}`}
          />
          <button
            type="button"
            className={GENERATE_BUTTON_CLASS}
            onClick={onGenerate}
            disabled={disabled}
          >
            {actionLabel}
          </button>
        </div>
      </label>
      {hint ? <span className="mt-1 block text-xs text-text-muted">{hint}</span> : null}
    </div>
  );
}

export function CreateProductPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isArabic = isClientArabic();
  const t = (s: string) => label(s, isArabic);
  const billingAccess = useClientOperationalAccess(isArabic);
  const canCreate = isClientAdmin(user?.role);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [uom, setUom] = useState('piece');
  const [expiryTracking, setExpiryTracking] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: async ({
      input,
      imageFile: file,
    }: {
      input: CreateClientProductInput;
      imageFile: File | null;
    }) => {
      const created = await createClientProduct(input);
      if (file) {
        try {
          await uploadClientProductImage(created.id, file);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Image upload failed.';
          throw new Error(`${t('Product created.')} ${msg}`);
        }
      }
      return created;
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['client', 'products'] });
      navigate(`/products/${created.id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!canCreate) {
    return <Navigate to="/products" replace />;
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!billingAccess.operationalAllowed) {
      setError(
        billingAccess.actionBlockedReason ||
          t('Creating products is not available for your account right now.'),
      );
      return;
    }
    const input: CreateClientProductInput = {
      name: name.trim(),
      expiryTracking,
      uom: uom as CreateClientProductInput['uom'],
    };
    const skuTrim = sku.trim();
    if (skuTrim) input.sku = skuTrim;
    const barcodeTrim = barcode.trim();
    if (barcodeTrim) input.barcode = barcodeTrim;
    const descTrim = description.trim();
    if (descTrim) input.description = descTrim;
    setError(null);
    createMut.mutate({ input, imageFile });
  };

  const loading = createMut.isPending;
  const fieldsDisabled = loading || !billingAccess.operationalAllowed;

  const uomOptions = UOM_OPTIONS.map((o) => ({
    value: o.value,
    label: isArabic ? o.labelAr : o.label,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-enter">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb">
          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 no-underline hover:text-brand-800 hover:underline"
          >
            <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
            {t('Back to inventory')}
          </Link>
        </nav>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-strong">{t('New product')}</h1>
          <p className="text-sm text-text-muted">
            {t('Add a catalog product to track sellable stock')}
          </p>
        </header>
      </div>

      {!billingAccess.operationalAllowed ? (
        <p
          className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
          role="alert"
        >
          {billingAccess.actionBlockedReason ||
            t('Creating products is not available for your account right now.')}
        </p>
      ) : null}

      <form id="create-client-product" onSubmit={submit} className="space-y-10">
        {error ? (
          <p
            className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <section className="space-y-5">
          <SectionHeading title={t('Details')} />
          <div className="space-y-5">
            <ImageUploadField
              label={t('Product photo')}
              hint={t('Optional')}
              file={imageFile}
              onFileChange={setImageFile}
              disabled={fieldsDisabled}
              isArabic={isArabic}
            />
            <TextField
              label={t('Name')}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={fieldsDisabled}
            />
            <InputWithGenerate
              id="client-product-sku"
              fieldLabel={t('SKU')}
              value={sku}
              onChange={setSku}
              actionLabel={t('Generate')}
              onGenerate={() => setSku(generateSku())}
              disabled={fieldsDisabled}
              inputClassName="font-mono text-xs"
            />
            <InputWithGenerate
              id="client-product-barcode"
              fieldLabel={t('Barcode')}
              value={barcode}
              onChange={setBarcode}
              actionLabel={t('Generate')}
              onGenerate={() => setBarcode(generateBarcode())}
              disabled={fieldsDisabled}
              inputClassName="font-mono text-xs"
            />
            <Textarea
              label={t('Description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={fieldsDisabled}
            />
            <Combobox
              label={t('UoM')}
              value={uom}
              onChange={setUom}
              options={uomOptions}
              placeholder={t('Select unit...')}
              disabled={fieldsDisabled}
              clearable={false}
              dropdownInFlow
            />

            <div className="space-y-3">
              <p className={`${FILTER_FIELD_LABEL_CLASS}`}>{t('Inventory mode')}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  disabled={fieldsDisabled}
                  onClick={() => setExpiryTracking(false)}
                  className={[
                    'rounded-2xl border-2 p-5 text-start transition disabled:cursor-not-allowed disabled:opacity-60',
                    !expiryTracking
                      ? 'border-brand-500 bg-brand-50 shadow-sm dark:bg-brand-950/40'
                      : 'border-border bg-surface-card hover:border-border-strong',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3.5">
                    <span
                      className={[
                        'mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
                        !expiryTracking ? 'border-brand-600' : 'border-border-strong',
                      ].join(' ')}
                      aria-hidden
                    >
                      {!expiryTracking ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={[
                            'flex h-10 w-10 items-center justify-center rounded-full',
                            !expiryTracking
                              ? 'bg-brand-100 text-brand-700'
                              : 'bg-surface-sunken text-text-muted',
                          ].join(' ')}
                        >
                          <i className="fa-solid fa-boxes-stacked" aria-hidden />
                        </span>
                        <span className="text-[15px] font-semibold text-text-strong">
                          {t('FIFO')}
                        </span>
                      </div>
                      <ul className="space-y-2 text-sm text-text-body">
                        <li className="flex items-start gap-2">
                          <i
                            className="fa-solid fa-check mt-0.5 text-brand-600"
                            aria-hidden
                          />
                          <span>{t('First In First Out')}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <i
                            className="fa-solid fa-check mt-0.5 text-brand-600"
                            aria-hidden
                          />
                          <span>{t('Recommended for products with no expiration dates')}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={fieldsDisabled}
                  onClick={() => setExpiryTracking(true)}
                  className={[
                    'rounded-2xl border-2 p-5 text-start transition disabled:cursor-not-allowed disabled:opacity-60',
                    expiryTracking
                      ? 'border-brand-500 bg-brand-50 shadow-sm dark:bg-brand-950/40'
                      : 'border-border bg-surface-card hover:border-border-strong',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3.5">
                    <span
                      className={[
                        'mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
                        expiryTracking ? 'border-brand-600' : 'border-border-strong',
                      ].join(' ')}
                      aria-hidden
                    >
                      {expiryTracking ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={[
                            'flex h-10 w-10 items-center justify-center rounded-full',
                            expiryTracking
                              ? 'bg-brand-100 text-brand-700'
                              : 'bg-surface-sunken text-text-muted',
                          ].join(' ')}
                        >
                          <i className="fa-solid fa-calendar-days" aria-hidden />
                        </span>
                        <span className="text-[15px] font-semibold text-text-strong">
                          {t('FEFO')}
                        </span>
                      </div>
                      <ul className="space-y-2 text-sm text-text-body">
                        <li className="flex items-start gap-2">
                          <i
                            className="fa-solid fa-check mt-0.5 text-brand-600"
                            aria-hidden
                          />
                          <span>{t('First Expiry First Out')}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <i
                            className="fa-solid fa-check mt-0.5 text-brand-600"
                            aria-hidden
                          />
                          <span>{t('Recommended for products with expiration dates')}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="danger"
            onClick={() => navigate('/products')}
            disabled={loading}
          >
            {t('Cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            disabled={!billingAccess.operationalAllowed}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            {t('Create')}
          </Button>
        </div>
      </form>
    </div>
  );
}
