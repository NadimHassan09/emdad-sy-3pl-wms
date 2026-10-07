import { useLocation } from 'react-router'
import { Hammer } from 'lucide-react'
import { switchUiAndReload, useUiPreferences } from '@emdad/core'
import { EmptyState, PageHeader } from '@emdad/ui'
import { Button } from '@emdad/ui/ui/button'

/** Placeholder for routes that have not been rebuilt yet. The route still exists; the classic UI serves it. */
export function NotMigratedYet() {
  const { pathname } = useLocation()
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  return (
    <div className="space-y-5">
      <PageHeader title={t('Coming to the new interface', 'قريباً في الواجهة الجديدة')} />
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={Hammer}
          title={t('This page has not been migrated yet', 'لم يتم نقل هذه الصفحة بعد')}
          description={
            <>
              <span dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{pathname}</span>
              <span className="mt-2 block">{t('It works exactly as before in the classic interface.', 'تعمل كما هي تماماً في الواجهة الكلاسيكية.')}</span>
            </>
          }
          action={<Button onClick={() => switchUiAndReload('v1')}>{t('Open in classic interface', 'فتح في الواجهة الكلاسيكية')}</Button>}
        />
      </div>
    </div>
  )
}
