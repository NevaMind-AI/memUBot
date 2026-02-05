/**
 * Mode-aware asset exports
 * Uses Vite's standard env mechanism (VITE_APP_MODE from .env.{mode} files)
 */

import appIconMemu from './app-icon-memu.png'
import appIconYumi from './app-icon-yumi.png'

// Get app mode from Vite env (loaded from .env.memu or .env.yumi)
const appMode = import.meta.env.VITE_APP_MODE || 'memu'

// App icon based on mode
export const appIcon = appMode === 'yumi' ? appIconYumi : appIconMemu

// Re-export other assets
export { default as logoSvg } from './logo.svg'
