import type { ReactNode } from 'react'
import type { AuditLogDetail } from '@/api/audit-logs'
import {
  formatAuditActionLabel,
  formatAuditJson,
  formatAuditRole,
  formatAuditTimestamp,
} from '@/lib/audit-log-display'
import { useUiPreferences } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'

export function AuditLogDetailDialog({
  open,
  onClose,
  row,
  loading,
  companyName,
  title,
}: {
  open: boolean
  onClose: () => void
  row: AuditLogDetail | null
  loading?: boolean
  companyName?: string | null
  title: string
}) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('Loading…', 'جاري التحميل…')}</p>
        ) : !row ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="space-y-5 text-sm">
            <Section title={t('Actor', 'المستخدم')}>
              <Meta label="Email" value={row.actorEmail} />
              <Meta label="Name" value={row.actorName} />
              <Meta label="Role" value={formatAuditRole(row.actorRole, isArabic)} />
              <Meta label="Actor ID" value={row.actorId ?? '—'} />
            </Section>
            <Section title={t('Event', 'الحدث')}>
              <Meta label="Action" value={formatAuditActionLabel(row.action)} />
              <Meta label={t('Resource', 'المورد')} value={`${row.resourceType} · ${row.resourceId}`} />
              <Meta label={t('Company', 'الشركة')} value={companyName ?? row.companyId ?? t('System', 'النظام')} />
              <Meta label={t('Timestamp', 'الوقت')} value={formatAuditTimestamp(row.createdAt)} />
            </Section>
            <Section title={t('Metadata', 'البيانات')}>
              <Meta label="IP" value={row.ipAddress ?? '—'} />
              <Meta label="User agent" value={row.userAgent ?? '—'} />
            </Section>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{t('Before state', 'قبل')}</h4>
              <pre className="max-h-56 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs">
                {formatAuditJson(row.previousState)}
              </pre>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{t('After state', 'بعد')}</h4>
              <pre className="max-h-56 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs">
                {formatAuditJson(row.newState)}
              </pre>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('Close', 'إغلاق')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
      <dl className="divide-y rounded-lg border">{children}</dl>
    </section>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 px-3 py-2">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-mono text-xs">{value}</dd>
    </div>
  )
}
