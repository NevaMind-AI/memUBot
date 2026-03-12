/**
 * Sidebar Component
 */
import type { ComponentType } from 'react'
import { QmemorySidebar } from './qmemory.impl'
import type { MemuNavItem, QmemorySidebarProps } from './types'

// Export the Sidebar component
export const Sidebar = QmemorySidebar as ComponentType<{
  activeNav: string
  onNavChange: (nav: string) => void
}>

// Re-export types
export type { MemuNavItem, QmemorySidebarProps }
