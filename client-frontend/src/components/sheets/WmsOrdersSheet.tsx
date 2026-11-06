import { useCallback, useEffect, useState } from 'react';

import { Alert, Button, Skeleton } from '@ds';

import {
  createClientInboundOrder,
  deleteClientInboundOrder,
  fetchClientInboundOrder,
  fetchClientInboundOrders,
  updateClientInboundOrder,
} from '../../services/clientInboundOrdersService';
import {
  createClientOutboundOrder,
  deleteClientOutboundOrder,
  fetchClientOutboundOrder,
  fetchClientOutboundOrders,
  updateClientOutboundOrder,
} from '../../services/clientOutboundOrdersService';
import { fetchClientProducts, type ClientProductRow } from '../../services/clientProductsService';

export type WmsSheetKind = 'inbound' | 'outbound';

/** Same lock as the server: once the warehouse approves, the order leaves this sheet. */
const EDITABLE = ['draft', 'pending_approval'];

type Row = {
  key: string;
  id?: string;
  orderNumber?: string;
  status?: string;
  date: string;
  address: string;
  reference: string;
  notes: string;
  productId: string;
  quantity: string;
  linesSummary?: string;
  dirty: boolean;
  error?: string;
  saved?: boolean;
};

let keySeed = 0;
const newKey = () => `w${(keySeed += 1)}`;

function emptyRow(): Row {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  return { key: newKey(), date: tomorrow, address: '', reference: '', notes: '', productId: '', quantity: '1', dirty: true };
}

const cell = 'border-b border-r border-neutral-200 p-0 dark:border-neutral-700';
const input =
  'w-full min-w-[7rem] bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:bg-emerald-950/30';

function errorText(e: unknown): string {
  const msg = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(' · ');
  return msg ?? (e instanceof Error ? e.message : 'Failed');
}

export function WmsOrdersSheet({ kind, isArabic }: { kind: WmsSheetKind; isArabic: boolean }) {
  const t = (en: string, ar: string) => (isArabic ? ar : en);
  const isInbound = kind === 'inbound';
  const [rows, setRows] = useState<Row[]>([]);
  const [products, setProducts] = useState<ClientProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const productPage = await fetchClientProducts({ limit: 500, offset: 0 });
      setProducts(productPage.items.filter((p) => p.status === 'active'));
      if (isInbound) {
        const page = await fetchClientInboundOrders({ limit: 100, offset: 0 });
        const editable = page.items.filter((o) => EDITABLE.includes(o.status));
        const details = await Promise.all(editable.map((o) => fetchClientInboundOrder(o.id)));
        setRows(details.map((d) => ({
          key: d.id, id: d.id, orderNumber: d.orderNumber, status: d.status,
          date: d.expectedArrivalDate?.slice(0, 10) ?? '', address: '',
          reference: d.clientReference ?? '', notes: d.notes ?? '', productId: '', quantity: '',
          linesSummary: d.lines.map((l) => `${l.product.sku} × ${Number(l.expectedQuantity)}`).join(', '),
          dirty: false,
        })));
      } else {
        const page = await fetchClientOutboundOrders({ limit: 100, offset: 0 });
        const editable = page.items.filter((o) => EDITABLE.includes(o.status));
        const details = await Promise.all(editable.map((o) => fetchClientOutboundOrder(o.id)));
        setRows(details.map((d) => ({
          key: d.id, id: d.id, orderNumber: d.orderNumber, status: d.status,
          date: d.requiredShipDate?.slice(0, 10) ?? '', address: d.destinationAddress ?? '',
          reference: d.clientReference ?? '', notes: d.notes ?? '', productId: '', quantity: '',
          linesSummary: d.lines.map((l) => `${l.product?.sku ?? '?'} × ${Number(l.requestedQuantity)}`).join(', '),
          dirty: false,
        })));
      }
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [isInbound]);

  useEffect(() => { void load(); }, [load]);

  const patch = (key: string, change: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...change, dirty: true, saved: false, error: undefined } : r)));

  const saveRow = async (row: Row): Promise<Row> => {
    try {
      if (!row.id) {
        if (!row.productId) throw new Error(t('Choose a product.', 'اختر منتجًا.'));
        if (!isInbound && !row.address.trim()) throw new Error(t('Destination address is required.', 'عنوان الوجهة مطلوب.'));
        const sku = products.find((p) => p.id === row.productId)?.sku ?? '';
        const common = { clientReference: row.reference || undefined, notes: row.notes || undefined };
        const created = isInbound
          ? await createClientInboundOrder({
              ...common,
              expectedArrivalDate: row.date,
              lines: [{ productId: row.productId, expectedQuantity: Number(row.quantity) }],
            })
          : await createClientOutboundOrder({
              ...common,
              destinationAddress: row.address.trim(),
              requiredShipDate: row.date,
              lines: [{ productId: row.productId, requestedQuantity: Number(row.quantity) }],
            });
        return { ...row, id: created.id, orderNumber: created.orderNumber, status: created.status, dirty: false, saved: true,
          linesSummary: `${sku} × ${row.quantity}`, productId: '', quantity: '' };
      }
      if (isInbound) {
        await updateClientInboundOrder(row.id, {
          expectedArrivalDate: row.date || undefined, clientReference: row.reference, notes: row.notes,
        });
      } else {
        await updateClientOutboundOrder(row.id, {
          requiredShipDate: row.date || undefined, destinationAddress: row.address.trim() || undefined,
          clientReference: row.reference, notes: row.notes,
        });
      }
      return { ...row, dirty: false, saved: true };
    } catch (e) {
      return { ...row, error: errorText(e) };
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
    if (!window.confirm(t('Delete this order?', 'حذف هذا الطلب؟'))) return;
    try {
      if (isInbound) await deleteClientInboundOrder(row.id); else await deleteClientOutboundOrder(row.id);
      setRows((rs) => rs.filter((r) => r.key !== row.key));
    } catch (e) {
      patch(row.key, { error: errorText(e) });
    }
  };

  const shown = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    return !q || [r.orderNumber, r.address, r.reference, r.notes, r.linesSummary].join(' ').toLowerCase().includes(q);
  });
  const dirtyCount = rows.filter((r) => r.dirty).length;

  if (loading) return <Skeleton className="h-64" />;
  if (loadError) return <Alert variant="error">{loadError}</Alert>;

  const head = [
    t('Order', 'الطلب'),
    isInbound ? t('Expected arrival', 'تاريخ الوصول المتوقع') : t('Ship date', 'تاريخ الشحن'),
    ...(isInbound ? [] : [t('Destination address', 'عنوان الوجهة')]),
    t('Reference', 'مرجعك'), t('Product (SKU)', 'المنتج'), t('Qty', 'الكمية'), t('Notes', 'ملاحظات'), '',
  ];

  return (
    <div className="space-y-3">
      <Alert variant="info">
        {t(
          'Edit orders here until the warehouse approves them. After approval an order leaves this sheet and only the warehouse can change it. To change the products of an existing order, delete it and add it again.',
          'عدّل الطلبات هنا حتى يوافق عليها المخزن. بعد الموافقة يخرج الطلب من هذه الصفحة ولا يعدله إلا المخزن. لتغيير منتجات طلب موجود احذفه وأضفه من جديد.',
        )}
      </Alert>
      <div className="flex flex-wrap items-center gap-2">
        <input className="rounded-md border px-3 py-1.5 text-sm" placeholder={t('Search…', 'بحث…')} value={search} onChange={(e) => setSearch(e.target.value)} />
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
            ) : shown.map((r) => (
              <tr key={r.key} className={r.error ? 'bg-red-50 dark:bg-red-950/20' : r.saved ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}>
                <td className={`${cell} whitespace-nowrap px-2 text-sm`}>
                  {r.orderNumber ?? t('New', 'جديد')}
                  {r.status ? <div className="text-xs text-neutral-500">{r.status.replace(/_/g, ' ')}</div> : null}
                </td>
                <td className={cell}><input className={input} type="date" value={r.date} onChange={(e) => patch(r.key, { date: e.target.value })} /></td>
                {isInbound ? null : (
                  <td className={cell}><input className={input} value={r.address} onChange={(e) => patch(r.key, { address: e.target.value })} /></td>
                )}
                <td className={cell}><input className={input} value={r.reference} onChange={(e) => patch(r.key, { reference: e.target.value })} /></td>
                {r.id ? (
                  <td className={`${cell} px-2 text-sm`} colSpan={2}>{r.linesSummary}</td>
                ) : (
                  <>
                    <td className={cell}>
                      <select className={input} value={r.productId} onChange={(e) => patch(r.key, { productId: e.target.value })}>
                        <option value="">—</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
                      </select>
                    </td>
                    <td className={cell}><input className={input} type="number" min="1" value={r.quantity} onChange={(e) => patch(r.key, { quantity: e.target.value })} /></td>
                  </>
                )}
                <td className={cell}><input className={input} value={r.notes} onChange={(e) => patch(r.key, { notes: e.target.value })} /></td>
                <td className={`${cell} whitespace-nowrap px-1`}>
                  <Button type="button" variant="ghost" onClick={() => void removeRow(r)}>{r.id ? t('Delete', 'حذف') : t('Remove', 'إزالة')}</Button>
                  {r.error ? <div className="max-w-[14rem] whitespace-normal px-1 pb-1 text-xs text-red-600">{r.error}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
