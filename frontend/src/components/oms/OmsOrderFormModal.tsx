import { useMutation, useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { CompaniesApi } from '../../api/companies';
import type { CreateOmsOrderInput, OmsOrderDetail, OmsPaymentMethod } from '../../api/oms';
import { OmsApi } from '../../api/oms';
import { OutboundApi } from '../../api/outbound';
import type { Product } from '../../api/products';
import { ProductsApi } from '../../api/products';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../Button';
import { CascadingAddressSelector } from '../CascadingAddressSelector';
import { Combobox } from '../Combobox';
import { Modal } from '../Modal';
import { SelectField } from '../SelectField';
import { TextField } from '../TextField';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { companyFilterComboboxOptions } from '../../lib/company-filter-options';
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../../lib/order-planning-dates';
import { canAccessInternalTransfer } from '../../lib/rbac';

type LineDraft = { productId: string; requestedQuantity: string; unitPrice: string };

const emptyLine = (): LineDraft => ({ productId: '', requestedQuantity: '1', unitPrice: '' });

export function OmsOrderFormModal({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: OmsOrderDetail | null;
  onClose: () => void;
  onSaved: (order: OmsOrderDetail) => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = canAccessInternalTransfer(user?.role);

  const [companyId, setCompanyId] = useState('');
  const [requiredShipDate, setRequiredShipDate] = useState(localCalendarDateYmd());
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [carrier, setCarrier] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<OmsPaymentMethod | ''>('');
  const [shippingFee, setShippingFee] = useState('');
  const [currency, setCurrency] = useState('SYP');
  const [storeChannel, setStoreChannel] = useState('');
  const [outboundOrderId, setOutboundOrderId] = useState('');
  const [outboundSearch, setOutboundSearch] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
  });

  const effectiveCompanyId = companyId || initial?.companyId || user?.tenantCompanyId || '';

  const products = useQuery({
    queryKey: [...QK.products, effectiveCompanyId],
    queryFn: () => ProductsApi.list({ companyId: effectiveCompanyId || undefined, limit: 200 }),
    enabled: !!effectiveCompanyId && open,
  });

  const outboundOptions = useQuery({
    queryKey: ['outbound-lookup', effectiveCompanyId, outboundSearch],
    queryFn: () =>
      OutboundApi.list({
        companyId: effectiveCompanyId || undefined,
        orderSearch: outboundSearch || undefined,
        limit: 50,
        offset: 0,
      }),
    enabled: open && !!effectiveCompanyId,
  });

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setCompanyId(initial.companyId);
      setRequiredShipDate(initial.requiredShipDate.slice(0, 10));
      setRecipientName(initial.recipientName ?? '');
      setRecipientPhone(initial.recipientPhone ?? '');
      setCity(initial.city ?? '');
      setDistrict(initial.district ?? '');
      setAddressLine1(initial.addressLine1 ?? '');
      setCarrier(initial.carrier ?? '');
      setNotes(initial.notes ?? '');
      setPaymentMethod(initial.paymentMethod ?? '');
      setShippingFee(initial.shippingFee ?? '');
      setCurrency(initial.currency ?? 'SYP');
      setStoreChannel(initial.storeChannel ?? '');
      setOutboundOrderId(initial.outboundOrderId ?? '');
    } else if (mode === 'create') {
      setCompanyId(user?.tenantCompanyId ?? '');
      setRequiredShipDate(localCalendarDateYmd());
      setRecipientName('');
      setRecipientPhone('');
      setCity('');
      setDistrict('');
      setAddressLine1('');
      setCarrier('');
      setNotes('');
      setPaymentMethod('');
      setShippingFee('');
      setCurrency('SYP');
      setStoreChannel('');
      setOutboundOrderId('');
      setLines([emptyLine()]);
    }
  }, [open, mode, initial, user?.tenantCompanyId]);

  const clientOptions = useMemo(
    () => companyFilterComboboxOptions(companies.data, 'Select client…'),
    [companies.data],
  );

  const productOptions = useMemo(
    () =>
      (products.data?.items ?? [])
        .filter((p: Product) => p.status === 'active')
        .map((p: Product) => ({
          value: p.id,
          label: `${p.sku} — ${p.name}`,
        })),
    [products.data],
  );

  const outboundComboboxOptions = useMemo(() => {
    const opts = (outboundOptions.data?.items ?? []).map((o) => ({
      value: o.id,
      label: `${o.orderNumber} (${o.status})`,
    }));
    if (
      outboundOrderId &&
      !opts.some((o) => o.value === outboundOrderId) &&
      initial?.linkedOutboundOrder
    ) {
      opts.unshift({
        value: outboundOrderId,
        label: `${initial.linkedOutboundOrder.orderNumber} (${initial.linkedOutboundOrder.status})`,
      });
    }
    return opts;
  }, [outboundOptions.data, outboundOrderId, initial?.linkedOutboundOrder]);

  const linesSum = useMemo(() => {
    return lines.reduce((sum, l) => {
      const qty = Number(l.requestedQuantity);
      const price = Number(l.unitPrice);
      if (!l.productId || !(qty > 0) || !(price >= 0) || Number.isNaN(price)) return sum;
      return sum + qty * price;
    }, 0);
  }, [lines]);

  const shipAmount = shippingFee ? Number(shippingFee) || 0 : 0;

  /** Subtotal = shipping fee + sum(price × qty) for each line. */
  const calculatedSubtotal = useMemo(() => {
    if (mode === 'edit' && initial) {
      const existingLinesSum = initial.lines.reduce((sum, l) => {
        if (l.lineTotal != null && l.lineTotal !== '') return sum + Number(l.lineTotal);
        const qty = Number(l.requestedQuantity);
        const price = Number(l.unitPrice ?? 0);
        return sum + (Number.isFinite(qty * price) ? qty * price : 0);
      }, 0);
      return existingLinesSum + shipAmount;
    }
    return linesSum + shipAmount;
  }, [mode, initial, linesSum, shipAmount]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (mode === 'create') {
        const parsedLines = lines
          .filter((l) => l.productId && Number(l.requestedQuantity) > 0)
          .map((l) => {
            const qty = Number(l.requestedQuantity);
            const unitPrice = Number(l.unitPrice);
            if (Number.isNaN(unitPrice) || unitPrice < 0) {
              throw new Error('Each product line needs a valid price.');
            }
            return {
              productId: l.productId,
              requestedQuantity: qty,
              unitPrice,
              lineTotal: qty * unitPrice,
            };
          });

        if (!effectiveCompanyId) throw new Error('Pick a client.');
        if (!outboundOrderId) throw new Error('Link an outbound order.');
        if (!isYmdOnOrAfterLocalToday(requiredShipDate)) {
          throw new Error('Required ship date cannot be before today.');
        }
        if (parsedLines.length === 0) throw new Error('Add at least one line.');

        const payload: CreateOmsOrderInput = {
          companyId: effectiveCompanyId,
          requiredShipDate,
          recipientName: recipientName || undefined,
          recipientPhone: recipientPhone || undefined,
          city: city || undefined,
          district: district || undefined,
          addressLine1: addressLine1 || undefined,
          carrier: carrier || undefined,
          notes: notes || undefined,
          paymentMethod: paymentMethod || undefined,
          subtotal: calculatedSubtotal,
          shippingFee: shippingFee ? shipAmount : undefined,
          codAmount: paymentMethod === 'COD' ? calculatedSubtotal : undefined,
          currency: currency || undefined,
          storeChannel: storeChannel || undefined,
          outboundOrderId,
          lines: parsedLines,
        };
        return OmsApi.create(payload);
      }

      if (!initial) throw new Error('Order not loaded.');
      if (!outboundOrderId) throw new Error('Link an outbound order.');
      return OmsApi.update(initial.id, {
        recipientName,
        recipientPhone,
        city,
        district,
        addressLine1,
        requiredShipDate,
        carrier,
        notes,
        paymentMethod: paymentMethod || undefined,
        subtotal: calculatedSubtotal,
        shippingFee: shippingFee ? shipAmount : 0,
        codAmount: paymentMethod === 'COD' ? calculatedSubtotal : undefined,
        currency,
        storeChannel,
        outboundOrderId,
      });
    },
    onSuccess: (order) => {
      toast.success(
        mode === 'create' ? 'E-commerce order created.' : 'E-commerce order updated.',
      );
      onSaved(order);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveMut.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Create E-commerce Order' : 'Edit E-commerce Order'}
      widthClass="max-w-4xl"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {isAdmin ? (
          <Combobox
            label="Client"
            value={companyId}
            onChange={setCompanyId}
            options={clientOptions}
            disabled={mode === 'edit'}
          />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="Recipient name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
          <TextField label="Recipient phone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
          <CascadingAddressSelector
            value={{ city, district, addressLine1 }}
            onChange={(next) => {
              setCity(next.city);
              setDistrict(next.district);
              setAddressLine1(next.addressLine1);
            }}
            cityLabel="Governorate"
            districtLabel="City/Region"
            addressLine1Label="Town/Neighborhood"
            cityPlaceholder="Select governorate…"
            districtPlaceholder="Select city/region…"
            addressLine1Placeholder="Select town/neighborhood…"
          />
          <TextField
            label="Required ship date"
            type="date"
            value={requiredShipDate}
            onChange={(e) => setRequiredShipDate(e.target.value)}
          />
          <TextField label="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          <TextField label="Sales channel" value={storeChannel} onChange={(e) => setStoreChannel(e.target.value)} />
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
          <div className="mb-2 text-sm font-semibold text-slate-800">Warehouse Link</div>
          <p className="mb-3 text-xs text-slate-500">Required — select the outbound warehouse order.</p>
          <Combobox
            label="Link to Outbound Order"
            value={outboundOrderId}
            onChange={setOutboundOrderId}
            onSearchQueryChange={setOutboundSearch}
            options={outboundComboboxOptions}
            placeholder="Select Outbound Order"
            clearable={false}
            required
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <SelectField
            label="Payment method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as OmsPaymentMethod | '')}
            options={[
              { value: '', label: '—' },
              { value: 'COD', label: 'COD' },
              { value: 'PREPAID', label: 'Prepaid' },
              { value: 'CREDIT', label: 'Credit' },
            ]}
          />
          <TextField label="Shipping fee" value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} />
          <TextField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          <div>
            <div className="mb-1 text-xs font-medium text-slate-600">Subtotal</div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {calculatedSubtotal || 0}
              <span className="ms-2 text-xs text-slate-500">
                (lines + shipping)
              </span>
            </div>
          </div>
        </div>

        <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        {mode === 'create' ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-800">Order lines</div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-[1fr_100px_120px_auto]">
                <Combobox
                  label={idx === 0 ? 'Product' : undefined}
                  value={line.productId}
                  onChange={(v) =>
                    setLines((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, productId: v } : row)),
                    )
                  }
                  options={productOptions}
                  placeholder="Pick product…"
                />
                <TextField
                  label={idx === 0 ? 'Qty' : undefined}
                  value={line.requestedQuantity}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, requestedQuantity: e.target.value } : row,
                      ),
                    )
                  }
                />
                <TextField
                  label={idx === 0 ? 'Price' : undefined}
                  value={line.unitPrice}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, unitPrice: e.target.value } : row,
                      ),
                    )
                  }
                  placeholder="0"
                  required
                />
                <div className={idx === 0 ? 'pt-6' : 'pt-1'}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={lines.length <= 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              + Add line
            </Button>
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saveMut.isPending}>
            {mode === 'create' ? 'Create E-commerce Order' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
