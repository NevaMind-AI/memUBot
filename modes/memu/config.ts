import type { ModeConfig } from '../types'

const config: ModeConfig = {
  appId: 'com.nevamind.memu-bot',
  productName: 'memU bot',
  executableName: 'memu-bot',
  name: 'memu-bot',  // Used for userData directory
  description: 'memU bot - AI Assistant for messaging platforms',
  
  // Icons (relative to this mode's directory)
  // macOS: icon.png will be converted to .icns by electron-builder
  // Windows: icon-win.png will be converted to .ico by electron-builder
  icon: 'icon.png',
  iconWin: 'icon-win.png',

  // Auto-update URL: public CloudFront endpoint hosting latest-mac.yml / latest.yml
  // Path includes mode name so yumi and memu don't share the same yaml
  updateUrl: 'https://d192tm8h0ep0ud.cloudfront.net/memu',

  // Release notes: update before each release
  releaseNotes: '- Bug fixes and performance improvements'
}

export default config
