import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { cn } from '@emdad/ui'
import { toast } from 'sonner'
import {
  createClientApi,
  type ClientApiScope,
  type ClientApiSecretOnce,
} from '@/services/clientApisService'
import { API_SCOPES, CLIENT_APIS_QUERY_KEY, SCOPE_META } from './apis-ui'

export function ApiCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (secret: ClientApiSecretOnce) => void
}) {
  const { isArabic } = useUiPreferences()
  const t = (en: string, ar: string) => (isArabic ? ar : en)
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [scope, setScope] = useState<ClientApiScope>('oms')

  const createMut = useMutation({
    mutationFn: () => createClientApi({ name: name.trim(), scope }),
    onSuccess: (row) => {
      setName('')
      setScope('oms')
      onOpenChange(false)
      onCreated(row)
      void queryClient.invalidateQueries({ queryKey: CLIENT_APIS_QUERY_KEY })
      toast.success(t('API created.', 'تم إنشاء الواجهة.'))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function close() {
    if (createMut.isPending) return
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Create API', 'إنشاء واجهة')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-name">{t('API name', 'اسم الواجهة')}</Label>
            <Input
              id="api-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Shopify OMS"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('API type', 'نوع الواجهة')}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {API_SCOPES.map((value) => {
                const meta = SCOPE_META[value]
                const selected = scope === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setScope(value)}
                    className={cn(
                      'rounded-xl border p-3 text-start transition-colors',
                      selected
                        ? 'border-primary bg-brand-50 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent',
                    )}
                  >
                    <div className="text-sm font-medium text-foreground">
                      {isArabic ? meta.ar : meta.en}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {isArabic ? meta.hintAr : meta.hint}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" disabled={createMut.isPending} onClick={close}>
            {t('Cancel', 'إلغاء')}
          </Button>
          <Button
            type="button"
            disabled={!name.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {t('Create', 'إنشاء')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
