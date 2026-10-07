import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useUiPreferences } from '@emdad/core'
import { Button } from '@emdad/ui/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import type { ClientApiSecretOnce } from '@/services/clientApisService'

export function ApiSecretOnceDialog({
  secret,
  onClose,
}: {
  secret: ClientApiSecretOnce | null
  onClose: () => void
}) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const [copiedField, setCopiedField] = useState<'key' | 'secret' | null>(null)

  async function copy(value: string, field: 'key' | 'secret') {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      window.setTimeout(() => setCopiedField(null), 1600)
    } catch {
      /* ignore */
    }
  }

  return (
    <Dialog open={!!secret} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('API secret', 'سر API')}</DialogTitle>
        </DialogHeader>
        {secret ? (
          <div className="space-y-4">
            <Alert>
              <AlertTitle>
                {t('Save this secret now. It will not be shown again.', 'احفظ هذا السر الآن. لن يظهر مرة أخرى.')}
              </AlertTitle>
              {secret.warning ? <AlertDescription>{secret.warning}</AlertDescription> : null}
            </Alert>
            <div className="space-y-2">
              <Label>{t('API key', 'مفتاح API')}</Label>
              <div className="flex gap-2">
                <Input value={secret.apiKey} readOnly dir="ltr" className="font-mono text-sm" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  aria-label={t('Copy', 'نسخ')}
                  onClick={() => void copy(secret.apiKey, 'key')}
                >
                  {copiedField === 'key' ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('API secret', 'سر API')}</Label>
              <div className="flex gap-2">
                <Input value={secret.apiSecret} readOnly dir="ltr" className="font-mono text-sm" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  aria-label={t('Copy', 'نسخ')}
                  onClick={() => void copy(secret.apiSecret, 'secret')}
                >
                  {copiedField === 'secret' ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t('Close', 'إغلاق')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
