/**
 * Sidebar component types
 */

// Memu navigation items (all platforms)
export type MemuNavItem = 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line' | 'feishu' | 'settings'

// Union type for all possible nav items
export type NavItem = MemuNavItem

// Sidebar props
export interface MemuSidebarProps {
  activeNav: MemuNavItem
  onNavChange: (nav: MemuNavItem) => void
}

// Generic props for the exported Sidebar
export interface SidebarProps {
  activeNav: string
  onNavChange: (nav: string) => void
}
