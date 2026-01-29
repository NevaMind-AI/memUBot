import { app, shell, BrowserWindow, protocol, net, ipcMain } from 'electron'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIpcHandlers } from './ipc/handlers'
import { mcpService } from './services/mcp.service'
import { autoConnectService } from './services/autoconnect.service'
import { loggerService } from './services/logger.service'
import { pathToFileURL } from 'url'

let mainWindow: BrowserWindow | null = null

// Startup status tracking
interface StartupStatus {
  stage: 'initializing' | 'mcp' | 'platforms' | 'ready'
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

  // Ensure agent output directory exists
  const agentOutputDir = join(app.getPath('userData'), 'agent-output')
  try {
    await mkdir(agentOutputDir, { recursive: true })
    console.log('[App] Agent output directory ready:', agentOutputDir)
  } catch (error) {
    console.error('[App] Failed to create agent output directory:', error)
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

  // Stage 4: Ready
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
  // Shutdown MCP servers
  await mcpService.shutdown()
})
