import { MemuDataSettings } from './memu.impl'
import { YumiDataSettings } from './yumi.impl'

const appMode = import.meta.env.VITE_APP_MODE || 'memu'

export const DataSettings = appMode === 'yumi' ? YumiDataSettings : MemuDataSettings
