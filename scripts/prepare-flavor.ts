/**
 * Prepare build resources for the current flavor
 * This script is called before electron-builder to set up icons and other resources
 */

import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

interface FlavorConfig {
  appId: string
  productName: string
  executableName: string
  description: string
  icon: string
  iconMac?: string
  iconWin?: string
}

async function loadFlavorConfig(flavor: string): Promise<FlavorConfig> {
  const configPath = path.join(projectRoot, 'flavors', flavor, 'config.ts')
  
  // Dynamic import of the config
  const module = await import(`file://${configPath}`)
  return module.default as FlavorConfig
}

async function main(): Promise<void> {
  const flavor = process.env.APP_FLAVOR || 'memu'
  
  console.log(`[Prepare] Preparing build resources for flavor: ${flavor}`)
  
  // Load flavor config
  const config = await loadFlavorConfig(flavor)
  const flavorDir = path.join(projectRoot, 'flavors', flavor)
  const buildDir = path.join(projectRoot, 'build')
  
  // Ensure build directory exists
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true })
  }
  
  // Copy icons from flavor directory to build directory
  // electron-builder will auto-convert PNG to .icns/.ico as needed
  const iconsToCopy = [
    { src: config.icon, dest: 'icon.png' },
    { src: config.iconWin || config.icon, dest: 'icon-win.png' }
  ]
  
  for (const { src, dest } of iconsToCopy) {
    const srcPath = path.join(flavorDir, src)
    const destPath = path.join(buildDir, dest)
    
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath)
      console.log(`[Prepare] Copied ${src} -> build/${dest}`)
    } else {
      console.warn(`[Prepare] Warning: ${srcPath} not found`)
    }
  }
  
  // Generate electron-builder config override using 'extends'
  // This will inherit all settings from the base config and override specific values
  const builderConfig = {
    extends: './electron-builder.yml',
    appId: config.appId,
    productName: config.productName,
    win: {
      executableName: config.executableName
    }
  }
  
  const configOverridePath = path.join(projectRoot, 'electron-builder.flavor.json')
  fs.writeFileSync(configOverridePath, JSON.stringify(builderConfig, null, 2))
  console.log(`[Prepare] Generated electron-builder.flavor.json`)
  
  console.log(`[Prepare] Done.`)
}

main().catch((err) => {
  console.error('[Prepare] Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
