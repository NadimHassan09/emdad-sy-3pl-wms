import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, Loader2, ShieldQuestion } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@ui/components/ui/alert-dialog'
import { Button } from '@ui/components/ui/button'
import { Input } from '@ui/components/ui/input'
import { Label } from '@ui/components/ui/label'
import { cn } from '@ui/lib/utils'

export type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** 'danger' = red confirm button (cancel / delete / irreversible). 'default' = brand-green confirm. */
  intent?: 'danger' | 'default'
  confirmLabel: string
  cancelLabel: string
  /** If set, the user must type this exact text to enable the confirm button. */
  typedConfirm?: string
  typedConfirmLabel?: string
  loading?: boolean
  onConfirm: () => void | Promise<void>
  /** Extra body (e.g. a reason textarea). */
  children?: ReactNode
}

/**
 * The single confirmation modal used for Cancel / Delete / Confirm actions.
 * Rule: red is reserved for destructive intent — Cancel (dismiss) is an outline button,
 * never red, and the confirm button of a non-destructive action is the brand primary.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  intent = 'default',
  confirmLabel,
  cancelLabel,
  typedConfirm,
  typedConfirmLabel,
  loading,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  useEffect(() => {
    if (!open) setTyped('')
  }, [open])

  const danger = intent === 'danger'
  const blocked = !!typedConfirm && typed.trim() !== typedConfirm

  return (
    <AlertDialog open={open} onOpenChange={(o) => (!loading ? onOpenChange(o) : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div
            className={cn(
              'mb-1 grid size-11 place-items-center rounded-full',
              danger ? 'bg-tone-danger-bg text-tone-danger-fg' : 'bg-brand-100 text-brand-800',
            )}
          >
            {danger ? <AlertTriangle className="size-5" aria-hidden /> : <ShieldQuestion className="size-5" aria-hidden />}
          </div>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {children}
        {typedConfirm ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-typed">{typedConfirmLabel ?? typedConfirm}</Label>
            <Input id="confirm-typed" dir="ltr" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
        ) : null}
        <AlertDialogFooter>
          <Button variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            disabled={loading || blocked}
            onClick={async () => {
              await onConfirm()
            }}
          >
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
