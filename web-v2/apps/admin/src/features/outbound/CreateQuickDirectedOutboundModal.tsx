import { useState } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@emdad/ui/ui/select'
import type { QuickDirectedOutboundInput, QuickDirectedOutboundReasonCode } from '@/api/outbound'
import { QUICK_DIRECTED_REASON_OPTIONS } from '@/lib/quick-directed-outbound'

type Props = {
  open: boolean
  loading?: boolean
  isArabic: boolean
  onClose: () => void
  onSubmit: (input: Omit<QuickDirectedOutboundInput, 'warehouseId'>) => void
}

export function CreateQuickDirectedOutboundModal({ open, loading, isArabic, onClose, onSubmit }: Props) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const [productCode, setProductCode] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [reasonCode, setReasonCode] = useState<QuickDirectedOutboundReasonCode>('consumption')

  function reset() {
    setProductCode('')
    setQuantity('1')
    setReasonCode('consumption')
  }

  function handleClose() {
    if (!loading) {
      reset()
      onClose()
    }
  }

  function handleSubmit() {
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) return
    const code = productCode.trim()
    if (!code) return
    onSubmit({ productCode: code, quantity: qty, reasonCode })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Quick directed outbound', 'إخراج سريع موجّه')}</DialogTitle>
          <DialogDescription>
            {t(
              'Scan or enter a product code and quantity. Stock is picked from directed locations automatically.',
              'امسح أو أدخل رمز المنتج والكمية. يُلتقط المخزون من مواقع موجّهة تلقائياً.',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('Barcode / SKU', 'الباركود / SKU')}</Label>
            <Input
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder={t('Scan or type barcode / SKU', 'امسح أو اكتب الباركود / SKU')}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Quantity', 'الكمية')}</Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('Reason', 'سبب الإخراج')}</Label>
            <Select value={reasonCode} onValueChange={(v) => setReasonCode(v as QuickDirectedOutboundReasonCode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUICK_DIRECTED_REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {isArabic ? opt.labelAr : opt.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={handleClose}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button
            type="button"
            disabled={loading || !productCode.trim() || !quantity.trim()}
            onClick={handleSubmit}
          >
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t('Confirm outbound', 'تأكيد الإخراج')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
