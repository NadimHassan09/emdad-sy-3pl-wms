import type { ContractGenerationStatus } from '@/api/documents'
import { StatusBadge, type Tone } from '@emdad/ui'

function generationTone(status: ContractGenerationStatus): Tone {
  if (status === 'complete') return 'success'
  if (status === 'partial') return 'warning'
  return 'neutral'
}

export function ContractGenerationBadge({
  status,
  isArabic,
}: {
  status: ContractGenerationStatus
  isArabic: boolean
}) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const label =
    status === 'complete'
      ? t('Complete', 'مكتمل')
      : status === 'partial'
        ? t('Partial', 'جزئي')
        : t('Not generated', 'لم يُنشأ')
  return <StatusBadge tone={generationTone(status)}>{label}</StatusBadge>
}
