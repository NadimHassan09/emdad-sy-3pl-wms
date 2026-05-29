import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  CycleCountApi,
  type CycleCountLine,
  type CycleCountVariance,
  type VarianceReasonCode,
} from '../../api/cycle-count';
import { Button } from '../../components/Button';
import { Column, DataTable } from '../../components/DataTable';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PageHeader } from '../../components/PageHeader';
import { SelectField } from '../../components/SelectField';
import { StatusBadge } from '../../components/StatusBadge';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { canExecuteCycleCount, isOperatorRole } from '../../lib/rbac';
import { useAuth } from '../../auth/AuthContext';

const REASON_LABELS: Record<VarianceReasonCode, string> = {
  damaged: 'Damaged',
  lost: 'Lost',
  misplaced: 'Misplaced',
  theft_suspected: 'Theft suspected',
  counting_mistake: 'Counting mistake',
  operational_correction: 'Operational correction',
  unknown: 'Unknown',
};

export function CycleCountDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const isOperator = isOperatorRole(user?.role);
  const isArabic =
    typeof window !== 'undefined' &&
    (window.localStorage.getItem('wms-ui-language') === 'AR' || document.documentElement.dir === 'rtl');
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  const [reviewTarget, setReviewTarget] = useState<CycleCountVariance | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewReason, setReviewReason] = useState<VarianceReasonCode>('unknown');
  const [reviewNotes, setReviewNotes] = useState('');

  const detail = useQuery({
    queryKey: QK.cycleCount.detail(id),
    queryFn: () => CycleCountApi.getCount(id),
    enabled: !!id,
  });

  const variances = useQuery({
    queryKey: QK.cycleCount.variances(id),
    queryFn: () => CycleCountApi.listCountVariances(id),
    enabled: !!id,
  });

  const reasonCodes = useQuery({
    queryKey: QK.cycleCount.reasonCodes,
    queryFn: () => CycleCountApi.listReasonCodes(),
    staleTime: 60 * 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.cycleCount.detail(id) });
    qc.invalidateQueries({ queryKey: QK.cycleCount.variances(id) });
    qc.invalidateQueries({ queryKey: QK.cycleCount.all });
  };

  const completeMut = useMutation({
    mutationFn: () => CycleCountApi.complete(id),
    onSuccess: () => {
      toast.success(t('Cycle count completed.', 'اكتمل الجرد.'));
      invalidate();
      navigate('/cycle-count');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reconcileMut = useMutation({
    mutationFn: () => CycleCountApi.buildReconciliation(id),
    onSuccess: () => {
      toast.success(t('Reconciliation draft created.', 'تم إنشاء مسودة التسوية.'));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const postMut = useMutation({
    mutationFn: () => CycleCountApi.postReconciliation(id),
    onSuccess: (r) => {
      toast.success(t(`Posted ${r.variancesPosted} variance(s).`, `تم ترحيل ${r.variancesPosted} فرق.`));
      invalidate();
      qc.invalidateQueries({ queryKey: QK.inventoryStock });
      qc.invalidateQueries({ queryKey: QK.ledger });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewMut = useMutation({
    mutationFn: () =>
      CycleCountApi.reviewVariance(reviewTarget!.id, {
        action: reviewAction,
        reasonCode: reviewAction === 'approve' ? reviewReason : reviewReason,
        reviewNotes: reviewNotes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t('Variance updated.', 'تم تحديث الفرق.'));
      setReviewTarget(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const count = detail.data;
  const canExecute =
    canExecuteCycleCount(user) &&
    count &&
    (count.status === 'scheduled' || count.status === 'in_progress');
  const canReconcile = count?.status === 'pending_review' && !isOperator;
  const canComplete = count?.status === 'pending_review' && !isOperator;

  const lineCols: Column<CycleCountLine>[] = useMemo(
    () => [
      { header: t('Product', 'المنتج'), accessor: (l) => l.product.name, width: '160px' },
      {
        header: t('SKU', 'SKU'),
        accessor: (l) => <span className="font-mono text-xs">{l.product.sku}</span>,
        width: '100px',
      },
      {
        header: t('Location', 'الموقع'),
        accessor: (l) => (
          <span className="font-mono text-[11px]" title={l.location.fullPath}>
            {l.location.fullPath}
          </span>
        ),
        width: '180px',
      },
      {
        header: t('Expected', 'المتوقع'),
        accessor: (l) => (
          <span className="font-mono text-xs">{Number(l.expectedQuantity).toLocaleString()}</span>
        ),
        width: '88px',
        className: 'text-right',
      },
      {
        header: t('Actual', 'الفعلي'),
        accessor: (l) =>
          l.actualQuantity != null ? (
            <span className="font-mono text-xs">{Number(l.actualQuantity).toLocaleString()}</span>
          ) : (
            '—'
          ),
        width: '88px',
        className: 'text-right',
      },
      {
        header: t('Variance', 'الفرق'),
        accessor: (l) => {
          if (l.discrepancyQuantity == null) return '—';
          const n = Number(l.discrepancyQuantity);
          return (
            <span className={`font-mono text-xs ${n !== 0 ? 'font-semibold text-amber-800' : ''}`}>
              {n > 0 ? '+' : ''}
              {n.toLocaleString()}
            </span>
          );
        },
        width: '80px',
        className: 'text-right',
      },
      {
        header: t('Line status', 'حالة البند'),
        accessor: (l) => <StatusBadge status={l.status} />,
        width: '100px',
      },
    ],
    [isArabic],
  );

  const varianceCols: Column<CycleCountVariance>[] = useMemo(
    () => [
      {
        header: t('Product', 'المنتج'),
        accessor: (v) => v.product.sku,
        width: '100px',
      },
      {
        header: t('Location', 'الموقع'),
        accessor: (v) => v.location.fullPath,
        width: '160px',
      },
      {
        header: t('Variance', 'الفرق'),
        accessor: (v) => (
          <span className="font-mono text-xs font-semibold text-amber-800">
            {Number(v.discrepancyQuantity).toLocaleString()}
          </span>
        ),
        width: '80px',
        className: 'text-right',
      },
      {
        header: t('Status', 'الحالة'),
        accessor: (v) => <StatusBadge status={v.status} />,
        width: '120px',
      },
      {
        header: t('Reason', 'السبب'),
        accessor: (v) => (v.reasonCode ? REASON_LABELS[v.reasonCode] : '—'),
        width: '140px',
      },
      {
        header: t('Actions', 'إجراء'),
        accessor: (v) =>
          v.status === 'pending_review' && !isOperator ? (
            <div className="flex gap-1">
              <Button
                variant="secondary"
                className="!px-2 !py-1 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setReviewTarget(v);
                  setReviewAction('approve');
                  setReviewReason('unknown');
                  setReviewNotes('');
                }}
              >
                {t('Approve', 'موافقة')}
              </Button>
              <Button
                variant="ghost"
                className="!px-2 !py-1 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setReviewTarget(v);
                  setReviewAction('reject');
                  setReviewReason('counting_mistake');
                  setReviewNotes('');
                }}
              >
                {t('Reject', 'رفض')}
              </Button>
            </div>
          ) : (
            '—'
          ),
        width: '160px',
      },
    ],
    [isArabic, isOperator],
  );

  if (detail.isLoading) {
    return <p className="text-sm text-slate-500">{t('Loading…', 'جاري التحميل…')}</p>;
  }

  if (!count) {
    return <p className="text-sm text-red-600">{t('Cycle count not found.', 'الجرد غير موجود.')}</p>;
  }

  return (
    <div>
      <PageHeader
        title={t('Cycle count', 'الجرد')}
        description={`${count.warehouse.code} · ${count.company.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/cycle-count">
              <Button variant="ghost">{t('Back', 'رجوع')}</Button>
            </Link>
            {canExecute ? (
              <Link to={`/cycle-count/${id}/execute`}>
                <Button variant="primary">{t('Execute count', 'تنفيذ الجرد')}</Button>
              </Link>
            ) : null}
            {canReconcile ? (
              <>
                <Button variant="secondary" onClick={() => reconcileMut.mutate()} disabled={reconcileMut.isPending}>
                  {t('Build reconciliation', 'إنشاء تسوية')}
                </Button>
                <Button variant="secondary" onClick={() => postMut.mutate()} disabled={postMut.isPending}>
                  {t('Post reconciliation', 'ترحيل التسوية')}
                </Button>
              </>
            ) : null}
            {canComplete ? (
              <Button variant="primary" onClick={() => completeMut.mutate()} disabled={completeMut.isPending}>
                {t('Complete count', 'إكمال الجرد')}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-[11px] uppercase text-slate-500">{t('Status', 'الحالة')}</div>
          <div className="mt-1">
            <StatusBadge status={count.status} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-[11px] uppercase text-slate-500">{t('Lines', 'البنود')}</div>
          <div className="mt-1 font-mono text-lg">{count.lines.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-[11px] uppercase text-slate-500">{t('Assigned', 'المكلف')}</div>
          <div className="mt-1 text-sm">{count.assignedWorker?.displayName ?? '—'}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-[11px] uppercase text-slate-500">{t('Snapshot', 'اللقطة')}</div>
          <div className="mt-1 text-sm">
            {count.snapshotAt ? new Date(count.snapshotAt).toLocaleString() : '—'}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-[11px] uppercase text-slate-500">{t('Interval', 'الفترة')}</div>
          <div className="mt-1 text-sm">
            {count.schedule?.intervalDays ? `${count.schedule.intervalDays}d` : '—'}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-[11px] uppercase text-slate-500">{t('Blind count', 'جرد أعمى')}</div>
          <div className="mt-1 text-sm">{count.blindCount ? t('Yes', 'نعم') : t('No', 'لا')}</div>
        </div>
      </div>

      {(variances.data?.length ?? 0) > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">
            {t('Variances', 'الفروقات')} ({variances.data?.length})
          </h2>
          <DataTable<CycleCountVariance>
            columns={varianceCols}
            rows={variances.data ?? []}
            loading={variances.isLoading}
            rowKey={(v) => v.id}
          />
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-800">{t('Count lines', 'بنود الجرد')}</h2>
        <DataTable<CycleCountLine> columns={lineCols} rows={count.lines} rowKey={(l) => l.id} />
      </section>

      <ConfirmModal
        open={!!reviewTarget}
        title={reviewAction === 'approve' ? t('Approve variance', 'الموافقة على الفرق') : t('Reject variance', 'رفض الفرق')}
        confirmLabel={t('Confirm', 'تأكيد')}
        loading={reviewMut.isPending}
        onConfirm={() => reviewMut.mutate()}
        onClose={() => setReviewTarget(null)}
      >
        <div className="space-y-3">
          <p>{t('Set reason code and optional notes.', 'حدد سبب الفرق وملاحظات اختيارية.')}</p>
          {reviewAction === 'approve' ? (
            <SelectField
              label={t('Reason code', 'رمز السبب')}
              name="reason"
              value={reviewReason}
              onChange={(e) => setReviewReason(e.target.value as VarianceReasonCode)}
              options={(reasonCodes.data?.codes ?? []).map((c) => ({
                value: c,
                label: REASON_LABELS[c] ?? c,
              }))}
            />
          ) : null}
          <TextField
            label={t('Notes', 'ملاحظات')}
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
          />
        </div>
      </ConfirmModal>
    </div>
  );
}
