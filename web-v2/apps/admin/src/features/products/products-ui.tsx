import { StatusBadge, type Tone } from '@emdad/ui'
import { productStatusLabel } from '@/lib/product-labels'

const PRODUCT_STATUS_TONE: Record<string, Tone> = {
  active: 'success',
  suspended: 'warning',
  archived: 'neutral',
}

export function ProductStatusBadge({ status, isArabic }: { status: string; isArabic: boolean }) {
  return (
    <StatusBadge tone={PRODUCT_STATUS_TONE[status] ?? 'neutral'}>
      {productStatusLabel(status, isArabic)}
    </StatusBadge>
  )
}
