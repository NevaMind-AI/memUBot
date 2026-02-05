/**
 * Sidebar Component
 * Exports the appropriate implementation based on APP_MODE
 */
import type { ComponentType } from 'react'
import { MemuSidebar } from './memu.impl'
import { YumiSidebar } from './yumi.impl'
import type { MemuNavItem, YumiNavItem, MemuSidebarProps, YumiSidebarProps } from './types'

// Get app mode from Vite env
const appMode = import.meta.env.VITE_APP_MODE || 'memu'

// Export the appropriate Sidebar based on mode
// Type assertion needed because each mode has different nav item types
export const Sidebar = (appMode === 'yumi' ? YumiSidebar : MemuSidebar) as ComponentType<{
  activeNav: string
  onNavChange: (nav: string) => void
}>

// Re-export types for each mode
export type { MemuNavItem, YumiNavItem, MemuSidebarProps, YumiSidebarProps }
