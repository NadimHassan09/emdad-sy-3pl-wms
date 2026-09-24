import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Alert } from '@ds';
import { useToast } from '../ToastProvider';
import { OutboundApi } from '../../api/outbound';
import type { OmsOrderListItem } from '../../api/oms';
import { CarrierShippingDetailsForm } from '../shipping/CarrierShippingDetailsForm';
import {
  buildCarrierShippingFormFromOrder,
  carrierFormToSavePayload,
  hasOverPacking,
  packingSummary,
  type CarrierShippingFormValue,
} from '../shipping/carrier-shipping-form';
import { QK } from '../../constants/query-keys';

type Props = {
  open: boolean;
  order: OmsOrderListItem | null;
  onClose: () => void;
  onSuccess: () => void;
  isArabic?: boolean;
};

export function OmsSingleShippingModal({
  open,
  order,
  onClose,
  onSuccess,
  isArabic = false,
}: Props) {
  const toast = useToast();
  const qc = useQueryClient();

  const outboundId = order?.outboundOrderId ?? order?.linkedOutboundOrder?.id ?? '';

  // Fetch full outbound order details
  const outboundQuery = useQuery({
    queryKey: ['outbound-order-detail', outboundId],
    queryFn: () => OutboundApi.get(outboundId),
    enabled: open && Boolean(outboundId),
  });

  const outbound = outboundQuery.data;

  const [form, setForm] = useState<CarrierShippingFormValue | null>(null);
  const [quotesRefreshing, setQuotesRefreshing] = useState(false);
  const [selectedCarrierAvailable, setSelectedCarrierAvailable] = useState(false);

  useEffect(() => {
    if (!open || !outbound) {
      setForm(null);
      return;
    }
    setForm(buildCarrierShippingFormFromOrder(outbound));
    setSelectedCarrierAvailable(Boolean(outbound.shippingProviderCode?.trim()));
  }, [open, outbound]);

  const codAmount = useMemo(() => {
    if (!outbound) return null;
    const raw = outbound.codAmount ?? order?.total;
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [outbound, order?.total]);

  const latestShipment = outbound?.carrierShipments?.[0] ?? null;
  const shipmentCreated =
    latestShipment?.status === 'created' || Boolean(latestShipment?.externalAwb);
  const awb = latestShipment?.externalAwb ?? outbound?.trackingNumber ?? null;

  const packingInvalid = useMemo(() => {
    if (!form) return false;
    return hasOverPacking(packingSummary(form.cartons, form.catalog));
  }, [form]);

  const canSave =
    Boolean(form) &&
    !quotesRefreshing &&
    !packingInvalid &&
    Boolean(form?.shippingProviderCode?.trim()) &&
    selectedCarrierAvailable;

  const invalidate = () => {
    if (outboundId) {
      qc.invalidateQueries({ queryKey: ['outbound-order-detail', outboundId] });
      qc.invalidateQueries({ queryKey: [...QK.outboundOrders, outboundId] });
    }
    qc.invalidateQueries({ queryKey: QK.omsOrders });
    qc.invalidateQueries({ queryKey: QK.outboundOrders });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!outbound || !form) throw new Error('No order details loaded.');
      return OutboundApi.saveShippingDetails(
        outbound.id,
        {
          ...carrierFormToSavePayload(form),
          shippingMethod: 'carrier',
          shippingProviderCode:
            form.shippingProviderCode.trim() || outbound.shippingProviderCode || null,
        },
        outbound.companyId,
      );
    },
    onSuccess: () => {
      toast.success(isArabic ? 'تم حفظ تفاصيل الشحن بنجاح.' : 'Shipping details saved.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!outbound || !form) throw new Error('No order details loaded.');
      // Auto-save form payload first before sending
      await OutboundApi.saveShippingDetails(
        outbound.id,
        {
          ...carrierFormToSavePayload(form),
          shippingMethod: 'carrier',
          shippingProviderCode:
            form.shippingProviderCode.trim() || outbound.shippingProviderCode || null,
        },
        outbound.companyId,
      );
      return OutboundApi.sendShippingDetails(outbound.id, outbound.companyId);
    },
    onSuccess: () => {
      toast.success(
        isArabic
          ? 'تم إرسال الشحنة لشركة الشحن وإصدار بوليصة الشحن بنجاح!'
          : 'Shipment sent to carrier. AWB generated successfully!',
      );
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const completeMut = useMutation({
    mutationFn: async () => {
      if (!outbound) throw new Error('No order details loaded.');
      return OutboundApi.completeShippingDetails(outbound.id, outbound.companyId);
    },
    onSuccess: () => {
      toast.success(
        isArabic
          ? 'تم إكمال تفاصيل الشحن بنجاح وأصبح الطلب جاهزاً للشحن!'
          : 'Shipping details complete. Order is now Ready to Ship!',
      );
      invalidate();
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isArabic
          ? `تفاصيل الشحن — طلب رقم ${order?.orderNumber ?? ''}`
          : `Shipping Details — Order #${order?.orderNumber ?? ''}`
      }
      widthClass="max-w-6xl"
    >
      <div className="space-y-6 text-sm">
        {outboundQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <i className="fa-solid fa-spinner fa-spin text-3xl text-primary" />
            <p className="text-text-muted text-sm">
              {isArabic ? 'جاري تحميل بيانات الشحنة…' : 'Loading shipping details…'}
            </p>
          </div>
        ) : !outboundId || !outbound ? (
          <div className="py-8">
            <Alert variant="error">
              {isArabic
                ? 'تعذر العثور على أمر الصادر المرتبط بهذا الطلب.'
                : 'Could not find linked outbound order for this OMS order.'}
            </Alert>
          </div>
        ) : (
          <>
            {/* Top Status & Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-sunken p-3 border border-border-subtle/70">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-text-muted">
                  {isArabic ? 'العميل:' : 'Client:'}
                </span>
                <span className="text-xs font-bold text-text-strong">
                  {order?.company?.name || '—'}
                </span>
                <span className="text-text-faint">•</span>
                <span className="text-xs font-semibold text-text-muted">
                  {isArabic ? 'المستلم:' : 'Customer:'}
                </span>
                <span className="text-xs font-bold text-text-strong">
                  {order?.recipientName || '—'}
                </span>
                {order?.recipientPhone ? (
                  <>
                    <span className="text-text-faint">•</span>
                    <span className="text-xs text-text-muted" dir="ltr">
                      {order.recipientPhone}
                    </span>
                  </>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={saveMut.isPending}
                  disabled={!canSave || sendMut.isPending || completeMut.isPending}
                  onClick={() => saveMut.mutate()}
                  className="shadow-xs font-semibold"
                >
                  <i className="fa-solid fa-floppy-disk text-xs" aria-hidden="true" />
                  <span>{isArabic ? 'حفظ البيانات' : 'Save'}</span>
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={sendMut.isPending}
                  disabled={
                    !canSave ||
                    shipmentCreated ||
                    saveMut.isPending ||
                    completeMut.isPending
                  }
                  onClick={() => sendMut.mutate()}
                  className="shadow-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <i className="fa-solid fa-paper-plane text-xs" aria-hidden="true" />
                  <span>{isArabic ? 'إرسال الشحنة (Send Shipment)' : 'Send Shipment'}</span>
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={completeMut.isPending}
                  disabled={!shipmentCreated || saveMut.isPending || sendMut.isPending}
                  onClick={() => completeMut.mutate()}
                  className="shadow-xs font-semibold bg-primary hover:bg-primary-hover text-white"
                >
                  <i className="fa-solid fa-circle-check text-xs" aria-hidden="true" />
                  <span>
                    {isArabic
                      ? 'إنهاء والتحويل لجاهز للشحن'
                      : 'Confirm as Ready to Ship'}
                  </span>
                </Button>
              </div>
            </div>

            {/* Shipment Sent Success Banner */}
            {shipmentCreated && awb ? (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:border-emerald-800/80 dark:bg-emerald-950/30 p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs shrink-0">
                    <i className="fa-solid fa-barcode text-base" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      {isArabic
                        ? 'تم إنشاء الشحنة وبوليصة الشحن بنجاح'
                        : 'Shipment created and AWB registered'}
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      AWB: {awb}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                  {isArabic ? 'جاهز للإنهاء' : 'Ready to Complete'}
                </span>
              </div>
            ) : null}

            {/* Carrier Error Alert */}
            {latestShipment?.status === 'failed' && (
              <Alert variant="error" title={isArabic ? 'فشل إرسال الشحنة لشركة الشحن' : 'Carrier Send Failed'}>
                {latestShipment.lastErrorSafe?.trim() ||
                  (isArabic
                    ? 'تعذر إرسال الشحنة. يرجى مراجعة الحقول وإعادة المحاولة.'
                    : 'Submission failed. Please verify the shipping details and send again.')}
              </Alert>
            )}

            {/* The Real Full-Featured Form */}
            {form ? (
              <div className="border border-border-subtle rounded-xl p-5 bg-surface-panel shadow-xs">
                <CarrierShippingDetailsForm
                  value={form}
                  onChange={setForm}
                  disabled={saveMut.isPending || sendMut.isPending || completeMut.isPending}
                  locked={shipmentCreated}
                  codAmount={codAmount}
                  showTitle={false}
                  onQuotesRefreshingChange={setQuotesRefreshing}
                  onSelectedCarrierAvailableChange={setSelectedCarrierAvailable}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
