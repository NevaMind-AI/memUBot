/**
 * App Component
 * Exports the appropriate implementation based on APP_MODE
 */
import { MemuApp } from './memu.impl'
import { YumiApp } from './yumi.impl'

// Get app mode from Vite env
const appMode = import.meta.env.VITE_APP_MODE || 'memu'

// Export the appropriate App based on mode
const App = appMode === 'yumi' ? YumiApp : MemuApp

export default App
