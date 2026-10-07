import { useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { OmsReturnsApi } from '@/api/oms'
import { QK } from '@/constants/query-keys'
import { OmsScanDialog, type OmsScanResult } from './OmsScanDialog'

type Props = {
  open: boolean
  onClose: () => void
  isArabic: boolean
  onRefreshNeeded?: () => void
}

export function ConfirmReturnByScanDialog({ open, onClose, isArabic, onRefreshNeeded }: Props) {
  const qc = useQueryClient()
  const touchedRef = useRef(false)

  const t = (en: string, ar: string) => (isArabic ? ar : en)

  const handleScan = async (code: string): Promise<OmsScanResult> => {
    try {
      const res = await OmsReturnsApi.confirmReturnByScan(code)
      if (res.action !== 'already_completed') {
        touchedRef.current = true
        void qc.invalidateQueries({ queryKey: QK.omsReturns })
        onRefreshNeeded?.()
      }
      return {
        ok: true,
        message:
          res.message ||
          (res.action === 'already_completed'
            ? t('Already completed.', 'المرتجع مكتمل مسبقاً.')
            : t('Return confirmed.', 'تم تأكيد المرتجع.')),
      }
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : t('Failed to process code.', 'فشل التحقق من الرمز.'),
      }
    }
  }

  const close = () => {
    if (touchedRef.current) onRefreshNeeded?.()
    touchedRef.current = false
    onClose()
  }

  return (
    <OmsScanDialog
      open={open}
      keepOpen
      isArabic={isArabic}
      title={t('Confirm return by scan (QR / barcode)', 'تأكيد واستلام المرتجع عبر المسح (QR / باركود)')}
      hint={t(
        'Point the camera at the waybill QR or barcode. The dialog stays open so you can scan the next parcel immediately.',
        'وجّه الكاميرا نحو QR أو الباركود على بوليصة الشحن. تبقى النافذة مفتوحة لمسح الطرد التالي فوراً.',
      )}
      submitLabel={t('Confirm', 'تأكيد')}
      onClose={close}
      onScan={handleScan}
    />
  )
}
