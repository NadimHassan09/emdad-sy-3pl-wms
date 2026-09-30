import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { OmsApi } from '../api/oms';
import { Button } from '../components/Button';
import { OmsWaybillView } from '../components/oms/OmsWaybillView';

export function OmsWaybillPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isArabic, setIsArabic] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const {
    data: waybill,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['oms-waybill', id],
    queryFn: () => (id ? OmsApi.getWaybill(id) : Promise.reject(new Error('No ID'))),
    enabled: Boolean(id),
    staleTime: 60_000,
  });

  const handleDownloadPdf = async () => {
    if (!id || !waybill) return;
    try {
      setIsDownloading(true);
      await OmsApi.downloadWaybillPdf(id, waybill.orderNumber);
    } catch (err) {
      console.error('Failed to download waybill PDF:', err);
      alert(isArabic ? 'فشل تحميل ملف PDF للبوليصة' : 'Failed to download waybill PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-12 print:bg-white print:p-0 print:m-0">
      {/* Top Action Bar (Hidden during print) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 shadow-xs print:hidden">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-1.5"
            >
              <i className="fa-solid fa-arrow-right rtl:rotate-0 ltr:rotate-180 text-xs" aria-hidden="true" />
              <span>{isArabic ? 'رجوع' : 'Back'}</span>
            </Button>

            <div>
              <h1 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>{isArabic ? 'بوليصة الشحن' : 'Shipping Waybill'}</span>
                {waybill && (
                  <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                    {waybill.orderNumber}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                  <i className="fa-solid fa-receipt text-[10px]" aria-hidden="true" />
                  <span>10 × 15 cm</span>
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                {isArabic
                  ? 'معاينة وطباعة بوليصة الشحن المعتمدة بمقاس 10 × 15 سم (طابعات حرارية 4×6 إنش)'
                  : 'Official 10 × 15 cm thermal shipping waybill (4×6")'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Language Switch */}
            <button
              type="button"
              onClick={() => setIsArabic(!isArabic)}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <i className="fa-solid fa-globe text-xs" aria-hidden="true" />
              <span>{isArabic ? 'English' : 'عربي'}</span>
            </button>

            {/* Carrier Official Label if available */}
            {waybill?.labelUrl && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(waybill.labelUrl!, '_blank')}
                className="gap-1.5"
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-xs" aria-hidden="true" />
                <span>{isArabic ? 'بوليصة الناقل الأصلية' : 'Carrier PDF Label'}</span>
              </Button>
            )}

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
              <span>{isArabic ? 'طباعة البوليصة' : 'Print'}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 print:p-0 print:max-w-none">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
            <i className="fa-solid fa-spinner fa-spin text-3xl text-primary" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-600">
              {isArabic ? 'جاري تجهيز بيانات بوليصة الشحن...' : 'Preparing waybill details...'}
            </p>
          </div>
        ) : isError || !waybill ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-sm text-rose-800 my-8">
            <i className="fa-solid fa-circle-exclamation text-2xl mb-2 text-rose-600" aria-hidden="true" />
            <p className="font-bold text-base">
              {isArabic ? 'تعذر استخراج بيانات بوليصة الشحن' : 'Failed to load waybill'}
            </p>
            <p className="text-xs text-rose-600 mt-1 font-mono">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        ) : (
          <div className="print:m-0 print:p-0">
            <OmsWaybillView waybill={waybill} isArabic={isArabic} />
          </div>
        )}
      </main>

      {/* Print Styles: Configured for 10 × 15 cm (100mm × 150mm) Thermal Label */}
      <style>{`
        @media print {
          @page {
            size: 100mm 150mm;
            margin: 0;
          }
          html, body {
            width: 100mm !important;
            height: 150mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            width: 100mm !important;
          }
          .waybill-paper {
            width: 96mm !important;
            max-width: 96mm !important;
            height: 146mm !important;
            max-height: 146mm !important;
            border: 1.5px solid #000000 !important;
            box-shadow: none !important;
            padding: 3mm !important;
            margin: 2mm auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
        }
      `}</style>
    </div>
  );
}

export default OmsWaybillPage;
