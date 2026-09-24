import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { OmsApi } from '../../api/oms';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { OmsWaybillView } from './OmsWaybillView';

type Props = {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
  isArabic?: boolean;
};

export function OmsWaybillModal({ open, orderId, onClose, isArabic = false }: Props) {
  const [isDownloading, setIsDownloading] = useState(false);

  const {
    data: waybill,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['oms-waybill', orderId],
    queryFn: () => (orderId ? OmsApi.getWaybill(orderId) : Promise.reject(new Error('No ID'))),
    enabled: open && Boolean(orderId),
    staleTime: 30_000,
  });

  const handleDownloadPdf = async () => {
    if (!orderId || !waybill) return;
    try {
      setIsDownloading(true);
      await OmsApi.downloadWaybillPdf(orderId, waybill.orderNumber);
    } catch (err) {
      console.error('Failed to download waybill PDF:', err);
      alert(isArabic ? 'فشل تحميل ملف PDF للبوليصة' : 'Failed to download waybill PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenFullPage = () => {
    if (!orderId) return;
    window.open(`/orders/oms/${orderId}/waybill`, '_blank');
  };

  const handlePrint = () => {
    if (!orderId) return;
    // Open the dedicated waybill view in a new tab where user can print or download without forced popups
    window.open(`/orders/oms/${orderId}/waybill`, '_blank');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isArabic ? 'بوليصة الشحن' : 'Shipping Waybill'}
      widthClass="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Top action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <i className="fa-solid fa-file-invoice text-sm" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-text-strong">
                  {waybill?.orderNumber || (isArabic ? 'جاري التحميل...' : 'Loading...')}
                </h3>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300">
                  <i className="fa-solid fa-receipt text-[9px]" />
                  <span>10 × 15 cm</span>
                </span>
              </div>
              <p className="text-xs text-text-muted">
                {isArabic ? 'بوليصة الشحن المعتمدة للطلب (طابعات حرارية 10 × 15 سم)' : 'Official shipping waybill (10 × 15 cm thermal)'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {waybill?.labelUrl && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(waybill.labelUrl!, '_blank')}
                className="gap-1.5"
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-xs" aria-hidden="true" />
                <span>{isArabic ? 'بوليصة شركة الشحن' : 'Carrier Label PDF'}</span>
              </Button>
            )}

            {/* Open Full Page in New Tab */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenFullPage}
              disabled={isLoading || !waybill}
              className="gap-1.5"
            >
              <i className="fa-solid fa-expand text-xs" aria-hidden="true" />
              <span>{isArabic ? 'فتح في صفحة مستقلة' : 'Full Page'}</span>
            </Button>

            {/* Direct Download PDF */}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isLoading || !waybill || isDownloading}
              className="gap-1.5 border-slate-300 font-bold"
            >
              <i
                className={isDownloading ? 'fa-solid fa-spinner fa-spin text-xs' : 'fa-solid fa-file-pdf text-rose-600 text-xs'}
                aria-hidden="true"
              />
              <span>{isArabic ? 'تحميل PDF' : 'Download PDF'}</span>
            </Button>

            {/* Print Button */}
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              disabled={isLoading || !waybill}
              className="gap-1.5 bg-primary text-white font-bold"
            >
              <i className="fa-solid fa-print text-xs" aria-hidden="true" />
              <span>{isArabic ? 'طباعة البوليصة' : 'Print Waybill'}</span>
            </Button>
          </div>
        </div>

        {/* Content area */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <i className="fa-solid fa-spinner fa-spin text-2xl text-primary" aria-hidden="true" />
            <p className="text-sm text-text-muted">
              {isArabic ? 'جاري استخراج بيانات بوليصة الشحن...' : 'Loading waybill details...'}
            </p>
          </div>
        ) : isError || !waybill ? (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 text-center text-sm text-danger">
            <i className="fa-solid fa-circle-exclamation text-xl mb-2" aria-hidden="true" />
            <p className="font-semibold">
              {isArabic ? 'فشل تحميل بيانات بوليصة الشحن' : 'Failed to load waybill'}
            </p>
            <p className="text-xs mt-1 text-text-muted">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh] p-1">
            <OmsWaybillView waybill={waybill} isArabic={isArabic} />
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div className="flex justify-between items-center pt-3 border-t border-border">
          <div className="text-xs text-text-muted">
            {isArabic ? 'يمكنك طباعة أو حفظ البوليصة كملف PDF' : 'Print or save waybill as PDF'}
          </div>
          <Button variant="secondary" size="md" onClick={onClose}>
            {isArabic ? 'إغلاق' : 'Close'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
