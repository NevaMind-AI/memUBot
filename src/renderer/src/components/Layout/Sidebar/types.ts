/**
 * Sidebar component types
 */

// Memu navigation items (all platforms)
export type MemuNavItem = 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line' | 'feishu' | 'settings'

// Yumi navigation items (only yumi and settings)
export type YumiNavItem = 'yumi' | 'settings'

// Union type for all possible nav items (used for generic compatibility)
export type NavItem = MemuNavItem | YumiNavItem

// Generic sidebar props - each implementation uses its own NavItem type
export interface MemuSidebarProps {
  activeNav: MemuNavItem
  onNavChange: (nav: MemuNavItem) => void
}

export interface YumiSidebarProps {
  activeNav: YumiNavItem
  onNavChange: (nav: YumiNavItem) => void
}

// Generic props for the exported Sidebar (accepts any valid nav)
export interface SidebarProps {
  activeNav: string
  onNavChange: (nav: string) => void
}
