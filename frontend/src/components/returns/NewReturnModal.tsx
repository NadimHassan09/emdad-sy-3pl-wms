import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { OutboundApi } from '../../api/outbound';
import { ProductsApi } from '../../api/products';
import { ReturnsApi, type CreateReturnOrderInput } from '../../api/returns';
import { useToast } from '../ToastProvider';
import { Button } from '../Button';
import { Combobox } from '../Combobox';
import { Modal } from '../Modal';
import { TextField } from '../TextField';
import { QK } from '../../constants/query-keys';
import { companyFilterComboboxOptions } from '../../lib/company-filter-options';
import { CompaniesApi } from '../../api/companies';

const MAX_RETURN_LINES = 50;

type DraftLine = {
  productId: string;
  outboundOrderLineId: string;
  expectedQuantity: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  warehouseId: string;
  defaultCompanyId: string;
  onSubmit: (input: CreateReturnOrderInput) => void;
  isArabic: boolean;
};

export function NewReturnModal({
  open,
  onClose,
  loading,
  warehouseId,
  defaultCompanyId,
  onSubmit,
  isArabic,
}: Props) {
  const toast = useToast();
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const [outboundId, setOutboundId] = useState('');
  const [clientRef, setClientRef] = useState('');
  const [shipmentRef, setShipmentRef] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ productId: '', outboundOrderLineId: '', expectedQuantity: '' }]);

  useEffect(() => {
    if (!open) return;
    setCompanyId(defaultCompanyId);
    setOutboundId('');
    setClientRef('');
    setShipmentRef('');
    setNotes('');
    setLines([{ productId: '', outboundOrderLineId: '', expectedQuantity: '' }]);
  }, [open, defaultCompanyId]);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
    enabled: open,
  });

  const outbounds = useQuery({
    queryKey: [...QK.outboundOrders, 'returns-create', companyId, warehouseId],
    queryFn: () =>
      OutboundApi.list({
        companyId: companyId || undefined,
        warehouseId: warehouseId || undefined,
        status: 'shipped',
        limit: 100,
      }),
    enabled: open && !!companyId,
  });

  const outboundDetail = useQuery({
    queryKey: ['outbound-orders', 'detail', outboundId],
    queryFn: () => OutboundApi.get(outboundId),
    enabled: open && !!outboundId,
  });

  const outboundQuota = useQuery({
    queryKey: QK.returns.outboundQuota(outboundId),
    queryFn: () => ReturnsApi.getOutboundQuota(outboundId),
    enabled: open && !!outboundId,
    staleTime: 30_000,
  });

  const products = useQuery({
    queryKey: [...QK.products, 'returns-create', companyId],
    queryFn: () => ProductsApi.list({ companyId, limit: 500 }),
    enabled: open && !!companyId && !outboundId,
  });

  const clientOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, t('Select client', 'اختر العميل')),
    [companies.data, isArabic],
  );

  const outboundOptions = useMemo(
    () => [
      { value: '', label: t('No outbound link', 'بدون ربط صادر') },
      ...(outbounds.data?.items ?? []).map((o) => ({
        value: o.id,
        label: `${o.orderNumber} · ${o.status}`,
      })),
    ],
    [outbounds.data, isArabic],
  );

  const quotaByLineId = useMemo(() => {
    const m = new Map<string, { remaining: number; shipped: number; already: number }>();
    for (const q of outboundQuota.data?.lines ?? []) {
      m.set(q.outboundOrderLineId, {
        remaining: Number(q.remaining),
        shipped: Number(q.shippedQuantity),
        already: Number(q.alreadyReturned),
      });
    }
    return m;
  }, [outboundQuota.data]);

  const productOptionsFromOutbound = useMemo(() => {
    const ob = outboundDetail.data;
    if (!ob) return [];
    return ob.lines.map((l) => {
      const q = quotaByLineId.get(l.id);
      const remaining = q?.remaining ?? Number(l.pickedQuantity);
      return {
        value: l.id,
        label: `${l.product?.sku ?? ''} · ${l.product?.name ?? ''} (${t('remaining', 'متبقي')} ${remaining})`,
        productId: l.productId,
        maxQty: remaining,
        disabled: remaining <= 0,
      };
    });
  }, [outboundDetail.data, quotaByLineId, isArabic]);

  const productOptionsManual = useMemo(
    () =>
      (products.data?.items ?? []).map((p) => ({
        value: p.id,
        label: `${p.sku} · ${p.name}`,
      })),
    [products.data],
  );

  const addLine = () => {
    setLines((prev) => {
      if (prev.length >= MAX_RETURN_LINES) return prev;
      return [...prev, { productId: '', outboundOrderLineId: '', expectedQuantity: '' }];
    });
  };

  const removeLine = (idx: number) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const submit = () => {
    if (!companyId) return;
    if (!warehouseId) return;

    const built: CreateReturnOrderInput['lines'] = [];
    const seenOutbound = new Set<string>();
    const seenProduct = new Set<string>();

    for (const row of lines) {
      const qty = Number(row.expectedQuantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      if (outboundId && row.outboundOrderLineId) {
        if (seenOutbound.has(row.outboundOrderLineId)) {
          toast.error(t('Each outbound line can appear once.', 'كل بند صادر مرة واحدة فقط.'));
          return;
        }
        seenOutbound.add(row.outboundOrderLineId);
        const obLine = outboundDetail.data?.lines.find((l) => l.id === row.outboundOrderLineId);
        if (!obLine) continue;
        const max = quotaByLineId.get(obLine.id)?.remaining ?? Number(obLine.pickedQuantity);
        if (qty > max) {
          toast.error(t('Quantity exceeds returnable remaining.', 'الكمية تتجاوز المتبقي القابل للإرجاع.'));
          return;
        }
        built.push({
          productId: obLine.productId,
          expectedQuantity: qty,
          outboundOrderLineId: obLine.id,
        });
      } else if (row.productId) {
        if (seenProduct.has(row.productId)) return;
        seenProduct.add(row.productId);
        built.push({ productId: row.productId, expectedQuantity: qty });
      }
    }

    if (built.length === 0) return;

    onSubmit({
      companyId,
      warehouseId,
      originalOutboundOrderId: outboundId || undefined,
      clientReference: clientRef.trim() || undefined,
      shipmentReference: shipmentRef.trim() || undefined,
      notes: notes.trim() || undefined,
      lines: built,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('New return', 'إرجاع جديد')}
      widthClass="max-w-2xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={loading || !warehouseId}>
            {t('Create return', 'إنشاء الإرجاع')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        {!warehouseId ? (
          <p className="text-sm text-amber-800">{t('Warehouse not resolved.', 'المستودع غير محدد.')}</p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Combobox
            label={t('Client', 'العميل')}
            value={companyId}
            onChange={setCompanyId}
            options={clientOptions}
          />
          <Combobox
            label={t('Linked outbound (shipped)', 'الصادر المرتبط')}
            value={outboundId}
            onChange={(v) => {
              setOutboundId(v);
              setLines([{ productId: '', outboundOrderLineId: '', expectedQuantity: '' }]);
            }}
            options={outboundOptions}
          />
          <TextField
            label={t('Client reference', 'مرجع العميل')}
            value={clientRef}
            onChange={(e) => setClientRef(e.target.value)}
          />
          <TextField
            label={t('Shipment reference', 'مرجع الشحنة')}
            value={shipmentRef}
            onChange={(e) => setShipmentRef(e.target.value)}
          />
        </div>

        <TextField
          label={t('Return reason / notes', 'سبب الإرجاع / ملاحظات')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {outboundId && outboundQuota.data ? (
          <p className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-950">
            {t(
              'Quantities are capped by shipped minus prior returns on this outbound.',
              'الكميات محدودة بالمشحون ناقص الإرجاعات السابقة على هذا الصادر.',
            )}
          </p>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">{t('Products', 'المنتجات')}</h3>
            <Button
              variant="ghost"
              className="!px-2 !py-1 text-xs"
              onClick={addLine}
              disabled={lines.length >= MAX_RETURN_LINES}
            >
              {t('+ Line', '+ بند')}
            </Button>
          </div>

          {lines.map((row, idx) => (
            <div key={idx} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-12">
              {outboundId ? (
                <div className="sm:col-span-7">
                  <Combobox
                    label={t('Outbound line', 'بند الصادر')}
                    value={row.outboundOrderLineId}
                    onChange={(v) => {
                      const opt = productOptionsFromOutbound.find((o) => o.value === v);
                      setLines((prev) =>
                        prev.map((l, i) =>
                          i === idx
                            ? {
                                ...l,
                                outboundOrderLineId: v,
                                productId: opt?.productId ?? '',
                                expectedQuantity:
                                  opt && opt.maxQty > 0 ? String(opt.maxQty) : l.expectedQuantity,
                              }
                            : l,
                        ),
                      );
                    }}
                    options={[
                      { value: '', label: t('Pick line…', 'اختر البند…') },
                      ...productOptionsFromOutbound
                        .filter(
                          (o) =>
                            o.value === row.outboundOrderLineId ||
                            !lines.some(
                              (l, i) => i !== idx && l.outboundOrderLineId === o.value,
                            ),
                        )
                        .filter((o) => !o.disabled || o.value === row.outboundOrderLineId)
                        .map((o) => ({ value: o.value, label: o.label })),
                    ]}
                  />
                </div>
              ) : (
                <div className="sm:col-span-7">
                  <Combobox
                    label={t('Product', 'المنتج')}
                    value={row.productId}
                    onChange={(v) =>
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, productId: v } : l)))
                    }
                    options={[
                      { value: '', label: t('Pick product…', 'اختر المنتج…') },
                      ...productOptionsManual,
                    ]}
                  />
                </div>
              )}
              <div className="sm:col-span-3">
                <TextField
                  label={t('Qty', 'الكمية')}
                  type="number"
                  min={0}
                  step="1"
                  value={row.expectedQuantity}
                  onChange={(e) => {
                    let v = e.target.value;
                    if (outboundId && row.outboundOrderLineId) {
                      const max =
                        quotaByLineId.get(row.outboundOrderLineId)?.remaining ??
                        productOptionsFromOutbound.find((o) => o.value === row.outboundOrderLineId)
                          ?.maxQty;
                      if (max != null && Number(v) > max) v = String(max);
                    }
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, expectedQuantity: v } : l)),
                    );
                  }}
                />
              </div>
              <div className="flex items-end sm:col-span-2">
                <Button variant="ghost" className="!px-2" onClick={() => removeLine(idx)}>
                  {t('Remove', 'إزالة')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
