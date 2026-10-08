import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { useToast } from '../ToastProvider';
import { OutboundApi, type OutboundOrder } from '../../api/outbound';
import { ShippingApi, type ShippingProviderAdminView, type ShippingRateQuote } from '../../api/shipping';
import type { OmsOrderListItem } from '../../api/oms';
import {
  buildCarrierShippingFormFromOrder,
  carrierFormToSavePayload,
  toBabelPartsFromCartons,
  totalCartonsWeightKg,
  currencyAfterCarrierSelect,
} from '../shipping/carrier-shipping-form';
import { QK } from '../../constants/query-keys';
import {
  annotateQuotesForUi,
  buildClientDestinationKey,
  BULK_RATES_FETCH_CONCURRENCY,
  createClientQuoteFingerprint,
  filterQuotesByCompany,
  filterQuotesByDeliveryType,
  getClientFxSnapshot,
  isLockedAssignmentState,
  normalizeDeliveryType,
  runPool,
  runProviderAwarePool,
  type AssignmentState,
  type ClientQuoteFingerprint,
  type DeliveryFilter,
  type ProviderCompanyFilter,
} from '../../lib/shipping-compare';

function formatMoney(price: number, currency: string): string {
  const cur = (currency.trim() || 'USD').toUpperCase();
  if (cur === 'SYP') {
    try {
      return `${new Intl.NumberFormat('ar-SY', { maximumFractionDigits: 0 }).format(price)} ل.س`;
    } catch {
      return `${price} ل.س`;
    }
  }
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `$${Number(price).toFixed(2)}`;
  }
}

type Props = {
  open: boolean;
  selectedOrders: OmsOrderListItem[];
  onClose: () => void;
  onSuccess: () => void;
  isArabic?: boolean;
};

export type BulkCarrierQuote = {
  carrierId: string;
  serviceId: string;
  serviceName: string;
  carrierName: string;
  price: number;
  currency: string;
  prices?: Array<{ price: number; currency: string }>;
  preferredCurrency?: string | null;
  deliveryType: 'address' | 'hub';
  isCheapest: boolean;
  isRecommended: boolean;
  logoUrl?: string;
  comparableValueUsd?: number;
};

type BulkShippingRow = {
  orderId: string;
  outboundOrderId: string;
  companyId?: string;
  orderNumber: string;
  clientName: string;
  customerName: string;
  customerPhone: string;
  city: string;
  district: string;
  destinationAddress: string;
  total: string;
  outboundOrder?: OutboundOrder | null;
  quotesLoading: boolean;
  /** Incomplete address only — never per-provider unavailability. */
  quotesError?: string | null;
  allQuotes: BulkCarrierQuote[];
  quotes: BulkCarrierQuote[];
  selectedProviderCode: string;
  selectedServiceId: string;
  selectedCarrierName: string;
  selectedPrice?: number;
  selectedCurrency?: string;
  assignmentState: AssignmentState;
  status: 'pending' | 'sending' | 'success' | 'failed' | 'completed' | 'blocked' | 'skipped';
  awb?: string | null;
  errorMessage?: string | null;
  sentProviderCode: string;
  sentServiceId: string;
  quoteFingerprint?: ClientQuoteFingerprint | null;
  packageType?: string;
  weightKg?: number;
  partsKey?: string;
  destinationKey?: string;
  /** True only when admin explicitly picked Manual. */
  explicitManual?: boolean;
};

function applyFiltersAndRecommend(
  allQuotes: BulkCarrierQuote[],
  deliveryFilter: DeliveryFilter,
  companyFilter: ProviderCompanyFilter,
  preferredCurrency?: string | null,
): BulkCarrierQuote[] {
  const byDelivery = filterQuotesByDeliveryType(allQuotes, deliveryFilter).map((q) => ({
    ...q,
    deliveryType: normalizeDeliveryType(q.deliveryType),
    preferredCurrency: preferredCurrency ?? q.preferredCurrency ?? null,
  }));
  const byCompany = filterQuotesByCompany(byDelivery, companyFilter);
  return annotateQuotesForUi(
    byCompany.map((q) => ({ ...q, available: true })),
    getClientFxSnapshot(),
  ).map((q) => ({
    ...q,
    deliveryType: normalizeDeliveryType(q.deliveryType),
    isCheapest: q.isCheapest,
    isRecommended: q.isRecommended,
  }));
}

function mapQuote(q: ShippingRateQuote): BulkCarrierQuote {
  return {
    carrierId: q.carrierId,
    serviceId: q.serviceId,
    serviceName: q.serviceName,
    carrierName: q.carrierName,
    price: q.price,
    currency: q.currency || 'USD',
    prices: q.prices,
    deliveryType: normalizeDeliveryType(q.deliveryType),
    isCheapest: Boolean(q.isCheapest),
    isRecommended: Boolean(q.isRecommended ?? q.isCheapest),
    logoUrl: q.logoUrl,
  };
}

export function OmsBulkShippingDetailsModal({
  open,
  selectedOrders,
  onClose,
  onSuccess,
  isArabic = false,
}: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<BulkShippingRow[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('mixed');
  const [companyFilter, setCompanyFilter] = useState<ProviderCompanyFilter>('auto');
  const [ratesProgress, setRatesProgress] = useState<{
    total: number;
    done: number;
    startedAt: number;
    providerInFlight: Record<string, { name: string; count: number }>;
  } | null>(null);
  const [ratesClockMs, setRatesClockMs] = useState(() => Date.now());
  const quotesAbortRef = useRef<AbortController | null>(null);
  const deliveryFilterRef = useRef<DeliveryFilter>('mixed');
  const companyFilterRef = useRef<ProviderCompanyFilter>('auto');
  const activeProvidersRef = useRef<ShippingProviderAdminView[]>([]);

  const providersQuery = useQuery({
    queryKey: ['shipping-providers-list'],
    queryFn: () => ShippingApi.listProviders(),
    enabled: open,
    staleTime: 60_000,
  });

  const activeProviders = useMemo(
    () => (providersQuery.data ?? []).filter((p: ShippingProviderAdminView) => p.enabled && p.connected),
    [providersQuery.data],
  );
  activeProvidersRef.current = activeProviders;

  const companyOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [
      { value: 'auto', label: isArabic ? 'تلقائي (الأرخص)' : 'Auto (cheapest)' },
      { value: 'manual', label: isArabic ? 'شحن يدوي (Manual)' : 'Manual shipping' },
    ];
    for (const p of activeProviders) {
      opts.push({ value: p.code, label: p.name || p.code });
    }
    // Common Sila courier labels that appear in serviceName
    for (const name of ['مسارات', 'Masarat', 'Tarabut', 'ترابط', 'Karam', 'كرم', 'DELIVEROO']) {
      if (!opts.some((o) => o.value.toUpperCase() === name.toUpperCase())) {
        opts.push({ value: name, label: name });
      }
    }
    return opts;
  }, [activeProviders, isArabic]);

  useEffect(() => {
    if (!ratesProgress || ratesProgress.done >= ratesProgress.total) return;
    const id = window.setInterval(() => setRatesClockMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [ratesProgress]);

  const eligibleOrders = useMemo(() => {
    return selectedOrders.filter((order) => {
      const outboundStatus = order.linkedOutboundOrder?.status;
      return (
        outboundStatus === 'waiting_for_shipping_method' ||
        outboundStatus === 'waiting_for_shipping_details'
      );
    });
  }, [selectedOrders]);

  const applyAssignmentFromQuotes = useCallback(
    (
      r: BulkShippingRow,
      annotated: BulkCarrierQuote[],
      company: ProviderCompanyFilter,
      keepUserPick: boolean,
    ): BulkShippingRow => {
      if (isLockedAssignmentState(r.assignmentState)) {
        return { ...r, quotes: annotated };
      }
      // Company filter = Manual → assign every open row to manual shipping.
      if (company.trim().toUpperCase() === 'MANUAL') {
        return {
          ...r,
          quotes: annotated,
          selectedProviderCode: 'manual',
          selectedServiceId: '',
          selectedCarrierName: isArabic ? 'شحن يدوي' : 'Manual',
          selectedPrice: undefined,
          selectedCurrency: undefined,
          assignmentState: 'USER_MODIFIED',
          explicitManual: true,
          status: 'pending',
          quoteFingerprint: null,
          errorMessage: null,
        };
      }

      // Keep a prior explicit Manual pick only under Auto (company filters override it).
      if (r.explicitManual && company === 'auto') {
        return {
          ...r,
          quotes: annotated,
          selectedProviderCode: 'manual',
          selectedServiceId: '',
          selectedCarrierName: isArabic ? 'شحن يدوي' : 'Manual',
          assignmentState: 'USER_MODIFIED',
          status: 'pending',
          errorMessage: null,
        };
      }

      if (company !== 'auto' && annotated.length === 0) {
        return {
          ...r,
          quotes: annotated,
          selectedProviderCode: '',
          selectedServiceId: '',
          selectedCarrierName: '',
          selectedPrice: undefined,
          selectedCurrency: undefined,
          assignmentState: 'BLOCKED',
          status: 'blocked',
          explicitManual: false,
          quoteFingerprint: null,
          errorMessage: isArabic
            ? 'الشركة المختارة غير متاحة لهذا الطلب — يمكنك اختيار شحن يدوي'
            : 'Selected company not available — Manual shipping is still available',
        };
      }

      if (keepUserPick && r.assignmentState === 'USER_MODIFIED') {
        const stillVisible = annotated.some(
          (q) => q.serviceId === r.selectedServiceId && q.carrierId === r.selectedProviderCode,
        );
        if (stillVisible) return { ...r, quotes: annotated, status: 'pending', errorMessage: null };
      }

      const cheapest = annotated.find((q) => q.isRecommended) || annotated[0];
      if (!cheapest) {
        return {
          ...r,
          quotes: annotated,
          selectedProviderCode: '',
          selectedServiceId: '',
          selectedCarrierName: '',
          selectedPrice: undefined,
          selectedCurrency: undefined,
          assignmentState: 'UNASSIGNED',
          status: 'pending',
          quoteFingerprint: null,
          errorMessage: null,
        };
      }

      return {
        ...r,
        quotes: annotated,
        selectedProviderCode: cheapest.carrierId,
        selectedServiceId: cheapest.serviceId,
        selectedCarrierName: cheapest.serviceName,
        selectedPrice: cheapest.price,
        selectedCurrency: cheapest.currency,
        assignmentState: company === 'auto' ? 'RECOMMENDED' : 'USER_MODIFIED',
        status: 'pending',
        errorMessage: null,
        quoteFingerprint: createClientQuoteFingerprint({
          providerCode: cheapest.carrierId,
          serviceId: cheapest.serviceId,
          currency: cheapest.currency,
          amount: cheapest.price,
          deliveryType: cheapest.deliveryType,
          packageType: r.packageType || 'box',
          weightKg: r.packageType === 'envelope' ? 1 : r.weightKg || 1,
          destinationKey: r.destinationKey || '',
          partsKey: r.partsKey,
        }),
      };
    },
    [isArabic],
  );

  const reapplyFilters = useCallback(
    (delivery: DeliveryFilter, company: ProviderCompanyFilter) => {
      deliveryFilterRef.current = delivery;
      companyFilterRef.current = company;
      setRows((prev) =>
        prev.map((r) => {
          if (isLockedAssignmentState(r.assignmentState)) return r;
          // Filter changes always re-select the cheapest under the new filter —
          // never keep a prior pick (that looked like "random" sticky selections).
          const annotated = applyFiltersAndRecommend(
            r.allQuotes,
            delivery,
            company,
            null,
          );
          return applyAssignmentFromQuotes(
            { ...r, explicitManual: false },
            annotated,
            company,
            false,
          );
        }),
      );
    },
    [applyAssignmentFromQuotes],
  );

  useEffect(() => {
    if (!open) {
      quotesAbortRef.current?.abort();
      return;
    }

    const abortController = new AbortController();
    quotesAbortRef.current = abortController;

    const initialRows: BulkShippingRow[] = eligibleOrders.map((order) => {
      const outboundId = order.outboundOrderId ?? order.linkedOutboundOrder?.id ?? '';
      const existingAwb =
        order.trackingNumber?.trim() ||
        order.linkedOutboundOrder?.trackingNumber?.trim() ||
        null;
      // Confirmed ONLY when a real AWB already exists — never because shippingMethod defaults to manual.
      const hasAwb = Boolean(existingAwb);
      const priorCarrierCode =
        order.linkedOutboundOrder?.shippingProviderCode ||
        (order.shippingMethod === 'carrier' ? (order as { shippingProviderCode?: string }).shippingProviderCode : '') ||
        '';
      const priorCarrier = priorCarrierCode ? priorCarrierCode.toUpperCase() : '';

      return {
        orderId: order.id,
        outboundOrderId: outboundId,
        companyId: order.companyId,
        orderNumber: order.orderNumber,
        clientName: order.company?.name ?? '—',
        customerName: order.recipientName ?? '—',
        customerPhone: order.recipientPhone ?? '—',
        city: order.city ?? '—',
        district: '',
        destinationAddress: order.city ?? '—',
        total: order.total ? `${order.total} ${order.currency ?? ''}`.trim() : '—',
        quotesLoading: Boolean(outboundId),
        quotesError: outboundId
          ? null
          : isArabic
            ? 'لا يوجد طلب مستودع مرتبط'
            : 'No linked outbound order',
        allQuotes: [],
        quotes: [],
        selectedProviderCode: hasAwb ? priorCarrier || '' : '',
        selectedServiceId: '',
        selectedCarrierName: hasAwb ? order.shippingCarrierName || order.carrier || '' : '',
        assignmentState: hasAwb ? 'CONFIRMED' : 'UNASSIGNED',
        status: hasAwb ? 'success' : 'pending',
        awb: existingAwb,
        sentProviderCode: hasAwb ? priorCarrier : '',
        sentServiceId: '',
        errorMessage: null,
        explicitManual: false,
      };
    });

    setRows(initialRows);
    setIsSending(false);
    setIsCompleting(false);
    setDeliveryFilter('mixed');
    setCompanyFilter('auto');
    deliveryFilterRef.current = 'mixed';
    companyFilterRef.current = 'auto';

    const rowsToFetch = initialRows.filter((row) => Boolean(row.outboundOrderId));
    // Coalesce identical destination/weight quotes across orders in this modal open.
    const quoteInflight = new Map<string, Promise<BulkCarrierQuote[]>>();
    const fetchTotal = rowsToFetch.length;
    setRatesProgress(
      fetchTotal > 0
        ? { total: fetchTotal, done: 0, startedAt: Date.now(), providerInFlight: {} }
        : null,
    );

    const bumpProvider = (code: string, name: string, delta: number) => {
      setRatesProgress((prev) => {
        if (!prev) return prev;
        const cur = prev.providerInFlight[code] ?? { name, count: 0 };
        const nextCount = Math.max(0, cur.count + delta);
        const providerInFlight = { ...prev.providerInFlight };
        if (nextCount === 0) delete providerInFlight[code];
        else providerInFlight[code] = { name, count: nextCount };
        return { ...prev, providerInFlight };
      });
    };

    const markOrderDone = () => {
      setRatesProgress((prev) => {
        if (!prev) return prev;
        const done = Math.min(prev.total, prev.done + 1);
        return done >= prev.total ? null : { ...prev, done };
      });
    };

    void runPool(rowsToFetch, BULK_RATES_FETCH_CONCURRENCY, async (row) => {
      if (abortController.signal.aborted) return;
      try {
        const outbound = await OutboundApi.get(row.outboundOrderId);
        if (abortController.signal.aborted) return;

        const form = buildCarrierShippingFormFromOrder(outbound);
        const weightKg =
          form.packageType === 'envelope'
            ? 1
            : totalCartonsWeightKg(form.cartons, form.catalog) ||
              Number(outbound.shippingWeightKg) ||
              1;
        const parts = toBabelPartsFromCartons(form.cartons, form.catalog, form.packageType);
        const partsKey = (parts ?? []).map((p) => String(p.weight)).join(',');
        const codAmount =
          Number(
            outbound.codAmount ??
              (outbound as { omsOrder?: { total?: number } }).omsOrder?.total,
          ) || undefined;

        const governorate = (form.city || outbound.city || row.city || '').trim();
        const city = (form.district || outbound.district || '').trim();
        const neighborhood = (form.addressLine1 || outbound.addressLine1 || '').trim();
        const destinationKey = buildClientDestinationKey({
          neighbourhoodId: outbound.babelNeighbourhoodId,
          governorate,
          city: city || governorate,
          neighborhood: neighborhood || city,
        });

        let allQuotes: BulkCarrierQuote[] = [];
        let addressError: string | null = null;

        if (!governorate) {
          addressError = isArabic ? 'العنوان غير مكتمل' : 'Incomplete address';
        } else {
          try {
            const rateKey = JSON.stringify({
              packageType: form.packageType,
              weightKg: Math.max(weightKg, 0.1),
              parts: partsKey,
              codAmount: codAmount ?? null,
              neighbourhoodId: outbound.babelNeighbourhoodId ?? null,
              governorate,
              city: city || governorate,
              neighborhood: neighborhood || city,
            });
            let pending = quoteInflight.get(rateKey);
            if (!pending) {
              pending = (async () => {
                const basePayload = {
                  packageType: form.packageType,
                  weightKg: Math.max(weightKg, 0.1),
                  pickupType: 'address' as const,
                  volumeCbm: 0,
                  governorate,
                  city: city || governorate,
                  neighborhood: neighborhood || city,
                  parts,
                  codAmount,
                  neighbourhoodId: outbound.babelNeighbourhoodId ?? undefined,
                  deliveryType: 'address' as const,
                  includeAllDeliveryTypes: true,
                };
                const providers = activeProvidersRef.current;
                // Per-provider calls so the UI can show which carrier is slow.
                if (providers.length === 0) {
                  const res = await ShippingApi.quoteRates(basePayload, abortController.signal);
                  return (res.quotes ?? [])
                    .filter((q: ShippingRateQuote) => q.available && Number.isFinite(q.price))
                    .map((q) =>
                      mapQuote({
                        ...q,
                        deliveryType: q.deliveryType || 'address',
                      }),
                    );
                }
                const chunks = await Promise.all(
                  providers.map(async (p) => {
                    const code = p.code.toUpperCase();
                    bumpProvider(code, p.name || p.code, +1);
                    try {
                      const res = await ShippingApi.quoteRates(
                        { ...basePayload, providerCode: p.code },
                        abortController.signal,
                      );
                      return (res.quotes ?? [])
                        .filter((q: ShippingRateQuote) => q.available && Number.isFinite(q.price))
                        .map((q) =>
                          mapQuote({
                            ...q,
                            deliveryType: q.deliveryType || 'address',
                          }),
                        );
                    } catch {
                      return [] as BulkCarrierQuote[];
                    } finally {
                      bumpProvider(code, p.name || p.code, -1);
                    }
                  }),
                );
                const byService = new Map<string, BulkCarrierQuote>();
                for (const list of chunks) {
                  for (const q of list) {
                    const key = q.serviceId || `${q.carrierId}:${q.deliveryType}:${q.price}`;
                    if (!byService.has(key)) byService.set(key, q);
                  }
                }
                return [...byService.values()];
              })();
              quoteInflight.set(rateKey, pending);
            }
            allQuotes = await pending;
          } catch (err: unknown) {
            if (abortController.signal.aborted) return;
            addressError =
              err instanceof Error
                ? err.message
                : isArabic
                  ? 'تعذر جلب الأسعار'
                  : 'Failed to fetch rates';
          }
        }

        if (abortController.signal.aborted) return;
        setRows((prev) =>
          prev.map((r) => {
            if (r.orderId !== row.orderId) return r;
            const base: BulkShippingRow = {
              ...r,
              outboundOrder: outbound,
              city: governorate || r.city,
              district: city,
              destinationAddress:
                [governorate, city, neighborhood].filter(Boolean).join(' - ') ||
                r.destinationAddress,
              quotesLoading: false,
              quotesError: addressError,
              allQuotes,
              packageType: form.packageType,
              weightKg,
              partsKey,
              destinationKey,
            };
            if (isLockedAssignmentState(r.assignmentState)) {
              return {
                ...base,
                quotes: applyFiltersAndRecommend(
                  allQuotes,
                  deliveryFilterRef.current,
                  companyFilterRef.current,
                ),
              };
            }
            const annotated = applyFiltersAndRecommend(
              allQuotes,
              deliveryFilterRef.current,
              companyFilterRef.current,
            );
            return applyAssignmentFromQuotes(base, annotated, companyFilterRef.current, false);
          }),
        );
      } catch (err: unknown) {
        if (abortController.signal.aborted) return;
        setRows((prev) =>
          prev.map((r) =>
            r.orderId === row.orderId
              ? {
                  ...r,
                  quotesLoading: false,
                  quotesError:
                    err instanceof Error
                      ? err.message
                      : isArabic
                        ? 'فشل تحميل بيانات الطلب'
                        : 'Failed to load order',
                }
              : r,
          ),
        );
      } finally {
        if (!abortController.signal.aborted) markOrderDone();
      }
    });

    return () => {
      abortController.abort();
      setRatesProgress(null);
    };
  }, [
    open,
    eligibleOrders
      .map((order) => `${order.id}:${order.shippingMethod ?? ''}:${order.trackingNumber ?? ''}`)
      .join('|'),
    activeProviders,
    isArabic,
    applyAssignmentFromQuotes,
  ]);

  const softSaveAssignment = async (row: BulkShippingRow) => {
    if (!row.outboundOrderId || !row.selectedProviderCode || row.selectedProviderCode === 'manual') {
      return;
    }
    if (row.assignmentState === 'BLOCKED' || row.assignmentState === 'UNASSIGNED') return;
    try {
      const outbound = row.outboundOrder ?? (await OutboundApi.get(row.outboundOrderId));
      const form = buildCarrierShippingFormFromOrder(outbound);
      form.shippingProviderCode = row.selectedProviderCode;
      form.shippingServiceId = row.selectedServiceId;
      const picked = row.quotes.find((q) => q.serviceId === row.selectedServiceId);
      if (picked?.deliveryType) form.deliveryType = picked.deliveryType;
      form.currency =
        row.selectedCurrency === 'SYP'
          ? 'SYP'
          : row.selectedCurrency === 'USD'
            ? 'USD'
            : currencyAfterCarrierSelect(row.selectedProviderCode);

      await OutboundApi.saveShippingDetails(
        row.outboundOrderId,
        {
          ...carrierFormToSavePayload(form),
          shippingMethod: 'carrier',
          shippingProviderCode: row.selectedProviderCode,
          shippingServiceId: row.selectedServiceId || null,
          shippingQuotedPrice: row.selectedPrice ?? null,
          shippingQuotedCurrency: row.selectedCurrency ?? null,
        } as Parameters<typeof OutboundApi.saveShippingDetails>[1],
        outbound.companyId,
      );
    } catch {
      /* soft-save best-effort for batch analysis */
    }
  };

  const handleDeliveryFilterChange = (filter: DeliveryFilter) => {
    setDeliveryFilter(filter);
    reapplyFilters(filter, companyFilter);
  };

  const handleCompanyFilterChange = (filter: ProviderCompanyFilter) => {
    setCompanyFilter(filter);
    reapplyFilters(deliveryFilter, filter);
  };

  const handleSelectQuote = (orderId: string, quote: BulkCarrierQuote) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.orderId !== orderId || isLockedAssignmentState(r.assignmentState)) return r;
        const next: BulkShippingRow = {
          ...r,
          selectedProviderCode: quote.carrierId,
          selectedServiceId: quote.serviceId,
          selectedCarrierName: quote.serviceName,
          selectedPrice: quote.price,
          selectedCurrency: quote.currency,
          assignmentState: 'USER_MODIFIED',
          explicitManual: false,
          status: 'pending',
          awb: null,
          errorMessage: null,
          quoteFingerprint: createClientQuoteFingerprint({
            providerCode: quote.carrierId,
            serviceId: quote.serviceId,
            currency: quote.currency,
            amount: quote.price,
            deliveryType: quote.deliveryType,
            packageType: r.packageType || 'box',
            weightKg: r.packageType === 'envelope' ? 1 : r.weightKg || 1,
            destinationKey: r.destinationKey || '',
            partsKey: r.partsKey,
          }),
        };
        void softSaveAssignment(next);
        return next;
      }),
    );
  };

  const handleToggleQuoteCurrency = (
    orderId: string,
    quote: BulkCarrierQuote,
    currency: 'USD' | 'SYP',
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.orderId !== orderId || isLockedAssignmentState(r.assignmentState)) return r;
        const updatedAll = r.allQuotes.map((q) =>
          q.serviceId === quote.serviceId
            ? {
                ...q,
                preferredCurrency: currency,
                ...(q.prices?.find((p) => p.currency.toUpperCase() === currency)
                  ? {
                      price: q.prices.find((p) => p.currency.toUpperCase() === currency)!.price,
                      currency,
                    }
                  : {}),
              }
            : q,
        );
        const annotated = applyFiltersAndRecommend(
          updatedAll,
          deliveryFilter,
          companyFilter,
          currency,
        );
        const selected = annotated.find((q) => q.serviceId === quote.serviceId) || quote;
        const next: BulkShippingRow = {
          ...r,
          allQuotes: updatedAll,
          quotes: annotated,
          selectedProviderCode: selected.carrierId,
          selectedServiceId: selected.serviceId,
          selectedCarrierName: selected.serviceName,
          selectedPrice: selected.price,
          selectedCurrency: currency,
          assignmentState: 'USER_MODIFIED',
          explicitManual: false,
          status: 'pending',
        };
        void softSaveAssignment(next);
        return next;
      }),
    );
  };

  const handleSelectManual = (orderId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.orderId !== orderId || isLockedAssignmentState(r.assignmentState)) return r;
        return {
          ...r,
          selectedProviderCode: 'manual',
          selectedServiceId: '',
          selectedCarrierName: 'Manual',
          selectedPrice: undefined,
          selectedCurrency: undefined,
          assignmentState: 'USER_MODIFIED',
          explicitManual: true,
          status: 'pending',
          awb: null,
          errorMessage: null,
          quoteFingerprint: null,
        };
      }),
    );
  };

  const handleReopenAssignment = (orderId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.orderId !== orderId || r.assignmentState !== 'CONFIRMED') return r;
        return { ...r, assignmentState: 'USER_MODIFIED', status: 'pending' };
      }),
    );
  };

  // Soft-save recommendations once quotes settle
  useEffect(() => {
    if (!open) return;
    const ready = rows.filter(
      (r) =>
        !r.quotesLoading &&
        (r.assignmentState === 'RECOMMENDED' || r.assignmentState === 'USER_MODIFIED') &&
        r.selectedProviderCode &&
        r.selectedProviderCode !== 'manual',
    );
    for (const r of ready.slice(0, 50)) {
      void softSaveAssignment(r);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional settle pass
  }, [open, rows.filter((r) => !r.quotesLoading).length]);

  const successCount = rows.filter((r) => r.status === 'success' || r.status === 'completed').length;
  const failedRows = rows.filter((r) => r.status === 'failed');
  const blockedCount = rows.filter((r) => r.assignmentState === 'BLOCKED').length;
  const unassignedCount = rows.filter((r) => r.assignmentState === 'UNASSIGNED').length;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const sendOneRow = async (updatedRows: BulkShippingRow[], rowIndex: number) => {
    const target = updatedRows[rowIndex];
    if (
      target.assignmentState === 'BLOCKED' ||
      target.assignmentState === 'UNASSIGNED' ||
      target.assignmentState === 'CONFIRMED'
    ) {
      if (target.assignmentState !== 'CONFIRMED') target.status = 'skipped';
      setRows([...updatedRows]);
      return;
    }
    if (!target.outboundOrderId) {
      target.status = 'failed';
      target.errorMessage = isArabic ? 'لا يوجد طلب مستودع مرتبط' : 'No linked outbound order';
      setRows([...updatedRows]);
      return;
    }
    if (!target.selectedProviderCode) {
      target.status = 'skipped';
      setRows([...updatedRows]);
      return;
    }

    target.status = 'sending';
    setRows([...updatedRows]);

    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const outbound = target.outboundOrder ?? (await OutboundApi.get(target.outboundOrderId));
        const existingCreated = (outbound.carrierShipments ?? []).find(
          (s) => s.status === 'created' || Boolean(s.externalAwb),
        );
        if (existingCreated && target.selectedProviderCode !== 'manual') {
          target.status = 'success';
          target.awb = existingCreated.externalAwb || outbound.trackingNumber || 'Success';
          target.sentProviderCode = target.selectedProviderCode;
          target.sentServiceId = target.selectedServiceId;
          target.errorMessage = null;
          setRows([...updatedRows]);
          return;
        }

        const form = buildCarrierShippingFormFromOrder(outbound);
        form.shippingProviderCode = target.selectedProviderCode;
        form.shippingServiceId = target.selectedServiceId;
        form.currency =
          target.selectedCurrency === 'SYP'
            ? 'SYP'
            : target.selectedCurrency === 'USD'
              ? 'USD'
              : currencyAfterCarrierSelect(target.selectedProviderCode);
        const selectedQuote = target.quotes.find((q) => q.serviceId === target.selectedServiceId);
        if (selectedQuote?.deliveryType) form.deliveryType = selectedQuote.deliveryType;

        await OutboundApi.saveShippingDetails(
          target.outboundOrderId,
          {
            ...carrierFormToSavePayload(form),
            shippingMethod:
              target.selectedProviderCode === 'manual' ? ('manual' as const) : ('carrier' as const),
            shippingProviderCode:
              target.selectedProviderCode === 'manual' ? null : target.selectedProviderCode,
            shippingServiceId:
              target.selectedProviderCode === 'manual' ? null : target.selectedServiceId || null,
            shippingQuotedPrice: target.selectedPrice ?? null,
            shippingQuotedCurrency: target.selectedCurrency ?? null,
          } as Parameters<typeof OutboundApi.saveShippingDetails>[1],
          outbound.companyId,
        );

        if (target.selectedProviderCode === 'manual') {
          target.status = 'success';
          target.awb = null;
          target.sentProviderCode = 'manual';
          target.sentServiceId = '';
          target.errorMessage = null;
          setRows([...updatedRows]);
          return;
        }

        const weightForFp =
          form.packageType === 'envelope'
            ? 1
            : target.weightKg || totalCartonsWeightKg(form.cartons, form.catalog) || 1;

        const fingerprint =
          target.quoteFingerprint ??
          (target.selectedPrice != null
            ? createClientQuoteFingerprint({
                providerCode: target.selectedProviderCode,
                serviceId: target.selectedServiceId,
                currency: target.selectedCurrency || 'USD',
                amount: target.selectedPrice,
                deliveryType: form.deliveryType,
                packageType: form.packageType,
                weightKg: weightForFp,
                destinationKey: target.destinationKey || '',
                partsKey: target.partsKey,
              })
            : null);

        const sentOrder = await OutboundApi.sendShippingDetails(
          target.outboundOrderId,
          outbound.companyId,
          fingerprint ? { quoteFingerprint: fingerprint } : undefined,
        );
        const createdShipment = (sentOrder.carrierShipments ?? []).find(
          (s) => s.status === 'created' || Boolean(s.externalAwb),
        );

        target.status = 'success';
        target.awb = createdShipment?.externalAwb || sentOrder.trackingNumber || 'Success';
        target.sentProviderCode = target.selectedProviderCode;
        target.sentServiceId = target.selectedServiceId;
        target.errorMessage = null;
        target.outboundOrder = sentOrder;
        setRows([...updatedRows]);
        return;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : isArabic ? 'فشل إرسال الشحنة' : 'Send failed';
        const transient = /rate limit|timeout|temporar|429|503|ECONNRESET|network/i.test(message);
        if (transient && attempt < maxAttempts - 1) {
          await sleep(400 * Math.pow(2, attempt));
          try {
            const check = await OutboundApi.get(target.outboundOrderId);
            const created = (check.carrierShipments ?? []).find(
              (s) => s.status === 'created' || Boolean(s.externalAwb),
            );
            if (created) {
              target.status = 'success';
              target.awb = created.externalAwb || check.trackingNumber || 'Success';
              target.sentProviderCode = target.selectedProviderCode;
              target.sentServiceId = target.selectedServiceId;
              target.errorMessage = null;
              setRows([...updatedRows]);
              return;
            }
          } catch {
            /* retry */
          }
          continue;
        }
        target.status = 'failed';
        target.errorMessage = message;
        setRows([...updatedRows]);
        return;
      }
    }
  };

  const handleSendShipments = async () => {
    if (isSending || rows.length === 0) return;
    setIsSending(true);

    const updatedRows = [...rows];
    const work: Array<{ providerCode: string; index: number }> = [];

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      if (row.status === 'completed' || row.assignmentState === 'CONFIRMED') continue;
      if (row.assignmentState === 'BLOCKED' || row.assignmentState === 'UNASSIGNED') {
        row.status = 'skipped';
        continue;
      }
      const unchanged =
        row.status === 'success' &&
        row.selectedProviderCode === row.sentProviderCode &&
        row.selectedServiceId === row.sentServiceId;
      if (unchanged) continue;
      work.push({
        providerCode: row.selectedProviderCode === 'manual' ? 'MANUAL' : row.selectedProviderCode,
        index: i,
      });
    }

    setRows([...updatedRows]);
    await runProviderAwarePool(work, async (item) => {
      await sendOneRow(updatedRows, item.index);
    });

    setIsSending(false);
    void qc.invalidateQueries({ queryKey: QK.omsOrders });
    void qc.invalidateQueries({ queryKey: QK.outboundOrders });
    void qc.invalidateQueries({ queryKey: QK.omsBatches });

    const finalSuccess = updatedRows.filter((r) => r.status === 'success').length;
    const finalFailed = updatedRows.filter((r) => r.status === 'failed').length;
    const skipped = updatedRows.filter((r) => r.status === 'skipped').length;

    toast.success(
      isArabic
        ? `اكتمل الإرسال: ${finalSuccess} ناجح، ${finalFailed} فشل، ${skipped} متجاوز`
        : `Dispatch finished: ${finalSuccess} ok, ${finalFailed} failed, ${skipped} skipped.`,
    );
  };

  const handleConfirmShippingComplete = async () => {
    const successful = rows.filter(
      (r) =>
        r.status === 'success' &&
        r.assignmentState !== 'BLOCKED' &&
        r.assignmentState !== 'UNASSIGNED',
    );
    if (successful.length === 0 || isCompleting) return;

    setIsCompleting(true);
    let completedCount = 0;
    const updatedRows = [...rows];

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      if (row.status !== 'success') continue;
      if (row.assignmentState === 'BLOCKED' || row.assignmentState === 'UNASSIGNED') continue;

      try {
        await OutboundApi.completeShippingDetails(row.outboundOrderId);
        row.status = 'completed';
        row.assignmentState = 'CONFIRMED';
        completedCount++;
      } catch (err: unknown) {
        row.status = 'failed';
        row.errorMessage =
          err instanceof Error
            ? err.message
            : isArabic
              ? 'فشل إكمال الشحن'
              : 'Failed to complete shipping';
      }
      setRows([...updatedRows]);
    }

    setIsCompleting(false);
    void qc.invalidateQueries({ queryKey: QK.omsOrders });
    void qc.invalidateQueries({ queryKey: QK.outboundOrders });
    void qc.invalidateQueries({ queryKey: QK.omsBatches });

    toast.success(
      isArabic
        ? `تم تأكيد اكتمال الشحن لـ ${completedCount} طلب`
        : `Marked shipping complete for ${completedCount} order(s).`,
    );

    onSuccess();
    if (completedCount === successful.length) onClose();
  };

  const filterOptions: Array<{ value: DeliveryFilter; labelAr: string; labelEn: string }> = [
    { value: 'mixed', labelAr: 'الكل (Mixed)', labelEn: 'All / Mixed' },
    { value: 'address', labelAr: 'توصيل منزلي', labelEn: 'Home Delivery' },
    { value: 'hub', labelAr: 'توصيل للفرع', labelEn: 'Hub Delivery' },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isArabic ? `شحن الطلبات المحددة (${rows.length})` : `Bulk Shipping (${rows.length})`}
      widthClass="max-w-7xl"
    >
      <div className="flex flex-col gap-4 p-6" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface-sunken p-3">
          <span className="text-xs font-semibold text-text-strong">
            {isArabic ? 'نوع التوصيل' : 'Delivery Type'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={isSending || isCompleting}
                onClick={() => handleDeliveryFilterChange(opt.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  deliveryFilter === opt.value
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-border-subtle bg-surface-card text-text-muted hover:bg-surface-hover'
                }`}
              >
                {isArabic ? opt.labelAr : opt.labelEn}
              </button>
            ))}
          </div>
          <span className="text-xs font-semibold text-text-strong ms-2">
            {isArabic ? 'شركة الشحن' : 'Shipping Company'}
          </span>
          <select
            className="rounded-lg border border-border-subtle bg-surface-card px-2 py-1.5 text-xs font-semibold"
            value={companyFilter}
            disabled={isSending || isCompleting}
            onChange={(e) => handleCompanyFilterChange(e.target.value)}
          >
            {companyOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-text-muted">
            {isArabic
              ? 'التوصية بعد الفلتر · بدون تأكيد تلقائي · Manual يدوي فقط'
              : 'Recommend after filter · no auto-confirm · Manual is manual-only'}
          </span>
        </div>

        {ratesProgress && ratesProgress.total > 0 && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/30 px-4 py-3">
            {(() => {
              const pct = Math.min(
                100,
                Math.round((ratesProgress.done / ratesProgress.total) * 100),
              );
              const elapsedMs = Math.max(0, ratesClockMs - ratesProgress.startedAt);
              const remainingOrders = Math.max(0, ratesProgress.total - ratesProgress.done);
              const avgMs =
                ratesProgress.done > 0 ? elapsedMs / ratesProgress.done : 0;
              const etaMs =
                ratesProgress.done > 0 ? Math.round(avgMs * remainingOrders) : null;
              const formatEta = (ms: number) => {
                const sec = Math.max(1, Math.ceil(ms / 1000));
                if (sec < 60) return isArabic ? `${sec} ث` : `${sec}s`;
                const m = Math.floor(sec / 60);
                const s = sec % 60;
                return isArabic ? `${m} د ${s} ث` : `${m}m ${s}s`;
              };
              const activeNames = Object.values(ratesProgress.providerInFlight)
                .filter((p) => p.count > 0)
                .map((p) => p.name);
              return (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-sky-900 dark:text-sky-100">
                      {isArabic
                        ? `جاري جلب الأسعار… ${pct}% (${ratesProgress.done}/${ratesProgress.total})`
                        : `Fetching rates… ${pct}% (${ratesProgress.done}/${ratesProgress.total})`}
                    </span>
                    <span className="text-sky-800/80 dark:text-sky-200/80 tabular-nums">
                      {etaMs == null
                        ? isArabic
                          ? 'جاري تقدير الوقت…'
                          : 'Estimating time…'
                        : isArabic
                          ? `المتبقي ≈ ${formatEta(etaMs)}`
                          : `Remaining ≈ ${formatEta(etaMs)}`}
                      <span className="mx-1.5 opacity-40">·</span>
                      {isArabic
                        ? `مرّ ${formatEta(elapsedMs)}`
                        : `Elapsed ${formatEta(elapsedMs)}`}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-[width] duration-300 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-sky-900/80 dark:text-sky-100/80">
                    {activeNames.length > 0
                      ? isArabic
                        ? `الآن: ${activeNames.join(' · ')}`
                        : `Loading: ${activeNames.join(' · ')}`
                      : isArabic
                        ? 'بانتظار استجابة شركات الشحن…'
                        : 'Waiting on carrier responses…'}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-sunken p-3 rounded-xl border border-border-subtle/70">
          <div className="flex items-center gap-3 flex-wrap text-xs text-text-muted">
            <span>
              {isArabic
                ? `مرسل: ${successCount} · فاشل: ${failedRows.length} · محظور: ${blockedCount} · بدون تعيين: ${unassignedCount}`
                : `Sent: ${successCount} · Failed: ${failedRows.length} · Blocked: ${blockedCount} · Unassigned: ${unassignedCount}`}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <i className="fa-solid fa-sparkles text-emerald-500" />
              <span>
                {isArabic ? 'أرخص تكلفة فعلية (FX) — بانتظار تأكيدك' : 'Cheapest FX cost — awaiting your confirm'}
              </span>
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            loading={isSending}
            disabled={isSending || isCompleting || rows.length === 0}
            onClick={() => void handleSendShipments()}
            className="gap-2 bg-primary hover:bg-primary-hover text-white font-semibold shadow-xs"
          >
            <i className="fa-solid fa-paper-plane text-xs" />
            <span>{isArabic ? 'إرسال الشحنات' : 'Send Shipment'}</span>
          </Button>
        </div>

        <div className="max-h-[62vh] overflow-x-auto overflow-y-auto rounded-xl border border-border-subtle bg-surface-panel shadow-xs">
          <table className="w-full text-start text-xs border-collapse">
            <thead className="bg-surface-sunken border-b border-border-subtle sticky top-0 z-10 text-text-muted">
              <tr>
                <th className="p-3 text-start font-semibold whitespace-nowrap">{isArabic ? 'رقم الطلب' : 'Order #'}</th>
                <th className="p-3 text-start font-semibold whitespace-nowrap">{isArabic ? 'العميل' : 'Client'}</th>
                <th className="p-3 text-start font-semibold whitespace-nowrap">{isArabic ? 'المستلم' : 'Recipient'}</th>
                <th className="p-3 text-start font-semibold whitespace-nowrap">{isArabic ? 'الهاتف' : 'Phone'}</th>
                <th className="p-3 text-start font-semibold whitespace-nowrap">{isArabic ? 'المدينة' : 'City'}</th>
                <th className="p-3 text-start font-semibold whitespace-nowrap">{isArabic ? 'الإجمالي' : 'Total'}</th>
                <th className="p-3 text-start font-semibold min-w-[340px]">
                  {isArabic ? 'شركات الشحن المتاحة' : 'Available Carriers'}
                </th>
                <th className="p-3 text-start font-semibold whitespace-nowrap">{isArabic ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row) => {
                const isSuccess = row.status === 'success' || row.status === 'completed';
                const isFailed = row.status === 'failed';
                const locked = isLockedAssignmentState(row.assignmentState);
                const isBlocked = row.assignmentState === 'BLOCKED';

                const rowBgClass = isBlocked
                  ? 'bg-amber-500/10 dark:bg-amber-950/20'
                  : isSuccess
                    ? 'bg-emerald-500/10 dark:bg-emerald-950/20'
                    : isFailed
                      ? 'bg-rose-500/10 dark:bg-rose-950/20'
                      : 'hover:bg-surface-hover/50';

                return (
                  <tr key={row.orderId} className={`transition-colors ${rowBgClass}`}>
                    <td className="p-3 font-bold text-text-strong whitespace-nowrap align-top">
                      {row.orderNumber}
                    </td>
                    <td className="p-3 text-text-strong whitespace-nowrap align-top">{row.clientName}</td>
                    <td className="p-3 text-text-strong whitespace-nowrap align-top">{row.customerName}</td>
                    <td className="p-3 text-text-muted whitespace-nowrap align-top" dir="ltr">
                      {row.customerPhone}
                    </td>
                    <td className="p-3 text-text-muted whitespace-nowrap align-top">{row.city}</td>
                    <td className="p-3 text-text-strong font-medium whitespace-nowrap align-top">
                      {row.total}
                    </td>
                    <td className="p-3 align-top">
                      {row.quotesLoading ? (
                        <div className="flex items-center gap-2 py-2 text-sky-600">
                          <i className="fa-solid fa-spinner fa-spin text-sm" />
                          <span className="text-xs font-medium">
                            {isArabic ? 'جاري جلب الأسعار…' : 'Fetching rates…'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2 items-start">
                          {row.quotes.length === 0 && (
                            <div className="w-full text-[11px] text-amber-800 flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 mb-0.5">
                              <i className="fa-solid fa-triangle-exclamation text-[10px]" />
                              <span>
                                {row.quotesError ||
                                  (isArabic
                                    ? 'لا توجد شركات شحن لهذا الفلتر — يمكنك المتابعة بشحن يدوي'
                                    : 'No carriers for this filter — continue with Manual shipping')}
                              </span>
                            </div>
                          )}
                          {row.quotes.map((q) => {
                            const isSelected =
                              row.selectedServiceId === q.serviceId ||
                              (!row.selectedServiceId &&
                                row.selectedProviderCode === q.carrierId);
                            const dual =
                              (q.prices?.filter((p) =>
                                ['USD', 'SYP'].includes(p.currency.toUpperCase()),
                              ).length ?? 0) >= 2;
                            return (
                              <div
                                key={q.serviceId}
                                className={`group relative flex flex-col justify-between rounded-xl border p-2 text-start min-w-[140px] max-w-[180px] ${
                                  isSelected
                                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-1 ring-emerald-500/50'
                                    : 'border-border-subtle bg-surface-card'
                                } ${locked || isSending ? 'opacity-80' : ''}`}
                              >
                                <button
                                  type="button"
                                  disabled={isSending || locked}
                                  onClick={() => handleSelectQuote(row.orderId, q)}
                                  className="text-start disabled:cursor-not-allowed"
                                >
                                  <div className="flex items-center justify-between gap-1 w-full">
                                    <span
                                      className="text-xs font-bold text-text-strong truncate"
                                      title={q.serviceName}
                                    >
                                      {q.serviceName}
                                    </span>
                                    {q.isRecommended && companyFilter === 'auto' && (
                                      <span className="shrink-0 rounded bg-emerald-600 px-1 text-[9px] font-extrabold text-white uppercase">
                                        {isArabic ? 'الأوفر' : 'Best'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1.5 flex items-baseline justify-between gap-1">
                                    <span className="text-xs font-extrabold text-sky-600 tabular-nums">
                                      {formatMoney(q.price, q.currency)}
                                    </span>
                                    <span className="text-[10px] text-text-muted">
                                      {q.deliveryType === 'hub'
                                        ? isArabic
                                          ? 'فرع'
                                          : 'Hub'
                                        : isArabic
                                          ? 'منزلي'
                                          : 'Home'}
                                    </span>
                                  </div>
                                </button>
                                {dual && !locked && (
                                  <div className="mt-1.5 flex gap-1">
                                    {(['USD', 'SYP'] as const).map((cur) => {
                                      const p = q.prices?.find((x) => x.currency.toUpperCase() === cur);
                                      if (!p) return null;
                                      const active = (q.currency || '').toUpperCase() === cur;
                                      return (
                                        <button
                                          key={cur}
                                          type="button"
                                          disabled={isSending}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleQuoteCurrency(row.orderId, q, cur);
                                          }}
                                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${
                                            active
                                              ? 'border-sky-500 bg-sky-50 text-sky-800'
                                              : 'border-border-subtle text-text-muted'
                                          }`}
                                        >
                                          {cur}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            disabled={isSending || locked}
                            onClick={() => handleSelectManual(row.orderId)}
                            className={`flex min-w-[130px] flex-col justify-between rounded-xl border p-2 text-start ${
                              row.explicitManual && row.selectedProviderCode === 'manual'
                                ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500/50'
                                : row.quotes.length === 0
                                  ? 'border-emerald-400 bg-emerald-50/50 ring-1 ring-emerald-400/40'
                                  : 'border-border-subtle bg-surface-card'
                            }`}
                          >
                            <span className="text-xs font-bold">
                              {isArabic ? 'شحن يدوي' : 'Manual shipping'}
                            </span>
                            <span className="mt-1 text-[10px] text-text-muted">
                              {row.quotes.length === 0
                                ? isArabic
                                  ? 'متابعة الـworkflow يدويًا'
                                  : 'Continue workflow manually'
                                : isArabic
                                  ? 'اختيار يدوي فقط'
                                  : 'Manual pick only'}
                            </span>
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap align-top">
                      {row.assignmentState === 'BLOCKED' && (
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                          <i className="fa-solid fa-ban text-[11px]" />
                          {isArabic ? 'محظور / معلّق' : 'Blocked'}
                        </span>
                      )}
                      {row.assignmentState === 'UNASSIGNED' && row.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <i className="fa-solid fa-circle-exclamation text-[10px]" />
                          {isArabic ? 'يحتاج تعيين' : 'Needs attention'}
                        </span>
                      )}
                      {row.assignmentState === 'RECOMMENDED' && row.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-text-muted">
                          <i className="fa-regular fa-clock text-[10px]" />
                          {isArabic ? 'موصى · بانتظار الإرسال' : 'Recommended'}
                        </span>
                      )}
                      {row.assignmentState === 'USER_MODIFIED' && row.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-text-muted">
                          <i className="fa-regular fa-clock text-[10px]" />
                          {isArabic ? 'معدّل · بانتظار الإرسال' : 'Modified · pending'}
                        </span>
                      )}
                      {row.status === 'sending' && (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <i className="fa-solid fa-spinner fa-spin text-[10px]" />
                          {isArabic ? 'جاري الإرسال…' : 'Sending…'}
                        </span>
                      )}
                      {row.status === 'skipped' && (
                        <span className="text-xs text-text-muted">
                          {isArabic ? 'متجاوز' : 'Skipped'}
                        </span>
                      )}
                      {isSuccess && (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <i className="fa-solid fa-circle-check text-[11px] text-emerald-600" />
                            {row.assignmentState === 'CONFIRMED' || row.status === 'completed'
                              ? isArabic
                                ? 'مؤكد'
                                : 'Confirmed'
                              : row.awb
                                ? `${isArabic ? 'مُرسل ·' : 'Sent ·'} ${row.awb}`
                                : isArabic
                                  ? 'مُرسل (يدوي)'
                                  : 'Sent (manual)'}
                          </span>
                          {locked && (
                            <button
                              type="button"
                              className="text-[10px] text-sky-600 underline"
                              onClick={() => handleReopenAssignment(row.orderId)}
                            >
                              {isArabic ? 'إعادة فتح التعديل' : 'Reopen to edit'}
                            </button>
                          )}
                        </div>
                      )}
                      {isFailed && (
                        <div className="flex flex-col">
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            <i className="fa-solid fa-circle-xmark text-[11px]" />
                            {isArabic ? 'فشل' : 'Failed'}
                          </span>
                          {row.errorMessage && (
                            <span className="text-[10px] text-rose-600 mt-0.5 max-w-[200px] truncate" title={row.errorMessage}>
                              {row.errorMessage}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border-subtle">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSending || isCompleting}>
            {isArabic ? 'إغلاق' : 'Close'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={isCompleting}
            disabled={successCount === 0 || isSending || isCompleting}
            onClick={() => void handleConfirmShippingComplete()}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
          >
            <i className="fa-solid fa-check-double text-xs" />
            <span>
              {isArabic
                ? `تأكيد اكتمال الشحن (${successCount})`
                : `Confirm Shipping as Complete (${successCount})`}
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
