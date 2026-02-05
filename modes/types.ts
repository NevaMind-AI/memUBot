/**
 * Mode configuration type
 * Each mode defines a different app variant
 */
export interface ModeConfig {
  // App identity
  appId: string
  productName: string
  executableName: string
  name: string  // Used for userData directory (must be unique per mode)
  
  // Display
  description: string
  
  // Build resources (relative to mode directory)
  icon: string           // Main icon (PNG for all platforms)
  iconMac?: string       // macOS specific icon (.icns)
  iconWin?: string       // Windows specific icon (.ico or .png)
  
  // Optional customizations
  // Add more as needed: default settings, feature flags, etc.
}

/**
 * Default mode name
 */
export const DEFAULT_MODE = 'memu'
