import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { Alert, Card, ListPageHeader, Skeleton } from '@ds';
import { CodApi, OmsApi, OmsReturnsApi } from '../api/oms';
import { OmsOrderFormModal } from '../components/oms/OmsOrderFormModal';
import { CreateOmsReturnModal } from '../components/oms/CreateOmsReturnModal';
import { OmsOrderTrackingPanel } from '../components/oms/OmsOrderTrackingPanel';
import { OmsStatusBadge } from '../components/oms/OmsStatusBadge';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { Modal } from '../components/Modal';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { mapOmsCommercialDisplayStatus } from '../lib/oms-commercial-status';

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

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [shippingFeeAfterOpen, setShippingFeeAfterOpen] = useState(false);
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

  const deliveredMut = useMutation({
    mutationFn: () => OmsApi.delivered(id),
    onSuccess: () => {
      toast.success('Order marked delivered.');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const externalFulfillmentMut = useMutation({
    mutationFn: () => OmsApi.recordExternalFulfillment(id),
    onSuccess: () => {
      toast.success('Recorded as fulfilled outside warehouse.');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMut = useMutation({
    mutationFn: () => OmsApi.confirm(id),
    onSuccess: () => {
      toast.success('Order confirmed and fulfillment started.');
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
  useEffect(() => {
    if (!openShippingFeeRequested) return;
    if (autoOpenedShippingFeeModalRef.current) return;
    if (!order) return;
    if (order.status !== 'delivered' && order.status !== 'completed') return;
    setShippingFeeAfter(order.shippingFee ?? '');
    setShippingFeeAfterOpen(true);
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
  const canMarkDelivered = commercial === 'shipped';
  const canRecordExternalFulfillment =
    commercial === 'processing' &&
    !!outboundId &&
    (order.linkedOutboundOrder?.status === 'draft' ||
      order.linkedOutboundOrder?.status === 'allocated' ||
      order.linkedOutboundOrder?.status === 'pending_approval');
  const canRevertDelivery = commercial === 'delivered';
  const canCancel =
    commercial === 'waiting_for_confirmation' ||
    commercial === 'confirmed_waiting_for_admin_approval' ||
    commercial === 'processing' ||
    commercial === 'ready_to_ship' ||
    commercial === 'legacy' ||
    order.status === 'pending_approval' ||
    order.status === 'pending';
  const canCreateReturn = commercial === 'delivered';
  const canSpecifyShippingFeeAfterDelivery =
    commercial === 'delivered' ||
    order.status === 'delivered' ||
    order.status === 'completed';
  const canRetryCod = order.codGenerationStatus === 'failed';

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
            {canConfirm ? (
              <Button loading={confirmMut.isPending} onClick={() => confirmMut.mutate()}>
                Confirm & start fulfillment
              </Button>
            ) : null}
            {canApprove ? (
              <Button loading={approveMut.isPending} onClick={() => approveMut.mutate()}>
                Approve
              </Button>
            ) : null}
            {canRecordExternalFulfillment ? (
              <Button
                variant="secondary"
                loading={externalFulfillmentMut.isPending}
                onClick={() => {
                  if (
                    !window.confirm(
                      'Record this order as fulfilled outside the warehouse?\n\nNo picking, packing, carrier shipment, or inventory deduction will run.',
                    )
                  ) {
                    return;
                  }
                  externalFulfillmentMut.mutate();
                }}
              >
                Fulfilled outside warehouse
              </Button>
            ) : null}
            {canReject ? (
              <Button variant="secondary" onClick={() => setRejectOpen(true)}>
                Reject
              </Button>
            ) : null}
            {canMarkDelivered ? (
              <Button loading={deliveredMut.isPending} onClick={() => deliveredMut.mutate()}>
                Mark delivered
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
            {canSpecifyShippingFeeAfterDelivery ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setShippingFeeAfter(order.shippingFee ?? '');
                  setShippingFeeAfterOpen(true);
                }}
              >
                Specify shipping fee
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
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <OmsStatusBadge status={order.status} needsInformation={order.needsInformation} />
        {order.rejectionReason ? (
          <span className="rounded-full bg-status-error-bg px-2 py-0.5 text-xs font-medium text-status-error-fg">
            Rejected: {order.rejectionReason}
          </span>
        ) : null}
      </div>

      {order.needsInformation ? (
        <Alert variant="warning" title="Incomplete Order">
          Shipping/Delivery information is incomplete. Use Edit to complete Governorate, City/Area,
          and location before this order can be approved.
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
                <div className="sm:col-span-2">
                  <Field
                    label="Address"
                    value={order.addressLine1 ?? order.destinationAddress ?? '—'}
                  />
                </div>
                <Field label="City" value={order.city ?? '—'} />
                <Field label="District" value={order.district ?? '—'} />
                <Field label="Carrier" value={order.carrier ?? '—'} />
                <Field label="Tracking" value={order.trackingNumber ?? '—'} />
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
                  label="Shipping fee"
                  value={fmtMoney(order.shippingFee, order.currency)}
                />
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
    </div>
  );
}
