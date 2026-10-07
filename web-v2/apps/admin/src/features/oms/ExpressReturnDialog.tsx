import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
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
import { Textarea } from '@emdad/ui/ui/textarea'
import { toast } from 'sonner'
import { OmsReturnsApi } from '@/api/oms'
import { QK } from '@/constants/query-keys'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

function parseOrderInputs(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[\r\n,;]+/)) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

export function ExpressReturnDialog({ open, onClose, onSuccess }: Props) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()

  const [reason, setReason] = useState('')
  const [ordersText, setOrdersText] = useState('')
  const [resultSummary, setResultSummary] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setReason('')
    setOrdersText('')
    setResultSummary(null)
  }, [open])

  const expressMut = useMutation({
    mutationFn: async () => {
      const inputs = parseOrderInputs(ordersText)
      if (inputs.length === 0) {
        throw new Error(t('Enter at least one order number or ID.', 'أدخل رقم طلب أو معرّف واحد على الأقل.'))
      }
      const validated = await OmsReturnsApi.validateForExpress({ omsOrderIds: inputs })
      const eligibleIds = [...new Set(validated.filter((v) => v.eligible).map((v) => v.omsOrderId))]
      if (eligibleIds.length === 0) {
        const firstErr = validated.find((v) => v.error)?.error
        throw new Error(firstErr || t('No eligible orders.', 'لا توجد طلبات مؤهلة.'))
      }
      return OmsReturnsApi.expressReturn({
        omsOrderIds: eligibleIds,
        reason: reason.trim() || undefined,
      })
    },
    onSuccess: (res) => {
      const msg = t(
        `Created ${res.created.length} return(s)${res.failed.length > 0 ? `, ${res.failed.length} failed` : ''}.`,
        `تم إنشاء ${res.created.length} مرتجع${res.failed.length > 0 ? `، فشل ${res.failed.length}` : ''}.`,
      )
      if (res.failed.length > 0) toast.error(msg)
      else toast.success(msg)
      setResultSummary(msg)
      void qc.invalidateQueries({ queryKey: QK.omsReturns })
      onSuccess?.()
      if (res.failed.length === 0) onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !expressMut.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Express return', 'مرتجع سريع')}</DialogTitle>
          <DialogDescription>
            {t(
              'Paste or scan order numbers, OMS IDs, or client references — one per line. All returnable lines are returned at full quantity.',
              'الصق أو امسح أرقام الطلبات أو معرّفات OMS أو المراجع — سطر لكل طلب. تُرجَع كل الكميات القابلة للإرجاع.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="express-reason">{t('Reason (optional)', 'السبب (اختياري)')}</Label>
            <Textarea id="express-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="express-orders">{t('Orders', 'الطلبات')}</Label>
            <Textarea
              id="express-orders"
              rows={6}
              value={ordersText}
              onChange={(e) => setOrdersText(e.target.value)}
              placeholder={t('OMS-2026-00001\nclient-ref-42\n…', 'OMS-2026-00001\nclient-ref-42\n…')}
            />
          </div>
          {resultSummary ? <p className="text-sm text-muted-foreground">{resultSummary}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={expressMut.isPending}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="button" disabled={expressMut.isPending || !ordersText.trim()} onClick={() => expressMut.mutate()}>
            {expressMut.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t('Create express returns', 'إنشاء مرتجعات سريعة')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
