import { useEffect, useState } from 'react';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { OmsApi, type CancelShipmentResult } from '../../api/oms';
import { useToast } from '../ToastProvider';

export interface CancelShipmentTargetOrder {
  id: string;
  orderNumber: string;
  carrier?: string | null;
  shippingCarrierName?: string | null;
  shippingProviderCode?: string | null;
  trackingNumber?: string | null;
}

export interface CancelShipmentModalProps {
  open: boolean;
  order: CancelShipmentTargetOrder | null;
  onClose: () => void;
  onSuccess: () => void;
  isArabic?: boolean;
}

type ModalStep = 'confirm' | 'cancelling' | 'carrier_failed' | 'success';

export function CancelShipmentModal({
  open,
  order,
  onClose,
  onSuccess,
  isArabic = true,
}: CancelShipmentModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<ModalStep>('confirm');
  const [cancelResult, setCancelResult] = useState<CancelShipmentResult | null>(null);
  const [isForceCancelling, setIsForceCancelling] = useState(false);
  const [copiedAwb, setCopiedAwb] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('confirm');
      setCancelResult(null);
      setIsForceCancelling(false);
      setCopiedAwb(false);
    }
  }, [open, order?.id]);

  if (!order) return null;

  const awb =
    cancelResult?.awb ||
    order.trackingNumber ||
    null;

  const carrierName =
    cancelResult?.carrierName ||
    order.shippingCarrierName ||
    order.carrier ||
    (isArabic ? 'شركة الشحن' : 'Carrier');

  const providerCode =
    cancelResult?.providerCode ||
    order.shippingProviderCode ||
    '—';

  const handleCopyAwb = async () => {
    if (!awb) return;
    try {
      await navigator.clipboard.writeText(awb);
      setCopiedAwb(true);
      toast.success(isArabic ? 'تم نسخ رقم البوليصة بنجاح' : 'Waybill number copied');
      setTimeout(() => setCopiedAwb(false), 2000);
    } catch {
      toast.error(isArabic ? 'تعذر نسخ رقم البوليصة' : 'Failed to copy');
    }
  };

  const handlePrintAwb = () => {
    if (!awb) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error(isArabic ? 'يرجى السماح بالنوافذ المنبثقة للطباعة' : 'Please allow popups to print');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${isArabic ? 'rtl' : 'ltr'}">
        <head>
          <title>${isArabic ? 'بوليصة شحن' : 'Waybill'} - ${awb}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #111; }
            .card { border: 2px solid #333; border-radius: 8px; padding: 24px; max-width: 500px; margin: 0 auto; }
            h2 { margin-top: 0; border-bottom: 2px solid #eee; padding-bottom: 12px; }
            .row { display: flex; justify-content: space-between; margin: 12px 0; font-size: 16px; }
            .barcode { font-size: 28px; font-weight: bold; letter-spacing: 2px; text-align: center; margin: 24px 0; background: #f4f4f4; padding: 12px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>${isArabic ? 'بيانات الشحنة الملغاة' : 'Cancelled Shipment Details'}</h2>
            <div class="row"><span>${isArabic ? 'رقم الطلب' : 'Order Number'}:</span><strong>${order.orderNumber}</strong></div>
            <div class="row"><span>${isArabic ? 'شركة الشحن' : 'Shipping Carrier'}:</span><strong>${carrierName}</strong></div>
            <div class="row"><span>${isArabic ? 'مزود الخدمة' : 'Provider'}:</span><strong>${providerCode}</strong></div>
            <div class="barcode">${awb}</div>
            <p style="font-size: 13px; color: #666; text-align: center;">${isArabic ? 'استخدم رقم البوليصة أعلاه لإلغاء الشحنة في لوحة تحكم شركة الشحن.' : 'Use the waybill number above to cancel the shipment in the carrier merchant portal.'}</p>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleStartCancel = async () => {
    setStep('cancelling');
    try {
      const response = await OmsApi.cancelShipment(order.id, undefined, false);
      const res: CancelShipmentResult | undefined =
        response?.result || (response as unknown as CancelShipmentResult);
      const isSuccess = Boolean(
        res?.success &&
          res?.status !== 'refused' &&
          res?.status !== 'unsupported' &&
          res?.status !== 'error',
      );
      if (isSuccess && res) {
        setCancelResult(res);
        setStep('success');
      } else {
        setCancelResult(
          res && typeof res === 'object' && res.status
            ? res
            : {
                success: false,
                status: 'error',
                message:
                  res?.message ||
                  (isArabic ? 'تعذر إتمام الإلغاء لدى شركة الشحن' : 'Cancellation failed or unsupported'),
                orderId: order.id,
                orderNumber: order.orderNumber,
                carrierName,
                providerCode,
                awb: awb || undefined,
              },
        );
        setStep('carrier_failed');
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : isArabic ? 'فشل إرسال طلب الإلغاء' : 'Cancellation request failed';
      setCancelResult({
        success: false,
        status: 'error',
        message,
        orderId: order.id,
        orderNumber: order.orderNumber,
        carrierName,
        providerCode,
        awb: awb || undefined,
      });
      setStep('carrier_failed');
    }
  };

  const handleForceCancel = async () => {
    setIsForceCancelling(true);
    try {
      const response = await OmsApi.cancelShipment(
        order.id,
        'Manual local cancel confirmed by admin after carrier API cancel unsupported',
        true,
      );
      const res: CancelShipmentResult | undefined =
        response?.result || (response as unknown as CancelShipmentResult);
      const isSuccess = Boolean(
        res?.success &&
          res?.status !== 'refused' &&
          res?.status !== 'unsupported' &&
          res?.status !== 'error',
      );
      if (isSuccess && res) {
        setCancelResult(res);
        setStep('success');
        toast.success(
          isArabic
            ? 'تم الإلغاء المحلي في إمداد بنجاح. تذكر إلغاء الشحنة لدى شركة الشحن.'
            : 'Local cancellation confirmed. Remember to cancel on the carrier portal.',
        );
      } else {
        toast.error(res?.message || (isArabic ? 'فشل الإلغاء المحلي' : 'Force cancel failed'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : isArabic ? 'فشل الإلغاء المحلي' : 'Force cancel failed';
      toast.error(msg);
    } finally {
      setIsForceCancelling(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (step !== 'cancelling' && !isForceCancelling) {
          if (step === 'success') onSuccess();
          onClose();
        }
      }}
      title={
        isArabic
          ? `إلغاء الشحنة للطلب ${order.orderNumber}`
          : `Cancel shipment for order ${order.orderNumber}`
      }
      widthClass="max-w-xl"
    >
      <div className="space-y-4">
        {step === 'confirm' && (
          <>
            <div className="rounded-xl border border-border-subtle bg-surface-sunken p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">{isArabic ? 'رقم الطلب:' : 'Order Number:'}</span>
                <span className="font-bold text-text-strong font-mono">{order.orderNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">{isArabic ? 'شركة الشحن:' : 'Carrier:'}</span>
                <span className="font-semibold text-text-strong">{carrierName}</span>
              </div>
              {awb && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">{isArabic ? 'رقم البوليصة (AWB):' : 'Waybill (AWB):'}</span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">{awb}</span>
                </div>
              )}
            </div>

            <p className="text-sm text-text-body">
              {isArabic
                ? 'سيتم إرسال طلب إلغاء مباشر لشركة الشحن لإلغاء الشحنة إلكترونياً. في حال نجاح الإلغاء هناك، سيعود الطلب تلقائياً إلى مرحلة "تفاصيل الشحن".'
                : 'A direct cancellation request will be sent to the carrier via API. Upon confirmed cancellation, the order will return to "Shipping Details".'}
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
              <Button type="button" variant="secondary" onClick={onClose}>
                {isArabic ? 'تراجع' : 'Close'}
              </Button>
              <Button type="button" variant="danger" onClick={handleStartCancel}>
                {isArabic ? 'إرسال طلب الإلغاء لشركة الشحن' : 'Submit Cancellation to Carrier'}
              </Button>
            </div>
          </>
        )}

        {step === 'cancelling' && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <h4 className="font-bold text-text-strong text-base">
              {isArabic ? 'جاري إرسال طلب الإلغاء إلى شركة الشحن...' : 'Sending cancellation request to carrier...'}
            </h4>
            <p className="text-xs text-text-muted max-w-sm">
              {isArabic
                ? 'نتحقق من استجابة شركة الشحن وما إذا تم إلغاء البوليصة والشحنة بنجاح عندهم.'
                : 'Verifying carrier response and confirming whether the shipment and waybill were cancelled.'}
            </p>
          </div>
        )}

        {step === 'success' && (
          <>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-xl">
                <i className="fa-solid fa-check" aria-hidden="true" />
              </div>
              <h4 className="font-bold text-emerald-800 dark:text-emerald-300 text-base">
                {isArabic ? 'تم إلغاء الشحنة بنجاح' : 'Shipment Cancelled Successfully'}
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {cancelResult?.message ||
                  (isArabic
                    ? `تم تأكيد الإلغاء لدى شركة الشحن (${carrierName}). أعيد الطلب إلى مرحلة تفاصيل الشحن لتتمكن من إسناده لشركة أخرى.`
                    : `Cancellation confirmed with carrier (${carrierName}). Order returned to Shipping Details.`)}
              </p>
            </div>

            <div className="flex justify-end pt-3 border-t border-border-subtle">
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
              >
                {isArabic ? 'تم' : 'Done'}
              </Button>
            </div>
          </>
        )}

        {step === 'carrier_failed' && (
          <>
            <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <i className="fa-solid fa-triangle-exclamation text-amber-500 text-lg mt-0.5" aria-hidden="true" />
                <div className="space-y-1 min-w-0 flex-1">
                  <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                    {isArabic
                      ? 'تعذر إلغاء الشحنة تلقائياً لدى شركة الشحن'
                      : 'Carrier automated cancellation failed or unsupported'}
                  </h4>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                    {cancelResult?.message ||
                      (isArabic
                        ? `شركة الشحن (${carrierName}) لا تدعم الإلغاء الآلي عبر النظام (API) أو رفضت طلب الإلغاء.`
                        : `Carrier (${carrierName}) does not support API cancellation or rejected the request.`)}
                  </p>
                </div>
              </div>
            </div>

            {awb && (
              <div className="rounded-xl border border-border-subtle bg-surface-sunken p-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-text-muted">
                  {isArabic ? 'بيانات الشحنة لدى شركة الشحن:' : 'Carrier Shipment Reference:'}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">{isArabic ? 'شركة الشحن:' : 'Carrier:'}</span>
                  <span className="font-bold text-text-strong">{carrierName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">{isArabic ? 'مزود الخدمة:' : 'Provider:'}</span>
                  <span className="font-mono text-text-strong">{providerCode}</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-card border border-border-subtle">
                  <div className="min-w-0">
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">
                      {isArabic ? 'رقم البوليصة (Waybill):' : 'Waybill / Tracking #:'}
                    </div>
                    <div className="font-mono font-bold text-sm text-sky-600 dark:text-sky-400 select-all truncate">
                      {awb}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyAwb}
                      className="!px-2.5 !py-1 text-xs"
                      title={isArabic ? 'نسخ رقم البوليصة' : 'Copy waybill'}
                    >
                      <i className={`fa-solid ${copiedAwb ? 'fa-check text-emerald-500' : 'fa-copy'}`} aria-hidden="true" />
                      <span className="ms-1">{copiedAwb ? (isArabic ? 'تم النسخ' : 'Copied') : (isArabic ? 'نسخ' : 'Copy')}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handlePrintAwb}
                      className="!px-2.5 !py-1 text-xs"
                      title={isArabic ? 'طباعة البوليصة الملغاة' : 'Print waybill note'}
                    >
                      <i className="fa-solid fa-print" aria-hidden="true" />
                      <span className="ms-1">{isArabic ? 'طباعة' : 'Print'}</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 rounded-xl border border-sky-500/20 bg-sky-50/40 dark:bg-sky-950/20 text-xs text-sky-900 dark:text-sky-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <i className="fa-solid fa-circle-info text-sky-500" aria-hidden="true" />
                <span>{isArabic ? 'تنبيه هام للإلغاء اليدوي:' : 'Important Manual Action Required:'}</span>
              </div>
              <p className="leading-relaxed">
                {isArabic
                  ? `إذا اخترت "إلغاء محلي في إمداد"، سيتم فك ربط الشحنة في النظام ليتسنى لك المتابعة، ولكن يجب عليك التوجه فوراً إلى لوحة تحكم شركة الشحن (${carrierName}) وإلغاء الشحنة هناك يدوياً برقم البوليصة أعلاه حتى لا تخرج للتسليم بالخطأ.`
                  : `If you force release in EMDAD, the order will be unlinked locally so you can proceed, but you MUST visit the ${carrierName} portal and cancel the shipment manually using the waybill above.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border-subtle">
              <Button
                type="button"
                variant="secondary"
                disabled={isForceCancelling}
                onClick={onClose}
              >
                {isArabic ? 'التوقف والتراجع عن الإلغاء' : 'Abort & Keep Shipment'}
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={isForceCancelling}
                onClick={handleForceCancel}
              >
                {isArabic ? 'إلغاء محلي في إمداد والمتابعة' : 'Force Release in EMDAD & Continue'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
