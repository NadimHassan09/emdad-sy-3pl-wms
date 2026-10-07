import { useState } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, ExternalLink, FileDown, Globe, Loader2, Printer, Receipt,
} from 'lucide-react'
import { useNavigate } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'
import { OmsApi } from '@/api/oms'
import { printPdfBlob } from '@/lib/print-pdf-blob'
import { OmsWaybillView } from './OmsWaybillView'

const WAYBILL_PRINT_CSS = `
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
      min-height: 146mm !important;
      height: auto !important;
      max-height: none !important;
      border: 1.5px solid #000000 !important;
      box-shadow: none !important;
      padding: 3mm !important;
      margin: 2mm auto !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      box-sizing: border-box !important;
      overflow: visible !important;
      display: flex !important;
      flex-direction: column !important;
    }
  }
`

export function OmsWaybillPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [isArabic, setIsArabic] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const t = (en: string, ar: string) => (isArabic ? ar : en)

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
  })

  const handleDownloadPdf = async () => {
    if (!id || !waybill) return
    try {
      setIsDownloading(true)
      await OmsApi.downloadWaybillPdf(id, waybill.orderNumber)
    } catch (err) {
      console.error('Failed to download waybill PDF:', err)
      toast.error(t('Failed to download waybill PDF', 'فشل تحميل ملف PDF للبوليصة'))
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrint = async () => {
    if (!id || !waybill) return
    try {
      setIsDownloading(true)
      const blob = await OmsApi.waybillPdfBlob(id)
      printPdfBlob(blob)
    } catch {
      toast.error(t('Could not prepare the label for printing', 'تعذر تجهيز البوليصة للطباعة'))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/40 pb-12 print:bg-white print:p-0 print:m-0">
      <header className="sticky top-0 z-30 border-b bg-background/95 px-4 py-3 shadow-sm backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="rtl:rotate-180" aria-hidden />
              {t('Back', 'رجوع')}
            </Button>
            <div>
              <h1 className="flex flex-wrap items-center gap-2 text-sm font-bold">
                <span>{t('Shipping Waybill', 'بوليصة الشحن')}</span>
                {waybill ? (
                  <span className="rounded border bg-muted px-2 py-0.5 font-mono text-xs font-semibold">{waybill.orderNumber}</span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded border border-tone-success-border bg-tone-success-bg px-2 py-0.5 font-mono text-xs font-semibold text-tone-success-fg">
                  <Receipt className="size-3" aria-hidden />
                  10 × 15 cm
                </span>
              </h1>
              <p className="text-sm text-muted-foreground">
                {t(
                  'Official 10 × 15 cm thermal shipping waybill (4×6")',
                  'معاينة وطباعة بوليصة الشحن المعتمدة بمقاس 10 × 15 سم (طابعات حرارية 4×6 إنش)',
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsArabic(!isArabic)}>
              <Globe aria-hidden />
              {isArabic ? 'English' : 'عربي'}
            </Button>
            {waybill?.labelUrl ? (
              <Button type="button" variant="outline" size="sm" onClick={() => window.open(waybill.labelUrl!, '_blank', 'noopener,noreferrer')}>
                <ExternalLink aria-hidden />
                {t('Carrier PDF Label', 'بوليصة الناقل الأصلية')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isLoading || !waybill || isDownloading}
              onClick={() => void handleDownloadPdf()}
            >
              {isDownloading ? <Loader2 className="animate-spin" aria-hidden /> : <FileDown aria-hidden />}
              {t('Download PDF', 'تحميل PDF')}
            </Button>
            <Button type="button" size="sm" disabled={isLoading || !waybill || isDownloading} onClick={() => void handlePrint()}>
              <Printer aria-hidden />
              {t('Print', 'طباعة البوليصة')}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 sm:p-6 print:max-w-none print:p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-24 text-center">
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-medium text-muted-foreground">
              {t('Preparing waybill details...', 'جاري تجهيز بيانات بوليصة الشحن...')}
            </p>
          </div>
        ) : isError || !waybill ? (
          <div
            role="alert"
            className="my-8 rounded-xl border border-tone-danger-border bg-tone-danger-bg p-8 text-center text-sm text-tone-danger-fg"
          >
            <p className="text-base font-semibold">{t('Failed to load waybill', 'تعذر استخراج بيانات بوليصة الشحن')}</p>
            <p className="mt-1 font-mono text-xs">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        ) : (
          <div className="print:m-0 print:p-0">
            <OmsWaybillView waybill={waybill} isArabic={isArabic} />
          </div>
        )}
      </main>

      <style>{WAYBILL_PRINT_CSS}</style>
    </div>
  )
}
