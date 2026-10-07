import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUiPreferences } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Textarea } from '@emdad/ui/ui/textarea'
import { toast } from 'sonner'
import { CompaniesApi, type CompanyListRow } from '@/api/companies'
import { QK } from '@/constants/query-keys'
import { CompanyStatusBadge } from './clients-ui'

type LifecycleAction = 'suspend' | 'archive' | 'restore' | 'delete'

export function CustomerLifecycleDialog({
  company,
  isSuperAdmin,
  onClose,
}: {
  company: CompanyListRow | null
  isSuperAdmin: boolean
  onClose: () => void
}) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const id = company?.id ?? null
  const open = !!company

  useEffect(() => {
    if (open) setReason('')
  }, [open, id])

  const lifecycleKey = [...QK.companies, id, 'lifecycle'] as const
  const { data: ctx, isLoading } = useQuery({
    queryKey: lifecycleKey,
    queryFn: () => CompaniesApi.getLifecycle(id as string),
    enabled: open && !!id,
  })

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: QK.companies })
    void qc.invalidateQueries({ queryKey: lifecycleKey })
  }

  const runMut = useMutation({
    mutationFn: async (action: LifecycleAction) => {
      if (!id) throw new Error('No company')
      const trimmed = reason.trim() || undefined
      switch (action) {
        case 'suspend':
          return CompaniesApi.suspend(id, trimmed)
        case 'archive':
          return CompaniesApi.archive(id, trimmed)
        case 'restore':
          return CompaniesApi.restore(id, trimmed)
        case 'delete':
          if (ctx?.actions.canHardDelete) return CompaniesApi.remove(id)
          return CompaniesApi.purge(id)
      }
    },
    onSuccess: (_res, action) => {
      const msg =
        action === 'suspend'
          ? t('Customer suspended.', 'تم إيقاف العميل.')
          : action === 'archive'
            ? t('Customer archived.', 'تمت أرشفة العميل.')
            : action === 'restore'
              ? t('Customer restored.', 'تمت استعادة العميل.')
              : t('Customer permanently deleted.', 'تم حذف العميل نهائيا.')
      toast.success(msg)
      refresh()
      onClose()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const busy = runMut.isPending
  const a = ctx?.actions
  const deleteEnabled = !!a && (a.canHardDelete || (a.canPurge && isSuperAdmin))

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {company ? `${t('Lifecycle', 'دورة الحياة')} — ${company.name}` : ''}
          </DialogTitle>
        </DialogHeader>
        {isLoading || !ctx ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('Loading…', 'جارٍ التحميل…')}</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm font-medium">{t('Current status', 'الحالة الحالية')}</span>
              <CompanyStatusBadge status={ctx.status} isArabic={isArabic} />
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold">{t('Account data', 'بيانات الحساب')}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <Stat label={t('Products', 'المنتجات')} value={ctx.counts.products} />
                <Stat
                  label={t('Inbound', 'الوارد')}
                  value={`${ctx.counts.inboundOrders} (${ctx.counts.openInbound} ${t('open', 'مفتوح')})`}
                />
                <Stat
                  label={t('Outbound', 'الصادر')}
                  value={`${ctx.counts.outboundOrders} (${ctx.counts.openOutbound} ${t('open', 'مفتوح')})`}
                />
                <Stat label={t('On-hand stock', 'المخزون')} value={ctx.counts.stockOnHand} />
                <Stat label={t('Invoices', 'الفواتير')} value={ctx.counts.invoices} />
                <Stat label={t('Active users', 'المستخدمون')} value={ctx.counts.activeUsers} />
              </div>
            </div>
            {ctx.status === 'archived' ? (
              <p className="rounded-md bg-tone-warning-bg px-3 py-2 text-xs text-tone-warning-fg">
                {t('Archived', 'مؤرشف')} {ctx.retentionElapsedDays ?? 0}/{ctx.retentionDays}{' '}
                {t('retention days elapsed', 'يوم من فترة الاحتفاظ')}
              </p>
            ) : null}
            <div>
              <label className="mb-1 block text-sm font-medium">{t('Reason (optional)', 'السبب (اختياري)')}</label>
              <Textarea rows={2} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {a?.canSuspend ? (
                <Button type="button" variant="destructive" disabled={busy} onClick={() => runMut.mutate('suspend')}>
                  {t('Suspend', 'إيقاف')}
                </Button>
              ) : null}
              {a?.canRestore ? (
                <Button type="button" disabled={busy} onClick={() => runMut.mutate('restore')}>
                  {t('Restore', 'استعادة')}
                </Button>
              ) : null}
              {ctx.status !== 'archived' ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy || !a?.canArchive}
                  title={a?.canArchive ? '' : ctx.blockers.archive.join(' ')}
                  onClick={() => runMut.mutate('archive')}
                >
                  {t('Archive', 'أرشفة')}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="destructive"
                disabled={busy || !deleteEnabled}
                onClick={() => {
                  if (
                    window.confirm(
                      t(
                        `Permanently delete "${ctx.name}"? This cannot be undone.`,
                        `حذف "${ctx.name}" نهائيا؟ لا يمكن التراجع.`,
                      ),
                    )
                  ) {
                    runMut.mutate('delete')
                  }
                }}
              >
                {t('Permanently delete', 'حذف نهائي')}
              </Button>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t('Close', 'إغلاق')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-semibold">{value}</p>
    </div>
  )
}
