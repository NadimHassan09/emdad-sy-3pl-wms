import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
// forwardRef used by TextField + Button
import { Loader2 } from 'lucide-react'
import { cn } from '@emdad/ui'
import { Button as UiButton } from '@emdad/ui/ui/button'
import { Input } from '@emdad/ui/ui/input'
import { Label } from '@emdad/ui/ui/label'
import { Combobox as UiCombobox } from '@emdad/ui/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@emdad/ui/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@emdad/ui/ui/alert'
import { TaskStatusBadge } from '../task-ui'

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'brand'

const VARIANT: Record<BtnVariant, 'default' | 'secondary' | 'destructive' | 'ghost'> = {
  primary: 'default',
  brand: 'default',
  secondary: 'secondary',
  danger: 'destructive',
  ghost: 'ghost',
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean }
>(({ variant = 'primary', size = 'md', loading, disabled, className, children, ...rest }, ref) => (
  <UiButton
    ref={ref}
    variant={VARIANT[variant]}
    size={size === 'sm' ? 'sm' : 'default'}
    disabled={disabled || loading}
    className={className}
    {...rest}
  >
    {loading ? <Loader2 className="me-2 size-4 animate-spin" aria-hidden /> : null}
    {children}
  </UiButton>
))
Button.displayName = 'LegacyTaskButton'

export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label?: string; endAdornment?: ReactNode; hint?: ReactNode }
>(({ label, className, endAdornment, hint, ...props }, ref) => {
  const id = props.id ?? props.name
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div className="relative flex items-center gap-2">
        <Input ref={ref} id={id} className="text-sm" {...props} />
        {endAdornment}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
})
TextField.displayName = 'LegacyTaskTextField'

export function Combobox({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  emptyMessage,
  clearable: _clearable,
  dropdownInFlow: _dropdownInFlow,
  onSearchQueryChange: _onSearchQueryChange,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string; hint?: string }>
  placeholder?: string
  disabled?: boolean
  emptyMessage?: string
  clearable?: boolean
  dropdownInFlow?: boolean
  onSearchQueryChange?: (q: string) => void
}) {
  return (
    <div className="space-y-1.5">
      {label ? <Label>{label}</Label> : null}
      <UiCombobox
        value={value}
        onChange={onChange}
        options={options.map((o) => ({ value: o.value, label: o.label, description: o.hint }))}
        placeholder={placeholder}
        disabled={disabled}
        emptyLabel={emptyMessage ?? 'No options'}
      />
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  widthClass?: string
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={widthClass ?? 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return <TaskStatusBadge status={status} />
}

export function LegacyAlert({
  variant,
  title,
  children,
}: {
  variant: 'error' | 'warning' | 'info' | 'success'
  title: string
  children?: ReactNode
}) {
  return (
    <Alert variant={variant === 'error' ? 'destructive' : 'default'}>
      <AlertTitle>{title}</AlertTitle>
      {children ? <AlertDescription>{children}</AlertDescription> : null}
    </Alert>
  )
}
