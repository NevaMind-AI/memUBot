import type { FlavorConfig } from '../types'

const config: FlavorConfig = {
  appId: 'com.nevamind.memu-bot',
  productName: 'memU bot',
  executableName: 'memu-bot',
  description: 'memU bot - AI Assistant for messaging platforms',
  
  // Icons (relative to this flavor's directory)
  // macOS: icon.png will be converted to .icns by electron-builder
  // Windows: icon-win.png will be converted to .ico by electron-builder
  icon: 'icon.png',
  iconWin: 'icon-win.png'
}

export default config
