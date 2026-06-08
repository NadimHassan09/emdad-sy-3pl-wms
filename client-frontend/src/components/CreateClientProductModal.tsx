import { useEffect, useState, type FormEvent, type ReactElement } from 'react';

import { Button, Modal } from '@ds';
import { FILTER_PRIMARY_BUTTON_CLASS } from '@wms/components/FilterPanel';
import { SelectField } from '@wms/components/SelectField';
import { TextField } from '@wms/components/TextField';

import { generateSku } from '../lib/identifiers';
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

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  submitError?: string | null;
  onSubmit: (input: CreateClientProductInput) => void;
  isArabic: boolean;
};

function label(text: string, isArabic: boolean): string {
  if (!isArabic) return text;
  const ar: Record<string, string> = {
    'New product': 'منتج جديد',
    Name: 'الاسم',
    'SKU (optional)': 'رمز SKU (اختياري)',
    'Generate SKU': 'إنشاء SKU',
    'Barcode (optional)': 'الباركود (اختياري)',
    'Leave blank to auto-generate.': 'اتركه فارغاً للإنشاء التلقائي.',
    'Description (optional)': 'الوصف (اختياري)',
    UoM: 'وحدة القياس',
    'Product has an expiry date': 'المنتج له تاريخ انتهاء',
    'Min stock threshold': 'حد المخزون الأدنى',
    Cancel: 'إلغاء',
    Create: 'إنشاء',
  };
  return ar[text] ?? text;
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
  const [expiryTracking, setExpiryTracking] = useState(true);
  const [minStock, setMinStock] = useState('0');

  useEffect(() => {
    if (!open) return;
    setName('');
    setSku('');
    setBarcode('');
    setDescription('');
    setUom('piece');
    setExpiryTracking(true);
    setMinStock('0');
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
      minStockThreshold: minStock.trim() === '' ? 0 : Math.max(0, parseInt(minStock, 10) || 0),
    };
    const skuTrim = sku.trim();
    if (skuTrim) input.sku = skuTrim;
    const barcodeTrim = barcode.trim();
    if (barcodeTrim) input.barcode = barcodeTrim;
    const descTrim = description.trim();
    if (descTrim) input.description = descTrim;
    onSubmit(input);
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
      <form
        id="create-client-product"
        onSubmit={submit}
        className="space-y-3"
      >
        {submitError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {submitError}
          </p>
        ) : null}
        <TextField label={t('Name')} required value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <TextField
              label={t('SKU (optional)')}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0 sm:mb-0"
            onClick={() => setSku(generateSku())}
          >
            {t('Generate SKU')}
          </Button>
        </div>
        <TextField
          label={t('Barcode (optional)')}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          hint={t('Leave blank to auto-generate.')}
          className="font-mono text-xs"
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
        <TextField
          label={t('Min stock threshold')}
          type="number"
          min={0}
          value={minStock}
          onChange={(e) => setMinStock(e.target.value)}
        />
      </form>
    </Modal>
  );
}
