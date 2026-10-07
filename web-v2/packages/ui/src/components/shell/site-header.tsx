import { useEffect, useState, type ReactNode } from 'react'
import { Globe, LogOut, Moon, Search, Sun } from 'lucide-react'
import { useNavigate } from '@ui/lib/link'
import { Avatar, AvatarFallback, AvatarImage } from '@ui/components/ui/avatar'
import { Button } from '@ui/components/ui/button'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@ui/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/ui/dropdown-menu'
import { Kbd } from '@ui/components/ui/kbd'
import { SidebarTrigger } from '@ui/components/ui/sidebar'
import { Separator } from '@ui/components/ui/separator'
import type { NavGroup, ShellLabels, ShellUser } from './nav-types'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

export type SiteHeaderProps = {
  groups: NavGroup[]
  labels: ShellLabels
  user: ShellUser
  languageLabel: string
  isDark: boolean
  onToggleLanguage: () => void
  onToggleTheme: () => void
  onLogout: () => void
  /** e.g. notifications bell — app-specific */
  actions?: ReactNode
  /** extra user-menu items (profile, settings…) */
  menuItems?: ReactNode
}

export function SiteHeader({
  groups, labels, user, languageLabel, isDark, onToggleLanguage, onToggleTheme, onLogout, actions, menuItems,
}: SiteHeaderProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const flat = groups.flatMap((g) => g.items.flatMap((i) => (i.children?.length ? i.children.map((c) => ({ key: c.key, label: `${i.label} › ${c.label}`, to: c.to })) : [{ key: i.key, label: i.label, to: i.to }])))

  return (
    <header
      data-slot="site-header"
      className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 bg-background/85 ps-3 pe-4 backdrop-blur sm:ps-5 sm:pe-6"
    >
      <SidebarTrigger aria-label={labels.toggleSidebar} className="size-10" />
      <Separator orientation="vertical" className="mx-1 h-6" />

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-brand-500/50 sm:max-w-sm sm:flex-none sm:basis-80"
        aria-label={labels.search}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{labels.searchPlaceholder}</span>
        <Kbd className="ms-auto hidden sm:inline-flex">Ctrl K</Kbd>
      </button>

      <div className="ms-auto flex shrink-0 items-center gap-1 pe-0.5">
        {actions}
        <Button variant="ghost" size="icon" onClick={onToggleLanguage} aria-label={labels.toggleLanguage} title={labels.toggleLanguage} className="w-auto gap-1.5 px-2.5">
          <Globe aria-hidden />
          <span className="text-sm font-medium">{languageLabel}</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label={labels.toggleTheme} title={labels.toggleTheme}>
          {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="ms-1 flex items-center gap-2 rounded-full p-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" aria-label={user.name}>
              <Avatar className="size-9">
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials(user.name)}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="space-y-0.5 font-normal">
              <p className="truncate text-sm font-medium">{user.name}</p>
              {user.email ? <p className="truncate text-xs text-muted-foreground" dir="ltr">{user.email}</p> : null}
              {user.roleLabel ? <p className="text-xs text-muted-foreground">{user.roleLabel}</p> : null}
            </DropdownMenuLabel>
            {menuItems ? (<><DropdownMenuSeparator />{menuItems}</>) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onLogout} className="text-destructive focus:text-destructive">
              <LogOut aria-hidden />
              {labels.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen} title={labels.search} description={labels.searchPlaceholder}>
        <CommandInput placeholder={labels.searchPlaceholder} />
        <CommandList>
          <CommandEmpty>{labels.noResults}</CommandEmpty>
          <CommandGroup heading={labels.navigation}>
            {flat.map((it) => (
              <CommandItem
                key={it.key}
                value={it.label}
                onSelect={() => {
                  setOpen(false)
                  navigate(it.to)
                }}
              >
                {it.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  )
}
