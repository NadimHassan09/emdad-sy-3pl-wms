import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@emdad/ui/ui/alert-dialog'
import { Button } from '@emdad/ui/ui/button'
import { useUpdateDetector } from '@/hooks/useUpdateDetector'

/** Shown when a newer build is deployed (version.json changed) or a lazy chunk failed to load. */
export function AppUpdateDialog() {
  const { hasUpdate, latestVersion, refreshApp } = useUpdateDetector()
  const { isArabic } = useUiPreferences()
  const [busy, setBusy] = useState(false)
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  return (
    <AlertDialog open={hasUpdate}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mb-1 grid size-11 place-items-center rounded-full bg-brand-100 text-brand-800">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <AlertDialogTitle>{t('New version available', 'يتوفر إصدار جديد')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("There's a new version available. The system needs to refresh to apply the latest update.", 'يتوفر إصدار جديد. يحتاج النظام إلى التحديث لتطبيق آخر نسخة.')}
            {latestVersion ? <span className="mt-2 block font-mono text-xs" dir="ltr">v{latestVersion}</span> : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            onClick={() => {
              setBusy(true)
              refreshApp()
            }}
            disabled={busy}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t('Refresh now', 'تحديث الآن')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
