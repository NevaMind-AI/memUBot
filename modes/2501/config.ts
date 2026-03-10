import type { ModeConfig } from '../types'

const config: ModeConfig = {
  appId: 'com.cuadralabs.project-2501-bot',
  productName: 'Project 2501',
  executableName: 'project-2501-bot',
  name: 'project-2501-bot',  // Used for userData directory
  description: 'Project 2501 - AI Assistant for messaging platforms',
  
  // Icons (relative to this mode's directory)
  // macOS: icon.png will be converted to .icns by electron-builder
  // Windows: icon-win.png will be converted to .ico by electron-builder
  icon: 'icon.png',
  iconWin: 'icon-win.png',

  // Release notes: update before each release
  releaseNotes: [
    '- Add intermediate step feedback during Agent processing',
    '- Reply with busy status when receiving messages while processing',
    '- Bug fixes and performance improvements',
  ].join('\n')
}

export default config
