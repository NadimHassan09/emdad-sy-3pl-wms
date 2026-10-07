import { ChevronDown } from 'lucide-react'
import { useLocation, Link } from '@ui/lib/link'
import sidebarArt from '@ui/assets/sidebar-artwork.webp'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from '@ui/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@ui/components/ui/collapsible'
import { BrandLogo } from './brand-logo'
import type { NavGroup, NavItem } from './nav-types'

function isActive(pathname: string, to: string, end?: boolean) {
  if (end || to === '/') return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

const buttonCls =
  'h-10 gap-3 rounded-lg px-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ' +
  'data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground ' +
  'data-[active=true]:hover:bg-sidebar-primary data-[active=true]:hover:text-sidebar-primary-foreground'

function Item({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
  const Icon = item.icon
  const childActive = item.children?.some((c) => isActive(pathname, c.to))
  const active = !item.children && isActive(pathname, item.to, item.end)

  if (item.children?.length) {
    return (
      <Collapsible defaultOpen={childActive} className="group/collapsible">
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={item.label} data-active={childActive} className={buttonCls}>
              {Icon ? <Icon className="size-[1.125rem] shrink-0" /> : null}
              <span className="truncate">{item.label}</span>
              <ChevronDown className="ms-auto size-4 shrink-0 opacity-70 transition-transform group-data-[state=open]/collapsible:rotate-180" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub className="mx-0 ms-5 border-s border-sidebar-border px-0 ps-2">
              {item.children.map((c) => (
                <SidebarMenuSubItem key={c.key}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isActive(pathname, c.to, c.end)}
                    className="h-9 text-sm text-sidebar-foreground data-[active=true]:bg-sidebar-primary data-[active=true]:font-semibold data-[active=true]:text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <Link to={c.to} onClick={onNavigate}>
                      <span className="truncate">{c.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label} className={buttonCls}>
        <Link to={item.to} onClick={onNavigate} aria-current={active ? 'page' : undefined}>
          {Icon ? <Icon className="size-[1.125rem] shrink-0" /> : null}
          <span className="truncate">{item.label}</span>
        </Link>
      </SidebarMenuButton>
      {item.badge != null ? <SidebarMenuBadge className="text-sidebar-muted">{item.badge}</SidebarMenuBadge> : null}
    </SidebarMenuItem>
  )
}

export function AppSidebar({
  groups,
  side,
  portalLabel,
  footer,
}: {
  groups: NavGroup[]
  side: 'left' | 'right'
  portalLabel: string
  footer?: React.ReactNode
}) {
  const { pathname } = useLocation()
  const { isMobile, setOpenMobile } = useSidebar()
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false)
  }
  return (
    <Sidebar side={side} collapsible="icon" className="border-0">
      <div className="bg-sidebar-gradient relative isolate flex h-full min-h-0 flex-col overflow-hidden text-sidebar-foreground">
        <img
          src={sidebarArt}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 w-full select-none object-cover opacity-70 [mask-image:linear-gradient(to_top,black_50%,transparent)] group-data-[collapsible=icon]:hidden"
        />
        <SidebarHeader className="gap-1 px-4 pb-3 pt-5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:pb-2 group-data-[collapsible=icon]:pt-3">
          <BrandLogo tone="onDark" className="group-data-[collapsible=icon]:hidden" />
          <BrandLogo tone="onDark" compact className="hidden group-data-[collapsible=icon]:flex" />
          <p className="mt-1 text-xs font-medium text-sidebar-muted group-data-[collapsible=icon]:hidden">{portalLabel}</p>
        </SidebarHeader>
        <SidebarContent className="scrollbar-thin gap-1 px-2 pb-4">
          {groups.map((g) => (
            <SidebarGroup key={g.key} className="p-1">
              {g.label ? (
                <SidebarGroupLabel className="h-7 px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-muted">
                  {g.label}
                </SidebarGroupLabel>
              ) : null}
              <SidebarMenu>
                {g.items.map((it) => (
                  <Item key={it.key} item={it} pathname={pathname} onNavigate={onNavigate} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>
        {footer ? <SidebarFooter className="border-t border-sidebar-border p-3">{footer}</SidebarFooter> : null}
        <SidebarRail />
      </div>
    </Sidebar>
  )
}
