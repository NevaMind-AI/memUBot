import { MemuModelSettings } from './memu.impl'
import { YumiModelSettings } from './yumi.impl'

const appMode = import.meta.env.VITE_APP_MODE || 'memu'

export const ModelSettings = appMode === 'yumi' ? YumiModelSettings : MemuModelSettings
