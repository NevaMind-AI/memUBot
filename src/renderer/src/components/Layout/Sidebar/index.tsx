/**
 * Sidebar Component
 */
import type { ComponentType } from 'react'
import { MemuSidebar } from './memu.impl'
import type { MemuNavItem, MemuSidebarProps } from './types'

// Export the Sidebar component
export const Sidebar = MemuSidebar as ComponentType<{
  activeNav: string
  onNavChange: (nav: string) => void
}>

// Re-export types
export type { MemuNavItem, MemuSidebarProps }
