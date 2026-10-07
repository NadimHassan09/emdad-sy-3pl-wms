import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Label } from '@emdad/ui/ui/label'
import { ScrollArea } from '@emdad/ui/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import { ShippingApi } from '@/api/shipping'
import { QK } from '@/constants/query-keys'

type Props = {
  open: boolean
  outboundOrderIds: string[]
  isArabic: boolean
  onClose: () => void
}

export function OutboundBulkShippingDialog({ open, outboundOrderIds, isArabic, onClose }: Props) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [jobId, setJobId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSelections({})
      setJobId(null)
    }
  }, [open])

  const previewQuery = useQuery({
    queryKey: ['shipping-bulk-preview', outboundOrderIds.join(',')],
    queryFn: () => ShippingApi.bulkPreview(outboundOrderIds),
    enabled: open && outboundOrderIds.length > 0 && !jobId,
    staleTime: 30_000,
  })

  useEffect(() => {
    const lines = previewQuery.data?.lines
    if (!lines?.length) return
    setSelections((prev) => {
      const next = { ...prev }
      for (const line of lines) {
        if (!next[line.outboundOrderId]) next[line.outboundOrderId] = line.selectedProviderCode
      }
      return next
    })
  }, [previewQuery.data])

  const jobQuery = useQuery({
    queryKey: ['shipping-bulk-job', jobId],
    queryFn: () => ShippingApi.bulkGetJob(jobId!),
    enabled: Boolean(jobId),
    refetchInterval: (q) => {
      const status = q.state.data?.status
      if (status === 'processing' || status === 'pending') return 1200
      return false
    },
  })

  useEffect(() => {
    const job = jobQuery.data
    if (job && (job.status === 'completed' || job.status === 'completed_with_errors' || job.status === 'failed')) {
      void qc.invalidateQueries({ queryKey: QK.outboundOrders })
      toast.success(t('Bulk shipping job finished.', 'انتهت مهمة الشحن الجماعي.'))
    }
  }, [jobQuery.data, qc, isArabic])

  const confirmMut = useMutation({
    mutationFn: () => {
      const lines = previewQuery.data?.lines ?? []
      const items = lines.map((line) => ({
        outboundOrderId: line.outboundOrderId,
        providerCode: selections[line.outboundOrderId] || line.selectedProviderCode,
      }))
      return ShippingApi.bulkConfirm(items)
    },
    onSuccess: (job) => {
      setJobId(job.id)
      toast.success(t('Bulk shipping started.', 'بدأ الشحن الجماعي.'))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const lines = previewQuery.data?.lines ?? []
  const busy = confirmMut.isPending || jobQuery.isFetching

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('Bulk shipping processing', 'معالجة الشحن الجماعي')}</DialogTitle>
          <DialogDescription>
            {t(
              'Review carrier selections for ready-to-dispatch orders, then confirm to create AWBs.',
              'راجع اختيارات الشركات للطلبات الجاهزة للإرسال، ثم أكّد لإنشاء البوليصات.',
            )}
          </DialogDescription>
        </DialogHeader>

        {jobId ? (
          <div className="space-y-2 px-1 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t('Job status', 'حالة المهمة')}: {jobQuery.data?.status ?? '…'}
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[min(70vh,28rem)]">
            <div className="space-y-3 px-1 py-2">
              {previewQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t('Loading preview…', 'جارٍ تحميل المعاينة…')}
                </div>
              ) : null}
              {lines.map((line) => {
                const quotes = line.quotes ?? []
                return (
                  <div key={line.outboundOrderId} className="rounded-lg border p-3">
                    <div className="font-mono text-sm font-semibold">{line.orderNumber}</div>
                    <div className="mt-2 space-y-1.5">
                      <Label>{t('Carrier', 'شركة الشحن')}</Label>
                      <Select
                        value={selections[line.outboundOrderId] || line.selectedProviderCode || undefined}
                        onValueChange={(v) =>
                          setSelections((prev) => ({ ...prev, [line.outboundOrderId]: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select', 'اختر')} />
                        </SelectTrigger>
                        <SelectContent>
                          {quotes.map((q) => (
                            <SelectItem key={q.providerCode} value={q.providerCode}>
                              {q.providerName || q.providerCode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!quotes.length ? (
                        <p className="text-xs text-tone-warning-fg">
                          {t('No quotes — check shipping details.', 'لا عروض — راجع تفاصيل الشحن.')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t('Close', 'إغلاق')}
          </Button>
          {!jobId ? (
            <Button type="button" disabled={busy || !lines.length} onClick={() => confirmMut.mutate()}>
              {confirmMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t('Start bulk shipping', 'بدء الشحن الجماعي')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
