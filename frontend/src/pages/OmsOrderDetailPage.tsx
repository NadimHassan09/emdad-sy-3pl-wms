import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { OmsApi } from '../api/oms';
import { OmsOrderFormModal } from '../components/oms/OmsOrderFormModal';
import { Button } from '../components/Button';
import { ConfirmModal } from '../components/ConfirmModal';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800">{value}</div>
    </div>
  );
}

export function OmsOrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveShippingFee, setApproveShippingFee] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const orderQuery = useQuery({
    queryKey: [...QK.omsOrders, id],
    queryFn: () => OmsApi.getOrder(id),
    enabled: !!id,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: [...QK.omsOrders, id] });
    void qc.invalidateQueries({ queryKey: QK.omsOrders });
    void qc.invalidateQueries({ queryKey: QK.omsDashboard });
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
      toast.success('Order approved. Warehouse outbound created as draft.');
      setApproveOpen(false);
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

  const actionMut = useMutation({
    mutationFn: (action: 'delivered' | 'returned' | 'failedDelivery' | 'complete' | 'outForDelivery') => {
      if (action === 'delivered') return OmsApi.delivered(id);
      if (action === 'returned') return OmsApi.returned(id);
      if (action === 'failedDelivery') return OmsApi.failedDelivery(id);
      if (action === 'complete') return OmsApi.complete(id);
      return OmsApi.outForDelivery(id);
    },
    onSuccess: () => {
      toast.success('Status updated.');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const order = orderQuery.data;

  if (orderQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (orderQuery.isError || !order) {
    return <p className="text-sm text-rose-600">Could not load OMS order.</p>;
  }

  const total = order.total ?? order.subtotal ?? null;
  const canApprove = order.status === 'pending_approval' || order.status === 'draft';
  const canReject = order.status === 'pending_approval' || order.status === 'draft';
  const canEditCommercial =
    order.status === 'draft' ||
    order.status === 'pending_approval' ||
    order.status === 'approved' ||
    order.status === 'confirmed';
  const canMarkOutForDelivery = ['ready_to_ship', 'packing', 'shipped', 'approved', 'allocated'].includes(
    order.status,
  );
  const canMarkDelivered = ['out_for_delivery', 'shipped', 'ready_to_ship'].includes(order.status);
  const canMarkFailed = ['out_for_delivery', 'shipped'].includes(order.status);
  const canMarkReturned = ['delivered', 'failed_delivery', 'out_for_delivery', 'shipped'].includes(
    order.status,
  );
  const canComplete = order.status === 'delivered';

  return (
    <div className="space-y-4">
      <PageHeader
        title={`OMS ${order.orderNumber}`}
        description={order.company?.name ?? undefined}
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
            {canEditCommercial ? (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                Edit
              </Button>
            ) : null}
            {canMarkOutForDelivery ? (
              <Button
                variant="secondary"
                loading={actionMut.isPending}
                onClick={() => actionMut.mutate('outForDelivery')}
              >
                Out for delivery
              </Button>
            ) : null}
            {canMarkDelivered ? (
              <Button
                variant="secondary"
                loading={actionMut.isPending}
                onClick={() => actionMut.mutate('delivered')}
              >
                Mark delivered
              </Button>
            ) : null}
            {canMarkFailed ? (
              <Button
                variant="secondary"
                loading={actionMut.isPending}
                onClick={() => actionMut.mutate('failedDelivery')}
              >
                Failed delivery
              </Button>
            ) : null}
            {canMarkReturned ? (
              <Button
                variant="secondary"
                loading={actionMut.isPending}
                onClick={() => actionMut.mutate('returned')}
              >
                Mark returned
              </Button>
            ) : null}
            {canComplete ? (
              <Button
                variant="secondary"
                loading={actionMut.isPending}
                onClick={() => actionMut.mutate('complete')}
              >
                Complete
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={order.status} />
        {order.storeChannel ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {order.storeChannel}
          </span>
        ) : null}
        {order.rejectionReason ? (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
            Rejected: {order.rejectionReason}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Overview">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Order number" value={order.orderNumber} />
            <Field label="Status" value={order.status} />
            <Field label="Client" value={order.company?.name ?? '—'} />
            <Field label="Client reference" value={order.clientReference ?? '—'} />
            <Field
              label="Required ship date"
              value={new Date(order.requiredShipDate).toLocaleDateString()}
            />
            <Field
              label="Submitted"
              value={order.submittedAt ? new Date(order.submittedAt).toLocaleString() : '—'}
            />
            <Field
              label="Approved"
              value={order.approvedAt ? new Date(order.approvedAt).toLocaleString() : '—'}
            />
            <Field
              label="Rejected"
              value={order.rejectedAt ? new Date(order.rejectedAt).toLocaleString() : '—'}
            />
          </div>
        </Section>

        <Section title="Customer">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Recipient" value={order.recipientName ?? '—'} />
            <Field label="Phone" value={order.recipientPhone ?? '—'} />
            <Field label="City" value={order.city ?? '—'} />
            <Field label="District" value={order.district ?? '—'} />
          </div>
        </Section>

        <Section title="Shipment">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address" value={order.addressLine1 ?? order.destinationAddress} />
            <Field label="Carrier" value={order.carrier ?? '—'} />
            <Field label="Tracking" value={order.trackingNumber ?? '—'} />
            <Field label="Instructions" value={order.deliveryInstructions ?? '—'} />
          </div>
        </Section>

        <Section title="Payment">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment method" value={order.paymentMethod ?? '—'} />
            <Field label="COD status" value={order.codStatus ?? '—'} />
            <Field label="Shipping fee" value={order.shippingFee ?? '—'} />
            <Field label="Subtotal" value={order.subtotal ?? total ?? '—'} />
            <Field label="Currency" value={order.currency ?? '—'} />
          </div>
        </Section>
      </div>

      <Section title="Products">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2">Qty</th>
                <th className="px-2 py-2">Price</th>
                <th className="px-2 py-2">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.id} className="border-b border-slate-50">
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

      <Section title="Timeline">
        {order.timeline && order.timeline.length > 0 ? (
          <ol className="space-y-3">
            {order.timeline.map((ev) => (
              <li key={ev.id} className="border-l-2 border-emerald-200 pl-3">
                <div className="text-sm font-medium text-slate-800">{ev.eventType}</div>
                <div className="text-xs text-slate-500">
                  {new Date(ev.createdAt).toLocaleString()}
                  {ev.creator?.fullName ? ` · ${ev.creator.fullName}` : ''}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">No timeline events yet.</p>
        )}
      </Section>

      <Section title="Warehouse (WMS)">
        {order.linkedOutboundOrder ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Linked outbound"
              value={
                <Link
                  to={`/orders/outbound/${order.linkedOutboundOrder.id}`}
                  className="font-medium text-emerald-700 hover:underline"
                >
                  {order.linkedOutboundOrder.orderNumber}
                </Link>
              }
            />
            <Field
              label="Warehouse status"
              value={order.warehouseStatus ?? order.linkedOutboundOrder.status}
            />
            <Field label="Allocation" value={order.allocationStatus ?? 'none'} />
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            No outbound yet. Approve this order to generate a draft warehouse order.
          </p>
        )}
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
          This removes only the OMS record. Any linked outbound order will not be deleted.
        </p>
      </ConfirmModal>

      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title="Approve OMS order">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Approving validates stock and creates a draft outbound order for the warehouse.
          </p>
          <TextField
            label="Shipping fee (optional)"
            value={approveShippingFee}
            onChange={(e) => setApproveShippingFee(e.target.value)}
            placeholder={order.shippingFee ?? '0'}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button loading={approveMut.isPending} onClick={() => approveMut.mutate()}>
              Approve & create outbound
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
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button loading={rejectMut.isPending} onClick={() => rejectMut.mutate()}>
              Reject order
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
