import type { ModeConfig } from '../types'

const config: ModeConfig = {
  appId: 'com.nevamind.yumi',
  productName: 'Yumi',
  executableName: 'yumi',
  name: 'yumi',  // Used for userData directory
  description: 'Yumi - Your Cozy AI Assistant',
  
  // Icons (relative to this mode's directory)
  // macOS: icon.png will be converted to .icns by electron-builder
  // Windows: icon-win.png will be converted to .ico by electron-builder
  icon: 'icon.png',
  iconWin: 'icon-win.png'
}

export default config
