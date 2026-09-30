import { useState, useEffect, useMemo, useRef } from 'react';
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
  deliveryType: 'address' | 'hub';
  isCheapest: boolean;
  logoUrl?: string;
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
  quotesError?: string | null;
  quotes: BulkCarrierQuote[];
  selectedProviderCode: string;
  selectedServiceId: string;
  selectedCarrierName: string;
  selectedPrice?: number;
  selectedCurrency?: string;
  status: 'pending' | 'sending' | 'success' | 'failed' | 'completed';
  awb?: string | null;
  errorMessage?: string | null;
};

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
  const quotesAbortRef = useRef<AbortController | null>(null);

  // Fetch available shipping providers
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

  // Filter only eligible orders: strictly shipping details stage (exclude picking and packing)
  const eligibleOrders = useMemo(() => {
    return selectedOrders.filter((order) => {
      const outboundStatus = order.linkedOutboundOrder?.status;
      return (
        outboundStatus === 'waiting_for_shipping_method' ||
        outboundStatus === 'waiting_for_shipping_details'
      );
    });
  }, [selectedOrders]);

  // Initialize rows and fetch quotes for each order
  useEffect(() => {
    if (!open) {
      if (quotesAbortRef.current) {
        quotesAbortRef.current.abort();
      }
      return;
    }

    const abortController = new AbortController();
    quotesAbortRef.current = abortController;

    const defaultProvider = activeProviders.length > 0 ? activeProviders[0].code : 'BABEL_EXPRESS';

    const initialRows: BulkShippingRow[] = eligibleOrders.map((order) => {
      const outboundId = order.outboundOrderId ?? order.linkedOutboundOrder?.id ?? '';
      const existingAwb =
        order.trackingNumber?.trim() ||
        order.linkedOutboundOrder?.trackingNumber?.trim() ||
        null;

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
        quotesError: outboundId ? null : (isArabic ? 'لا يوجد طلب مستودع مرتبط' : 'No linked outbound order'),
        quotes: [],
        selectedProviderCode: (order.carrier?.toUpperCase()) || defaultProvider,
        selectedServiceId: '',
        selectedCarrierName: order.shippingCarrierName || order.carrier || '',
        status: existingAwb ? 'success' : 'pending',
        awb: existingAwb,
        errorMessage: null,
      };
    });

    setRows(initialRows);
    setIsSending(false);
    setIsCompleting(false);

    // Fetch details & quotes for each eligible row concurrently
    initialRows.forEach((row) => {
      if (!row.outboundOrderId) return;

      void (async () => {
        try {
          // 1. Get outbound order details
          const outbound = await OutboundApi.get(row.outboundOrderId);
          if (abortController.signal.aborted) return;

          const form = buildCarrierShippingFormFromOrder(outbound);
          const weightKg =
            form.packageType === 'envelope'
              ? 1
              : totalCartonsWeightKg(form.cartons, form.catalog) || (Number(outbound.shippingWeightKg) || 1);
          const parts = toBabelPartsFromCartons(form.cartons, form.catalog, form.packageType);
          const codAmount = Number(outbound.codAmount ?? (outbound as any).omsOrder?.total) || undefined;

          const governorate = (form.city || outbound.city || row.city || '').trim();
          const city = (form.district || outbound.district || '').trim();
          const neighborhood = (form.addressLine1 || outbound.addressLine1 || '').trim();

          // 2. Fetch carrier rates
          let fetchedQuotes: BulkCarrierQuote[] = [];
          let errorMsg: string | null = null;

          if (!governorate) {
            errorMsg = isArabic ? 'العنوان غير مكتمل' : 'Incomplete address';
          } else {
            try {
              const ratesRes = await ShippingApi.quoteRates(
                {
                  packageType: form.packageType,
                  weightKg: Math.max(weightKg, 0.1),
                  deliveryType: form.deliveryType,
                  pickupType: 'hub',
                  volumeCbm: 0,
                  governorate,
                  city: city || governorate,
                  neighborhood: neighborhood || city,
                  parts,
                  codAmount,
                },
                abortController.signal,
              );

              const rawQuotes = (ratesRes.quotes ?? []).filter(
                (q: ShippingRateQuote) => q.available && Number.isFinite(q.price),
              );

              // Sort ascending by price
              rawQuotes.sort((a, b) => a.price - b.price);
              const minPrice = rawQuotes.length > 0 ? rawQuotes[0].price : null;

              fetchedQuotes = rawQuotes.map((q) => ({
                carrierId: q.carrierId,
                serviceId: q.serviceId,
                serviceName: q.serviceName,
                carrierName: q.carrierName,
                price: q.price,
                currency: q.currency || 'USD',
                deliveryType: q.deliveryType as 'address' | 'hub',
                isCheapest: minPrice != null && q.price === minPrice,
                logoUrl: q.logoUrl,
              }));

              if (fetchedQuotes.length === 0 && (ratesRes.errors?.length ?? 0) > 0) {
                errorMsg = ratesRes.errors[0]?.message ?? (isArabic ? 'لا توجد أسعار متاحة' : 'No rates available');
              }
            } catch (err: unknown) {
              if (abortController.signal.aborted) return;
              errorMsg = err instanceof Error ? err.message : (isArabic ? 'تعذر جلب الأسعار' : 'Failed to fetch rates');
            }
          }

          // 3. Update row state: select cheapest by default if available
          setRows((prev) =>
            prev.map((r) => {
              if (r.orderId !== row.orderId) return r;

              const cheapest = fetchedQuotes.find((q) => q.isCheapest) || fetchedQuotes[0];
              return {
                ...r,
                outboundOrder: outbound,
                city: governorate || r.city,
                district: city,
                destinationAddress: [governorate, city, neighborhood].filter(Boolean).join(' - ') || r.destinationAddress,
                quotesLoading: false,
                quotesError: errorMsg,
                quotes: fetchedQuotes,
                selectedProviderCode: cheapest ? cheapest.carrierId : r.selectedProviderCode,
                selectedServiceId: cheapest ? cheapest.serviceId : '',
                selectedCarrierName: cheapest ? cheapest.serviceName : '',
                selectedPrice: cheapest ? cheapest.price : undefined,
                selectedCurrency: cheapest ? cheapest.currency : undefined,
              };
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
                    quotesError: err instanceof Error ? err.message : (isArabic ? 'فشل تحميل بيانات الطلب' : 'Failed to load order'),
                  }
                : r,
            ),
          );
        }
      })();
    });

    return () => {
      abortController.abort();
    };
  }, [open, eligibleOrders, activeProviders, isArabic]);

  const handleSelectQuote = (orderId: string, quote: BulkCarrierQuote) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.orderId !== orderId) return r;
        return {
          ...r,
          selectedProviderCode: quote.carrierId,
          selectedServiceId: quote.serviceId,
          selectedCarrierName: quote.serviceName,
          selectedPrice: quote.price,
          selectedCurrency: quote.currency,
        };
      }),
    );
  };

  const successCount = rows.filter((r) => r.status === 'success' || r.status === 'completed').length;
  const failedRows = rows.filter((r) => r.status === 'failed');

  // ─── Send Shipment via Carrier API ──────────────────────────────────────
  const handleSendShipments = async () => {
    if (isSending || rows.length === 0) return;
    setIsSending(true);

    const updatedRows = [...rows];

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      if (row.status === 'success' || row.status === 'completed') continue;

      if (!row.outboundOrderId) {
        row.status = 'failed';
        row.errorMessage = isArabic ? 'لا يوجد طلب مستودع مرتبط' : 'No linked outbound order';
        setRows([...updatedRows]);
        continue;
      }

      row.status = 'sending';
      setRows([...updatedRows]);

      try {
        // 1. Fetch fresh outbound order details
        const outbound = await OutboundApi.get(row.outboundOrderId);
        const form = buildCarrierShippingFormFromOrder(outbound);

        // 2. Set chosen carrier and service
        form.shippingProviderCode = row.selectedProviderCode;
        form.shippingServiceId = row.selectedServiceId;
        const cur = (row.selectedCurrency === 'SYP' ? 'SYP' : 'USD') || currencyAfterCarrierSelect(row.selectedProviderCode);
        form.currency = cur;

        // 3. Save shipping details first so all dimensions, weights, cartons, and payer are stored
        const savePayload = {
          ...carrierFormToSavePayload(form),
          shippingMethod: 'carrier' as const,
          shippingProviderCode: row.selectedProviderCode,
          shippingServiceId: row.selectedServiceId || null,
        };

        await OutboundApi.saveShippingDetails(row.outboundOrderId, savePayload as any, outbound.companyId);

        // 4. Send shipment via Carrier API
        const sentOrder = await OutboundApi.sendShippingDetails(row.outboundOrderId, outbound.companyId);
        const createdShipment = (sentOrder.carrierShipments ?? []).find(
          (s) => s.status === 'created' || Boolean(s.externalAwb),
        );

        row.status = 'success';
        row.awb = createdShipment?.externalAwb || sentOrder.trackingNumber || 'Success';
        row.errorMessage = null;
      } catch (err: unknown) {
        row.status = 'failed';
        row.errorMessage = err instanceof Error ? err.message : (isArabic ? 'فشل إرسال الشحنة' : 'Send failed');
      }

      setRows([...updatedRows]);
    }

    setIsSending(false);

    // Invalidate caches
    qc.invalidateQueries({ queryKey: QK.omsOrders });
    qc.invalidateQueries({ queryKey: QK.outboundOrders });

    const finalSuccess = updatedRows.filter((r) => r.status === 'success').length;
    const finalFailed = updatedRows.filter((r) => r.status === 'failed').length;

    toast.success(
      isArabic
        ? `اكتمل إرسال الشحنات: ${finalSuccess} ناجح، ${finalFailed} فشل`
        : `Shipment dispatch finished: ${finalSuccess} succeeded, ${finalFailed} failed.`,
    );
  };

  // ─── Confirm Shipping as Complete ───────────────────────────────────────
  const handleConfirmShippingComplete = async () => {
    const successful = rows.filter((r) => r.status === 'success');
    if (successful.length === 0 || isCompleting) return;

    setIsCompleting(true);
    let completedCount = 0;
    const updatedRows = [...rows];

    for (let i = 0; i < updatedRows.length; i++) {
      const row = updatedRows[i];
      if (row.status !== 'success') continue;

      try {
        await OutboundApi.completeShippingDetails(row.outboundOrderId);
        row.status = 'completed';
        completedCount++;
      } catch (err: unknown) {
        row.status = 'failed';
        row.errorMessage = err instanceof Error ? err.message : (isArabic ? 'فشل إكمال الشحن' : 'Failed to complete shipping');
      }
      setRows([...updatedRows]);
    }

    setIsCompleting(false);

    qc.invalidateQueries({ queryKey: QK.omsOrders });
    qc.invalidateQueries({ queryKey: QK.outboundOrders });

    toast.success(
      isArabic
        ? `تم تأكيد اكتمال الشحن لـ ${completedCount} طلب، أصبحت جاهزة للشحن!`
        : `Marked shipping complete for ${completedCount} order(s).`,
    );

    onSuccess();
    if (completedCount === successful.length) {
      onClose();
    }
  };

  // ─── Export Failed Orders to CSV ─────────────────────────────────────────
  const handleExportFailedOrders = () => {
    if (failedRows.length === 0) return;

    const headers = isArabic
      ? ['رقم الطلب', 'العميل', 'اسم المستلم', 'الهاتف', 'المدينة', 'شركة الشحن', 'الإجمالي', 'سبب الفشل']
      : ['Order #', 'Client', 'Recipient', 'Phone', 'City', 'Carrier', 'Total', 'Failure Reason'];

    const csvContent = [
      headers.join(','),
      ...failedRows.map((r) =>
        [
          `"${r.orderNumber.replace(/"/g, '""')}"`,
          `"${r.clientName.replace(/"/g, '""')}"`,
          `"${r.customerName.replace(/"/g, '""')}"`,
          `"${r.customerPhone.replace(/"/g, '""')}"`,
          `"${r.city.replace(/"/g, '""')}"`,
          `"${(r.selectedCarrierName || r.selectedProviderCode).replace(/"/g, '""')}"`,
          `"${r.total.replace(/"/g, '""')}"`,
          `"${(r.errorMessage ?? '').replace(/"/g, '""')}"`,
        ].join(','),
      ),
    ].join('\r\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `failed_shipping_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isArabic ? `شحن الطلبات المحددة (${rows.length})` : `Bulk Shipping (${rows.length})`}
      widthClass="max-w-7xl"
    >
      <div className="flex flex-col gap-4 p-6" dir={isArabic ? 'rtl' : 'ltr'}>
        {/* Header summary & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-sunken p-3 rounded-xl border border-border-subtle/70">
          <div className="flex items-center gap-3 flex-wrap text-xs text-text-muted">
            <span>
              {isArabic
                ? `إجمالي الطلبات القابلة للشحن: ${rows.length} | الناجحة: ${successCount} | الفاشلة: ${failedRows.length}`
                : `Eligible for shipping: ${rows.length} | Succeeded: ${successCount} | Failed: ${failedRows.length}`}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <i className="fa-solid fa-sparkles text-emerald-500" />
              <span>{isArabic ? 'يتم اختيار أفضل سعر تلقائياً لكل طلب' : 'Cheapest carrier auto-selected'}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {failedRows.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportFailedOrders}
                className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
              >
                <i className="fa-solid fa-file-excel text-xs" />
                <span>{isArabic ? 'تحميل شيت الطلبات الفاشلة' : 'Export Failed (Excel)'}</span>
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              loading={isSending}
              disabled={isSending || isCompleting || rows.length === 0}
              onClick={() => void handleSendShipments()}
              className="gap-2 bg-primary hover:bg-primary-hover text-white font-semibold shadow-xs"
            >
              <i className="fa-solid fa-paper-plane text-xs" />
              <span>{isArabic ? 'إرسال الشحنات (Send Shipment)' : 'Send Shipment'}</span>
            </Button>
          </div>
        </div>

        {/* Orders Table */}
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
                <th className="p-3 text-start font-semibold min-w-[340px]">{isArabic ? 'شركات الشحن المتاحة والأسعار' : 'Available Carriers & Rates'}</th>
                <th className="p-3 text-start font-semibold whitespace-nowrap">{isArabic ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row) => {
                const isSuccess = row.status === 'success' || row.status === 'completed';
                const isFailed = row.status === 'failed';

                const rowBgClass = isSuccess
                  ? 'bg-emerald-500/10 dark:bg-emerald-950/20'
                  : isFailed
                  ? 'bg-rose-500/10 dark:bg-rose-950/20'
                  : 'hover:bg-surface-hover/50';

                return (
                  <tr key={row.orderId} className={`transition-colors ${rowBgClass}`}>
                    <td className="p-3 font-bold text-text-strong whitespace-nowrap align-top">{row.orderNumber}</td>
                    <td className="p-3 text-text-strong whitespace-nowrap align-top">{row.clientName}</td>
                    <td className="p-3 text-text-strong whitespace-nowrap align-top">{row.customerName}</td>
                    <td className="p-3 text-text-muted whitespace-nowrap align-top" dir="ltr">{row.customerPhone}</td>
                    <td className="p-3 text-text-muted whitespace-nowrap align-top">{row.city}</td>
                    <td className="p-3 text-text-strong font-medium whitespace-nowrap align-top">{row.total}</td>

                    {/* Carrier Cards Column */}
                    <td className="p-3 align-top">
                      {row.quotesLoading ? (
                        <div className="flex items-center gap-2 py-2 text-sky-600 dark:text-sky-400">
                          <i className="fa-solid fa-spinner fa-spin text-sm" />
                          <span className="text-xs font-medium">
                            {isArabic ? 'جاري جلب شركات الشحن والأسعار...' : 'Fetching carrier rates...'}
                          </span>
                        </div>
                      ) : row.quotes.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {row.quotes.map((q) => {
                            const isSelected =
                              row.selectedServiceId === q.serviceId ||
                              (!row.selectedServiceId && row.selectedProviderCode === q.carrierId);

                            return (
                              <button
                                key={q.serviceId}
                                type="button"
                                disabled={isSending || isSuccess}
                                onClick={() => handleSelectQuote(row.orderId, q)}
                                className={`group relative flex flex-col justify-between rounded-xl border p-2 text-start transition-all cursor-pointer select-none min-w-[130px] max-w-[165px] ${
                                  isSelected
                                    ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-xs ring-1 ring-emerald-500/50 text-text-strong'
                                    : 'border-border-subtle bg-surface-card hover:border-border hover:bg-surface-sunken text-text-body'
                                } ${isSending || isSuccess ? 'cursor-not-allowed opacity-80' : ''}`}
                              >
                                {/* Top: Carrier Name + Best Price */}
                                <div className="flex items-center justify-between gap-1 w-full">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {q.logoUrl ? (
                                      <img src={q.logoUrl} alt="" className="h-4 w-4 shrink-0 rounded object-contain" />
                                    ) : (
                                      <i className="fa-solid fa-truck-fast text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    )}
                                    <span className="text-xs font-bold text-text-strong truncate" title={q.serviceName}>
                                      {q.serviceName}
                                    </span>
                                  </div>
                                  {q.isCheapest && (
                                    <span className="shrink-0 rounded bg-emerald-600 px-1 py-0.2 text-[9px] font-extrabold text-white uppercase tracking-wider">
                                      {isArabic ? 'الأوفر' : 'Best'}
                                    </span>
                                  )}
                                </div>

                                {/* Middle: Price & Delivery type */}
                                <div className="mt-1.5 flex items-baseline justify-between gap-1 w-full">
                                  <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
                                    {formatMoney(q.price, q.currency)}
                                  </span>
                                  <span className="text-[10px] text-text-muted flex items-center gap-0.5">
                                    <i className={`fa-solid ${q.deliveryType === 'hub' ? 'fa-building' : 'fa-house'} text-[8px]`} />
                                    <span>{q.deliveryType === 'hub' ? (isArabic ? 'فرع' : 'Branch') : (isArabic ? 'منزلي' : 'Home')}</span>
                                  </span>
                                </div>

                                {/* Bottom: Selection status */}
                                <div className="mt-1 flex items-center gap-1">
                                  {isSelected ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                      <i className="fa-solid fa-circle-check text-[10px]" />
                                      <span>{isArabic ? 'محدد' : 'Selected'}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-text-faint group-hover:text-text-muted">
                                      {isArabic ? 'اختيار' : 'Select'}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
                            <i className="fa-solid fa-triangle-exclamation text-[10px]" />
                            <span>{row.quotesError || (isArabic ? 'لا توجد شركات شحن متاحة للعنوان' : 'No carriers available')}</span>
                          </div>
                          {activeProviders.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] text-text-muted">{isArabic ? 'الافتراضي:' : 'Default:'}</span>
                              <span className="text-[10px] font-bold text-text-strong">
                                {activeProviders.find((p) => p.code === row.selectedProviderCode)?.name || row.selectedProviderCode}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Status Column */}
                    <td className="p-3 whitespace-nowrap align-top">
                      {row.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 text-text-muted">
                          <i className="fa-regular fa-clock text-[10px]" />
                          <span>{isArabic ? 'جاهز للإرسال' : 'Pending'}</span>
                        </span>
                      )}
                      {row.status === 'sending' && (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <i className="fa-solid fa-spinner fa-spin text-[10px]" />
                          <span>{isArabic ? 'جاري الإرسال...' : 'Sending...'}</span>
                        </span>
                      )}
                      {isSuccess && (
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <i className="fa-solid fa-circle-check text-[11px] text-emerald-600" />
                          <span>{row.awb ? `${isArabic ? 'بوليصة:' : 'AWB:'} ${row.awb}` : (isArabic ? 'تم بنجاح' : 'Success')}</span>
                        </span>
                      )}
                      {isFailed && (
                        <div className="flex flex-col">
                          <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <i className="fa-solid fa-circle-xmark text-[11px] text-rose-600" />
                            <span>{isArabic ? 'فشل' : 'Failed'}</span>
                          </span>
                          {row.errorMessage && (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 max-w-[200px] truncate" title={row.errorMessage}>
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

        {/* Footer */}
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
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 shadow-xs"
          >
            <i className="fa-solid fa-check-double text-xs" />
            <span>
              {isArabic
                ? `تأكيد اكتمال الشحن للناجحة (${successCount})`
                : `Confirm Shipping as Complete (${successCount})`}
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
