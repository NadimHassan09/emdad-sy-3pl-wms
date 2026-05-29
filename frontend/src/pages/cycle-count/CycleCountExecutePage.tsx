import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  CycleCountApi,
  type BlindCycleCountLocationLine,
  type BlindCycleCountProductGroup,
} from '../../api/cycle-count';
import { BarcodeScanModal } from '../../components/BarcodeScanModal';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { useAuth } from '../../auth/AuthContext';
import { QK } from '../../constants/query-keys';
import { canExecuteCycleCount } from '../../lib/rbac';

function nextPendingLine(products: BlindCycleCountProductGroup[]): {
  product: BlindCycleCountProductGroup;
  line: BlindCycleCountLocationLine;
} | null {
  for (const p of products) {
    const line = p.locations.find((l) => l.status === 'pending');
    if (line) return { product: p, line };
  }
  return null;
}

export function CycleCountExecutePage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const canExecute = canExecuteCycleCount(user);
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);

  const taskQuery = useQuery({
    queryKey: QK.cycleCount.execution(id),
    queryFn: () => CycleCountApi.getExecutionTask(id),
    enabled: !!id && canExecute,
  });

  const claimMut = useMutation({
    mutationFn: () => CycleCountApi.claimExecutionTask(id),
    onSuccess: (data) => {
      qc.setQueryData(QK.cycleCount.execution(id), data);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!taskQuery.data || claimMut.isPending || claimMut.isSuccess) return;
    if (taskQuery.data.status === 'scheduled') {
      claimMut.mutate();
    }
  }, [taskQuery.data?.status]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: QK.cycleCount.execution(id) });
    qc.invalidateQueries({ queryKey: QK.cycleCount.myTasks('') });
    qc.invalidateQueries({ queryKey: QK.cycleCount.all });
  }, [qc, id]);

  const countLineMut = useMutation({
    mutationFn: ({ lineId, actualQuantity }: { lineId: string; actualQuantity: string }) =>
      CycleCountApi.submitLineCount(id, lineId, actualQuantity, notes.trim() || undefined),
    onSuccess: () => {
      setQty('');
      setNotes('');
      invalidate();
      toast.success(t('Count saved.', 'تم حفظ العد.'));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const skipMut = useMutation({
    mutationFn: (lineId: string) =>
      CycleCountApi.skipLine(id, lineId, notes.trim() || undefined),
    onSuccess: () => {
      setQty('');
      setNotes('');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finishMut = useMutation({
    mutationFn: () => CycleCountApi.finishTask(id),
    onSuccess: () => {
      toast.success(t('Submitted for review.', 'أُرسل للمراجعة.'));
      invalidate();
      navigate(`/cycle-count/${id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const task = taskQuery.data;
  const products = task?.products ?? [];

  const activeProduct = useMemo(() => {
    if (activeProductId) {
      return products.find((p) => p.productId === activeProductId) ?? products[0];
    }
    return nextPendingLine(products)?.product ?? products[0];
  }, [products, activeProductId]);

  const activeLine = useMemo(() => {
    if (!activeProduct) return null;
    return activeProduct.locations.find((l) => l.status === 'pending') ?? activeProduct.locations[0];
  }, [activeProduct]);

  const progressPct = task
    ? Math.round(
        ((task.progress.counted + task.progress.skipped) / Math.max(task.progress.totalLines, 1)) * 100,
      )
    : 0;

  const handleScan = (code: string) => {
    const c = code.trim().toLowerCase();
    if (!c) return;
    const match = products.find(
      (p) =>
        p.sku.toLowerCase() === c ||
        p.barcode?.toLowerCase() === c ||
        p.locations.some((l) => l.location.barcode.toLowerCase() === c),
    );
    if (match) {
      setActiveProductId(match.productId);
      setScanOpen(false);
      toast.success(t('Product selected.', 'تم اختيار المنتج.'));
      return;
    }
    toast.error(t('No matching product or location.', 'لا منتج أو موقع مطابق.'));
  };

  const submitCurrent = () => {
    if (!activeLine || activeLine.status !== 'pending') return;
    const trimmed = qty.trim();
    if (trimmed === '' || Number(trimmed) < 0 || !Number.isFinite(Number(trimmed))) {
      toast.error(t('Enter a valid quantity.', 'أدخل كمية صحيحة.'));
      return;
    }
    countLineMut.mutate({ lineId: activeLine.lineId, actualQuantity: trimmed });
  };

  if (!canExecute) {
    return (
      <div>
        <PageHeader
          title={t('Count execution', 'تنفيذ الجرد')}
          description={t('Worker profile required', 'يتطلب ملف عامل')}
          actions={
            <Link to="/cycle-count">
              <Button variant="ghost">{t('Dashboard', 'لوحة الجرد')}</Button>
            </Link>
          }
        />
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {t(
            'Your account is not linked to a Worker profile. Use a warehouse operator account to execute blind counts.',
            'حسابك غير مرتبط بملف عامل. استخدم حساب مشغل مستودع لتنفيذ الجرد الأعمى.',
          )}
        </p>
      </div>
    );
  }

  if (taskQuery.isLoading) {
    return <p className="text-sm text-slate-500">{t('Loading…', 'جاري التحميل…')}</p>;
  }

  if (!task) {
    return <p className="text-sm text-red-600">{t('Task not found.', 'المهمة غير موجودة.')}</p>;
  }

  const busy = countLineMut.isPending || skipMut.isPending || finishMut.isPending;

  return (
    <div className="pb-28 sm:pb-8">
      <PageHeader
        title={t('Count execution', 'تنفيذ الجرد')}
        description={`${task.warehouse.code} · ${task.progress.totalLines - task.progress.pending}/${task.progress.totalLines}`}
        actions={
          <Link to={`/cycle-count/${id}`}>
            <Button variant="ghost">{t('Details', 'التفاصيل')}</Button>
          </Link>
        }
      />

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <StatusBadge status={task.status} />
          <span className="font-mono text-xs text-slate-600">{progressPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-emerald-600 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {t('Blind count — expected quantities are hidden.', 'جرد أعمى — الكميات المتوقعة مخفية.')}
        </p>
      </div>

      <div className="mb-3 flex gap-2">
        <Button variant="secondary" className="min-h-[44px] flex-1" onClick={() => setScanOpen(true)}>
          {t('Scan barcode', 'مسح باركود')}
        </Button>
      </div>

      {activeProduct && activeLine ? (
        <div className="mb-4 rounded-lg border-2 border-slate-800 bg-white p-4 shadow-sm">
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">{t('Product', 'المنتج')}</div>
          <div className="text-lg font-semibold text-slate-900">{activeProduct.name}</div>
          <div className="font-mono text-sm text-slate-600">{activeProduct.sku}</div>
          {activeProduct.barcode ? (
            <div className="mt-1 font-mono text-xs text-slate-500">{activeProduct.barcode}</div>
          ) : null}

          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="text-xs uppercase text-slate-500">{t('Location', 'الموقع')}</div>
            <div className="font-mono text-sm font-medium">{activeLine.location.fullPath}</div>
            <div className="font-mono text-[11px] text-slate-500">{activeLine.location.barcode}</div>
            {activeLine.lot ? (
              <div className="mt-1 text-xs text-slate-600">
                {t('Lot', 'دفعة')}: {activeLine.lot.lotNumber}
              </div>
            ) : null}
            <div className="mt-2">
              <StatusBadge status={activeLine.status} />
            </div>
          </div>

          {activeLine.status === 'pending' ? (
            <div className="mt-4 space-y-3">
              <TextField
                label={t('Counted quantity', 'الكمية المعدودة')}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="text-lg"
                autoFocus
              />
              <TextField
                label={t('Notes (optional)', 'ملاحظات')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-600">
              {t('Counted', 'معد')}:{' '}
              <span className="font-mono font-semibold">{activeLine.actualQuantity ?? '—'}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-emerald-700">{t('All locations counted.', 'تم عد كل المواقع.')}</p>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-800">{t('Products', 'المنتجات')}</h2>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {products.map((p) => (
            <li key={p.productId}>
              <button
                type="button"
                className={`flex w-full items-center justify-between px-3 py-3 text-left hover:bg-slate-50 ${
                  activeProduct?.productId === p.productId ? 'bg-slate-50' : ''
                }`}
                onClick={() => setActiveProductId(p.productId)}
              >
                <div>
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="font-mono text-[11px] text-slate-500">{p.sku}</div>
                </div>
                <span className="font-mono text-xs text-slate-600">
                  {p.completedCount}/{p.locations.length}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <div className="mx-auto flex max-w-3xl gap-2">
          {activeLine?.status === 'pending' ? (
            <>
              <Button
                variant="ghost"
                className="min-h-[48px] flex-1"
                disabled={busy}
                onClick={() => skipMut.mutate(activeLine.lineId)}
              >
                {t('Skip', 'تخطي')}
              </Button>
              <Button
                variant="primary"
                className="min-h-[48px] flex-[2]"
                disabled={busy}
                loading={countLineMut.isPending}
                onClick={submitCurrent}
              >
                {t('Save count', 'حفظ العد')}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              className="min-h-[48px] w-full"
              disabled={busy || task.progress.pending > 0}
              onClick={() => setFinishOpen(true)}
            >
              {t('Finish & submit', 'إنهاء وإرسال')}
            </Button>
          )}
        </div>
      </div>

      <BarcodeScanModal open={scanOpen} onClose={() => setScanOpen(false)} onScan={handleScan} />

      <ConfirmModal
        open={finishOpen}
        title={t('Submit count for review?', 'إرسال الجرد للمراجعة؟')}
        confirmLabel={t('Submit', 'إرسال')}
        loading={finishMut.isPending}
        onConfirm={() => finishMut.mutate()}
        onClose={() => setFinishOpen(false)}
      >
        {t(
          'Supervisor will review discrepancies before inventory is adjusted.',
          'سيراجع المشرف الفروقات قبل تعديل المخزون.',
        )}
      </ConfirmModal>
    </div>
  );
}
