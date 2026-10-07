import type { ComponentType } from 'react'

export type NavItem = {
  key: string
  label: string
  to: string
  icon?: ComponentType<{ className?: string }>
  badge?: string | number
  /** Optional second level. When present, `to` is only used for active matching. */
  children?: Omit<NavItem, 'children' | 'icon'>[]
  /** exact path match (e.g. dashboard "/") */
  end?: boolean
}

export type NavGroup = {
  key: string
  label?: string
  items: NavItem[]
}

export type ShellUser = {
  name: string
  email?: string
  roleLabel?: string
  avatarUrl?: string
}

export type ShellLabels = {
  portal: string
  search: string
  searchPlaceholder: string
  noResults: string
  navigation: string
  toggleLanguage: string
  toggleTheme: string
  toggleSidebar: string
  logout: string
  skipToContent: string
  notifications?: string
}
