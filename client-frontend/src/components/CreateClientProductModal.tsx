import { useEffect, useState, type FormEvent, type ReactElement } from 'react';

import { Button, Modal } from '@ds';
import { FILTER_PRIMARY_BUTTON_CLASS } from '@ds';
import {
  FILTER_FIELD_CONTROL_CLASS,
  FILTER_FIELD_LABEL_CLASS,
  FILTER_FIELD_LABEL_GAP_CLASS,
} from '@ds';
import { SelectField } from '@ds';
import { TextField } from '@ds';

import { ImageUploadField } from './ImageUploadField';
import { generateBarcode, generateSku } from '../lib/identifiers';
import type { CreateClientProductInput } from '../services/clientProductsService';

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

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  submitError?: string | null;
  onSubmit: (input: CreateClientProductInput, imageFile: File | null) => void;
  isArabic: boolean;
};

function label(text: string, isArabic: boolean): string {
  if (!isArabic) return text;
  const ar: Record<string, string> = {
    'New product': 'منتج جديد',
    Name: 'الاسم',
    'SKU (optional)': 'رمز SKU (اختياري)',
    'Generate SKU': 'إنشاء',
    'Barcode (optional)': 'الباركود (اختياري)',
    'Generate barcode': 'إنشاء',
    Generate: 'إنشاء',
    'Leave blank to auto-generate.': 'اتركه فارغاً للإنشاء التلقائي.',
    'Description (optional)': 'الوصف (اختياري)',
    UoM: 'وحدة القياس',
    'Product has an expiry date': 'المنتج له تاريخ انتهاء',
    'Product photo': 'صورة المنتج',
    'Optional. Images are compressed before saving.': 'اختياري. يتم ضغط الصور قبل الحفظ.',
    Cancel: 'إلغاء',
    Create: 'إنشاء',
  };
  return ar[text] ?? text;
}

function InputWithGenerate({
  id,
  fieldLabel,
  hint,
  value,
  onChange,
  actionLabel,
  onGenerate,
  inputClassName = '',
}: {
  id: string;
  fieldLabel: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  actionLabel: string;
  onGenerate: () => void;
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
            className={`${JOINED_INPUT_CLASS} ${inputClassName}`}
          />
          <button type="button" className={GENERATE_BUTTON_CLASS} onClick={onGenerate}>
            {actionLabel}
          </button>
        </div>
      </label>
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </div>
  );
}

export function CreateClientProductModal({
  open,
  onClose,
  loading,
  submitError,
  onSubmit,
  isArabic,
}: Props): ReactElement {
  const t = (text: string) => label(text, isArabic);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [uom, setUom] = useState('piece');
  const [expiryTracking, setExpiryTracking] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setSku('');
    setBarcode('');
    setDescription('');
    setUom('piece');
    setExpiryTracking(false);
    setImageFile(null);
  }, [open]);

  const handleClose = () => {
    if (!loading) onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
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
    onSubmit(input, imageFile);
  };

  const uomOptions = UOM_OPTIONS.map((o) => ({
    value: o.value,
    label: isArabic ? o.labelAr : o.label,
  }));

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('New product')}
      widthClass="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} type="button" disabled={loading}>
            {t('Cancel')}
          </Button>
          <Button
            form="create-client-product"
            type="submit"
            loading={loading}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            {t('Create')}
          </Button>
        </>
      }
    >
      <form id="create-client-product" onSubmit={submit} className="space-y-3">
        {submitError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {submitError}
          </p>
        ) : null}
        <ImageUploadField
          label={t('Product photo')}
          hint={t('Optional. Images are compressed before saving.')}
          file={imageFile}
          onFileChange={setImageFile}
          disabled={loading}
          isArabic={isArabic}
        />
        <TextField label={t('Name')} required value={name} onChange={(e) => setName(e.target.value)} />
        <InputWithGenerate
          id="client-product-sku"
          fieldLabel={t('SKU (optional)')}
          value={sku}
          onChange={setSku}
          actionLabel={t('Generate')}
          onGenerate={() => setSku(generateSku())}
          inputClassName="font-mono text-xs"
        />
        <InputWithGenerate
          id="client-product-barcode"
          fieldLabel={t('Barcode (optional)')}
          value={barcode}
          onChange={setBarcode}
          actionLabel={t('Generate')}
          onGenerate={() => setBarcode(generateBarcode())}
          hint={t('Leave blank to auto-generate.')}
          inputClassName="font-mono text-xs"
        />
        <TextField
          label={t('Description (optional)')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <SelectField label={t('UoM')} value={uom} onChange={(e) => setUom(e.target.value)} options={uomOptions} />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={expiryTracking}
            onChange={(e) => setExpiryTracking(e.target.checked)}
          />
          {t('Product has an expiry date')}
        </label>
      </form>
    </Modal>
  );
}
