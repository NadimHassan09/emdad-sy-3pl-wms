import { useMutation, useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { CompaniesApi } from '../../api/companies';
import type { CreateOmsOrderInput, OmsOrderDetail, OmsPaymentMethod } from '../../api/oms';
import { OmsApi } from '../../api/oms';
import type { Product } from '../../api/products';
import { ProductsApi } from '../../api/products';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../Button';
import { CascadingAddressSelector } from '../CascadingAddressSelector';
import { Combobox } from '../Combobox';
import { DeliveryLocationMap } from '../DeliveryLocationMap';
import { Modal } from '../Modal';
import { SelectField } from '../SelectField';
import { TextField } from '../TextField';
import {
  InternationalPhoneInput,
  RecipientNameInput,
  createInternationalPhoneValue,
  type InternationalPhoneValue,
} from '@ds';
import { useToast } from '../ToastProvider';
import { QK } from '../../constants/query-keys';
import { companyFilterComboboxOptions } from '../../lib/company-filter-options';
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../../lib/order-planning-dates';
import { canAccessInternalTransfer } from '../../lib/rbac';
import {
  DEFAULT_PHONE_COUNTRY,
  isValidRecipientName,
  phoneFromStoredValue,
} from '../../../../shared/lib/recipient-contact';

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
  const linesFrozen =
    mode === 'edit' &&
    !!initial &&
    !['draft', 'waiting_for_confirmation', 'confirmed_waiting_for_admin_approval', 'pending_approval'].includes(initial.status);

  const [companyId, setCompanyId] = useState('');
  const [requiredShipDate, setRequiredShipDate] = useState(localCalendarDateYmd());
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState<InternationalPhoneValue>(() =>
    createInternationalPhoneValue(DEFAULT_PHONE_COUNTRY),
  );
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [deliveryLat, setDeliveryLat] = useState('');
  const [deliveryLng, setDeliveryLng] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<OmsPaymentMethod | ''>('');
  const [shippingFee, setShippingFee] = useState('');
  const [currency, setCurrency] = useState('USD');
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

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setCompanyId(initial.companyId);
      setRequiredShipDate(initial.requiredShipDate.slice(0, 10));
      setRecipientName(initial.recipientName ?? '');
      const stored = phoneFromStoredValue(initial.recipientPhone, initial.shippingPhoneCountry);
      setRecipientPhone(createInternationalPhoneValue(stored.countryIso, stored.nationalNumber));
      setContactSubmitted(false);
      setCity(initial.city ?? '');
      setDistrict(initial.district ?? '');
      setAddressLine1(initial.addressLine1 ?? '');
      setAddressLine2((initial as { addressLine2?: string }).addressLine2 ?? '');
      setDeliveryLat(initial.shippingReceiverLat != null ? String(initial.shippingReceiverLat) : '');
      setDeliveryLng(initial.shippingReceiverLng != null ? String(initial.shippingReceiverLng) : '');
      setNotes(initial.notes ?? '');
      setPaymentMethod(initial.paymentMethod ?? '');
      setShippingFee(initial.shippingFee ?? '');
      setCurrency(initial.currency ?? 'USD');
    } else if (mode === 'create') {
      setCompanyId(user?.tenantCompanyId ?? '');
      setRequiredShipDate(localCalendarDateYmd());
      setRecipientName('');
      setRecipientPhone(createInternationalPhoneValue(DEFAULT_PHONE_COUNTRY));
      setContactSubmitted(false);
      setCity('');
      setDistrict('');
      setAddressLine1('');
      setAddressLine2('');
      setDeliveryLat('');
      setDeliveryLng('');
      setNotes('');
      setPaymentMethod('');
      setShippingFee('');
      setCurrency('USD');
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
        if (!isYmdOnOrAfterLocalToday(requiredShipDate)) {
          throw new Error('Required ship date cannot be before today.');
        }
        if (parsedLines.length === 0) throw new Error('Add at least one line.');
        if (!deliveryLat.trim() || !deliveryLng.trim()) {
          throw new Error('Please select the delivery location on the map before creating the order.');
        }

        const payload: CreateOmsOrderInput = {
          companyId: effectiveCompanyId,
          requiredShipDate,
          recipientName: recipientName.trim() || undefined,
          recipientPhone: recipientPhone.e164 || undefined,
          city: city || undefined,
          district: district || undefined,
          addressLine1: addressLine1 || undefined,
          addressLine2: addressLine2 || undefined,
          shippingReceiverLat: deliveryLat.trim() ? Number(deliveryLat) : undefined,
          shippingReceiverLng: deliveryLng.trim() ? Number(deliveryLng) : undefined,
          notes: notes || undefined,
          paymentMethod: paymentMethod || undefined,
          subtotal: calculatedSubtotal,
          shippingFee: shippingFee ? shipAmount : undefined,
          codAmount: paymentMethod === 'COD' ? calculatedSubtotal : undefined,
          currency: currency || undefined,
          lines: parsedLines,
          shippingPhoneCountry: recipientPhone.countryIso || undefined,
        };
        return OmsApi.create(payload);
      }

      if (!initial) throw new Error('Order not loaded.');
      if (linesFrozen) {
        return OmsApi.update(initial.id, {
          recipientName: recipientName.trim() || undefined,
          recipientPhone: recipientPhone.e164 || undefined,
          city,
          district,
          addressLine1,
          addressLine2: addressLine2 || undefined,
          shippingReceiverLat: deliveryLat.trim() ? Number(deliveryLat) : undefined,
          shippingReceiverLng: deliveryLng.trim() ? Number(deliveryLng) : undefined,
          requiredShipDate,
          notes,
          paymentMethod: paymentMethod || undefined,
          subtotal: calculatedSubtotal,
          shippingFee: shippingFee ? shipAmount : 0,
          codAmount: paymentMethod === 'COD' ? calculatedSubtotal : undefined,
          currency,
          shippingPhoneCountry: recipientPhone.countryIso || undefined,
        });
      }
      return OmsApi.update(initial.id, {
        recipientName: recipientName.trim() || undefined,
        recipientPhone: recipientPhone.e164 || undefined,
        city,
        district,
        addressLine1,
        addressLine2: addressLine2 || undefined,
        shippingReceiverLat: deliveryLat.trim() ? Number(deliveryLat) : undefined,
        shippingReceiverLng: deliveryLng.trim() ? Number(deliveryLng) : undefined,
        requiredShipDate,
        notes,
        paymentMethod: paymentMethod || undefined,
        subtotal: calculatedSubtotal,
        shippingFee: shippingFee ? shipAmount : 0,
        codAmount: paymentMethod === 'COD' ? calculatedSubtotal : undefined,
        currency,
        shippingPhoneCountry: recipientPhone.countryIso || undefined,
      });
    },
    onSuccess: (order) => {
      toast.success(mode === 'create' ? 'OMS order created.' : 'OMS order updated.');
      onSaved(order);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setContactSubmitted(true);
    if (!isValidRecipientName(recipientName)) return;
    if (!recipientPhone.isEmpty && !recipientPhone.isValid) return;
    saveMut.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Create OMS Order' : 'Edit OMS Order'}
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

        {mode === 'create' ? (
          <p className="rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2 text-xs text-text-body">
            Order will be submitted as <span className="font-medium">pending approval</span>. Approving
            generates the warehouse outbound order.
          </p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <RecipientNameInput
            label="Recipient name"
            value={recipientName}
            onChange={setRecipientName}
            submitted={contactSubmitted}
          />
          <InternationalPhoneInput
            label="Recipient phone"
            value={recipientPhone}
            onChange={setRecipientPhone}
            submitted={contactSubmitted}
          />
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
            cityPlaceholder="Select or type governorate…"
            districtPlaceholder="Select or type city/region…"
            addressLine1Placeholder="Select or type town/neighborhood…"
          />
          <TextField
            label="Street / Detailed Address"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            placeholder="Street name, building, floor…"
          />
        </div>
        <DeliveryLocationMap
          lat={deliveryLat}
          lng={deliveryLng}
          onChange={({ lat, lng }) => {
            setDeliveryLat(lat);
            setDeliveryLng(lng);
          }}
          governorate={city}
          city={district}
          neighborhood={addressLine1}
          street={addressLine2}
          onRemovePin={() => {
            setDeliveryLat('');
            setDeliveryLng('');
          }}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <TextField
            label="Required ship date"
            type="date"
            value={requiredShipDate}
            onChange={(e) => setRequiredShipDate(e.target.value)}
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
          <TextField
            label="Shipping fee"
            value={shippingFee}
            onChange={(e) => setShippingFee(e.target.value)}
          />
          <TextField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          <div>
            <div className="mb-1 text-xs font-medium text-text-body">Subtotal</div>
            <div className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-text-strong">
              {calculatedSubtotal || 0}
              <span className="ms-2 text-xs text-text-muted">(lines + shipping)</span>
            </div>
          </div>
        </div>

        <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        {mode === 'create' ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-text-strong">Order lines</div>
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
                    variant="danger"
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


        <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
          <Button type="button" variant="danger" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saveMut.isPending}>
            {mode === 'create' ? 'Submit for approval' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
