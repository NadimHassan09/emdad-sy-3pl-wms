import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@ui/components/ui/button'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@ui/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@ui/components/ui/popover'
import { cn } from '@ui/lib/utils'

export type ComboboxOption = { value: string; label: string }

/** Searchable single-select (Popover + Command). Value '' is a valid "all" option. */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel = 'No results',
  disabled,
  className,
  id,
  /** When set, typing in the list search drives server-side filtering (cmdk client filter off). */
  onSearchChange,
}: {
  value: string
  onChange: (v: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  disabled?: boolean
  className?: string
  id?: string
  onSearchChange?: (q: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const current = options.find((o) => o.value === value)
  const serverFilter = Boolean(onSearchChange)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && serverFilter) {
          setQuery('')
          onSearchChange?.('')
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !current && 'text-muted-foreground', className)}
        >
          <span className="truncate">{current?.label ?? placeholder}</span>
          <ChevronsUpDown className="opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0" align="start">
        <Command shouldFilter={!serverFilter}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={serverFilter ? query : undefined}
            onValueChange={
              serverFilter
                ? (v) => {
                    setQuery(v)
                    onSearchChange?.(v)
                  }
                : undefined
            }
          />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            {options.map((o) => (
              <CommandItem
                key={o.value || '__empty__'}
                value={`${o.label} ${o.value}`}
                onSelect={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
              >
                <Check className={cn('size-4', o.value === value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                {o.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
