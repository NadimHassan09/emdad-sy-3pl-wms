import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { Alert, Card, ListPageHeader, Skeleton } from '@ds';
import { api } from '../api/client';
import { CodApi, OmsApi, OmsReturnsApi } from '../api/oms';
import { OmsOrderFormModal } from '../components/oms/OmsOrderFormModal';
import { CreateOmsReturnModal } from '../components/oms/CreateOmsReturnModal';
import { OmsOrderTrackingPanel } from '../components/oms/OmsOrderTrackingPanel';
import { OmsShipmentMovementPanel } from '../components/oms/OmsShipmentMovementPanel';
import { OmsStatusBadge } from '../components/oms/OmsStatusBadge';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { Modal } from '../components/Modal';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../auth/AuthContext';
import { OmsEditShippingFeeModal } from '../components/oms/OmsEditShippingFeeModal';
import { CancelShipmentModal } from '../components/oms/CancelShipmentModal';
import { QK } from '../constants/query-keys';
import {
  mapOmsCommercialDisplayStatus,
  omsCommercialStatusLabel,
} from '../lib/oms-commercial-status';
import { isOmsAdminCancellableStatus } from '../lib/oms-order-cancel';
import { isOmsOrderDeletable } from '../lib/oms-order-delete';
import { isOmsReturnEligibleStatus } from '../lib/oms-return-eligibility';
import { orderOperationalStage, orderMainStatus } from '../lib/oms-operational-stage';

type CarrierCostView = {
  carrierQuote: string | null;
  carrierQuoteCurrency: string | null;
  shipments: Array<{
    id: string;
    providerCode: string;
    actualCost: string | null;
    actualCostCurrency: string | null;
    history: Array<{
      id: string;
      previousAmount: string | null;
      previousCurrency: string | null;
      amount: string;
      currency: string | null;
      source: string;
      eventAt: string | null;
    }>;
  }>;
};

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className="mt-0.5 text-sm text-text-strong">{value}</div>
    </div>
  );
}

function fmtMoney(value: string | null | undefined, currency?: string | null): string {
  if (!value) return '—';
  return `${value}${currency ? ` ${currency}` : ''}`;
}

export function OmsOrderDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [undoCancelOpen, setUndoCancelOpen] = useState(false);
  const [cancelShipmentOpen, setCancelShipmentOpen] = useState(false);
  const [rollbackOfdOpen, setRollbackOfdOpen] = useState(false);
  const [rollbackReadyOpen, setRollbackReadyOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [shippingFeeAfterOpen, setShippingFeeAfterOpen] = useState(false);
  const [editShippingFeeOpen, setEditShippingFeeOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  const [shippingFeeAfter, setShippingFeeAfter] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [revertReason, setRevertReason] = useState('');

  const openShippingFeeRequested = Boolean((location.state as { openShippingFee?: boolean } | null)?.openShippingFee);
  const autoOpenedShippingFeeModalRef = useRef(false);

  const orderQuery = useQuery({
    queryKey: [...QK.omsOrders, id],
    queryFn: () => OmsApi.getOrder(id),
    enabled: !!id,
  });

  const codQuery = useQuery({
    queryKey: ['cod-by-order', id],
    queryFn: () => CodApi.byOrder(id),
    enabled: !!id,
  });

  const canSeeCarrierCost =
    user?.role === 'super_admin' || user?.role === 'wh_manager' || user?.role === 'finance';
  const canSeeCarrierHistory = user?.role === 'super_admin' || user?.role === 'wh_manager';
  const carrierCostQuery = useQuery({
    queryKey: ['carrier-costs', id],
    queryFn: () =>
      api.get<CarrierCostView>(`/shipping/orders/${id}/carrier-costs`).then((response) => response.data),
    enabled: !!id && canSeeCarrierHistory,
  });

  const returnsQuery = useQuery({
    queryKey: ['oms-returns', 'by-order', id],
    queryFn: () => OmsReturnsApi.list({ omsOrderId: id, limit: 20 }),
    enabled: !!id,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: [...QK.omsOrders, id] });
    void qc.invalidateQueries({ queryKey: QK.omsOrders });
    void qc.invalidateQueries({ queryKey: QK.omsDashboard });
    void qc.invalidateQueries({ queryKey: ['cod-by-order', id] });
    void qc.invalidateQueries({ queryKey: ['oms-returns', 'by-order', id] });
  };

  const deleteMut = useMutation({
    mutationFn: () => OmsApi.delete(id),
    onSuccess: () => {
      toast.success('OMS order deleted.');
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
      navigate('/orders/oms');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: () => OmsApi.approve(id),
    onSuccess: () => {
      toast.success('Order approved.');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setShippingFeeAfterMut = useMutation({
    mutationFn: () => {
      const fee = shippingFeeAfter.trim();
      if (!fee) throw new Error('Enter a shipping fee.');
      return OmsApi.update(id, { shippingFee: Number(fee) });
    },
    onSuccess: () => {
      toast.success('Shipping fee updated.');
      setShippingFeeAfterOpen(false);
      setShippingFeeAfter('');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: () => OmsApi.reject(id, rejectReason.trim() || undefined),
    onSuccess: () => {
      toast.success('Order rejected.');
      setRejectOpen(false);
      setRejectReason('');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => OmsApi.cancel(id),
    onSuccess: () => {
      toast.success('Order cancelled.');
      setCancelOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const undoCancelMut = useMutation({
    mutationFn: () => OmsApi.revertCancel(id),
    onSuccess: () => {
      toast.success('Cancellation undone.');
      setUndoCancelOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deliveredMut = useMutation({
    mutationFn: () => OmsApi.delivered(id),
    onSuccess: () => {
      toast.success('Order marked delivered.');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resumeOfdMut = useMutation({
    mutationFn: () => OmsApi.outForDelivery(id),
    onSuccess: () => {
      toast.success('Order resumed out for delivery.');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmReceiptMut = useMutation({
    mutationFn: () => OmsApi.confirmReturnReceipt(id),
    onSuccess: () => {
      toast.success('Return receipt confirmed. Stock updated once.');
      invalidate();
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const failedDeliveryMut = useMutation({
    mutationFn: () => OmsApi.failedDelivery(id),
    onSuccess: () => {
      toast.success('Order marked as failed delivery.');
      invalidate();
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const returnedMut = useMutation({
    mutationFn: () => OmsApi.returned(id),
    onSuccess: () => {
      toast.success('Return coordinated. Stock is unchanged until the warehouse confirms receipt.');
      invalidate();
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rollbackReturnMut = useMutation({
    mutationFn: (targetStatus: 'out_for_delivery' | 'ready_to_ship') =>
      OmsApi.rollbackReturn(id, { targetStatus }),
    onSuccess: (res) => {
      toast.success(res.message || 'Return rolled back successfully.');
      setRollbackOfdOpen(false);
      setRollbackReadyOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const undoReturnMut = useMutation({
    mutationFn: () => OmsApi.undoConfirmedReturn(id),
    onSuccess: () => {
      toast.success('Confirmed return undone. Order is ready to ship.');
      invalidate();
      void qc.invalidateQueries({ queryKey: ['oms-returns'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const confirmMut = useMutation({
    mutationFn: () => OmsApi.confirm(id),
    onSuccess: () => {
      toast.success('Order confirmed (waiting for admin approval).');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revertDeliveryMut = useMutation({
    mutationFn: () => OmsApi.revertDelivery(id, revertReason.trim()),
    onSuccess: () => {
      toast.success('Delivery reverted to shipped.');
      setRevertOpen(false);
      setRevertReason('');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retryCodMut = useMutation({
    mutationFn: () => CodApi.retryGeneration(id),
    onSuccess: () => {
      toast.success('COD generation retried.');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const order = orderQuery.data;
  const commercial = order ? mapOmsCommercialDisplayStatus(order.status) : null;

  // Auto-open the "Specify shipping fee" modal when coming from the /orders/oms row actions.
  // Must be declared before any early-return (loading/error) paths to keep React hook order stable.
  // Auto-open the shipping fee adjustment modal when coming with openShippingFee in navigation state.
  useEffect(() => {
    if (!openShippingFeeRequested) return;
    if (autoOpenedShippingFeeModalRef.current) return;
    if (!order) return;
    setEditShippingFeeOpen(true);
    autoOpenedShippingFeeModalRef.current = true;
  }, [openShippingFeeRequested, order]);

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-5 animate-enter">
        <Link
          to="/orders/oms"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
        >
          <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
          Back to OMS orders
        </Link>
        <Card className="p-5 sm:p-6">
          <div className="space-y-4" aria-busy="true">
            <Skeleton height={28} width="40%" />
            <Skeleton height={140} />
          </div>
        </Card>
      </div>
    );
  }
  if (orderQuery.isError || !order) {
    return (
      <div className="space-y-5 animate-enter">
        <Link
          to="/orders/oms"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
        >
          <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
          Back to OMS orders
        </Link>
        <Alert variant="error" title="Could not load OMS order." />
      </div>
    );
  }

  const total = order.total ?? order.subtotal ?? null;
  const outboundId = order.linkedOutboundOrder?.id ?? order.outboundOrderId;
  const canConfirm =
    commercial === 'waiting_for_confirmation';
  const canApprove =
    commercial === 'confirmed_waiting_for_admin_approval' && !order.needsInformation;
  const canReject =
    commercial === 'confirmed_waiting_for_admin_approval' ||
    commercial === 'waiting_for_confirmation';
  const canEditCommercial =
    commercial === 'waiting_for_confirmation' ||
    commercial === 'confirmed_waiting_for_admin_approval' ||
    commercial === 'processing';
  const canMarkDelivered =
    commercial === 'shipped' || order.status === 'failed_delivery';
  const canResumeOutForDelivery = order.status === 'failed_delivery';
  const canMarkFailedDelivery =
    commercial === 'shipped' || order.status === 'out_for_delivery';
  const canMarkReturned = order.status === 'failed_delivery';
  const canConfirmReturnReceipt = order.status === 'return_pending_receipt';
  const canUndoConfirmedReturn = user?.role === 'super_admin' && order.status === 'returned';
  const stage = order ? orderOperationalStage(order) : null;
  const canCancelShipment = order.status === 'ready_to_ship' && stage === 'shipping_confirmation';
  const canRollbackReturn = order.status === 'returned';
  const canRevertDelivery = commercial === 'delivered';
  const canUndoCancel = Boolean(order.canRevertCancel);
  const canCancel = isOmsAdminCancellableStatus(order.status);
  const canCreateReturn = isOmsReturnEligibleStatus(order.status);
  const canDelete = isOmsOrderDeletable(order.status);
  const canRetryCod = order.codGenerationStatus === 'failed';
  const canEditShippingFee =
    !user ||
    user?.role === 'super_admin' ||
    user?.role === 'wh_manager' ||
    user?.role === 'admin' ||
    user?.authGroup === 'ADMIN';

  return (
    <div className="space-y-5 animate-enter">
      <Link
        to="/orders/oms"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-strong"
      >
        <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
        Back to OMS orders
      </Link>

      <ListPageHeader
        icon="fa-cart-shopping"
        title={`OMS ${order.orderNumber}`}
        subtitle={order.company?.name ?? undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            {order.status !== 'cancelled' ? (
              <Button
                variant="secondary"
                onClick={() => window.open(`/orders/oms/${order.id}/waybill`, '_blank')}
                className="gap-1.5 font-semibold"
              >
                <i className="fa-solid fa-file-invoice text-primary text-xs" aria-hidden="true" />
                <span>بوليصة الشحن (Waybill)</span>
              </Button>
            ) : null}
            {canConfirm ? (
              <Button loading={confirmMut.isPending} onClick={() => confirmMut.mutate()}>
                Confirm order
              </Button>
            ) : null}
            {canApprove ? (
              <Button loading={approveMut.isPending} onClick={() => approveMut.mutate()}>
                Approve
              </Button>
            ) : null}
            {canReject ? (
              <Button variant="secondary" onClick={() => setRejectOpen(true)}>
                Reject
              </Button>
            ) : null}
            {canCancelShipment ? (
              <Button
                variant="secondary"
                className="!border-rose-400 !text-rose-700 hover:!bg-rose-50 dark:!border-rose-800 dark:!text-rose-300 dark:hover:!bg-rose-950/30"
                onClick={() => setCancelShipmentOpen(true)}
              >
                <i className="fa-solid fa-ban mr-1.5 text-xs" aria-hidden="true" />
                Cancel Shipment
              </Button>
            ) : null}
            {canResumeOutForDelivery ? (
              <Button
                variant="secondary"
                loading={resumeOfdMut.isPending}
                onClick={() => resumeOfdMut.mutate()}
              >
                Out for delivery
              </Button>
            ) : null}
            {canMarkDelivered ? (
              <Button loading={deliveredMut.isPending} onClick={() => deliveredMut.mutate()}>
                Mark delivered
              </Button>
            ) : null}
            {canMarkFailedDelivery ? (
              <Button
                variant="secondary"
                loading={failedDeliveryMut.isPending}
                onClick={() => failedDeliveryMut.mutate()}
              >
                Field Delivery
              </Button>
            ) : null}
            {canMarkReturned ? (
              <Button
                variant="secondary"
                loading={returnedMut.isPending}
                onClick={() => returnedMut.mutate()}
              >
                Return pending receipt
              </Button>
            ) : null}
            {canConfirmReturnReceipt ? (
              <Button
                loading={confirmReceiptMut.isPending}
                onClick={() => confirmReceiptMut.mutate()}
              >
                Confirm return receipt
              </Button>
            ) : null}
            {canRollbackReturn ? (
              <>
                <Button
                  variant="secondary"
                  className="!border-blue-500 !text-blue-700 hover:!bg-blue-50 dark:!border-blue-700 dark:!text-blue-300"
                  onClick={() => setRollbackOfdOpen(true)}
                >
                  <i className="fa-solid fa-truck-fast mr-1.5 text-xs" aria-hidden="true" />
                  Rollback to Out for Delivery
                </Button>
                <Button
                  variant="secondary"
                  className="!border-indigo-500 !text-indigo-700 hover:!bg-indigo-50 dark:!border-indigo-700 dark:!text-indigo-300"
                  onClick={() => setRollbackReadyOpen(true)}
                >
                  <i className="fa-solid fa-box-archive mr-1.5 text-xs" aria-hidden="true" />
                  Rollback to Ready to Ship
                </Button>
              </>
            ) : null}
            {canUndoConfirmedReturn ? (
              <Button
                variant="secondary"
                loading={undoReturnMut.isPending}
                onClick={() => undoReturnMut.mutate()}
              >
                Undo confirmed return
              </Button>
            ) : null}
            {canRevertDelivery ? (
              <Button variant="secondary" onClick={() => setRevertOpen(true)}>
                Revert delivery
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                className="!border-danger-600 !bg-danger-600 !text-white hover:!border-danger-700 hover:!bg-danger-700"
                onClick={() => setCancelOpen(true)}
              >
                Cancel order
              </Button>
            ) : null}
            {canUndoCancel ? (
              <Button variant="secondary" onClick={() => setUndoCancelOpen(true)}>
                Undo Cancel
              </Button>
            ) : null}
            {canEditShippingFee ? (
              <Button
                variant="secondary"
                onClick={() => setEditShippingFeeOpen(true)}
              >
                <i className="fa-solid fa-pen text-xs me-1.5" aria-hidden="true" />
                Edit shipping fee
              </Button>
            ) : null}
            {canRetryCod ? (
              <Button
                variant="secondary"
                loading={retryCodMut.isPending}
                onClick={() => retryCodMut.mutate()}
              >
                Retry COD
              </Button>
            ) : null}
            {canCreateReturn ? (
              <Button variant="secondary" onClick={() => setReturnOpen(true)}>
                Create return
              </Button>
            ) : null}
            {outboundId ? (
              <Button variant="secondary" onClick={() => navigate(`/orders/outbound/${outboundId}`)}>
                Open outbound
              </Button>
            ) : null}
            {canEditCommercial ? (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <OmsStatusBadge status={orderMainStatus(order)} needsInformation={order.needsInformation} />
        {order.rejectionReason ? (
          <span className="rounded-full bg-status-error-bg px-2 py-0.5 text-xs font-medium text-status-error-fg">
            Rejected: {order.rejectionReason}
          </span>
        ) : null}
      </div>

      {order.needsInformation ? (
        <Alert variant="warning" title="Incomplete Order">
          Shipping/Delivery information is incomplete. Use Edit to complete Governorate, City / Region,
          and Town / Neighborhood before this order can be approved.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card padding="none">
            <Card.Header>
              <Card.Title>Recipient & shipping</Card.Title>
            </Card.Header>
            <Card.Body className="px-4 py-4 sm:px-5">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Field label="Recipient" value={order.recipientName ?? '—'} />
                <Field label="Phone" value={order.recipientPhone ?? '—'} />
                <Field label="Governorate" value={order.city ?? '—'} />
                <Field label="City / Region" value={order.district ?? '—'} />
                <Field label="Town / Neighborhood" value={order.addressLine1 ?? '—'} />
                <Field
                  label="Detailed Address"
                  value={order.addressLine2 || order.destinationAddress || '—'}
                />
                <Field
                  label="Carrier"
                  value={order.shippingCarrierName || order.carrier || '—'}
                />
                <Field
                  label="Tracking"
                  value={
                    order.awbPending
                      ? 'Carrier AWB pending'
                      : order.trackingNumber ?? '—'
                  }
                />
                {order.cancellationUnconfirmed ? (
                  <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                    Babel did not return this shipment. Cancellation is not confirmed; the current carrier and AWB stay assigned.
                  </div>
                ) : null}
                {order.deliveryInstructions ? (
                  <div className="sm:col-span-2">
                    <Field label="Instructions" value={order.deliveryInstructions} />
                  </div>
                ) : null}
              </div>
            </Card.Body>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <Card.Header>
              <Card.Title>Line items</Card.Title>
              <span className="text-xs font-medium text-text-muted">
                {order.lines.length} {order.lines.length === 1 ? 'item' : 'items'}
              </span>
            </Card.Header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-card-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-2.5 text-left">#</th>
                    <th className="px-4 py-2.5 text-left">SKU</th>
                    <th className="px-4 py-2.5 text-left">Product</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Price</th>
                    <th className="px-4 py-2.5 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {order.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-2.5 text-text-muted">{line.lineNumber}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-text-muted">
                        {line.product?.sku ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-text-strong">
                        {line.product?.name ?? line.productId}
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

          <Card padding="none" className="overflow-hidden">
            <Card.Header>
              <div>
                <Card.Title>Inbound Traceability</Card.Title>
                <p className="mt-0.5 text-xs text-text-muted">
                  Source inbound receipts supplying inventory for this order
                </p>
              </div>
              <span className="text-xs font-medium text-text-muted">
                {(order.inboundTraceability ?? []).length}{' '}
                {(order.inboundTraceability ?? []).length === 1 ? 'source' : 'sources'}
              </span>
            </Card.Header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-card-muted text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Product</th>
                    <th className="px-4 py-2.5 text-left">SKU</th>
                    <th className="px-4 py-2.5 text-left">Source Inbound Order</th>
                    <th className="px-4 py-2.5 text-right">Quantity Used</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {(order.inboundTraceability ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-text-muted">
                        No inbound traceability records recorded for this order.
                      </td>
                    </tr>
                  ) : (
                    (order.inboundTraceability ?? []).map((item, idx) => (
                      <tr key={item.id ?? `${item.productId}-${item.inboundOrderId ?? idx}`}>
                        <td className="px-4 py-2.5 font-medium text-text-strong">
                          {item.productName}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-text-muted">
                          {item.productSku}
                        </td>
                        <td className="px-4 py-2.5">
                          {item.inboundOrderId && item.inboundOrderNumber ? (
                            <Link
                              to={`/orders/inbound/${item.inboundOrderId}`}
                              className="font-medium text-brand-700 hover:underline dark:text-brand-400"
                            >
                              {item.inboundOrderNumber}
                            </Link>
                          ) : (
                            <span className="text-xs italic text-text-muted">
                              {item.status === 'source_not_recorded'
                                ? 'Source not recorded'
                                : 'Not yet allocated'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-text-body">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              item.status === 'fulfilled'
                                ? 'bg-status-success-bg text-status-success-fg'
                                : item.status === 'allocated'
                                  ? 'bg-status-info-bg text-status-info-fg'
                                  : 'bg-surface-card-muted text-text-muted'
                            }`}
                          >
                            {item.status === 'fulfilled'
                              ? 'Fulfilled'
                              : item.status === 'allocated'
                                ? 'Allocated'
                                : item.status === 'source_not_recorded'
                                  ? 'Unrecorded'
                                  : 'Unfulfilled'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {order.notes ? (
            <Card padding="none">
              <Card.Header>
                <Card.Title>Notes</Card.Title>
              </Card.Header>
              <Card.Body className="px-4 py-4 sm:px-5">
                <p className="whitespace-pre-wrap text-sm text-text-body">{order.notes}</p>
              </Card.Body>
            </Card>
          ) : null}

          <Card padding="none">
            <Card.Header>
              <Card.Title>Returns</Card.Title>
            </Card.Header>
            <Card.Body className="px-4 py-4 sm:px-5">
              {(returnsQuery.data?.items ?? []).length === 0 ? (
                <p className="text-sm text-text-muted">
                  {canCreateReturn
                    ? 'No returns yet. Use Create return to open a return request.'
                    : 'No returns for this order.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle text-left text-xs uppercase text-text-muted">
                        <th className="px-2 py-2">Return #</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Reason</th>
                        <th className="px-2 py-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(returnsQuery.data?.items ?? []).map((ret) => (
                        <tr key={ret.id} className="border-b border-border-subtle">
                          <td className="px-2 py-2">
                            <Link
                              to={`/oms/returns/${ret.id}`}
                              className="font-medium text-brand-700 hover:underline"
                            >
                              {ret.returnNumber}
                            </Link>
                          </td>
                          <td className="px-2 py-2">{ret.status.replace(/_/g, ' ')}</td>
                          <td className="px-2 py-2">{ret.reason ?? '—'}</td>
                          <td className="px-2 py-2">
                            {new Date(ret.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>

        <div className="space-y-5">
          <Card padding="none">
            <Card.Header>
              <Card.Title>Order details</Card.Title>
            </Card.Header>
            <Card.Body className="px-4 py-4 sm:px-5">
              <div className="space-y-3">
                <Field label="Order #" value={order.orderNumber} />
                {outboundId ? (
                  <Field
                    label="Outbound Order"
                    value={
                      <Link
                        to={`/orders/outbound/${outboundId}`}
                        className="font-medium text-brand-700 hover:underline dark:text-brand-400"
                      >
                        {order.linkedOutboundOrder?.orderNumber ?? outboundId}
                      </Link>
                    }
                  />
                ) : null}
                <Field label="Client" value={order.company?.name ?? '—'} />
                <Field label="Client reference" value={order.clientReference ?? '—'} />
                <Field
                  label="Required ship"
                  value={new Date(order.requiredShipDate).toLocaleDateString()}
                />
                <Field
                  label="Submitted"
                  value={
                    order.submittedAt ? new Date(order.submittedAt).toLocaleString() : '—'
                  }
                />
                <Field
                  label="Created"
                  value={new Date(order.createdAt).toLocaleString()}
                />
                {order.warehouseStatus ? (
                  <Field label="Warehouse status" value={order.warehouseStatus} />
                ) : null}
              </div>
            </Card.Body>
          </Card>

          <Card padding="none">
            <Card.Header>
              <Card.Title>Pricing & COD</Card.Title>
            </Card.Header>
            <Card.Body className="px-4 py-4 sm:px-5">
              <div className="space-y-3">
                <Field label="Payment" value={order.paymentMethod ?? '—'} />
                <Field
                  label="Client shipping rate"
                  value={
                    <div className="flex items-center justify-end gap-2">
                      <span>{fmtMoney(order.shippingFee, order.currency)}</span>
                      {canEditShippingFee ? (
                        <button
                          type="button"
                          onClick={() => setEditShippingFeeOpen(true)}
                          className="inline-flex items-center gap-1 rounded border border-border-subtle bg-white px-2 py-0.5 text-xs font-semibold text-text-strong shadow-2xs hover:bg-surface-hover"
                        >
                          <i className="fa-solid fa-pen text-[10px]" aria-hidden="true" />
                          Edit
                        </button>
                      ) : null}
                    </div>
                  }
                />
                {canSeeCarrierCost ? (
                  <Field
                    label="Carrier quote"
                    value={fmtMoney(
                      carrierCostQuery.data?.carrierQuote ??
                        (order.linkedOutboundOrder?.shippingQuotedPrice != null
                          ? String(order.linkedOutboundOrder.shippingQuotedPrice)
                          : null),
                      carrierCostQuery.data?.carrierQuoteCurrency ??
                        order.linkedOutboundOrder?.shippingQuotedCurrency,
                    )}
                  />
                ) : null}
                {canSeeCarrierCost ? (
                  <Field
                    label="Actual carrier cost"
                    value={fmtMoney(
                      order.linkedOutboundOrder?.shippingCost != null
                        ? String(order.linkedOutboundOrder.shippingCost)
                        : null,
                      order.linkedOutboundOrder?.shippingCostCurrency,
                    )}
                  />
                ) : null}
                <Field
                  label="Subtotal"
                  value={
                    <span className="font-semibold">
                      {fmtMoney(order.subtotal ?? total, order.currency)}
                    </span>
                  }
                />
                <Field label="COD amount" value={fmtMoney(order.codAmount, order.currency)} />
                <Field label="Legacy COD status" value={order.codStatus ?? '—'} />
              </div>
              {canSeeCarrierHistory && (carrierCostQuery.data?.shipments.length ?? 0) > 0 ? (
                <div className="mt-4 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Carrier cost history
                  </h3>
                  {carrierCostQuery.data?.shipments.map((shipment) => (
                    <div key={shipment.id} className="rounded-lg border border-border-subtle p-3 text-sm">
                      <div className="text-text-body">
                        {shipment.providerCode}: {shipment.actualCost ? `${shipment.actualCost} ${shipment.actualCostCurrency ?? ''}` : 'Pending'}
                      </div>
                      {shipment.history.length === 0 ? (
                        <p className="mt-1 text-text-muted">No verified cost changes yet.</p>
                      ) : (
                        <ul className="mt-2 space-y-1 text-text-muted">
                          {shipment.history.map((change) => (
                            <li key={change.id}>
                              {change.previousAmount ?? '—'} {change.previousCurrency ?? ''} → {change.amount}{' '}
                              {change.currency ?? ''} · {change.source}
                              {change.eventAt ? ` · ${new Date(change.eventAt).toLocaleString()}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              {codQuery.data ? (
                <div className="mt-4 rounded-lg border border-border-subtle bg-surface-sunken p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                      COD record
                    </h3>
                    <Link
                      to={`/oms/cod/${codQuery.data.id}`}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      View details
                    </Link>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Status" value={codQuery.data.status.replace(/_/g, ' ')} />
                    <Field
                      label="Original amount"
                      value={fmtMoney(codQuery.data.originalAmount, codQuery.data.currency)}
                    />
                    <Field
                      label="Current amount"
                      value={fmtMoney(codQuery.data.currentAmount, codQuery.data.currency)}
                    />
                    <Field
                      label="Available at"
                      value={
                        codQuery.data.availableAt
                          ? new Date(codQuery.data.availableAt).toLocaleString()
                          : '—'
                      }
                    />
                  </div>
                </div>
              ) : codQuery.isLoading ? (
                <p className="mt-3 text-sm text-text-muted">Loading COD record…</p>
              ) : null}
            </Card.Body>
          </Card>
        </div>
      </div>

      <OmsOrderTrackingPanel order={order} />

      <OmsShipmentMovementPanel order={order} />

      <OmsOrderFormModal
        open={editOpen}
        mode="edit"
        initial={order}
        onClose={() => setEditOpen(false)}
        onSaved={invalidate}
      />

      <ConfirmModal
        open={deleteOpen}
        title="Delete this OMS order?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        loading={deleteMut.isPending}
        onClose={() => !deleteMut.isPending && setDeleteOpen(false)}
        onConfirm={() => deleteMut.mutate()}
      >
        <p className="text-sm">
          This removes only the OMS commercial record. It does <strong>not</strong> cancel or delete
          any linked warehouse outbound.
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={cancelOpen}
        title="Cancel this OMS order?"
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        danger
        loading={cancelMut.isPending}
        onClose={() => !cancelMut.isPending && setCancelOpen(false)}
        onConfirm={() => cancelMut.mutate()}
      >
        <p className="text-sm">The order will be marked cancelled in the commercial lifecycle.</p>
      </ConfirmModal>

      <ConfirmModal
        open={undoCancelOpen}
        title="Undo this cancellation?"
        confirmLabel="Undo Cancel"
        cancelLabel="Keep cancelled"
        loading={undoCancelMut.isPending}
        onClose={() => !undoCancelMut.isPending && setUndoCancelOpen(false)}
        onConfirm={() => undoCancelMut.mutate()}
      >
        <p className="text-sm">
          The order will return to{' '}
          <strong>
            {omsCommercialStatusLabel(order.revertCancelToStatus ?? order.cancelledFromStatus ?? '')}
          </strong>
          .
        </p>
      </ConfirmModal>

      <Modal
        open={shippingFeeAfterOpen}
        onClose={() => setShippingFeeAfterOpen(false)}
        title="Specify shipping fee"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-body">
            Set or update the shipping fee after this OMS order has been delivered.
          </p>
          <TextField
            label="Shipping fee"
            value={shippingFeeAfter}
            onChange={(e) => setShippingFeeAfter(e.target.value)}
            placeholder={order.shippingFee ?? '0'}
          />
          <div className="flex justify-end gap-2">
            <Button variant="danger" onClick={() => setShippingFeeAfterOpen(false)}>
              Cancel
            </Button>
            <Button loading={setShippingFeeAfterMut.isPending} onClick={() => setShippingFeeAfterMut.mutate()}>
              Save fee
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject OMS order">
        <div className="space-y-4">
          <TextField
            label="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="danger" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button loading={rejectMut.isPending} onClick={() => rejectMut.mutate()}>
              Reject order
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={revertOpen} onClose={() => setRevertOpen(false)} title="Revert delivery">
        <div className="space-y-4">
          <p className="text-sm text-text-body">
            This moves the order from Delivered back to Shipped. A reason is required for audit.
          </p>
          <TextField
            label="Reason (required)"
            value={revertReason}
            onChange={(e) => setRevertReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="danger" onClick={() => setRevertOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={revertDeliveryMut.isPending}
              disabled={!revertReason.trim()}
              onClick={() => revertDeliveryMut.mutate()}
            >
              Revert to shipped
            </Button>
          </div>
        </div>
      </Modal>

      <CreateOmsReturnModal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        initialOrderId={id}
        onSuccess={() => invalidate()}
      />

      <OmsEditShippingFeeModal
        open={editShippingFeeOpen}
        onClose={() => setEditShippingFeeOpen(false)}
        orders={order ? [order] : []}
        onSuccess={() => invalidate()}
      />

      <CancelShipmentModal
        open={cancelShipmentOpen}
        order={order}
        onClose={() => setCancelShipmentOpen(false)}
        onSuccess={() => invalidate()}
      />

      <ConfirmModal
        open={rollbackOfdOpen}
        title={`Rollback to Out for Delivery (Reship with original carrier)?`}
        confirmLabel="Reship & Out for Delivery"
        cancelLabel="Cancel"
        loading={rollbackReturnMut.isPending}
        onClose={() => !rollbackReturnMut.isPending && setRollbackOfdOpen(false)}
        onConfirm={() => rollbackReturnMut.mutate('out_for_delivery')}
      >
        <div className="space-y-2 text-sm">
          <p>
            This action reverses the inventory from the Returns quarantine location and initiates a real reshipment with the original shipping provider via API.
          </p>
          <p className="text-xs font-semibold text-text-strong">
            Crucial safeguard: The order status will NOT advance to Out for Delivery unless the carrier API successfully confirms acceptance.
          </p>
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={rollbackReadyOpen}
        title={`Rollback to Ready to Ship?`}
        confirmLabel="Rollback to Ready to Ship"
        cancelLabel="Cancel"
        loading={rollbackReturnMut.isPending}
        onClose={() => !rollbackReturnMut.isPending && setRollbackReadyOpen(false)}
        onConfirm={() => rollbackReturnMut.mutate('ready_to_ship')}
      >
        <div className="space-y-2 text-sm">
          <p>
            This action reverses the inventory from the Returns quarantine location and resets the order to <strong>Ready to Ship / Shipping Details</strong>.
          </p>
          <p className="text-xs text-text-muted">
            No shipment will be created automatically. You will be able to review addresses, package dimensions, and choose any carrier you prefer.
          </p>
        </div>
      </ConfirmModal>
    </div>
  );
}
