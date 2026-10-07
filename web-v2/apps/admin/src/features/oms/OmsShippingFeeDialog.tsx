import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialFee?: string | null
  loading?: boolean
  onSave: (fee: number) => void
  isArabic: boolean
}

export function OmsShippingFeeDialog({
  open,
  onOpenChange,
  initialFee,
  loading,
  onSave,
  isArabic,
}: Props) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const [fee, setFee] = useState('')

  useEffect(() => {
    if (open) setFee(initialFee?.trim() ? String(initialFee) : '')
  }, [open, initialFee])

  const submit = () => {
    const trimmed = fee.trim()
    if (!trimmed) return
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n < 0) return
    onSave(n)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Specify shipping fee', 'تحديد رسوم الشحن')}</DialogTitle>
          <DialogDescription className="text-sm">
            {t(
              'Set or update the shipping fee after this OMS order has been delivered.',
              'حدّد أو حدّث رسوم الشحن بعد تسليم طلب OMS.',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="oms-shipping-fee" className="text-sm">
            {t('Shipping fee', 'رسوم الشحن')}
          </Label>
          <Input
            id="oms-shipping-fee"
            type="number"
            min={0}
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            disabled={loading}
            className="text-sm"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button type="button" onClick={submit} disabled={loading || !fee.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('Save fee', 'حفظ الرسوم')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
