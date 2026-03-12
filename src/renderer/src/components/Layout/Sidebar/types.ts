/**
 * Sidebar component types
 */

// Qmemory navigation items (all platforms)
export type QmemoryNavItem = 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line' | 'feishu' | 'settings'

// Union type for all possible nav items
export type NavItem = QmemoryNavItem

// Sidebar props
export interface QmemorySidebarProps {
  activeNav: QmemoryNavItem
  onNavChange: (nav: QmemoryNavItem) => void
}

// Generic props for the exported Sidebar
export interface SidebarProps {
  activeNav: string
  onNavChange: (nav: string) => void
}
