import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { BillingApi } from '../../api/billing';
import { Button } from '../Button';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';
import { formatDecimal } from '../../lib/billing-invoice-display';

type Props = {
  referenceType: 'inbound_order' | 'outbound_order';
  referenceId: string;
  canEdit: boolean;
};

export function OrderManualChargesSection({ referenceType, referenceId, canEdit }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const queryKey = ['order-manual-charges', referenceType, referenceId];

  const chargesQuery = useQuery({
    queryKey,
    queryFn: () => BillingApi.listOrderCharges(referenceType, referenceId),
  });

  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');

  const createMut = useMutation({
    mutationFn: () =>
      BillingApi.createOrderCharge({
        referenceType,
        referenceId,
        description: description.trim(),
        quantity: Number(quantity) || 0,
        unitPrice: Number(unitPrice) || 0,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
      setDescription('');
      setQuantity('1');
      setUnitPrice('0');
      toast.success('Manual charge added.');
    },
    onError: () => toast.error('Could not add charge.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => BillingApi.deleteOrderCharge(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
      toast.success('Charge removed.');
    },
    onError: () => toast.error('Could not remove charge.'),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Description is required.');
      return;
    }
    createMut.mutate();
  };

  const charges = chargesQuery.data ?? [];

  return (
    <section className="rounded-lg border border-border bg-surface-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-text-strong">Manual charges (VAS)</h3>
      <p className="mt-1 text-xs text-text-muted">
        These charges are included automatically in the client&apos;s billing cycle invoice.
      </p>

      {chargesQuery.isPending ? <p className="mt-3 text-sm text-text-muted">Loading charges…</p> : null}

      {charges.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-text-muted">
                <th className="py-2 pr-4">Description</th>
                <th className="py-2 pr-4">Qty</th>
                <th className="py-2 pr-4">Unit</th>
                <th className="py-2 pr-4">Total</th>
                {canEdit ? <th className="py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id} className="border-b border-border-subtle">
                  <td className="py-2 pr-4">{c.description}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums">{formatDecimal(c.quantity, 2)}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums">{formatDecimal(c.unitPrice, 2)}</td>
                  <td className="py-2 pr-4 font-mono tabular-nums">{formatDecimal(c.totalPrice)}</td>
                  {canEdit ? (
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={deleteMut.isPending}
                        onClick={() => deleteMut.mutate(c.id)}
                      >
                        Remove
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-text-muted">No manual charges on this order.</p>
      )}

      {canEdit ? (
        <form className="mt-4 grid gap-3 sm:grid-cols-4" onSubmit={handleSubmit}>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="sm:col-span-2"
          />
          <TextField
            label="Quantity"
            type="number"
            min={0}
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <TextField
            label="Unit price"
            type="number"
            min={0}
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          <div className="sm:col-span-4">
            <Button type="submit" size="sm" variant="brand" loading={createMut.isPending}>
              Add charge
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
