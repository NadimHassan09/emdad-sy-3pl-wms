import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { OmsApi } from '../api/oms';
import { OmsOrderFormModal } from '../components/oms/OmsOrderFormModal';
import { Button } from '../components/Button';
import { Combobox } from '../components/Combobox';
import { ConfirmModal } from '../components/ConfirmModal';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { OutboundApi } from '../api/outbound';

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
  const [linkOpen, setLinkOpen] = useState(false);
  const [outboundSearch, setOutboundSearch] = useState('');
  const [selectedOutboundId, setSelectedOutboundId] = useState('');

  const orderQuery = useQuery({
    queryKey: [...QK.omsOrders, id],
    queryFn: () => OmsApi.getOrder(id),
    enabled: !!id,
  });

  const outboundOptions = useQuery({
    queryKey: ['outbound-lookup', orderQuery.data?.companyId, outboundSearch],
    queryFn: () =>
      OutboundApi.list({
        companyId: orderQuery.data?.companyId,
        orderSearch: outboundSearch || undefined,
        limit: 50,
      }),
    enabled: linkOpen && !!orderQuery.data?.companyId,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: [...QK.omsOrders, id] });
    void qc.invalidateQueries({ queryKey: QK.omsOrders });
  };

  const deleteMut = useMutation({
    mutationFn: () => OmsApi.delete(id),
    onSuccess: () => {
      toast.success('E-commerce order deleted.');
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
      navigate('/orders/oms');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkMut = useMutation({
    mutationFn: (outboundOrderId: string | null) =>
      OmsApi.update(id, { outboundOrderId }),
    onSuccess: () => {
      toast.success('Warehouse link updated.');
      setLinkOpen(false);
      setSelectedOutboundId('');
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const order = orderQuery.data;

  if (orderQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (orderQuery.isError || !order) {
    return <p className="text-sm text-rose-600">Could not load e-commerce order.</p>;
  }

  const total = order.total ?? order.subtotal ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`E-commerce ${order.orderNumber}`}
        description={order.company?.name ?? undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Edit Order
            </Button>
            <Button variant="secondary" onClick={() => setDeleteOpen(true)}>
              Delete Order
            </Button>
            {order.outboundOrderId ? (
              <>
                <Button variant="secondary" onClick={() => setLinkOpen(true)}>
                  Change Linked Outbound Order
                </Button>
                <Button variant="secondary" onClick={() => linkMut.mutate(null)}>
                  Unlink Outbound Order
                </Button>
              </>
            ) : (
              <Button onClick={() => setLinkOpen(true)}>Link Outbound Order</Button>
            )}
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
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="General Information">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Order number" value={order.orderNumber} />
            <Field label="Status" value={order.status} />
            <Field label="Client" value={order.company?.name ?? '—'} />
            <Field label="Client reference" value={order.clientReference ?? '—'} />
            <Field label="External reference" value={order.externalReference ?? '—'} />
            <Field
              label="Required ship date"
              value={new Date(order.requiredShipDate).toLocaleDateString()}
            />
            <Field label="Created" value={new Date(order.createdAt).toLocaleString()} />
            <Field label="Updated" value={new Date(order.updatedAt).toLocaleString()} />
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

        <Section title="Shipping Information">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address" value={order.addressLine1 ?? order.destinationAddress} />
            <Field label="Address line 2" value={order.addressLine2 ?? '—'} />
            <Field label="Carrier" value={order.carrier ?? '—'} />
            <Field label="Tracking" value={order.trackingNumber ?? '—'} />
            <Field
              label="Instructions"
              value={order.deliveryInstructions ?? '—'}
            />
          </div>
        </Section>

        <Section title="Billing Information">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment method" value={order.paymentMethod ?? '—'} />
            <Field label="COD status" value={order.codStatus ?? '—'} />
            <Field label="Currency" value={order.currency ?? '—'} />
          </div>
        </Section>
      </div>

      <Section title="Order Items">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Pricing Summary">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shipping fee" value={order.shippingFee ?? '—'} />
            <Field label="Subtotal" value={order.subtotal ?? total ?? '—'} />
          </div>
        </Section>

        <Section title="Notes">
          <p className="whitespace-pre-wrap text-sm text-slate-700">{order.notes ?? '—'}</p>
        </Section>
      </div>

      <Section title="Status Timeline">
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

      <Section title="Warehouse Integration">
        {order.linkedOutboundOrder ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Linked Outbound Order"
              value={
                <Link
                  to={`/orders/outbound/${order.linkedOutboundOrder.id}`}
                  className="font-medium text-emerald-700 hover:underline"
                >
                  {order.linkedOutboundOrder.orderNumber}
                </Link>
              }
            />
            <Field label="Warehouse status" value={order.warehouseStatus ?? order.linkedOutboundOrder.status} />
            <Field label="Allocation" value={order.allocationStatus ?? 'none'} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">No Outbound Order Linked</p>
            <Button onClick={() => setLinkOpen(true)}>Link Outbound Order</Button>
          </div>
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
        title="Delete this e-commerce order?"
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

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title={order.outboundOrderId ? 'Change linked outbound order' : 'Link outbound order'}
      >
        <div className="space-y-4">
          <Combobox
            label="Outbound order"
            value={selectedOutboundId || order.outboundOrderId || ''}
            onChange={setSelectedOutboundId}
            onSearchQueryChange={setOutboundSearch}
            options={(outboundOptions.data?.items ?? []).map((o) => ({
              value: o.id,
              label: `${o.orderNumber} (${o.status})`,
            }))}
            placeholder="Select outbound order"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={linkMut.isPending}
              onClick={() =>
                linkMut.mutate(selectedOutboundId || order.outboundOrderId || null)
              }
            >
              Save link
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
