import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

type ToolResult = { success: boolean; data?: unknown; error?: string }

/**
 * Execute multi-line AppleScript
 */
async function runAppleScript(script: string, timeout = 15000): Promise<string> {
  const { stdout } = await execAsync(`osascript << 'APPLESCRIPT'
${script}
APPLESCRIPT`, {
    timeout,
    maxBuffer: 10 * 1024 * 1024
  })
  return stdout.trim()
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// VISUAL SHOW TOOL
// ============================================================================

interface ShowToolInput {
  app: 'mail' | 'calendar' | 'notes' | 'finder' | 'keynote'
  target?: {
    email_subject?: string
    date?: string
    note_title?: string
    folder_path?: string
    file_path?: string
    presentation_path?: string
  }
  delay_ms?: number
}

/**
 * Execute macOS Show tool - opens and focuses apps for visual demonstration
 */
export async function executeMacOSShowTool(input: ShowToolInput): Promise<ToolResult> {
  const { app, target, delay_ms = 500 } = input

  if (!app) {
    return { success: false, error: 'app is required' }
  }

  console.log(`[MacOS Visual] Opening app: ${app}`, target ? `with target: ${JSON.stringify(target)}` : '')

  try {
    let result: string

    switch (app) {
      case 'mail':
        result = await showMail(target?.email_subject)
        break
      case 'calendar':
        result = await showCalendar(target?.date)
        break
      case 'notes':
        result = await showNotes(target?.note_title)
        break
      case 'finder':
        result = await showFinder(target?.folder_path, target?.file_path)
        break
      case 'keynote':
        result = await showKeynote(target?.presentation_path)
        break
      default:
        return { success: false, error: `Unknown app: ${app}` }
    }

    // Apply delay for visual pacing
    if (delay_ms > 0) {
      await sleep(delay_ms)
    }

    return {
      success: true,
      data: {
        app,
        target,
        message: result
      }
    }
  } catch (error) {
    console.error(`[MacOS Visual] Error opening ${app}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Open Mail and optionally search for specific email
 */
async function showMail(emailSubject?: string): Promise<string> {
  if (emailSubject) {
    const escapedSubject = emailSubject.replace(/"/g, '\\"')
    const script = `
tell application "Mail"
  activate
  delay 0.5
  
  -- Try to find and select the email
  try
    set targetMessage to first message of inbox whose subject contains "${escapedSubject}"
    set selected messages of message viewer 1 to {targetMessage}
    return "Mail opened and found email: " & subject of targetMessage
  on error
    -- If not found, just open inbox
    return "Mail opened (email not found: ${escapedSubject})"
  end try
end tell`
    return await runAppleScript(script)
  } else {
    const script = `
tell application "Mail"
  activate
  return "Mail opened"
end tell`
    return await runAppleScript(script)
  }
}

/**
 * Open Calendar and navigate to specific date
 */
async function showCalendar(date?: string): Promise<string> {
  if (date) {
    // Parse the ISO date and format for AppleScript
    const dateObj = new Date(date)
    const script = `
tell application "Calendar"
  activate
  delay 0.3
  
  -- Navigate to the specified date
  set targetDate to date "${dateObj.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}"
  
  try
    view calendar at targetDate
    return "Calendar opened at ${date}"
  on error
    return "Calendar opened (could not navigate to ${date})"
  end try
end tell`
    return await runAppleScript(script)
  } else {
    const script = `
tell application "Calendar"
  activate
  return "Calendar opened"
end tell`
    return await runAppleScript(script)
  }
}

/**
 * Open Notes and optionally search for specific note
 */
async function showNotes(noteTitle?: string): Promise<string> {
  if (noteTitle) {
    const escapedTitle = noteTitle.replace(/"/g, '\\"')
    const script = `
tell application "Notes"
  activate
  delay 0.5
  
  -- Search for the note
  try
    set matchingNotes to notes whose name contains "${escapedTitle}"
    if (count of matchingNotes) > 0 then
      set targetNote to item 1 of matchingNotes
      show targetNote
      return "Notes opened and found: " & name of targetNote
    else
      return "Notes opened (note not found: ${escapedTitle})"
    end if
  on error errMsg
    return "Notes opened (search failed: " & errMsg & ")"
  end try
end tell`
    return await runAppleScript(script)
  } else {
    const script = `
tell application "Notes"
  activate
  return "Notes opened"
end tell`
    return await runAppleScript(script)
  }
}

/**
 * Open Finder at specific folder, or preview a specific file
 */
async function showFinder(folderPath?: string, filePath?: string): Promise<string> {
  // If file_path is provided, open folder and preview the file with Quick Look
  if (filePath) {
    const expandedPath = filePath.replace(/^~/, process.env.HOME || '')
    const script = `
tell application "Finder"
  activate
  delay 0.3
  try
    set targetFile to POSIX file "${expandedPath}" as alias
    reveal targetFile
    delay 0.5
    select targetFile
    delay 0.3
  on error errMsg
    return "Finder opened (file not found: ${filePath})"
  end try
end tell

-- Trigger Quick Look with spacebar
delay 0.3
tell application "System Events"
  keystroke space
end tell

return "Finder opened and previewing: ${filePath}"`
    return await runAppleScript(script)
  }
  
  // If folder_path is provided, open that folder
  if (folderPath) {
    // Expand ~ to home directory
    const expandedPath = folderPath.replace(/^~/, process.env.HOME || '')
    const script = `
tell application "Finder"
  activate
  try
    open POSIX file "${expandedPath}"
    return "Finder opened at ${folderPath}"
  on error
    -- If folder doesn't exist, just open home
    open home
    return "Finder opened (folder not found: ${folderPath})"
  end try
end tell`
    return await runAppleScript(script)
  }
  
  // Default: just open Finder
  const script = `
tell application "Finder"
  activate
  open home
  return "Finder opened"
end tell`
  return await runAppleScript(script)
}

/**
 * Open Keynote with optional presentation file
 */
async function showKeynote(presentationPath?: string): Promise<string> {
  if (presentationPath) {
    // Expand ~ to home directory
    const expandedPath = presentationPath.replace(/^~/, process.env.HOME || '')
    const script = `
tell application "Keynote"
  activate
  try
    open POSIX file "${expandedPath}"
    return "Keynote opened with presentation: ${presentationPath}"
  on error errMsg
    -- If file doesn't open, just activate Keynote
    return "Keynote opened (could not open file: " & errMsg & ")"
  end try
end tell`
    return await runAppleScript(script)
  } else {
    const script = `
tell application "Keynote"
  activate
  return "Keynote opened"
end tell`
    return await runAppleScript(script)
  }
}

// ============================================================================
// VISUAL CLOSE TOOL
// ============================================================================

interface CloseToolInput {
  target: 'finder' | 'quicklook' | 'keynote' | 'mail' | 'calendar' | 'notes'
  delay_ms?: number
}

/**
 * Execute macOS Close tool - closes windows/previews for visual flow
 */
export async function executeMacOSCloseTool(input: CloseToolInput): Promise<ToolResult> {
  const { target, delay_ms = 300 } = input

  if (!target) {
    return { success: false, error: 'target is required' }
  }

  console.log(`[MacOS Visual] Closing: ${target}`)

  try {
    let result: string

    switch (target) {
      case 'quicklook':
        result = await closeQuickLook()
        break
      case 'finder':
        result = await closeFinderWindow()
        break
      case 'keynote':
        result = await closeAppWindow('Keynote')
        break
      case 'mail':
        result = await closeAppWindow('Mail')
        break
      case 'calendar':
        result = await closeAppWindow('Calendar')
        break
      case 'notes':
        result = await closeAppWindow('Notes')
        break
      default:
        return { success: false, error: `Unknown target: ${target}` }
    }

    // Apply delay for visual pacing
    if (delay_ms > 0) {
      await sleep(delay_ms)
    }

    return {
      success: true,
      data: {
        target,
        message: result
      }
    }
  } catch (error) {
    console.error(`[MacOS Visual] Error closing ${target}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Dismiss Quick Look preview by pressing Escape
 */
async function closeQuickLook(): Promise<string> {
  const script = `
tell application "System Events"
  key code 53  -- Escape key
end tell
return "Quick Look dismissed"`
  return await runAppleScript(script)
}

/**
 * Close the frontmost Finder window
 */
async function closeFinderWindow(): Promise<string> {
  const script = `
tell application "Finder"
  try
    close front window
    return "Finder window closed"
  on error
    return "No Finder window to close"
  end try
end tell`
  return await runAppleScript(script)
}

/**
 * Close the frontmost window of an app (without quitting)
 */
async function closeAppWindow(appName: string): Promise<string> {
  const script = `
tell application "${appName}"
  try
    close front window
    return "${appName} window closed"
  on error
    return "No ${appName} window to close"
  end try
end tell`
  return await runAppleScript(script)
}
