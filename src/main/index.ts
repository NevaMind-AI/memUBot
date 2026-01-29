import { app, shell, BrowserWindow, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupIpcHandlers } from './ipc/handlers'
import { startTailscaleStatusPolling } from './ipc/tailscale.handlers'
import { mcpService } from './services/mcp.service'
import { autoConnectService } from './services/autoconnect.service'
import { pathToFileURL } from 'url'

let stopTailscalePolling: (() => void) | null = null

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

  // Initialize MCP service
  try {
    await mcpService.initialize()
    console.log('[App] MCP service initialized')
  } catch (error) {
    console.error('[App] Failed to initialize MCP service:', error)
  }

  // Auto-connect configured messaging platforms
  try {
    await autoConnectService.connectConfiguredPlatforms()
    console.log('[App] Auto-connect completed')
  } catch (error) {
    console.error('[App] Auto-connect failed:', error)
  }

  // Create main window
  const mainWindow = createWindow()

  // Start Tailscale status polling
  stopTailscalePolling = startTailscaleStatusPolling(mainWindow)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWindow = createWindow()
      // Restart Tailscale polling for new window
      if (stopTailscalePolling) {
        stopTailscalePolling()
      }
      stopTailscalePolling = startTailscaleStatusPolling(newWindow)
    }
  })
})

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup on quit
app.on('will-quit', async () => {
  // Stop Tailscale polling
  if (stopTailscalePolling) {
    stopTailscalePolling()
  }
  // Shutdown MCP servers
  await mcpService.shutdown()
})
