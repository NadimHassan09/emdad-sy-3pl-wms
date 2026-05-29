import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { LocationsApi } from '../../api/locations';
import {
  ReturnsApi,
  type ReturnItemCondition,
  type ReturnItemDisposition,
  type ReturnOrderLine,
} from '../../api/returns';
import { Button } from '../../components/Button';
import { Combobox } from '../../components/Combobox';
import { PageHeader } from '../../components/PageHeader';
import { SelectField } from '../../components/SelectField';
import { StatusBadge } from '../../components/StatusBadge';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import {
  canPostDisposition,
  dispositionLabel,
  locationTypesForDisposition,
} from '../../lib/return-labels';
import { isOperatorRole } from '../../lib/rbac';
import { useAuth } from '../../auth/AuthContext';

const CONDITIONS: ReturnItemCondition[] = ['new', 'good', 'damaged', 'unusable'];
const DISPOSITIONS: ReturnItemDisposition[] = [
  'restock',
  'quarantine',
  'damaged',
  'discard',
  'inspection_required',
];

const conditionOptions = CONDITIONS.map((c) => ({ value: c, label: c }));

function lineNeedsWork(line: ReturnOrderLine): boolean {
  if (line.lineStatus === 'posted') return false;
  const expected = Number(line.expectedQuantity);
  const received = Number(line.receivedQuantity);
  if (received < expected) return true;
  if (line.lineStatus === 'received' || line.lineStatus === 'pending') return received > 0;
  if (line.lineStatus === 'inspected') {
    return !line.disposition || line.disposition === 'inspection_required' || canPostDisposition(line.disposition);
  }
  return true;
}

function nextWorkLine(lines: ReturnOrderLine[]): ReturnOrderLine | null {
  return lines.find(lineNeedsWork) ?? lines.find((l) => l.lineStatus !== 'posted') ?? lines[0] ?? null;
}

export function ReturnProcessPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const isOperator = isOperatorRole(user?.role);
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState('');
  const [condition, setCondition] = useState<ReturnItemCondition>('good');
  const [disposition, setDisposition] = useState<ReturnItemDisposition>('inspection_required');
  const [targetLocationId, setTargetLocationId] = useState('');
  const [inspectionNotes, setInspectionNotes] = useState('');

  const detail = useQuery({
    queryKey: QK.returns.detail(id),
    queryFn: () => ReturnsApi.get(id),
    enabled: !!id,
  });

  const order = detail.data;
  const warehouseId = order?.warehouseId ?? order?.warehouse?.id ?? '';

  const locations = useQuery({
    queryKey: QK.locationsFlat(warehouseId, false),
    queryFn: () => LocationsApi.list(warehouseId, false),
    enabled: !!warehouseId,
    staleTime: 5 * 60_000,
  });

  const startReceivingMut = useMutation({
    mutationFn: () => ReturnsApi.startReceiving(id),
    onSuccess: (data) => {
      qc.setQueryData(QK.returns.detail(id), data);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!order || startReceivingMut.isPending || startReceivingMut.isSuccess) return;
    if (order.status === 'confirmed') {
      startReceivingMut.mutate();
    }
  }, [order?.status]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.returns.detail(id) });
    qc.invalidateQueries({ queryKey: QK.returns.all });
  };

  const receiveMut = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) =>
      ReturnsApi.receiveLine(id, lineId, { quantity, condition }),
    onSuccess: () => {
      toast.success(t('Quantity received.', 'تم استلام الكمية.'));
      setReceiveQty('');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inspectMut = useMutation({
    mutationFn: (lineId: string) =>
      ReturnsApi.inspectLine(id, lineId, {
        condition,
        disposition,
        targetLocationId: targetLocationId || undefined,
        inspectionNotes: inspectionNotes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t('Inspection saved.', 'تم حفظ الفحص.'));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const postLineMut = useMutation({
    mutationFn: (lineId: string) =>
      ReturnsApi.applyDisposition(id, lineId, {
        disposition,
        targetLocationId: targetLocationId || undefined,
      }),
    onSuccess: () => {
      toast.success(t('Inventory posted for line.', 'تم ترحيل مخزون البند.'));
      invalidate();
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.ledger });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const postAllMut = useMutation({
    mutationFn: () => ReturnsApi.postInventory(id),
    onSuccess: () => {
      toast.success(t('Batch inventory posted.', 'تم ترحيل المخزون دفعة.'));
      invalidate();
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.ledger });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeMut = useMutation({
    mutationFn: () => ReturnsApi.complete(id),
    onSuccess: () => {
      toast.success(t('Return completed.', 'اكتمل الإرجاع.'));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lines = order?.lines ?? [];
  const activeLine = useMemo(() => {
    if (activeLineId) return lines.find((l) => l.id === activeLineId) ?? nextWorkLine(lines);
    return nextWorkLine(lines);
  }, [lines, activeLineId]);

  useEffect(() => {
    if (!activeLine) return;
    const remaining =
      Number(activeLine.expectedQuantity) - Number(activeLine.receivedQuantity);
    if (remaining > 0) setReceiveQty(String(remaining));
    if (activeLine.disposition) setDisposition(activeLine.disposition);
    if (activeLine.targetLocationId) setTargetLocationId(activeLine.targetLocationId);
  }, [activeLine?.id, activeLine?.receivedQuantity]);

  const locationOptions = useMemo(() => {
    const types = locationTypesForDisposition(disposition);
    const locs = (locations.data ?? []).filter(
      (loc) => types.length === 0 || types.includes(loc.type),
    );
    return [
      { value: '', label: t('Select location…', 'اختر الموقع…') },
      ...locs.map((l) => ({
        value: l.id,
        label: `${l.fullPath} (${l.type})`,
      })),
    ];
  }, [locations.data, disposition, isArabic]);

  const busy =
    receiveMut.isPending ||
    inspectMut.isPending ||
    postLineMut.isPending ||
    postAllMut.isPending ||
    completeMut.isPending ||
    startReceivingMut.isPending;

  const progressPct = useMemo(() => {
    if (lines.length === 0) return 0;
    const done = lines.filter((l) => l.lineStatus === 'posted').length;
    return Math.round((done / lines.length) * 100);
  }, [lines]);

  if (detail.isLoading || startReceivingMut.isPending) {
    return <p className="text-sm text-slate-500">{t('Loading…', 'جاري التحميل…')}</p>;
  }

  if (!order) {
    return <p className="text-sm text-red-600">{t('Return not found.', 'الإرجاع غير موجود.')}</p>;
  }

  if (order.status === 'draft' || order.status === 'completed' || order.status === 'cancelled') {
    return (
      <div>
        <PageHeader
          title={t('Process return', 'معالجة الإرجاع')}
          description={order.orderNumber}
          actions={
            <Link to={`/returns/${id}`}>
              <Button variant="ghost">{t('Details', 'التفاصيل')}</Button>
            </Link>
          }
        />
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {t(
            'Confirm the return before processing, or view a completed return on the detail page.',
            'أكد الإرجاع قبل المعالجة، أو اعرض الإرجاع المكتمل من صفحة التفاصيل.',
          )}
        </p>
      </div>
    );
  }

  const stepReceive =
    activeLine &&
    Number(activeLine.receivedQuantity) < Number(activeLine.expectedQuantity);
  const stepInspect =
    activeLine &&
    !stepReceive &&
    activeLine.lineStatus !== 'posted' &&
    (activeLine.lineStatus === 'received' ||
      activeLine.lineStatus === 'pending' ||
      (activeLine.lineStatus === 'inspected' &&
        activeLine.disposition === 'inspection_required'));
  const stepPost =
    activeLine &&
    !stepReceive &&
    !stepInspect &&
    activeLine.lineStatus === 'inspected' &&
    !!activeLine.disposition &&
    canPostDisposition(activeLine.disposition);

  const submitReceive = () => {
    if (!activeLine) return;
    const q = Number(receiveQty);
    if (!Number.isFinite(q) || q <= 0) {
      toast.error(t('Enter a valid quantity.', 'أدخل كمية صحيحة.'));
      return;
    }
    receiveMut.mutate({ lineId: activeLine.id, quantity: q });
  };

  return (
    <div className="pb-32 sm:pb-10">
      <PageHeader
        title={t('Process return', 'معالجة الإرجاع')}
        description={`${order.orderNumber} · ${progressPct}%`}
        actions={
          <Link to={`/returns/${id}`}>
            <Button variant="ghost">{t('Details', 'التفاصيل')}</Button>
          </Link>
        }
      />

      <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-sky-600 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {lines.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setActiveLineId(l.id)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs ${
              activeLine?.id === l.id
                ? 'border-sky-600 bg-sky-50'
                : 'border-slate-200 bg-white'
            }`}
          >
            <span className="font-mono font-semibold">{l.product.sku}</span>
            <div className="mt-1">
              <StatusBadge status={l.lineStatus} />
            </div>
          </button>
        ))}
      </div>

      {activeLine ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">{activeLine.product.name}</h2>
          <p className="font-mono text-xs text-slate-500">
            {activeLine.product.sku} · {t('Expected', 'متوقع')}{' '}
            {Number(activeLine.expectedQuantity)} · {t('Received', 'مستلم')}{' '}
            {Number(activeLine.receivedQuantity)}
          </p>

          {stepReceive ? (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('1 · Receive', '1 · استلام')}
              </p>
              <TextField
                label={t('Quantity to receive', 'كمية الاستلام')}
                type="number"
                min={0}
                value={receiveQty}
                onChange={(e) => setReceiveQty(e.target.value)}
              />
              <SelectField
                label={t('Condition (optional)', 'الحالة (اختياري)')}
                value={condition}
                onChange={(e) => setCondition(e.target.value as ReturnItemCondition)}
                options={conditionOptions}
              />
              <Button variant="primary" className="w-full sm:w-auto" disabled={busy} onClick={submitReceive}>
                {t('Receive', 'استلام')}
              </Button>
            </div>
          ) : null}

          {stepInspect ? (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('2 · Inspect', '2 · فحص')}
              </p>
              <SelectField
                label={t('Condition', 'الحالة')}
                value={condition}
                onChange={(e) => setCondition(e.target.value as ReturnItemCondition)}
                options={conditionOptions}
              />
              <SelectField
                label={t('Disposition', 'التصرف')}
                value={disposition}
                onChange={(e) => {
                  setDisposition(e.target.value as ReturnItemDisposition);
                  setTargetLocationId('');
                }}
                options={DISPOSITIONS.map((d) => ({
                  value: d,
                  label: dispositionLabel(d, isArabic),
                }))}
              />
              {canPostDisposition(disposition) ? (
                <Combobox
                  label={t('Target location', 'الموقع المستهدف')}
                  value={targetLocationId}
                  onChange={setTargetLocationId}
                  options={locationOptions}
                />
              ) : null}
              <TextField
                label={t('Inspection notes', 'ملاحظات الفحص')}
                value={inspectionNotes}
                onChange={(e) => setInspectionNotes(e.target.value)}
              />
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                disabled={busy}
                onClick={() => inspectMut.mutate(activeLine.id)}
              >
                {t('Save inspection', 'حفظ الفحص')}
              </Button>
            </div>
          ) : null}

          {stepPost ? (
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t('3 · Post inventory', '3 · ترحيل المخزون')}
              </p>
              <p className="text-sm text-slate-600">
                {dispositionLabel(activeLine.disposition, isArabic)} →{' '}
                {activeLine.targetLocation?.fullPath ?? t('pick location', 'اختر موقع')}
              </p>
              {!activeLine.targetLocationId && canPostDisposition(disposition) ? (
                <Combobox
                  label={t('Target location', 'الموقع المستهدف')}
                  value={targetLocationId}
                  onChange={setTargetLocationId}
                  options={locationOptions}
                />
              ) : null}
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                disabled={busy}
                onClick={() => postLineMut.mutate(activeLine.id)}
              >
                {t('Post line', 'ترحيل البند')}
              </Button>
            </div>
          ) : null}

          {activeLine.lineStatus === 'posted' ? (
            <p className="mt-4 text-sm text-emerald-800">{t('Line complete.', 'اكتمل البند.')}</p>
          ) : null}
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-lg flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-end">
          {!isOperator ? (
            <Button variant="ghost" disabled={busy} onClick={() => postAllMut.mutate()}>
              {t('Post all eligible', 'ترحيل الكل المؤهل')}
            </Button>
          ) : null}
          {!isOperator ? (
            <Button variant="primary" disabled={busy} onClick={() => completeMut.mutate()}>
              {t('Complete return', 'إكمال الإرجاع')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
