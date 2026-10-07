import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Expand, ExternalLink, FileDown, Globe, Loader2, Printer, Receipt } from 'lucide-react'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { ScrollArea } from '@emdad/ui/ui/scroll-area'
import { OmsApi } from '@/api/oms'
import { printPdfBlob } from '@/lib/print-pdf-blob'
import { OmsWaybillView } from './OmsWaybillView'

type Props = {
  open: boolean
  orderId: string | null
  onClose: () => void
}

export function OmsWaybillDialog({ open, orderId, onClose }: Props) {
  const [isArabic, setIsArabic] = useState(true)
  const [isDownloading, setIsDownloading] = useState(false)
  const t = (en: string, ar: string) => (isArabic ? ar : en)

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
  })

  const handleDownloadPdf = async () => {
    if (!orderId || !waybill) return
    try {
      setIsDownloading(true)
      await OmsApi.downloadWaybillPdf(orderId, waybill.orderNumber)
    } catch (err) {
      console.error('Failed to download waybill PDF:', err)
      toast.error(t('Failed to download waybill PDF', 'فشل تحميل ملف PDF للبوليصة'))
    } finally {
      setIsDownloading(false)
    }
  }

  const handleOpenFullPage = () => {
    if (!orderId) return
    window.open(`/orders/oms/${orderId}/waybill`, '_blank', 'noopener,noreferrer')
  }

  const handlePrint = async () => {
    if (!orderId || !waybill) return
    try {
      setIsDownloading(true)
      const blob = await OmsApi.waybillPdfBlob(orderId)
      printPdfBlob(blob)
    } catch {
      toast.error(t('Could not prepare the label for printing', 'تعذر تجهيز البوليصة للطباعة'))
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{t('Shipping Waybill', 'بوليصة الشحن')}</DialogTitle>
          <DialogDescription>
            {t('Official shipping waybill (10 × 15 cm thermal)', 'بوليصة الشحن المعتمدة للطلب (طابعات حرارية 10 × 15 سم)')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Receipt className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-bold">
                    {waybill?.orderNumber ?? t('Loading...', 'جاري التحميل...')}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded border border-tone-success-border bg-tone-success-bg px-1.5 py-0.5 font-mono text-xs font-semibold text-tone-success-fg">
                    10 × 15 cm
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsArabic(!isArabic)}>
                <Globe aria-hidden />
                {isArabic ? 'English' : 'عربي'}
              </Button>
              {waybill?.labelUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(waybill.labelUrl!, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink aria-hidden />
                  {t('Carrier Label PDF', 'بوليصة شركة الشحن')}
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="sm" disabled={isLoading || !waybill} onClick={handleOpenFullPage}>
                <Expand aria-hidden />
                {t('Full page', 'فتح في صفحة مستقلة')}
              </Button>
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
                {t('Print Waybill', 'طباعة البوليصة')}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-16 text-center">
              <Loader2 className="size-7 animate-spin text-primary" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {t('Loading waybill details...', 'جاري استخراج بيانات بوليصة الشحن...')}
              </p>
            </div>
          ) : isError || !waybill ? (
            <div
              role="alert"
              className="rounded-xl border border-tone-danger-border bg-tone-danger-bg p-6 text-center text-sm text-tone-danger-fg"
            >
              <p className="font-semibold">{t('Failed to load waybill', 'فشل تحميل بيانات بوليصة الشحن')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{error instanceof Error ? error.message : 'Unknown error'}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[70vh] p-1">
              <OmsWaybillView waybill={waybill} isArabic={isArabic} />
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-between">
          <p className="text-sm text-muted-foreground">{t('Print or save waybill as PDF', 'يمكنك طباعة أو حفظ البوليصة كملف PDF')}</p>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('Close', 'إغلاق')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
