/**
 * Flavor configuration type
 * Each flavor defines a different app variant
 */
export interface FlavorConfig {
  // App identity
  appId: string
  productName: string
  executableName: string
  
  // Display
  description: string
  
  // Build resources (relative to flavor directory)
  icon: string           // Main icon (PNG for all platforms)
  iconMac?: string       // macOS specific icon (.icns)
  iconWin?: string       // Windows specific icon (.ico or .png)
  
  // Optional customizations
  // Add more as needed: default settings, feature flags, etc.
}

/**
 * Default flavor name
 */
export const DEFAULT_FLAVOR = 'memu'
