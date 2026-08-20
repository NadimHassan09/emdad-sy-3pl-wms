import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button, Textarea, InternationalPhoneInput, RecipientNameInput, createInternationalPhoneValue } from '@ds';

import { CompaniesApi } from '../api/companies';
import { InventoryApi } from '../api/inventory';
import type { CreateOmsOrderInput, OmsPaymentMethod } from '../api/oms';
import { OmsApi } from '../api/oms';
import type { Product } from '../api/products';
import { ProductsApi } from '../api/products';
import { useAuth } from '../auth/AuthContext';
import { CascadingAddressSelector } from '../components/CascadingAddressSelector';
import { Combobox } from '../components/Combobox';
import { DeliveryLocationMap } from '../components/DeliveryLocationMap';
import { FILTER_PRIMARY_BUTTON_CLASS } from '../components/FilterPanel';
import { SelectField } from '../components/SelectField';
import { TextField } from '../components/TextField';
import { useToast } from '../components/ToastProvider';
import { QK } from '../constants/query-keys';
import { companyFilterComboboxOptions } from '../lib/company-filter-options';
import { isYmdOnOrAfterLocalToday, localCalendarDateYmd } from '../lib/order-planning-dates';
import { canAccessInternalTransfer } from '../lib/rbac';
import {
  DEFAULT_PHONE_COUNTRY,
  isValidRecipientName,
  phoneFromStoredValue,
} from '../../../shared/lib/recipient-contact';
import {
  clearListUiCache,
  readListUiCache,
  writeListUiCache,
} from '../../../shared/design-system-next/hooks/listUiCache';

type DraftLine = {
  key: string;
  productId: string;
  requestedQuantity: string;
  unitPrice: string;
};

type OmsCreateDraft = {
  companyId: string;
  shipDate: string;
  recipientName: string;
  recipientPhone: string;
  recipientPhoneCountry?: string;
  city: string;
  district: string;
  addressLine1: string;
  addressLine2: string;
  deliveryLat: string;
  deliveryLng: string;
  paymentMethod: OmsPaymentMethod | '';
  notes: string;
  lines: DraftLine[];
};

const OMS_CREATE_DRAFT_KEY = 'form:/orders/oms/new';

function readOmsCreateDraft(): OmsCreateDraft | undefined {
  return readListUiCache<OmsCreateDraft>(OMS_CREATE_DRAFT_KEY);
}

const emptyLine = (): DraftLine => ({
  key: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  productId: '',
  requestedQuantity: '',
  unitPrice: '',
});

function SectionHeading({ title }: { title: string }): ReactElement {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-600 dark:text-brand-400">
      {title}
    </h2>
  );
}

function formatAvailable(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '…';
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function OmsOrderCreatePage(): ReactElement {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = canAccessInternalTransfer(user?.role);
  const savedDraft = readOmsCreateDraft();

  const [companyId, setCompanyId] = useState(
    savedDraft?.companyId || user?.tenantCompanyId || '',
  );
  const [shipDate, setShipDate] = useState(
    () => savedDraft?.shipDate || localCalendarDateYmd(),
  );
  const [recipientName, setRecipientName] = useState(savedDraft?.recipientName ?? '');
  const [recipientPhone, setRecipientPhone] = useState(() => {
    const stored = phoneFromStoredValue(
      savedDraft?.recipientPhone,
      savedDraft?.recipientPhoneCountry,
    );
    return createInternationalPhoneValue(stored.countryIso, stored.nationalNumber);
  });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [city, setCity] = useState(savedDraft?.city ?? '');
  const [district, setDistrict] = useState(savedDraft?.district ?? '');
  const [addressLine1, setAddressLine1] = useState(savedDraft?.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = useState(savedDraft?.addressLine2 ?? '');
  const [deliveryLat, setDeliveryLat] = useState(savedDraft?.deliveryLat ?? '');
  const [deliveryLng, setDeliveryLng] = useState(savedDraft?.deliveryLng ?? '');
  const [paymentMethod, setPaymentMethod] = useState<OmsPaymentMethod | ''>(
    savedDraft?.paymentMethod ?? '',
  );
  const [notes, setNotes] = useState(savedDraft?.notes ?? '');
  const [lines, setLines] = useState<DraftLine[]>(
    savedDraft?.lines?.length ? savedDraft.lines : [emptyLine()],
  );
  const [error, setError] = useState<string | null>(null);

  const effectiveCompanyId = companyId || user?.tenantCompanyId || '';

  const companies = useQuery({
    queryKey: QK.companies,
    queryFn: () => CompaniesApi.list(),
    staleTime: 10 * 60_000,
    enabled: isAdmin,
  });

  const products = useQuery({
    queryKey: [...QK.products, effectiveCompanyId],
    queryFn: () => ProductsApi.list({ companyId: effectiveCompanyId || undefined, limit: 200 }),
    enabled: !!effectiveCompanyId,
  });

  const clientOptions = useMemo(
    () =>
      companyFilterComboboxOptions(companies.data, 'Select client…').filter((o) => o.value !== ''),
    [companies.data],
  );

  const activeProducts = useMemo(
    () => (products.data?.items ?? []).filter((p: Product) => p.status === 'active'),
    [products.data],
  );

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of activeProducts) map.set(p.id, p);
    return map;
  }, [activeProducts]);

  const usedProductIds = useMemo(
    () => new Set(lines.map((l) => l.productId).filter(Boolean)),
    [lines],
  );

  const optionsForLine = (lineKey: string) => {
    const currentId = lines.find((l) => l.key === lineKey)?.productId;
    return activeProducts
      .filter((p) => p.id === currentId || !usedProductIds.has(p.id))
      .map((p) => ({
        value: p.id,
        label: `${p.sku} — ${p.name}`,
      }));
  };

  const canAddLine = activeProducts.some((p) => !usedProductIds.has(p.id));

  const distinctProductIds = useMemo(
    () => Array.from(new Set(lines.map((l) => l.productId).filter(Boolean))),
    [lines],
  );

  const availabilityResults = useQueries({
    queries: distinctProductIds.map((pid) => ({
      queryKey: QK.availability(pid, effectiveCompanyId),
      queryFn: () => InventoryApi.availability(pid, effectiveCompanyId),
      enabled: !!pid && !!effectiveCompanyId,
      staleTime: 10_000,
    })),
  });

  const availabilityByProduct = useMemo(() => {
    const m = new Map<string, number>();
    distinctProductIds.forEach((pid, i) => {
      const r = availabilityResults[i]?.data;
      if (r) m.set(pid, Number(r.available));
    });
    return m;
  }, [availabilityResults, distinctProductIds]);

  const requestedByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lines) {
      if (!l.productId) continue;
      const n = Number(l.requestedQuantity);
      if (!Number.isFinite(n) || n <= 0) continue;
      m.set(l.productId, (m.get(l.productId) ?? 0) + n);
    }
    return m;
  }, [lines]);

  const shortages = useMemo(() => {
    const out: { productId: string; requested: number; available: number }[] = [];
    requestedByProduct.forEach((qty, pid) => {
      const avail = availabilityByProduct.get(pid);
      if (avail !== undefined && qty > avail) {
        out.push({ productId: pid, requested: qty, available: avail });
      }
    });
    return out;
  }, [availabilityByProduct, requestedByProduct]);

  const clampQtyToAvailable = (productId: string, raw: string): string => {
    if (!productId || raw === '') return raw;
    const n = Number(raw);
    if (!Number.isFinite(n)) return raw;
    const avail = availabilityByProduct.get(productId);
    if (avail !== undefined && n > avail) return String(avail);
    if (n < 0) return '0';
    return raw;
  };

  // Cap quantities once availability arrives (e.g. user typed before the query resolved).
  useEffect(() => {
    if (availabilityByProduct.size === 0) return;
    setLines((prev) => {
      let changed = false;
      const next = prev.map((l) => {
        if (!l.productId || !l.requestedQuantity) return l;
        const clamped = clampQtyToAvailable(l.productId, l.requestedQuantity);
        if (clamped !== l.requestedQuantity) {
          changed = true;
          return { ...l, requestedQuantity: clamped };
        }
        return l;
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clamp when availability map updates
  }, [availabilityByProduct]);

  const linesSum = useMemo(() => {
    return lines.reduce((sum, l) => {
      const qty = Number(l.requestedQuantity);
      const price = Number(l.unitPrice);
      if (!l.productId || !(qty > 0) || !(price >= 0) || Number.isNaN(price)) return sum;
      return sum + qty * price;
    }, 0);
  }, [lines]);

  const totalItems = useMemo(() => {
    return lines.reduce((sum, l) => {
      const qty = Number(l.requestedQuantity);
      if (!l.productId || !(qty > 0)) return sum;
      return sum + qty;
    }, 0);
  }, [lines]);


  const addLine = () => {
    if (!canAddLine) {
      toast.error('All products are already on this order.');
      return;
    }
    setLines((prev) => [...prev, emptyLine()]);
  };

  const createMut = useMutation({
    mutationFn: (payload: CreateOmsOrderInput) => OmsApi.create(payload),
    onSuccess: (order) => {
      clearListUiCache(OMS_CREATE_DRAFT_KEY);
      toast.success('OMS order created.');
      void qc.invalidateQueries({ queryKey: QK.omsOrders });
      void qc.invalidateQueries({ queryKey: QK.omsDashboard });
      navigate(`/orders/oms/${order.id}`);
    },
    onError: (err: Error) => setError(err.message || 'Could not submit order.'),
  });

  useEffect(() => {
    writeListUiCache<OmsCreateDraft>(OMS_CREATE_DRAFT_KEY, {
      companyId,
      shipDate,
      recipientName,
      recipientPhone: recipientPhone.e164 || recipientPhone.nationalNumber,
      recipientPhoneCountry: recipientPhone.countryIso,
      city,
      district,
      addressLine1,
      addressLine2,
      deliveryLat,
      deliveryLng,
      paymentMethod,
      notes,
      lines,
    });
  }, [
    companyId,
    shipDate,
    recipientName,
    recipientPhone,
    city,
    district,
    addressLine1,
    addressLine2,
    deliveryLat,
    deliveryLng,
    paymentMethod,
    notes,
    lines,
  ]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setContactSubmitted(true);
    if (!isValidRecipientName(recipientName)) {
      setError('Name can only contain Arabic or English letters and spaces.');
      return;
    }
    if (!recipientPhone.isEmpty && !recipientPhone.isValid) {
      setError('Please enter a valid phone number.');
      return;
    }
    if (!effectiveCompanyId) {
      setError('Pick a client.');
      return;
    }
    if (!isYmdOnOrAfterLocalToday(shipDate)) {
      setError('Required ship date cannot be before today.');
      return;
    }
    if (shortages.length > 0) {
      setError('Quantity cannot exceed available stock for one or more products.');
      return;
    }
    if (!deliveryLat.trim() || !deliveryLng.trim()) {
      setError('Please select the delivery location on the map before creating the order.');
      return;
    }

    const payloadLines: CreateOmsOrderInput['lines'] = [];
    for (const l of lines) {
      if (!l.productId || !l.requestedQuantity) continue;
      const qty = Number(l.requestedQuantity);
      const unitPrice = Number(l.unitPrice);
      if (!(qty > 0)) continue;
      if (Number.isNaN(unitPrice) || unitPrice < 0) {
        setError('Each product line needs a valid price.');
        return;
      }
      const avail = availabilityByProduct.get(l.productId);
      if (avail !== undefined && qty > avail) {
        setError('Quantity cannot exceed available stock.');
        return;
      }
      payloadLines.push({
        productId: l.productId,
        requestedQuantity: qty,
        unitPrice,
        lineTotal: qty * unitPrice,
      });
    }
    if (payloadLines.length === 0) {
      setError('Add at least one line with quantity and price.');
      return;
    }
    setError(null);
    createMut.mutate({
      companyId: effectiveCompanyId,
      requiredShipDate: shipDate,
      recipientName: recipientName.trim() || undefined,
      recipientPhone: recipientPhone.e164 || undefined,
      city: city.trim() || undefined,
      district: district.trim() || undefined,
      addressLine1: addressLine1.trim() || undefined,
      addressLine2: addressLine2.trim() || undefined,
      shippingReceiverLat: deliveryLat.trim() ? Number(deliveryLat) : undefined,
      shippingReceiverLng: deliveryLng.trim() ? Number(deliveryLng) : undefined,
      notes: notes.trim() || undefined,
      paymentMethod: paymentMethod || undefined,
      subtotal: linesSum,
      codAmount: paymentMethod === 'COD' ? linesSum : undefined,
      currency: 'USD',
      lines: payloadLines,
      shippingPhoneCountry: recipientPhone.countryIso || undefined,
    });
  };

  const loading = createMut.isPending;

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-enter">
      <div className="space-y-3">
        <nav aria-label="Breadcrumb">
          <Link
            to="/orders/oms"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 no-underline hover:text-brand-800 hover:underline"
          >
            <i className="fa-solid fa-arrow-left rtl:rotate-180 text-xs" aria-hidden="true" />
            Back to online orders
          </Link>
        </nav>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-text-strong">New online order</h1>
          <p className="text-sm text-text-muted">Create an order from your store channel.</p>
        </header>
      </div>

      <form id="create-admin-oms" onSubmit={submit} className="space-y-10">
        {error ? (
          <p
            className="rounded-lg border border-status-danger-border bg-status-danger-bg px-3 py-2 text-sm text-status-danger-fg"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {isAdmin ? (
          <section className="space-y-5">
            <SectionHeading title="Client" />
            <Combobox
              label="Client"
              value={companyId}
              onChange={setCompanyId}
              options={clientOptions}
              placeholder="Select client…"
              disabled={loading}
            />
          </section>
        ) : null}

        <section className="space-y-5">
          <SectionHeading title="Shipping information" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <RecipientNameInput
              label="Recipient name"
              value={recipientName}
              onChange={setRecipientName}
              disabled={loading}
              submitted={contactSubmitted}
            />
            <InternationalPhoneInput
              label="Recipient phone"
              value={recipientPhone}
              onChange={setRecipientPhone}
              disabled={loading}
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
              disabled={loading}
            />
            <TextField
              label="Street / Detailed Address"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              disabled={loading}
              placeholder="Street name, building, floor…"
              className="md:col-span-2"
            />
          </div>
          <DeliveryLocationMap
            lat={deliveryLat}
            lng={deliveryLng}
            onChange={({ lat, lng }) => {
              setDeliveryLat(lat);
              setDeliveryLng(lng);
            }}
            disabled={loading}
            governorate={city}
            city={district}
            neighborhood={addressLine1}
            street={addressLine2}
            onRemovePin={() => {
              setDeliveryLat('');
              setDeliveryLng('');
            }}
          />
        </section>

        <section className="space-y-5">
          <SectionHeading title="Order details" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextField
              label="Required ship date"
              type="date"
              required
              min={localCalendarDateYmd()}
              value={shipDate}
              onChange={(e) => setShipDate(e.target.value)}
              disabled={loading}
            />
            <SelectField
              label="Payment method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as OmsPaymentMethod | '')}
              disabled={loading}
              options={[
                { value: '', label: '—' },
                { value: 'COD', label: 'COD' },
                { value: 'PREPAID', label: 'Prepaid' },
                { value: 'CREDIT', label: 'Credit' },
              ]}
            />
          </div>
          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            disabled={loading}
          />
        </section>

        <section className="space-y-4">
          <SectionHeading title="Products" />

          <div className="space-y-3">
            <div className="hidden gap-3 px-0.5 sm:grid sm:grid-cols-[minmax(0,1fr)_120px_120px_40px]">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
                Product
                <span aria-hidden="true" className="ms-0.5 text-danger-600">
                  *
                </span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
                Quantity
                <span aria-hidden="true" className="ms-0.5 text-danger-600">
                  *
                </span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-muted">
                Unit price
                <span aria-hidden="true" className="ms-0.5 text-danger-600">
                  *
                </span>
              </span>
              <span className="sr-only">Remove</span>
            </div>

            {lines.map((line) => {
              const p = productById.get(line.productId);
              const avail = line.productId
                ? availabilityByProduct.get(line.productId)
                : undefined;
              const summed = line.productId
                ? requestedByProduct.get(line.productId) ?? 0
                : 0;
              const isShort = avail !== undefined && summed > avail;

              return (
                <div
                  key={line.key}
                  className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_40px]"
                >
                  <div className="min-w-0">
                    <Combobox
                      value={line.productId}
                      onChange={(id) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.key === line.key
                              ? {
                                  ...l,
                                  productId: id,
                                  requestedQuantity: clampQtyToAvailable(
                                    id,
                                    l.requestedQuantity,
                                  ),
                                }
                              : l,
                          ),
                        )
                      }
                      options={optionsForLine(line.key)}
                      placeholder="Search and select a product..."
                      disabled={loading || !effectiveCompanyId}
                      clearable={false}
                      dropdownInFlow
                      emptyMessage="All products are already on this order."
                    />
                    {p ? (
                      <p className="mt-1.5 text-[11px] text-text-muted">
                        Current quantity:{' '}
                        <span
                          className={[
                            'font-mono font-semibold',
                            isShort ? 'text-status-error-fg' : 'text-text-strong',
                          ].join(' ')}
                        >
                          {formatAvailable(avail)}
                        </span>{' '}
                        <span className="uppercase text-text-body">{p.uom}</span>
                      </p>
                    ) : null}
                    {isShort ? (
                      <p className="mt-1 text-[11px] font-medium text-status-error-fg">
                        Exceeds available stock
                      </p>
                    ) : null}
                  </div>
                  <TextField
                    type="number"
                    min={0}
                    max={avail !== undefined ? avail : undefined}
                    step="1"
                    aria-label="Quantity"
                    value={line.requestedQuantity}
                    onChange={(e) => {
                      const next = clampQtyToAvailable(line.productId, e.target.value);
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key ? { ...l, requestedQuantity: next } : l,
                        ),
                      );
                    }}
                    disabled={loading || !line.productId}
                    placeholder={line.productId ? 'Enter Qty' : 'Select a product first'}
                  />
                  <TextField
                    type="number"
                    min={0}
                    step="0.01"
                    aria-label="Unit price"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key ? { ...l, unitPrice: e.target.value } : l,
                        ),
                      )
                    }
                    required
                    disabled={loading || !line.productId}
                    placeholder={line.productId ? 'Enter price' : 'Select a product first'}
                  />
                  <button
                    type="button"
                    aria-label="Remove"
                    disabled={lines.length <= 1 || loading}
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-text-muted transition hover:border-status-danger-border hover:bg-status-danger-bg hover:text-status-danger-fg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i className="fa-solid fa-trash-can text-sm" aria-hidden />
                  </button>
                </div>
              );
            })}

            <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_120px_120px_40px]">
              <div className="hidden sm:block" />
              <div className="hidden sm:block" />
              <div className="hidden sm:block" />
              <button
                type="button"
                aria-label="+ Add line"
                disabled={loading || !effectiveCompanyId || !canAddLine}
                title={
                  !canAddLine && activeProducts.length > 0
                    ? 'All products are already on this order.'
                    : '+ Add line'
                }
                onClick={addLine}
                className="inline-flex h-10 w-10 items-center justify-center justify-self-start rounded-lg border border-border-strong bg-surface-card text-text-muted transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 sm:justify-self-auto"
              >
                <i className="fa-solid fa-plus text-sm" aria-hidden />
              </button>
            </div>

            <p className="text-sm text-text-muted">
              Total items:{' '}
              <span className="font-semibold tabular-nums text-text-strong">
                {totalItems.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
              <span className="mx-2 text-border-strong">·</span>
              Subtotal:{' '}
              <span className="font-semibold tabular-nums text-text-strong">
                {linesSum.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
              </span>
            </p>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border-subtle pt-6">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={() => navigate('/orders/oms')}
          >
            Cancel
          </Button>
          <button
            type="submit"
            form="create-admin-oms"
            disabled={loading || shortages.length > 0}
            className={FILTER_PRIMARY_BUTTON_CLASS}
          >
            {loading ? (
              <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
            ) : (
              <i className="fa-solid fa-check" aria-hidden="true" />
            )}
            Submit for approval
          </button>
        </div>
      </form>
    </div>
  );
}
