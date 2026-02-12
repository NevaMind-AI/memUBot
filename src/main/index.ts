// IMPORTANT: This must be the first import to set up app name and userData path
// before any other modules that might use app.getPath('userData')
import './init-app'

import { app, shell, BrowserWindow, protocol, net, ipcMain } from 'electron'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIpcHandlers } from './ipc/handlers'
import { mcpService } from './services/mcp.service'
import { autoConnectService } from './services/autoconnect'
import { loggerService } from './services/logger.service'
import { proactiveService } from './services/proactive.service'
import { localApiService, serviceManager } from './services/back-service'
import { analyticsService, trackAppStart } from './services/analytics.service'
import { getAuthService } from './services/auth'
import { pathToFileURL } from 'url'
import { initializeShellEnv } from './utils/shell-env'
import { requestAllPermissions } from './utils/permissions'
import { powerService } from './services/power.service'

// Initialize shell environment early (before any external processes are spawned)
// This ensures npx, node, etc. are available in packaged apps
initializeShellEnv()

// Parse command line arguments
// Usage: npm run dev -- --with-proactive
const withProactive = process.argv.includes('--with-proactive')

let mainWindow: BrowserWindow | null = null

// Startup status tracking
interface StartupStatus {
  stage: 'initializing' | 'mcp' | 'platforms' | 'ready' | 'permissions'
  message: string
  progress: number // 0-100
}

function sendStartupStatus(status: StartupStatus): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('startup-status', status)
  }
}

// Register custom protocol for serving local files safely
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 680,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Track app start after renderer is ready
  mainWindow.webContents.on('did-finish-load', () => {
    // Small delay to ensure Faro SDK is initialized in renderer
    setTimeout(() => {
      trackAppStart()
    }, 1000)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const { url } = details
    // Handle local-file:// protocol - open file with default app
    if (url.startsWith('local-file://')) {
      const filePath = decodeURIComponent(url.replace('local-file://', ''))
      shell.openPath(filePath).catch((err) => {
        console.error('[App] Failed to open file:', err)
      })
    } else {
      // For http/https URLs, open in browser
      shell.openExternal(url).catch((err) => {
        console.error('[App] Failed to open external URL:', err)
      })
    }
    return { action: 'deny' }
  })

  // Intercept navigation to external URLs (clicked links in markdown, etc.)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow navigation to dev server or local files
    const allowedOrigins = [
      'http://localhost',
      'file://'
    ]
    
    const isAllowed = allowedOrigins.some(origin => url.startsWith(origin))
    
    if (!isAllowed) {
      // External URL - open in default browser instead
      event.preventDefault()
      shell.openExternal(url).catch((err) => {
        console.error('[App] Failed to open external URL:', err)
      })
    }
  })

  // HMR for renderer base on electron-vite cli
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// Initialize app
app.whenReady().then(async () => {
  // Initialize logger service (captures console output in production)
  loggerService.initialize()

  // Initialize Analytics service (Grafana Faro) - IPC handlers only
  await analyticsService.initialize()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Register local-file protocol handler for serving local files
  protocol.handle('local-file', (request) => {
    // Extract file path from URL (local-file:///path/to/file)
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''))
    return net.fetch(pathToFileURL(filePath).href)
  })

  // Setup keyboard shortcuts
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Setup IPC handlers before creating window
  setupIpcHandlers()

  // Setup startup status IPC handler
  ipcMain.handle('get-startup-status', () => {
    return { ready: startupComplete }
  })

  // Create main window FIRST for faster perceived startup
  mainWindow = createWindow()

  // Initialize services asynchronously after window is shown
  initializeServicesAsync()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

// Track if startup is complete
let startupComplete = false

// Initialize services asynchronously
async function initializeServicesAsync(): Promise<void> {
  // Small delay to ensure window is rendered
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Stage 1: Initializing
  sendStartupStatus({
    stage: 'initializing',
    message: 'Starting up...',
    progress: 10
  })

  // Start power save blocker based on settings
  try {
    const { loadSettings } = await import('./config/settings.config')
    const settings = await loadSettings()
    if (settings.preventSleep !== false) {
      powerService.start('prevent-app-suspension')
    }
  } catch (error) {
    // Default to preventing sleep if settings fail to load
    powerService.start('prevent-app-suspension')
    console.error('[App] Failed to load power settings, defaulting to prevent sleep:', error)
  }

  // Ensure agent output directory exists
  const agentOutputDir = join(app.getPath('userData'), 'agent-output')
  try {
    await mkdir(agentOutputDir, { recursive: true })
    console.log('[App] Agent output directory ready:', agentOutputDir)
  } catch (error) {
    console.error('[App] Failed to create agent output directory:', error)
  }

  // Request macOS permissions (Contacts, Calendar, Automation)
  // This triggers permission dialogs on first run
  sendStartupStatus({
    stage: 'permissions',
    message: 'Requesting permissions...',
    progress: 20
  })
  
  try {
    await requestAllPermissions()
  } catch (error) {
    console.error('[App] Permission request error:', error)
  }

  // Initialize Auth service (Yumi only, no-op for Memu)
  sendStartupStatus({
    stage: 'initializing',
    message: 'Initializing auth service...',
    progress: 25
  })

  try {
    const authService = getAuthService()
    await authService.initialize()
    console.log('[App] Auth service initialized')
  } catch (error) {
    console.error('[App] Failed to initialize auth service:', error)
  }

  // Stage 2: MCP Service
  sendStartupStatus({
    stage: 'mcp',
    message: 'Loading MCP servers...',
    progress: 30
  })

  try {
    await mcpService.initialize()
    console.log('[App] MCP service initialized')
  } catch (error) {
    console.error('[App] Failed to initialize MCP service:', error)
  }

  // Stage 3: Auto-connect platforms
  sendStartupStatus({
    stage: 'platforms',
    message: 'Connecting to messaging platforms...',
    progress: 60
  })

  try {
    await autoConnectService.connectConfiguredPlatforms()
    console.log('[App] Auto-connect completed')
  } catch (error) {
    console.error('[App] Auto-connect failed:', error)
  }

  // Stage 4: Start proactive service (only when --with-proactive flag is passed)
  sendStartupStatus({
    stage: 'ready',
    message: 'Starting proactive service...',
    progress: 80
  })

  if (withProactive) {
    try {
      const started = await proactiveService.start(5000) // 5 second interval
      if (started) {
        console.log('[App] Proactive service started')
      } else {
        console.log('[App] Proactive service not started (memuApiKey not configured)')
      }
    } catch (error) {
      console.error('[App] Failed to start proactive service:', error)
    }
  } else {
    console.log('[App] Proactive service skipped (use --with-proactive to enable)')
  }

  // Stage 5: Start local API server
  sendStartupStatus({
    stage: 'ready',
    message: 'Starting local API server...',
    progress: 85
  })

  // Restore persisted recent reply platform (#8) before starting API & services
  try {
    const { agentService } = await import('./services/agent.service')
    await agentService.loadPersistedRecentPlatform()
  } catch (error) {
    console.error('[App] Failed to restore recent platform:', error)
  }

  try {
    const apiStarted = await localApiService.start()
    if (apiStarted) {
      console.log(`[App] Local API server started at ${localApiService.getBaseUrl()}`)
    } else {
      console.error('[App] Failed to start local API server')
    }
  } catch (error) {
    console.error('[App] Local API server error:', error)
  }

  // Stage 6: Start user services
  sendStartupStatus({
    stage: 'ready',
    message: 'Starting user services...',
    progress: 95
  })

  try {
    await serviceManager.startAllServices()
    console.log(`[App] User services started (${serviceManager.getRunningCount()} running)`)
  } catch (error) {
    console.error('[App] Failed to start user services:', error)
  }

  // Stage 7: Ready
  sendStartupStatus({
    stage: 'ready',
    message: 'Ready',
    progress: 100
  })

  startupComplete = true
  console.log('[App] Startup complete')
}

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup on quit
app.on('will-quit', async () => {
  // Stop power save blocker
  powerService.stop()

  // Stop proactive service
  proactiveService.stop()
  
  // Stop all user services
  await serviceManager.stopAllServices()
  
  // Stop local API server
  await localApiService.stop()
  
  // Shutdown MCP servers
  await mcpService.shutdown()
  
  // Shutdown Auth service
  getAuthService().destroy()
  
  // Shutdown Analytics service (flush remaining events)
  await analyticsService.shutdown()
})
