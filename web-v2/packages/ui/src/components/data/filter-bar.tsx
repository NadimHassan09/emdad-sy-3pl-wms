import type { ReactNode } from 'react'
import { RotateCcw, Search, X } from 'lucide-react'
import { Button } from '@ui/components/ui/button'
import { Input } from '@ui/components/ui/input'
import { cn } from '@ui/lib/utils'

/** Wrapper for list filters: search + selects + actions. Wraps on small screens. */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3', className)}>{children}</div>
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  clearLabel = 'Clear',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  clearLabel?: string
  className?: string
}) {
  return (
    <div className={cn('relative min-w-48 flex-1 sm:max-w-sm', className)}>
      <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="ps-9 pe-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onChange('')}
          className="absolute inset-y-0 end-2 my-auto grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  )
}

/** Reset / Clear filters — soft danger so it reads as a destructive clear action. */
export function ResetFiltersButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      className="border border-tone-danger-border bg-tone-danger-bg text-tone-danger-fg hover:bg-tone-danger-bg hover:text-tone-danger-fg"
    >
      <RotateCcw aria-hidden />
      {label}
    </Button>
  )
}
