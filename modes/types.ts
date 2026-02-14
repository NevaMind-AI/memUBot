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

  // Auto-update
  // Public URL where update metadata (latest-mac.yml, latest.yml) and
  // installers are hosted. Used as the electron-builder generic publish URL.
  updateUrl?: string

  // Release notes shown in the update dialog when a new version is detected.
  // Update this before each release. Written into latest-mac.yml / latest.yml
  // via electron-builder's releaseInfo config.
  releaseNotes?: string

  // Optional customizations
  // Add more as needed: default settings, feature flags, etc.
}

/**
 * Default mode name
 */
export const DEFAULT_MODE = 'memu'
