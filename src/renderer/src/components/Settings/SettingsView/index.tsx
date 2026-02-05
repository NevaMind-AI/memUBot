import { MemuSettingsView } from './memu.impl'
import { YumiSettingsView } from './yumi.impl'

const appMode = import.meta.env.VITE_APP_MODE || 'memu'

export const SettingsView = appMode === 'yumi' ? YumiSettingsView : MemuSettingsView
