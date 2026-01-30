import { execSync } from 'child_process'
import { shell, dialog, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Track if we've already shown the FDA dialog this session
let fdaDialogShown = false

/**
 * Request all macOS permissions that require user authorization
 * Should be called once at app startup
 */
export async function requestAllPermissions(): Promise<void> {
  // Only run on macOS
  if (process.platform !== 'darwin') {
    return
  }

  console.log('[Permissions] Requesting macOS permissions...')

  // Check and request Full Disk Access first (most important)
  const hasFDA = await requestFullDiskAccess()

  // Request other permissions in parallel
  // If FDA not granted, also request folder permissions as fallback
  const permissionRequests = [
    requestContactsPermission(),
    requestCalendarPermission(),
    requestAutomationPermissions()
  ]
  
  if (!hasFDA) {
    permissionRequests.push(requestFolderPermissions())
  }
  
  await Promise.all(permissionRequests)

  console.log('[Permissions] Permission requests completed')
}

/**
 * Check if app has Full Disk Access permission
 * Tests by trying to actually read protected system files
 * This also triggers macOS to add the app to the FDA list
 */
function hasFullDiskAccess(): boolean {
  // Paths that require Full Disk Access
  // Actually reading these files will trigger TCC to add the app to the FDA list
  const testPaths = [
    path.join(os.homedir(), 'Library/Mail/V10'),  // Mail data
    path.join(os.homedir(), 'Library/Mail'),
    path.join(os.homedir(), 'Library/Safari/Bookmarks.plist'),
    path.join(os.homedir(), 'Library/Messages/chat.db'),
    '/Library/Application Support/com.apple.TCC/TCC.db'
  ]
  
  for (const testPath of testPaths) {
    try {
      // Actually try to read the file/directory, not just check access
      // This triggers the TCC system to record the access attempt
      const stat = fs.statSync(testPath)
      
      if (stat.isDirectory()) {
        // For directories, try to list contents
        const contents = fs.readdirSync(testPath)
        console.log(`[Permissions] FDA check: can read ${testPath} (${contents.length} items)`)
        return true
      } else {
        // For files, try to read first few bytes
        const fd = fs.openSync(testPath, 'r')
        const buffer = Buffer.alloc(10)
        fs.readSync(fd, buffer, 0, 10, 0)
        fs.closeSync(fd)
        console.log(`[Permissions] FDA check: can read ${testPath}`)
        return true
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      // EPERM or "operation not permitted" means we don't have FDA
      // ENOENT means the file doesn't exist, try next path
      if (errorMsg.includes('EPERM') || errorMsg.includes('operation not permitted')) {
        console.log(`[Permissions] FDA check: access denied to ${testPath}`)
        // Continue to check other paths - this access attempt should add app to FDA list
      }
      // Continue to next path
    }
  }
  
  return false
}

/**
 * Request Full Disk Access permission
 * This opens System Settings and prompts user to grant permission
 * @returns true if FDA is already granted, false otherwise
 */
async function requestFullDiskAccess(): Promise<boolean> {
  console.log('[Permissions] Checking Full Disk Access...')
  
  if (hasFullDiskAccess()) {
    console.log('[Permissions] Full Disk Access: authorized')
    return true
  }
  
  console.log('[Permissions] Full Disk Access: not granted')
  
  // Don't show dialog more than once per session
  if (fdaDialogShown) {
    return false
  }
  fdaDialogShown = true
  
  // Show dialog to guide user
  const appName = app.getName() || 'memU bot'
  const result = await dialog.showMessageBox({
    type: 'info',
    title: 'Full Disk Access Required',
    message: `${appName} needs Full Disk Access`,
    detail: 'To use all features (reading emails, accessing files, etc.), please grant Full Disk Access permission.\n\n' +
            'Click "Open Settings" to go to System Settings, then:\n' +
            '1. Click the + button\n' +
            '2. Find and select this app\n' +
            '3. Toggle the switch to enable access',
    buttons: ['Open Settings', 'Later'],
    defaultId: 0,
    cancelId: 1
  })
  
  if (result.response === 0) {
    // Open System Settings to Full Disk Access pane
    // macOS Ventura+ uses different URL scheme
    try {
      // Try the new macOS Ventura+ URL first
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles')
    } catch {
      // Fallback for older macOS
      execSync('open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"', {
        stdio: ['pipe', 'pipe', 'pipe']
      })
    }
    console.log('[Permissions] Opened System Settings for Full Disk Access')
  }
  
  return false
}

/**
 * Request folder access permissions (Documents, Downloads, Desktop)
 * This triggers the "App wants to access X folder" dialogs
 */
async function requestFolderPermissions(): Promise<void> {
  const homeDir = os.homedir()
  
  // Folders that require permission on macOS
  const foldersToAccess = [
    { name: 'Documents', path: path.join(homeDir, 'Documents') },
    { name: 'Downloads', path: path.join(homeDir, 'Downloads') },
    { name: 'Desktop', path: path.join(homeDir, 'Desktop') }
  ]

  console.log('[Permissions] Requesting folder access permissions...')

  for (const folder of foldersToAccess) {
    try {
      // Try to read the folder - this triggers the permission dialog if not already granted
      fs.readdirSync(folder.path)
      console.log(`[Permissions] Folder (${folder.name}): authorized`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      if (errorMsg.includes('EPERM') || errorMsg.includes('operation not permitted')) {
        console.log(`[Permissions] Folder (${folder.name}): permission denied`)
      } else {
        console.log(`[Permissions] Folder (${folder.name}): ${errorMsg}`)
      }
    }
  }
}

/**
 * Request Contacts access permission
 */
async function requestContactsPermission(): Promise<void> {
  try {
    console.log('[Permissions] Checking contacts access...')
    
    // Trigger contacts permission by running a simple AppleScript
    execSync(`osascript -e 'tell application "Contacts" to count of people'`, {
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    console.log('[Permissions] Contacts: authorized')
  } catch (error) {
    // Permission denied or app not responding - this is expected on first run
    console.log('[Permissions] Contacts: permission requested (user action may be required)')
  }
}

/**
 * Request Calendar access permission
 */
async function requestCalendarPermission(): Promise<void> {
  try {
    console.log('[Permissions] Checking calendar access...')
    
    // Trigger calendar permission by running a simple AppleScript
    execSync(`osascript -e 'tell application "Calendar" to count of calendars'`, {
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    console.log('[Permissions] Calendar: authorized')
  } catch (error) {
    console.log('[Permissions] Calendar: permission requested (user action may be required)')
  }
}

/**
 * Request Automation (AppleScript) permissions for common apps
 * This triggers the "allow app to control X" dialogs
 */
async function requestAutomationPermissions(): Promise<void> {
  const appsToAuthorize = [
    { name: 'Mail', script: 'tell application "Mail" to count of accounts' },
    { name: 'Contacts', script: 'tell application "Contacts" to name' },
    { name: 'Calendar', script: 'tell application "Calendar" to name' },
    { name: 'System Events', script: 'tell application "System Events" to name' }
  ]

  console.log('[Permissions] Requesting automation permissions...')

  for (const app of appsToAuthorize) {
    try {
      execSync(`osascript -e '${app.script}'`, {
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe']
      })
      console.log(`[Permissions] Automation (${app.name}): authorized`)
    } catch (error) {
      console.log(`[Permissions] Automation (${app.name}): permission requested`)
    }
  }
}

/**
 * Check if a specific permission is granted
 */
export function checkPermissionStatus(): {
  contacts: string
  calendar: string
  automation: string
} {
  if (process.platform !== 'darwin') {
    return { contacts: 'n/a', calendar: 'n/a', automation: 'n/a' }
  }

  let contacts = 'unknown'
  let calendar = 'unknown'
  let automation = 'unknown'

  // Check contacts
  try {
    execSync(`osascript -e 'tell application "Contacts" to count of people'`, {
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    contacts = 'authorized'
  } catch {
    contacts = 'denied or not determined'
  }

  // Check calendar
  try {
    execSync(`osascript -e 'tell application "Calendar" to count of calendars'`, {
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    calendar = 'authorized'
  } catch {
    calendar = 'denied or not determined'
  }

  // Check automation (Mail as proxy)
  try {
    execSync(`osascript -e 'tell application "Mail" to count of accounts'`, {
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    automation = 'authorized'
  } catch {
    automation = 'denied or not determined'
  }

  return { contacts, calendar, automation }
}
