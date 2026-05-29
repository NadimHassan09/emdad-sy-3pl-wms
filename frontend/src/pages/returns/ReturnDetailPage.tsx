import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  ReturnsApi,
  type ReturnOrder,
  type ReturnOrderLine,
} from '../../api/returns';
import { Button } from '../../components/Button';
import { Column, DataTable } from '../../components/DataTable';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/ToastProvider';
import { QK } from '../../constants/query-keys';
import { dispositionLabel } from '../../lib/return-labels';
import { isOperatorRole } from '../../lib/rbac';
import { useAuth } from '../../auth/AuthContext';

function formatDt(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReturnDetailPage() {
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
  const locale = isArabic ? 'ar-SY' : 'en-GB';

  const [cancelOpen, setCancelOpen] = useState(false);

  const detail = useQuery({
    queryKey: QK.returns.detail(id),
    queryFn: () => ReturnsApi.get(id),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: QK.returns.detail(id) });
    qc.invalidateQueries({ queryKey: QK.returns.all });
  };

  const confirmMut = useMutation({
    mutationFn: () => ReturnsApi.confirm(id),
    onSuccess: () => {
      toast.success(t('Return confirmed.', 'تم تأكيد الإرجاع.'));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startReceivingMut = useMutation({
    mutationFn: () => ReturnsApi.startReceiving(id),
    onSuccess: () => {
      toast.success(t('Receiving started.', 'بدأ الاستلام.'));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const postMut = useMutation({
    mutationFn: () => ReturnsApi.postInventory(id),
    onSuccess: () => {
      toast.success(t('Inventory posted for eligible lines.', 'تم ترحيل المخزون للبنود المؤهلة.'));
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
      navigate('/returns');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => ReturnsApi.cancel(id),
    onSuccess: () => {
      toast.success(t('Return cancelled.', 'أُلغي الإرجاع.'));
      setCancelOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const order = detail.data;
  const busy =
    confirmMut.isPending ||
    startReceivingMut.isPending ||
    postMut.isPending ||
    completeMut.isPending ||
    cancelMut.isPending;

  const canProcess =
    order &&
    (order.status === 'confirmed' ||
      order.status === 'receiving' ||
      order.status === 'inspecting');

  const lineCols: Column<ReturnOrderLine>[] = useMemo(
    () => [
      {
        header: t('SKU', 'SKU'),
        accessor: (l) => <span className="font-mono text-xs">{l.product.sku}</span>,
        width: '100px',
      },
      {
        header: t('Product', 'المنتج'),
        accessor: (l) => l.product.name,
        width: '140px',
      },
      {
        header: t('Expected', 'المتوقع'),
        accessor: (l) => (
          <span className="font-mono text-xs">{Number(l.expectedQuantity).toLocaleString()}</span>
        ),
        width: '72px',
        className: 'text-right',
      },
      {
        header: t('Received', 'مستلم'),
        accessor: (l) => (
          <span className="font-mono text-xs">{Number(l.receivedQuantity).toLocaleString()}</span>
        ),
        width: '72px',
        className: 'text-right',
      },
      {
        header: t('Posted', 'مرحّل'),
        accessor: (l) => (
          <span className="font-mono text-xs">{Number(l.postedQuantity).toLocaleString()}</span>
        ),
        width: '72px',
        className: 'text-right',
      },
      {
        header: t('Line', 'البند'),
        accessor: (l) => <StatusBadge status={l.lineStatus} />,
        width: '96px',
      },
      {
        header: t('Disposition', 'التصرف'),
        accessor: (l) => (
          <span className="text-xs">{dispositionLabel(l.disposition, isArabic)}</span>
        ),
        width: '120px',
      },
      {
        header: t('Location', 'الموقع'),
        accessor: (l) => (
          <span className="font-mono text-[10px]" title={l.targetLocation?.fullPath}>
            {l.targetLocation?.fullPath ?? '—'}
          </span>
        ),
        width: '140px',
      },
    ],
    [isArabic],
  );

  if (detail.isLoading) {
    return <p className="text-sm text-slate-500">{t('Loading…', 'جاري التحميل…')}</p>;
  }

  if (!order) {
    return <p className="text-sm text-red-600">{t('Return not found.', 'الإرجاع غير موجود.')}</p>;
  }

  const summary = (o: ReturnOrder) => (
    <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <span className="text-xs text-slate-500">{t('Client', 'العميل')}</span>
        <p className="font-medium">{o.company.name}</p>
      </div>
      <div>
        <span className="text-xs text-slate-500">{t('Warehouse', 'المستودع')}</span>
        <p className="font-medium">{o.warehouse?.code ?? '—'}</p>
      </div>
      <div>
        <span className="text-xs text-slate-500">{t('Outbound', 'الصادر')}</span>
        <p>
          {o.originalOutbound ? (
            <Link
              to={`/orders/outbound/${o.originalOutbound.id}`}
              className="font-mono text-sky-800 hover:underline"
            >
              {o.originalOutbound.orderNumber}
            </Link>
          ) : (
            '—'
          )}
        </p>
      </div>
      <div>
        <span className="text-xs text-slate-500">{t('Status', 'الحالة')}</span>
        <p>
          <StatusBadge status={o.status} />
        </p>
      </div>
      {o.notes ? (
        <div className="sm:col-span-2 lg:col-span-4">
          <span className="text-xs text-slate-500">{t('Notes', 'ملاحظات')}</span>
          <p className="whitespace-pre-wrap">{o.notes}</p>
        </div>
      ) : null}
      <div>
        <span className="text-xs text-slate-500">{t('Created', 'أُنشئ')}</span>
        <p>{formatDt(o.createdAt, locale)}</p>
      </div>
      <div>
        <span className="text-xs text-slate-500">{t('Completed', 'اكتمل')}</span>
        <p>{formatDt(o.completedAt, locale)}</p>
      </div>
    </div>
  );

  return (
    <div className="pb-8">
      <PageHeader
        title={order.orderNumber}
        description={order.company.name}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/returns">
              <Button variant="ghost">{t('Back', 'رجوع')}</Button>
            </Link>
            {canProcess ? (
              <Link to={`/returns/${id}/process`}>
                <Button variant="primary">{t('Process', 'معالجة')}</Button>
              </Link>
            ) : null}
            {order.status === 'draft' && !isOperator ? (
              <Button variant="primary" disabled={busy} onClick={() => confirmMut.mutate()}>
                {t('Confirm', 'تأكيد')}
              </Button>
            ) : null}
            {order.status === 'confirmed' ? (
              <Button variant="ghost" disabled={busy} onClick={() => startReceivingMut.mutate()}>
                {t('Start receiving', 'بدء الاستلام')}
              </Button>
            ) : null}
            {!isOperator &&
            (order.status === 'receiving' || order.status === 'inspecting') ? (
              <>
                <Button variant="ghost" disabled={busy} onClick={() => postMut.mutate()}>
                  {t('Post inventory', 'ترحيل المخزون')}
                </Button>
                <Button variant="primary" disabled={busy} onClick={() => completeMut.mutate()}>
                  {t('Complete', 'إكمال')}
                </Button>
              </>
            ) : null}
            {order.status === 'draft' ? (
              <Button variant="ghost" disabled={busy} onClick={() => setCancelOpen(true)}>
                {t('Cancel', 'إلغاء')}
              </Button>
            ) : null}
          </div>
        }
      />

      {summary(order)}

      <h2 className="mb-2 text-sm font-semibold text-slate-800">{t('Lines', 'البنود')}</h2>
      <DataTable columns={lineCols} rows={order.lines} rowKey={(l) => l.id} />

      <ConfirmModal
        open={cancelOpen}
        title={t('Cancel return?', 'إلغاء الإرجاع؟')}
        confirmLabel={t('Cancel return', 'إلغاء الإرجاع')}
        danger
        onConfirm={() => cancelMut.mutate()}
        onClose={() => setCancelOpen(false)}
        loading={cancelMut.isPending}
      >
        {t(
          'Only draft returns with no received quantity can be cancelled.',
          'يمكن إلغاء مسودات الإرجاع دون كميات مستلمة فقط.',
        )}
      </ConfirmModal>
    </div>
  );
}
