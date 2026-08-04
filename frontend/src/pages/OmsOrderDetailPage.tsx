import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { Alert, Card, ListPageHeader, Skeleton } from '@ds';
import { CodApi, OmsApi, OmsReturnsApi } from '../api/oms';
import { OmsOrderFormModal } from '../components/oms/OmsOrderFormModal';
import { OmsStatusBadge } from '../components/oms/OmsStatusBadge';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { Modal } from '../components/Modal';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { mapOmsCommercialDisplayStatus, omsCommercialStatusLabel } from '../lib/oms-commercial-status';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-text-muted">{label}</div>
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
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [shippingFeeAfterOpen, setShippingFeeAfterOpen] = useState(false);
  const [approveShippingFee, setApproveShippingFee] = useState('');
  const [shippingFeeAfter, setShippingFeeAfter] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnQty, setReturnQty] = useState<Record<string, string>>({});

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
    mutationFn: () => {
      const fee = approveShippingFee.trim();
      return OmsApi.approve(id, fee ? Number(fee) : undefined);
    },
    onSuccess: () => {
      toast.success('Order approved.');
      setApproveOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setShippingFeeAfterMut = useMutation({
    mutationFn: () => {
      const fee = shippingFeeAfter.trim();
      return OmsApi.update(id, { shippingFee: fee ? Number(fee) : undefined });
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

  const retryCodMut = useMutation({
    mutationFn: () => CodApi.retryGeneration(id),
    onSuccess: () => {
      toast.success('COD generation retried.');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createReturnMut = useMutation({
    mutationFn: () => {
      const order = orderQuery.data!;
      const lines = order.lines
        .map((line) => {
          const qty = Number(returnQty[line.id] ?? 0);
          if (!Number.isFinite(qty) || qty <= 0) return null;
          return {
            productId: line.productId,
            quantity: qty,
            unitPrice: line.unitPrice != null ? Number(line.unitPrice) : undefined,
          };
        })
        .filter(Boolean) as Array<{ productId: string; quantity: number; unitPrice?: number }>;
      if (lines.length === 0) {
        throw new Error('Enter a return quantity for at least one line.');
      }
      return OmsReturnsApi.create({
        omsOrderId: id,
        reason: returnReason.trim() || undefined,
        lines,
      });
    },
    onSuccess: () => {
      toast.success('Return request created.');
      setReturnOpen(false);
      setReturnReason('');
      setReturnQty({});
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const order = orderQuery.data;
  const commercial = order ? mapOmsCommercialDisplayStatus(order.status) : null;

  const defaultReturnQty = useMemo(() => {
    if (!order) return {};
    return Object.fromEntries(order.lines.map((l) => [l.id, l.requestedQuantity]));
  }, [order]);

  // Auto-open the "Specify shipping fee" modal when coming from the /orders/oms row actions.
  // Must be declared before any early-return (loading/error) paths to keep React hook order stable.
  useEffect(() => {
    if (!openShippingFeeRequested) return;
    if (autoOpenedShippingFeeModalRef.current) return;
    if (!order) return;
    if (order.status !== 'shipped' && order.status !== 'completed') return;
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
  const canApprove = commercial === 'pending_approval';
  const canReject = commercial === 'pending_approval';
  const canEditCommercial =
    commercial === 'pending_approval' || commercial === 'pending';
  const canMarkDelivered = commercial === 'out_for_delivery';
  const canCancel = commercial !== 'delivered' && commercial !== 'cancelled';
  const canCreateReturn = commercial === 'delivered';
  const canSpecifyShippingFeeAfterFulfillment =
    order.status === 'shipped' || order.status === 'completed';
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
            {canApprove ? (
              <Button
                onClick={() => {
                  setApproveShippingFee(order.shippingFee ?? '');
                  setApproveOpen(true);
                }}
              >
                Approve
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
            {canCancel ? (
              <Button variant="secondary" onClick={() => setCancelOpen(true)}>
                Cancel order
              </Button>
            ) : null}
            {canSpecifyShippingFeeAfterFulfillment ? (
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
              <Button
                variant="secondary"
                onClick={() => {
                  setReturnQty(defaultReturnQty);
                  setReturnOpen(true);
                }}
              >
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
        <OmsStatusBadge status={order.status} />
        {order.storeChannel ? (
          <span className="rounded-full bg-surface-card-muted px-2 py-0.5 text-xs font-medium text-text-body">
            {order.storeChannel}
          </span>
        ) : null}
        {order.rejectionReason ? (
          <span className="rounded-full bg-status-error-bg px-2 py-0.5 text-xs font-medium text-status-error-fg">
            Rejected: {order.rejectionReason}
          </span>
        ) : null}
      </div>

      <Section title="Overview">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Order number" value={order.orderNumber} />
          <Field label="Status" value={omsCommercialStatusLabel(order.status)} />
          <Field label="Client" value={order.company?.name ?? '—'} />
          <Field label="Client reference" value={order.clientReference ?? '—'} />
          <Field label="Sales channel" value={order.storeChannel ?? '—'} />
          <Field
            label="Required ship date"
            value={new Date(order.requiredShipDate).toLocaleDateString()}
          />
          <Field label="Recipient" value={order.recipientName ?? '—'} />
          <Field label="Phone" value={order.recipientPhone ?? '—'} />
          <Field
            label="Submitted"
            value={order.submittedAt ? new Date(order.submittedAt).toLocaleString() : '—'}
          />
        </div>
      </Section>

      <Section title="Products">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs uppercase text-text-muted">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2">Qty</th>
                <th className="px-2 py-2">Price</th>
                <th className="px-2 py-2">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.id} className="border-b border-border-subtle">
                  <td className="px-2 py-2">{line.lineNumber}</td>
                  <td className="px-2 py-2">
                    {line.product ? `${line.product.sku} — ${line.product.name}` : line.productId}
                  </td>
                  <td className="px-2 py-2">{line.requestedQuantity}</td>
                  <td className="px-2 py-2">{line.unitPrice ?? '—'}</td>
                  <td className="px-2 py-2">{line.lineTotal ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Shipping">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address" value={order.addressLine1 ?? order.destinationAddress} />
          <Field label="City" value={order.city ?? '—'} />
          <Field label="District" value={order.district ?? '—'} />
          <Field label="Carrier" value={order.carrier ?? '—'} />
          <Field label="Tracking" value={order.trackingNumber ?? '—'} />
          <Field label="Instructions" value={order.deliveryInstructions ?? '—'} />
        </div>
      </Section>

      <Section title="Timeline">
        {order.timeline && order.timeline.length > 0 ? (
          <ol className="space-y-3">
            {order.timeline.map((ev) => (
              <li key={ev.id} className="border-l-2 border-brand-200 dark:border-brand-500/40 pl-3">
                <div className="text-sm font-medium text-text-strong">{ev.eventType}</div>
                <div className="text-xs text-text-muted">
                  {new Date(ev.createdAt).toLocaleString()}
                  {ev.creator?.fullName ? ` · ${ev.creator.fullName}` : ''}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-text-muted">No timeline events yet.</p>
        )}
      </Section>

      <Section title="Returns">
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
                      <Link to="/oms/returns" className="font-medium text-brand-700 hover:underline">
                        {ret.returnNumber}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{ret.status.replace(/_/g, ' ')}</td>
                    <td className="px-2 py-2">{ret.reason ?? '—'}</td>
                    <td className="px-2 py-2">{new Date(ret.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Financial">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Payment method" value={order.paymentMethod ?? '—'} />
          <Field label="Subtotal" value={fmtMoney(order.subtotal ?? total, order.currency)} />
          <Field label="Shipping fee" value={fmtMoney(order.shippingFee, order.currency)} />
          <Field label="COD amount" value={fmtMoney(order.codAmount, order.currency)} />
          <Field label="Legacy COD status" value={order.codStatus ?? '—'} />
        </div>
        {codQuery.data ? (
          <div className="mt-4 rounded-lg border border-border-subtle bg-surface-sunken p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
              COD record
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
      </Section>

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

      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title="Approve OMS order">
        <div className="space-y-4">
          <p className="text-sm text-text-body">
            Approving validates stock and creates a draft outbound order for fulfillment.
          </p>
          <TextField
            label="Shipping fee (optional)"
            value={approveShippingFee}
            onChange={(e) => setApproveShippingFee(e.target.value)}
            placeholder={order.shippingFee ?? '0'}
          />
          <div className="flex justify-end gap-2">
            <Button variant="danger" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button loading={approveMut.isPending} onClick={() => approveMut.mutate()}>
              Approve
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={shippingFeeAfterOpen}
        onClose={() => setShippingFeeAfterOpen(false)}
        title="Specify shipping fee"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-body">
            Update the shipping fee after this OMS order is already shipped/completed.
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

      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} title="Create OMS return">
        <div className="space-y-4">
          <TextField
            label="Reason (optional)"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
          />
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase text-text-muted">Return quantities</div>
            {order.lines.map((line) => (
              <div key={line.id} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-text-body">
                  {line.product?.sku ?? line.productId}
                </span>
                <input
                  type="number"
                  min={0}
                  max={Number(line.requestedQuantity)}
                  value={returnQty[line.id] ?? ''}
                  onChange={(e) =>
                    setReturnQty((prev) => ({ ...prev, [line.id]: e.target.value }))
                  }
                  className="w-24 rounded-lg border border-border px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="danger" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button loading={createReturnMut.isPending} onClick={() => createReturnMut.mutate()}>
              Submit return
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
