import type { ReactElement } from 'react';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert, Card, Skeleton, StatusBadge } from '@ds';

import { ClientOrderTrackingPanel } from '../components/ClientOrderTrackingPanel';
import {
  clientOmsCommercialStatusBadgeKey,
  clientOmsCommercialStatusLabel,
  mapClientOmsCommercialDisplayStatus,
} from '../lib/client-oms-commercial-status';
import { isClientArabic } from '../lib/client-ui-language';
import {
  cancelClientOmsOrder,
  confirmClientOmsOrder,
  fetchClientOmsOrder,
  fetchClientOmsTimeline,
  revertCancelClientOmsOrder,
} from '../services/clientOmsOrdersService';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function labelText(label: string, isArabic: boolean): string {
  if (!isArabic) return label;
  const ar: Record<string, string> = {
    'Back to online orders': 'العودة إلى الطلبات الإلكترونية',
    'Online order not found.': 'الطلب الإلكتروني غير موجود.',
    'Could not load this order. Please try again.': 'تعذر تحميل هذا الطلب. حاول مرة أخرى.',
    'Loading order…': 'جاري تحميل الطلب…',
    Rejected: 'مرفوض',
    'Recipient & shipping': 'المستلم والشحن',
    'Incomplete Order': 'طلب غير مكتمل',
    'Shipping/Delivery information is incomplete.': 'معلومات الشحن/التوصيل غير مكتملة.',
    Recipient: 'المستلم',
    Phone: 'الهاتف',
    Address: 'العنوان',
    City: 'المدينة',
    District: 'المنطقة',
    Carrier: 'شركة الشحن',
    Tracking: 'رقم التتبع',
    'Line items': 'بنود الطلب',
    '#': '#',
    SKU: 'SKU',
    Product: 'المنتج',
    Qty: 'الكمية',
    Price: 'السعر',
    'Line total': 'الإجمالي',
    Notes: 'ملاحظات',
    'Order details': 'تفاصيل الطلب',
    'Order #': 'رقم الطلب',
    'Required ship': 'تاريخ الشحن المطلوب',
    Created: 'تاريخ الإنشاء',
    'Warehouse status': 'حالة المستودع',
    'Pricing & COD': 'التسعير والتحصيل',
    Payment: 'طريقة الدفع',
    'Shipping fee': 'رسوم الشحن',
    Subtotal: 'الإجمالي الفرعي',
    'COD status': 'حالة التحصيل',
  };
  return ar[label] ?? label;
}

export function EcommerceOrderDetailPage(): ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const isArabic = isClientArabic();
  const t = (label: string) => labelText(label, isArabic);
  const qc = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ['client', 'ecommerce-orders', id],
    queryFn: () => fetchClientOmsOrder(id),
    enabled: !!id,
  });

  const timelineQuery = useQuery({
    queryKey: ['client', 'ecommerce-orders', id, 'timeline'],
    queryFn: () => fetchClientOmsTimeline(id),
    enabled: !!id,
  });

  const confirmMut = useMutation({
    mutationFn: () => confirmClientOmsOrder(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client', 'ecommerce-orders', id] });
      void qc.invalidateQueries({ queryKey: ['client', 'ecommerce-orders'] });
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelClientOmsOrder(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client', 'ecommerce-orders', id] });
      void qc.invalidateQueries({ queryKey: ['client', 'ecommerce-orders'] });
    },
  });

  const undoCancelMut = useMutation({
    mutationFn: () => revertCancelClientOmsOrder(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client', 'ecommerce-orders', id] });
      void qc.invalidateQueries({ queryKey: ['client', 'ecommerce-orders'] });
    },
  });

  const data = orderQuery.data
    ? {
        ...orderQuery.data,
        timeline: timelineQuery.data ?? orderQuery.data.timeline,
      }
    : undefined;

  const commercial = data ? mapClientOmsCommercialDisplayStatus(data.status) : null;
  const rawStatus = data?.status ?? '';
  // Client may cancel only before admin approval (confirm + waiting-for-admin stages).
  // After admin approval (processing+), only warehouse/admin can cancel.
  const canConfirm =
    rawStatus === 'waiting_for_confirmation' || commercial === 'waiting_for_confirmation';
  const canCancel =
    rawStatus === 'waiting_for_confirmation' ||
    rawStatus === 'confirmed_waiting_for_admin_approval' ||
    rawStatus === 'pending_approval';
  const canUndoCancel = Boolean(data?.canRevertCancel);
  const undoToLabel = data?.revertCancelToStatus
    ? clientOmsCommercialStatusLabel(data.revertCancelToStatus, isArabic)
    : null;

  const notFound =
    orderQuery.error &&
    isAxiosError(orderQuery.error) &&
    orderQuery.error.response?.status === 404;

  return (
    <div className="space-y-5 animate-enter" dir={isArabic ? 'rtl' : 'ltr'}>
      <Link
        to="/ecommerce-orders"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <i
          className={`fa-solid ${isArabic ? 'fa-arrow-right' : 'fa-arrow-left'} text-xs`}
          aria-hidden="true"
        />
        {t('Back to online orders')}
      </Link>

      {notFound ? (
        <Alert variant="error" title={t('Online order not found.')} />
      ) : orderQuery.error ? (
        <Alert variant="error" title={t('Could not load this order. Please try again.')} />
      ) : null}

      {orderQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton height={28} width="40%" />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Skeleton height={180} />
              <Skeleton height={220} />
            </div>
            <div className="space-y-4">
              <Skeleton height={160} />
              <Skeleton height={140} />
            </div>
          </div>
        </div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-text-strong font-mono">
                {data.orderNumber || data.id.slice(0, 8)}
              </h1>
              <StatusBadge status={clientOmsCommercialStatusBadgeKey(data.status)} isArabic={isArabic}>
                {clientOmsCommercialStatusLabel(data.status, isArabic)}
              </StatusBadge>
              {data.needsInformation ? (
                <StatusBadge status="failed delivery" isArabic={isArabic}>
                  {t('Incomplete Order')}
                </StatusBadge>
              ) : null}
            </div>
            {canConfirm || canCancel || canUndoCancel ? (
              <div className="flex flex-wrap items-center gap-2">
                {canConfirm ? (
                  <button
                    type="button"
                    disabled={confirmMut.isPending}
                    onClick={() => confirmMut.mutate()}
                    className="rounded-lg border border-success-600 bg-success-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:border-success-700 hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isArabic ? 'تأكيد الطلب' : 'Confirm order'}
                  </button>
                ) : null}
                {canCancel ? (
                  <button
                    type="button"
                    disabled={cancelMut.isPending}
                    onClick={() => cancelMut.mutate()}
                    className="rounded-lg border border-danger-600 bg-danger-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:border-danger-700 hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isArabic ? 'إلغاء الطلب' : 'Cancel order'}
                  </button>
                ) : null}
                {canUndoCancel ? (
                  <button
                    type="button"
                    disabled={undoCancelMut.isPending}
                    onClick={() => {
                      const msg = undoToLabel
                        ? isArabic
                          ? `التراجع عن الإلغاء وإرجاع الطلب إلى ${undoToLabel}؟`
                          : `Undo cancel and restore this order to ${undoToLabel}?`
                        : isArabic
                          ? 'التراجع عن الإلغاء وإرجاع الطلب لحالته السابقة؟'
                          : 'Undo cancel and restore this order to its previous status?';
                      if (!window.confirm(msg)) return;
                      undoCancelMut.mutate();
                    }}
                    className="rounded-lg border border-border-strong bg-surface-card px-3.5 py-2 text-sm font-semibold text-text-strong shadow-sm transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isArabic ? 'التراجع عن الإلغاء' : 'Undo Cancel'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {confirmMut.isError || cancelMut.isError || undoCancelMut.isError ? (
            <Alert
              variant="error"
              title={
                (confirmMut.error as Error | null)?.message ||
                (cancelMut.error as Error | null)?.message ||
                (undoCancelMut.error as Error | null)?.message ||
                (isArabic ? 'تعذر تنفيذ الإجراء' : 'Action failed')
              }
            />
          ) : null}

          {data.rejectionReason ? (
            <Alert variant="error" title={`${t('Rejected')}: ${data.rejectionReason}`} />
          ) : null}

          {data.needsInformation ? (
            <Alert variant="warning" title={t('Incomplete Order')}>
              {t('Shipping/Delivery information is incomplete.')}
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <Card padding="none">
                <Card.Header>
                  <Card.Title>{t('Recipient & shipping')}</Card.Title>
                </Card.Header>
                <Card.Body>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <DetailRow label={t('Recipient')} value={data.recipientName} />
                    <DetailRow label={t('Phone')} value={data.recipientPhone} />
                    <DetailRow
                      label={t('Address')}
                      value={data.addressLine1 ?? data.destinationAddress}
                      className="sm:col-span-2"
                      preWrap
                    />
                    {data.city ? <DetailRow label={t('City')} value={data.city} /> : null}
                    {data.district ? <DetailRow label={t('District')} value={data.district} /> : null}
                    {data.carrier ? <DetailRow label={t('Carrier')} value={data.carrier} /> : null}
                    {data.trackingNumber ? (
                      <DetailRow label={t('Tracking')} value={data.trackingNumber} />
                    ) : null}
                  </dl>
                </Card.Body>
              </Card>

              <Card padding="none" className="overflow-hidden">
                <Card.Header>
                  <Card.Title>{t('Line items')}</Card.Title>
                  <span className="text-xs font-medium text-text-muted">
                    {data.lines.length} {isArabic ? 'بند' : data.lines.length === 1 ? 'item' : 'items'}
                  </span>
                </Card.Header>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-card-muted text-xs uppercase text-text-muted font-semibold">
                      <tr>
                        <th className="px-4 py-2.5 text-left">{t('#')}</th>
                        <th className="px-4 py-2.5 text-left">{t('SKU')}</th>
                        <th className="px-4 py-2.5 text-left">{t('Product')}</th>
                        <th className="px-4 py-2.5 text-right">{t('Qty')}</th>
                        <th className="px-4 py-2.5 text-right">{t('Price')}</th>
                        <th className="px-4 py-2.5 text-right">{t('Line total')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {data.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-4 py-2.5 text-text-muted">{line.lineNumber}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-text-muted">
                            {line.product?.sku ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-text-strong">
                            {line.product?.name ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-text-body">
                            {line.requestedQuantity}
                          </td>
                          <td className="px-4 py-2.5 text-right text-text-body">
                            {line.unitPrice ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-text-strong">
                            {line.lineTotal ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {data.notes ? (
                <Card padding="none">
                  <Card.Header>
                    <Card.Title>{t('Notes')}</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <p className="whitespace-pre-wrap text-sm text-text-body">{data.notes}</p>
                  </Card.Body>
                </Card>
              ) : null}
            </div>

            <div className="space-y-5">
              <Card padding="none">
                <Card.Header>
                  <Card.Title>{t('Order details')}</Card.Title>
                </Card.Header>
                <Card.Body>
                  <dl className="space-y-3">
                    <DetailRow label={t('Order #')} value={data.orderNumber} mono />
                    <DetailRow label={t('Required ship')} value={formatDate(data.requiredShipDate)} />
                    <DetailRow label={t('Created')} value={formatDateTime(data.createdAt)} />
                    {data.warehouseStatus ? (
                      <DetailRow label={t('Warehouse status')} value={data.warehouseStatus} />
                    ) : null}
                  </dl>
                </Card.Body>
              </Card>

              {data.paymentMethod || data.subtotal || data.shippingFee ? (
                <Card padding="none">
                  <Card.Header>
                    <Card.Title>{t('Pricing & COD')}</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    <dl className="space-y-3">
                      {data.paymentMethod ? (
                        <DetailRow label={t('Payment')} value={data.paymentMethod} />
                      ) : null}
                      {data.shippingFee ? (
                        <DetailRow
                          label={t('Shipping fee')}
                          value={`${data.shippingFee} ${data.currency ?? ''}`.trim()}
                        />
                      ) : null}
                      {data.subtotal ? (
                        <DetailRow
                          label={t('Subtotal')}
                          value={`${data.subtotal} ${data.currency ?? ''}`.trim()}
                          strong
                        />
                      ) : null}
                      {data.codStatus ? (
                        <DetailRow label={t('COD status')} value={data.codStatus} />
                      ) : null}
                    </dl>
                  </Card.Body>
                </Card>
              ) : null}
            </div>
          </div>

          <ClientOrderTrackingPanel order={data} />
        </>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  className,
  mono,
  strong,
  preWrap,
}: {
  label: string;
  value?: string | null;
  className?: string;
  mono?: boolean;
  strong?: boolean;
  preWrap?: boolean;
}): ReactElement {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-sm text-text-strong ${mono ? 'font-mono' : ''} ${
          strong ? 'font-semibold' : ''
        } ${preWrap ? 'whitespace-pre-wrap' : ''}`}
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}

export default EcommerceOrderDetailPage;
