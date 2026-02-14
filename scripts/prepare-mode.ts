/**
 * Prepare build resources for the current mode
 * This script is called before electron-builder to set up icons and other resources
 */

import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

interface ModeConfig {
  appId: string
  productName: string
  executableName: string
  name: string  // Used for userData directory
  description: string
  icon: string
  iconMac?: string
  iconWin?: string
  updateUrl?: string
  releaseNotes?: string
}

async function loadModeConfig(mode: string): Promise<ModeConfig> {
  const configPath = path.join(projectRoot, 'modes', mode, 'config.ts')
  
  // Dynamic import of the config
  const module = await import(`file://${configPath}`)
  return module.default as ModeConfig
}

async function main(): Promise<void> {
  const mode = process.env.APP_MODE || 'memu'
  
  console.log(`[Prepare] Preparing build resources for mode: ${mode}`)
  
  // Load mode config
  const config = await loadModeConfig(mode)
  const modeDir = path.join(projectRoot, 'modes', mode)
  const buildDir = path.join(projectRoot, 'build')
  
  // Ensure build directory exists
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true })
  }
  
  // Copy icons from mode directory to build directory
  // electron-builder will auto-convert PNG to .icns/.ico as needed
  const iconsToCopy = [
    { src: config.icon, dest: 'icon.png' },
    { src: config.iconWin || config.icon, dest: 'icon-win.png' }
  ]
  
  for (const { src, dest } of iconsToCopy) {
    const srcPath = path.join(modeDir, src)
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
  // extraMetadata.name overrides package.json's name, which affects app.name and userData path
  const builderConfig: Record<string, unknown> = {
    extends: './electron-builder.yml',
    appId: config.appId,
    productName: config.productName,
    extraMetadata: {
      name: config.name  // This makes app.name correct in packaged app
    },
    win: {
      executableName: config.executableName
    }
  }

  // Override auto-update publish URL if the mode defines one
  if (config.updateUrl) {
    builderConfig.publish = {
      provider: 'generic',
      url: config.updateUrl
    }
  }

  // Include release notes in the generated latest-mac.yml / latest.yml
  if (config.releaseNotes) {
    builderConfig.releaseInfo = {
      releaseNotes: config.releaseNotes
    }
  }
  
  const configOverridePath = path.join(projectRoot, 'electron-builder.mode.json')
  fs.writeFileSync(configOverridePath, JSON.stringify(builderConfig, null, 2))
  console.log(`[Prepare] Generated electron-builder.mode.json`)
  
  console.log(`[Prepare] Done.`)
}

main().catch((err) => {
  console.error('[Prepare] Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
