import { useMemo } from 'react'
import { ExternalLink } from 'lucide-react'
import { StatusBadge, toneClasses, cn, type Tone } from '@emdad/ui'
import { switchUiAndReload } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@emdad/ui/ui/dialog'
import type { OmsBulkApproveResponse, OmsBulkCancelResponse, OmsBulkConfirmResponse, OmsBulkStatusTransitionResponse } from '@/api/oms'
import type { BulkIdsResponse } from '@/api/outbound'

export function StatCard({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const t = toneClasses[tone]
  return (
    <div className={cn('rounded-lg border px-2 py-2 text-center', t.bg, t.border, t.text)}>
      <div className="tabular text-lg font-semibold">{value}</div>
      <div className="text-sm">{label}</div>
    </div>
  )
}

/* ── Bulk action result ─────────────────────────────────────────── */
export type BulkResult = OmsBulkApproveResponse | OmsBulkConfirmResponse | OmsBulkCancelResponse | OmsBulkStatusTransitionResponse | BulkIdsResponse

type Normalized = { succeeded: { orderNumber: string | null }[]; failures: { orderNumber: string | null; error: string }[]; total: number; ok: number; failed: number }

function normalize(r: BulkResult): Normalized {
  const pick = (succeeded: { orderNumber: string | null }[], ok: number): Normalized => ({
    succeeded,
    failures: r.failures.map((f) => ({ orderNumber: f.orderNumber, error: f.error })),
    total: r.requested,
    ok,
    failed: r.failed,
  })
  if ('approved' in r) return pick(r.approvedOrders, r.approved)
  if ('confirmed' in r) return pick(r.confirmedOrders, r.confirmed)
  if ('cancelled' in r) return pick(r.cancelledOrders, r.cancelled)
  return pick(r.completedOrders, r.completed)
}

export function BulkResultDialog({ open, title, result, onClose, isArabic }: { open: boolean; title: string; result: BulkResult; onClose: () => void; isArabic: boolean }) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const n = useMemo(() => normalize(result), [result])
  const skipped = Math.max(0, n.total - n.ok - n.failed)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t(`${n.total} orders requested`, `${n.total} طلب مطلوب`)}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label={t('Succeeded', 'نجح')} value={n.ok} tone="success" />
          <StatCard label={t('Failed', 'فشل')} value={n.failed} tone={n.failed ? 'danger' : 'neutral'} />
          <StatCard label={t('Skipped', 'تم تخطيها')} value={skipped} tone="neutral" />
        </div>
        {n.failures.length > 0 ? (
          <ul className="max-h-56 divide-y overflow-y-auto rounded-lg border text-sm">
            {n.failures.map((f, i) => (
              <li key={`${f.orderNumber}-${i}`} className="flex flex-col gap-0.5 px-3 py-2">
                <span className="font-medium">{f.orderNumber ?? '—'}</span>
                <span className="text-muted-foreground">{f.error}</span>
              </li>
            ))}
          </ul>
        ) : n.succeeded.length > 0 ? (
          <p className="text-sm text-muted-foreground">{n.succeeded.map((o) => o.orderNumber).filter(Boolean).slice(0, 12).join(', ')}{n.succeeded.length > 12 ? '…' : ''}</p>
        ) : null}
        <DialogFooter>
          <Button type="button" onClick={onClose}>{t('Close', 'إغلاق')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Honest placeholder for flows not yet rebuilt (Phase 1 scope) ── */
export function NotYetRebuiltDialog({ open, feature, onClose, isArabic }: { open: boolean; feature: string; onClose: () => void; isArabic: boolean }) {
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{feature}</DialogTitle>
          <DialogDescription>
            {t('This action is not part of the new interface yet. Open the classic interface to complete it — nothing is lost.', 'هذا الإجراء لم يُنقل إلى الواجهة الجديدة بعد. افتح الواجهة الكلاسيكية لإتمامه — لن يضيع أي شيء.')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <StatusBadge tone="pending">{t('Coming in a later phase', 'في مرحلة لاحقة')}</StatusBadge>
          <Button type="button" variant="outline" onClick={onClose}>{t('Close', 'إغلاق')}</Button>
          <Button type="button" onClick={() => switchUiAndReload('v1')}>
            <ExternalLink aria-hidden />
            {t('Open classic interface', 'فتح الواجهة الكلاسيكية')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
