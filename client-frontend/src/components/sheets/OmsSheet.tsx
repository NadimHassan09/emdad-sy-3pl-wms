import { useCallback, useEffect, useMemo, useState } from 'react';

import { Alert, Button, Skeleton } from '@ds';

import { listCities, listDistricts, listNeighborhoods } from '../../data/syria-address';
import {
  cancelClientOmsOrder,
  createClientOmsOrder,
  deleteClientOmsOrder,
  fetchClientOmsOrder,
  fetchClientOmsOrders,
  updateClientOmsOrder,
  type ClientOmsOrderStatus,
  type ClientOmsPaymentMethod,
} from '../../services/clientOmsOrdersService';
import { fetchClientProducts, type ClientProductRow } from '../../services/clientProductsService';

/** Same lock as the server: after the warehouse approves, the order leaves this sheet. */
const EDITABLE: ClientOmsOrderStatus[] = [
  'draft',
  'waiting_for_confirmation',
  'pending_approval',
  'confirmed_waiting_for_admin_approval',
];
const DELETABLE: ClientOmsOrderStatus[] = ['draft', 'waiting_for_confirmation'];

type Row = {
  key: string;
  id?: string;
  orderNumber?: string;
  status?: ClientOmsOrderStatus;
  requiredShipDate: string;
  recipientName: string;
  recipientPhone: string;
  city: string;
  district: string;
  addressLine1: string;
  addressLine2: string;
  paymentMethod: ClientOmsPaymentMethod | '';
  productId: string;
  quantity: string;
  unitPrice: string;
  linesSummary?: string;
  notes: string;
  dirty: boolean;
  error?: string;
  saved?: boolean;
};

let keySeed = 0;
const newKey = () => `n${(keySeed += 1)}`;

function emptyRow(): Row {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return {
    key: newKey(), requiredShipDate: tomorrow, recipientName: '', recipientPhone: '', city: '', district: '',
    addressLine1: '', addressLine2: '', paymentMethod: '', productId: '', quantity: '1', unitPrice: '', notes: '', dirty: true,
  };
}

const cell = 'border-b border-r border-neutral-200 p-0 dark:border-neutral-700';
const input =
  'w-full min-w-[7rem] bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:bg-emerald-950/30';

export function OmsSheet({ isArabic }: { isArabic: boolean }) {
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const [rows, setRows] = useState<Row[]>([]);
  const [products, setProducts] = useState<ClientProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const cities = useMemo(() => listCities(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [page, productPage] = await Promise.all([
        fetchClientOmsOrders({ limit: 100, offset: 0 }),
        fetchClientProducts({ limit: 500, offset: 0 }),
      ]);
      setProducts(productPage.items.filter((p) => p.status === 'active'));
      const editable = page.items.filter((o) => EDITABLE.includes(o.status));
      const details = await Promise.all(editable.map((o) => fetchClientOmsOrder(o.id)));
      setRows(
        details.map((d) => ({
          key: d.id, id: d.id, orderNumber: d.orderNumber, status: d.status,
          requiredShipDate: d.requiredShipDate?.slice(0, 10) ?? '',
          recipientName: d.recipientName ?? '', recipientPhone: d.recipientPhone ?? '',
          city: d.city ?? '', district: d.district ?? '', addressLine1: d.addressLine1 ?? '', addressLine2: d.addressLine2 ?? '',
          paymentMethod: (d.paymentMethod as ClientOmsPaymentMethod) ?? '',
          productId: '', quantity: '', unitPrice: '',
          linesSummary: d.lines.map((l) => `${l.product?.sku ?? '?'} × ${Number(l.requestedQuantity)}`).join(', '),
          notes: d.notes ?? '', dirty: false,
        })),
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the sheet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const patch = (key: string, change: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...change, dirty: true, saved: false, error: undefined } : r)));

  const saveRow = async (row: Row): Promise<Row> => {
    try {
      if (!row.id) {
        if (!row.productId) throw new Error(t('Choose a product.', 'اختر منتجًا.'));
        const created = await createClientOmsOrder({
          requiredShipDate: row.requiredShipDate,
          recipientName: row.recipientName,
          recipientPhone: row.recipientPhone,
          city: row.city,
          district: row.district,
          addressLine1: row.addressLine1,
          addressLine2: row.addressLine2,
          notes: row.notes || undefined,
          paymentMethod: row.paymentMethod || undefined,
          currency: 'USD',
          lines: [{
            productId: row.productId,
            requestedQuantity: Number(row.quantity),
            ...(row.unitPrice !== '' ? { unitPrice: Number(row.unitPrice) } : {}),
          }],
        });
        return { ...row, id: created.id, orderNumber: created.orderNumber, status: created.status, dirty: false, saved: true,
          linesSummary: `${products.find((p) => p.id === row.productId)?.sku ?? ''} × ${row.quantity}`, productId: '', quantity: '', unitPrice: '' };
      }
      await updateClientOmsOrder(row.id, {
        requiredShipDate: row.requiredShipDate || undefined,
        recipientName: row.recipientName,
        recipientPhone: row.recipientPhone,
        city: row.city,
        district: row.district,
        addressLine1: row.addressLine1,
        addressLine2: row.addressLine2,
        notes: row.notes,
        paymentMethod: row.paymentMethod || undefined,
      });
      return { ...row, dirty: false, saved: true };
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      return { ...row, error: Array.isArray(msg) ? msg.join(' · ') : msg ?? (e instanceof Error ? e.message : 'Failed') };
    }
  };

  const saveAll = async () => {
    setSaving(true);
    const next: Row[] = [];
    for (const r of rows) next.push(r.dirty ? await saveRow(r) : r);
    setRows(next);
    setSaving(false);
  };

  const removeRow = async (row: Row) => {
    if (!row.id) { setRows((rs) => rs.filter((r) => r.key !== row.key)); return; }
    const canDelete = row.status && DELETABLE.includes(row.status);
    if (!window.confirm(canDelete ? t('Delete this order?', 'حذف هذا الطلب؟') : t('Cancel this order?', 'إلغاء هذا الطلب؟'))) return;
    try {
      if (canDelete) await deleteClientOmsOrder(row.id); else await cancelClientOmsOrder(row.id);
      setRows((rs) => rs.filter((r) => r.key !== row.key));
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      patch(row.key, { error: msg ?? (e instanceof Error ? e.message : 'Failed') });
    }
  };

  const shown = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.orderNumber, r.recipientName, r.recipientPhone, r.city, r.district, r.linesSummary].join(' ').toLowerCase().includes(q);
  });
  const dirtyCount = rows.filter((r) => r.dirty).length;

  if (loading) return <Skeleton className="h-64" />;
  if (loadError) return <Alert variant="error">{loadError}</Alert>;

  const head = [
    t('Order', 'الطلب'), t('Ship date', 'تاريخ الشحن'), t('Recipient', 'المستلم'), t('Phone', 'الهاتف'),
    t('Governorate', 'المحافظة'), t('City / region', 'المدينة / المنطقة'), t('Neighborhood', 'الحي'),
    t('Street address', 'العنوان التفصيلي'), t('Payment', 'الدفع'), t('Product (SKU)', 'المنتج'), t('Qty', 'الكمية'),
    t('Unit price (USD)', 'سعر الوحدة (USD)'), t('Notes', 'ملاحظات'), '',
  ];

  return (
    <div className="space-y-3">
      <Alert variant="info">
        {t(
          'Edit orders here until the warehouse approves them. After approval an order leaves this sheet and only the warehouse can change it. Prices are in USD. Governorate, city, neighborhood and payment are chosen from lists.',
          'عدّل الطلبات هنا حتى يوافق عليها المخزن. بعد الموافقة يخرج الطلب من هذه الصفحة ولا يعدله إلا المخزن. الأسعار بالدولار. المحافظة والمدينة والحي والدفع تُختار من قوائم.',
        )}
      </Alert>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="rounded-md border px-3 py-1.5 text-sm"
          placeholder={t('Search…', 'بحث…')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="button" variant="ghost" onClick={() => setRows((rs) => [...rs, emptyRow()])}>{t('+ Add row', '+ إضافة صف')}</Button>
        <Button type="button" onClick={() => void saveAll()} disabled={saving || dirtyCount === 0}>
          {saving ? t('Saving…', 'جارٍ الحفظ…') : `${t('Save changes', 'حفظ التغييرات')} (${dirtyCount})`}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void load()} disabled={saving}>{t('Reload', 'إعادة تحميل')}</Button>
      </div>
      <div className="overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-700">
        <table className="min-w-full border-collapse text-start">
          <thead className="sticky top-0 bg-neutral-50 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            <tr>{head.map((h, i) => <th key={i} className="border-b border-r px-2 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={head.length} className="p-6 text-center text-sm text-neutral-500">
                {t('No editable orders. Add a row to create one.', 'لا توجد طلبات قابلة للتعديل. أضف صفًا لإنشاء طلب.')}
              </td></tr>
            ) : shown.map((r) => {
              const districts = listDistricts(r.city);
              const hoods = listNeighborhoods(r.city, r.district);
              const isNew = !r.id;
              return (
                <tr key={r.key} className={r.error ? 'bg-red-50 dark:bg-red-950/20' : r.saved ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}>
                  <td className={`${cell} whitespace-nowrap px-2 text-sm`}>
                    {r.orderNumber ?? t('New', 'جديد')}
                    {r.status ? <div className="text-xs text-neutral-500">{r.status.replace(/_/g, ' ')}</div> : null}
                  </td>
                  <td className={cell}><input className={input} type="date" value={r.requiredShipDate} onChange={(e) => patch(r.key, { requiredShipDate: e.target.value })} /></td>
                  <td className={cell}><input className={input} value={r.recipientName} onChange={(e) => patch(r.key, { recipientName: e.target.value })} /></td>
                  <td className={cell}><input className={input} value={r.recipientPhone} inputMode="tel" onChange={(e) => patch(r.key, { recipientPhone: e.target.value })} /></td>
                  <td className={cell}>
                    <select className={input} value={r.city} onChange={(e) => patch(r.key, { city: e.target.value, district: '', addressLine1: '' })}>
                      <option value="">—</option>
                      {r.city && !cities.includes(r.city) ? <option value={r.city}>{r.city}</option> : null}
                      {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className={cell}>
                    <select className={input} value={r.district} disabled={!r.city} onChange={(e) => patch(r.key, { district: e.target.value, addressLine1: '' })}>
                      <option value="">—</option>
                      {r.district && !districts.includes(r.district) ? <option value={r.district}>{r.district}</option> : null}
                      {districts.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className={cell}>
                    <select className={input} value={r.addressLine1} disabled={!r.district} onChange={(e) => patch(r.key, { addressLine1: e.target.value })}>
                      <option value="">—</option>
                      {r.addressLine1 && !hoods.includes(r.addressLine1) ? <option value={r.addressLine1}>{r.addressLine1}</option> : null}
                      {hoods.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className={cell}><input className={input} value={r.addressLine2} onChange={(e) => patch(r.key, { addressLine2: e.target.value })} /></td>
                  <td className={cell}>
                    <select className={input} value={r.paymentMethod} onChange={(e) => patch(r.key, { paymentMethod: e.target.value as ClientOmsPaymentMethod })}>
                      <option value="">—</option>
                      <option value="COD">COD</option>
                      <option value="PREPAID">{t('Prepaid', 'مدفوع مسبقًا')}</option>
                      <option value="CREDIT">{t('Credit', 'آجل')}</option>
                    </select>
                  </td>
                  {isNew ? (
                    <>
                      <td className={cell}>
                        <select className={input} value={r.productId} onChange={(e) => patch(r.key, { productId: e.target.value })}>
                          <option value="">—</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
                        </select>
                      </td>
                      <td className={cell}><input className={input} type="number" min="1" value={r.quantity} onChange={(e) => patch(r.key, { quantity: e.target.value })} /></td>
                      <td className={cell}><input className={input} type="number" min="0" step="1" value={r.unitPrice} onChange={(e) => patch(r.key, { unitPrice: e.target.value })} /></td>
                    </>
                  ) : (
                    <td className={`${cell} px-2 text-sm`} colSpan={3} title={t('Products cannot be changed. Delete the order and add it again.', 'لا يمكن تغيير المنتجات. احذف الطلب وأضفه من جديد.')}>
                      {r.linesSummary}
                    </td>
                  )}
                  <td className={cell}><input className={input} value={r.notes} onChange={(e) => patch(r.key, { notes: e.target.value })} /></td>
                  <td className={`${cell} whitespace-nowrap px-1`}>
                    <Button type="button" variant="ghost" onClick={() => void removeRow(r)}>
                      {isNew ? t('Remove', 'إزالة') : r.status && DELETABLE.includes(r.status) ? t('Delete', 'حذف') : t('Cancel order', 'إلغاء الطلب')}
                    </Button>
                    {r.error ? <div className="max-w-[14rem] whitespace-normal px-1 pb-1 text-xs text-red-600">{r.error}</div> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
