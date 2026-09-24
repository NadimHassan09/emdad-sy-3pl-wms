import { useState, type ReactElement } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  Clock,
  Truck,
  Building2,
  AlertTriangle,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react';

import { OmsApi, type OmsOrderDetail } from '../../api/oms';
import { useToast } from '../ToastProvider';
import { useWmsTranslation } from '../../lib/ui-i18n';

type Props = {
  order: OmsOrderDetail;
  onRefresh?: () => void;
};

type ReturnStep = {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: typeof RotateCcw;
  timestamp?: string | null;
  isCurrent: boolean;
  isPast: boolean;
};

export function OmsOrderReturnInfoPanel({ order, onRefresh }: Props): ReactElement | null {
  const { isArabic } = useWmsTranslation();
  const toast = useToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const activeReturn = order.activeReturn;
  const isReturned = order.status === 'returned';
  const isFailedDelivery = order.status === 'failed_delivery';

  // Only render if order has return activity or failed delivery
  if (!activeReturn && !isReturned && !isFailedDelivery) {
    return null;
  }

  const stage = activeReturn?.carrierReturnStage || (isReturned ? 'warehouse_confirmed' : 'return_created');

  const stepsOrder = ['return_created', 'returning_to_sender', 'returned_to_sender', 'warehouse_confirmed'];
  const currentIndex = stepsOrder.indexOf(stage) >= 0 ? stepsOrder.indexOf(stage) : (isReturned ? 3 : 0);

  const steps: ReturnStep[] = [
    {
      id: 'return_created',
      labelAr: 'إنشاء طلب الإرجاع',
      labelEn: 'Return Initiated',
      icon: RotateCcw,
      timestamp: activeReturn?.carrierReturnCreatedAt || order.deliveryFailedAt || activeReturn?.createdAt,
      isCurrent: currentIndex === 0,
      isPast: currentIndex > 0,
    },
    {
      id: 'returning_to_sender',
      labelAr: 'قيد العودة للمستودع',
      labelEn: 'Returning to Sender',
      icon: Truck,
      timestamp: activeReturn?.carrierReturningAt,
      isCurrent: currentIndex === 1,
      isPast: currentIndex > 1,
    },
    {
      id: 'returned_to_sender',
      labelAr: 'وصلت مقر الإرجاع',
      labelEn: 'Arrived at Dock',
      icon: Building2,
      timestamp: activeReturn?.carrierReturnedAt,
      isCurrent: currentIndex === 2,
      isPast: currentIndex > 2,
    },
    {
      id: 'warehouse_confirmed',
      labelAr: 'تأكيد المستودع وإعادة المخزون',
      labelEn: 'Warehouse Restocked',
      icon: PackageCheck,
      timestamp: activeReturn?.warehouseConfirmedAt || order.returnedAt,
      isCurrent: currentIndex === 3,
      isPast: currentIndex >= 3,
    },
  ];

  const handleConfirmWarehouseReceipt = async () => {
    setIsConfirming(true);
    try {
      await OmsApi.confirmReturnReceipt(order.id);
      toast.success(
        isArabic
          ? 'تم تأكيد استلام المرتجع في المستودع وإعادة قيد المنتجات في المخزون بنجاح.'
          : 'Return confirmed and inventory restocked into warehouse.',
      );
      setConfirmModalOpen(false);
      onRefresh?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(
        isArabic
          ? `فشل تأكيد استلام المرتجع: ${msg}`
          : `Failed to confirm return: ${msg}`,
      );
    } finally {
      setIsConfirming(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString(isArabic ? 'ar-SY' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6 mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {isArabic ? 'دورة إرجاع الشحنة ومطابقة المستودع' : 'Return Lifecycle & Warehouse Verification'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isArabic
                ? 'تتبع مراحل المرتجع لدى شركة الشحن ومطابقة الاستلام الفعلي بالمخزون'
                : 'Carrier return progression with warehouse stock confirmation'}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {currentIndex === 3 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isArabic ? 'مكتمل بالمستودع وتمت إعادة المخزون' : 'Confirmed & Restocked'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              <Clock className="w-3.5 h-3.5 animate-pulse" />
              {isArabic ? 'بانتظار الاستلام الفعلي بالمستودع' : 'Pending Warehouse Intake'}
            </span>
          )}
        </div>
      </div>

      {/* Lifecycle Stepper */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isDone = step.isPast;
          const isCurrent = step.isCurrent;

          return (
            <div
              key={step.id}
              className={`relative rounded-xl border p-4 transition-all ${
                isDone
                  ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                  : isCurrent
                  ? 'bg-amber-50/60 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700 ring-2 ring-amber-400/30'
                  : 'bg-muted/30 border-border opacity-70'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    isDone
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-amber-600 text-white'
                      : 'bg-muted text-muted-foreground border border-border'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </span>
                <StepIcon
                  className={`w-4 h-4 ${
                    isDone
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : isCurrent
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground'
                  }`}
                />
              </div>

              <div className="text-sm font-semibold text-foreground">
                {isArabic ? step.labelAr : step.labelEn}
              </div>

              <div className="text-xs text-muted-foreground mt-1">
                {step.timestamp ? formatDate(step.timestamp) : (isDone ? 'مكتمل' : '—')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Details Box */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/40 border border-border text-xs">
        <div>
          <span className="text-muted-foreground block mb-0.5">
            {isArabic ? 'رقم طلب الإرجاع:' : 'Return Number:'}
          </span>
          <span className="font-semibold text-foreground font-mono">
            {activeReturn?.returnNumber || '—'}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground block mb-0.5">
            {isArabic ? 'سبب الإرجاع (المعتمد):' : 'Return Reason:'}
          </span>
          <span className="font-semibold text-foreground">
            {activeReturn?.reason || '—'}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground block mb-0.5">
            {isArabic ? 'حالة شركة الشحن الأصلية:' : 'Original Carrier Status:'}
          </span>
          <span className="font-semibold text-foreground font-mono">
            {activeReturn?.carrierOriginalStatus || '—'}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground block mb-0.5">
            {isArabic ? 'بوليصة الشحن (AWB):' : 'Tracking AWB:'}
          </span>
          <span className="font-semibold text-foreground font-mono">
            {activeReturn?.carrierAwb || order.trackingNumber || '—'}
          </span>
        </div>
      </div>

      {/* Verification Notice & Action */}
      {currentIndex < 3 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {isArabic
                  ? 'البضاعة لم تُعد للمخزون بعد (حماية المخزون)'
                  : 'Inventory not yet restocked (Stock Guard)'}
              </h4>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/80 mt-0.5">
                {isArabic
                  ? 'بناءً على السياسة المحكمة، إشعارات شركة الشحن لا تغير المخزون تلقائياً. يرجى الضغط على زر التأكيد بعد الفحص الفعلي للبضاعة في المستودع.'
                  : 'Carrier status updates do not affect stock. Confirm physical intake below once goods are verified.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setConfirmModalOpen(true)}
            className="shrink-0 px-4 py-2.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            {isArabic ? 'تأكيد استلام المرتجع وإعادة المخزون' : 'Confirm Receipt & Restock'}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20 p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="text-xs text-emerald-900 dark:text-emerald-200">
            <span className="font-semibold block text-sm">
              {isArabic
                ? 'تم استلام المرتجع وإعادة إدخال المنتجات في المخزون بنجاح'
                : 'Return verified and restocked into warehouse inventory'}
            </span>
            <span>
              {isArabic ? 'تاريخ الإكمال في المستودع: ' : 'Completed at: '}
              {formatDate(activeReturn?.warehouseConfirmedAt || order.returnedAt)}
            </span>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <PackageCheck className="w-6 h-6" />
              <h3 className="text-base font-bold text-foreground">
                {isArabic ? 'تأكيد استلام المرتجع في المستودع' : 'Confirm Return Receipt'}
              </h3>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {isArabic
                ? 'هل تأكدت من وصول الطرد المرتجع وفحص محتوياته؟ سيقوم النظام الآن بإعادة كميات المنتجات إلى المخزون (موقع المرتجعات Returns) وتحويل حالة الطلب إلى "مرتجع".'
                : 'Have you verified physical arrival and inspection of this return? This will restock the items into warehouse inventory and set the order status to Returned.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={isConfirming}
                className="px-4 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted text-foreground cursor-pointer"
              >
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmWarehouseReceipt}
                disabled={isConfirming}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isConfirming && <Clock className="w-3.5 h-3.5 animate-spin" />}
                {isArabic ? 'نعم، تأكيد الاستلام وإعادة المخزون' : 'Confirm & Restock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
