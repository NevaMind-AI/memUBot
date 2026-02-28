import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

type ToolResult = { success: boolean; data?: unknown; error?: string }

/**
 * Execute AppleScript and return result
 */
async function runAppleScript(script: string): Promise<string> {
  // Escape the script for shell
  const escapedScript = script.replace(/'/g, "'\\''")
  const { stdout } = await execAsync(`osascript -e '${escapedScript}'`, {
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024
  })
  return stdout.trim()
}

/**
 * Execute multi-line AppleScript
 */
async function runAppleScriptMultiline(script: string, timeout = 30000): Promise<string> {
  // For complex scripts, use heredoc approach
  const { stdout } = await execAsync(`osascript << 'APPLESCRIPT'
${script}
APPLESCRIPT`, {
    timeout,
    maxBuffer: 10 * 1024 * 1024
  })
  return stdout.trim()
}

/**
 * Check if an app is already running
 */
async function isAppRunning(appName: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `osascript -e 'tell application "System Events" to (name of processes) contains "${appName}"'`,
      { timeout: 5000 }
    )
    return stdout.trim() === 'true'
  } catch {
    return false
  }
}

/**
 * Get the check script for verifying app is responsive
 */
function getAppCheckScript(appName: string): string {
  switch (appName) {
    case 'Contacts':
      return `tell application "Contacts" to count of people`
    case 'Calendar':
      return `tell application "Calendar" to count of calendars`
    case 'Mail':
      return `tell application "Mail" to count of accounts`
    default:
      return `tell application "${appName}" to name`
  }
}

/**
 * Ensure an app is running and responsive before executing scripts
 * Returns true if app is ready, false if it failed to start
 */
async function ensureAppRunning(appName: string, maxRetries = 3): Promise<{ ready: boolean; error?: string }> {
  const checkScript = getAppCheckScript(appName)
  
  // First, check if app is already running and responsive
  const alreadyRunning = await isAppRunning(appName)
  if (alreadyRunning) {
    try {
      await execAsync(`osascript -e '${checkScript}'`, { timeout: 10000 })
      console.log(`[MacOS] ${appName} is already running and ready`)
      return { ready: true }
    } catch {
      // App is running but not responsive, continue with normal flow
      console.log(`[MacOS] ${appName} is running but not responsive, will retry...`)
    }
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Launch the app
      await execAsync(`osascript -e 'tell application "${appName}" to launch'`, { timeout: 10000 })
      
      // Wait for app to initialize with polling
      // Start with 2 seconds, then check every 1 second for up to 10 seconds
      const maxWaitTime = 10000 // 10 seconds max wait
      const pollInterval = 1000 // Check every 1 second
      const initialWait = 2000 // Initial wait before first check
      
      await new Promise(resolve => setTimeout(resolve, initialWait))
      
      let elapsed = initialWait
      while (elapsed < maxWaitTime) {
        try {
          await execAsync(`osascript -e '${checkScript}'`, { timeout: 5000 })
          console.log(`[MacOS] ${appName} is ready (attempt ${attempt}, waited ${elapsed}ms)`)
          return { ready: true }
        } catch {
          // App not ready yet, wait and retry
          await new Promise(resolve => setTimeout(resolve, pollInterval))
          elapsed += pollInterval
        }
      }
      
      // If we get here, app didn't respond within maxWaitTime
      throw new Error(`App did not respond within ${maxWaitTime}ms`)
      
    } catch (error) {
      console.log(`[MacOS] ${appName} not ready, attempt ${attempt}/${maxRetries}:`, error instanceof Error ? error.message : error)
      
      if (attempt < maxRetries) {
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }
  }
  
  // Provide app-specific help for permission settings
  const privacySection = appName === 'Contacts' ? 'Contacts' 
    : appName === 'Calendar' ? 'Calendars'
    : appName === 'Mail' ? 'Mail' 
    : appName
  
  return { 
    ready: false, 
    error: `${appName} app is not responding after ${maxRetries} attempts. Please try: 1) Open ${appName} app manually first, 2) Check System Settings > Privacy & Security > ${privacySection} to ensure this app has permission.`
  }
}

// ============================================================================
// APP LAUNCHER TOOL
// ============================================================================

interface LaunchAppInput {
  app_name: string
}

/**
 * Execute macOS App Launcher tool - ensures an app is running before AppleScript operations
 */
export async function executeMacOSLaunchAppTool(input: LaunchAppInput): Promise<ToolResult> {
  if (!input.app_name) {
    return { success: false, error: 'app_name is required' }
  }
  
  const appName = input.app_name.trim()
  console.log(`[MacOS] Launching app: ${appName}`)
  
  const result = await ensureAppRunning(appName)
  
  if (result.ready) {
    return {
      success: true,
      data: {
        app: appName,
        status: 'ready',
        message: `${appName} is running and ready for AppleScript commands`
      }
    }
  } else {
    return {
      success: false,
      error: result.error || `Failed to launch ${appName}`
    }
  }
}

// ============================================================================
// MAIL TOOL
// ============================================================================

interface MailInput {
  action: 'list_accounts' | 'send_email' | 'read_email' | 'download_attachment'
  account?: string
  index?: number
  to?: string
  subject?: string
  body?: string
  attachments?: string[]  // File paths to attach when sending
  attachment_index?: number  // Which attachment to download (1-based)
}

/**
 * Execute macOS Mail tool (simplified - for complex queries use bash with AppleScript)
 */
export async function executeMacOSMailTool(input: MailInput): Promise<ToolResult> {
  try {
    // Ensure Mail app is running and responsive
    const appStatus = await ensureAppRunning('Mail')
    if (!appStatus.ready) {
      return { success: false, error: appStatus.error }
    }
    
    switch (input.action) {
      case 'list_accounts':
        return await listAccounts()
      case 'read_email':
        if (!input.index) {
          return { success: false, error: 'index is required for read_email action' }
        }
        return await readEmail('INBOX', input.index)
      case 'send_email':
        if (!input.to || !input.subject || !input.body) {
          return { success: false, error: 'to, subject, and body are required for send_email action' }
        }
        return await sendEmail(input.to, input.subject, input.body, input.account, input.attachments)
      case 'download_attachment':
        if (!input.index) {
          return { success: false, error: 'index is required for download_attachment action' }
        }
        return await downloadAttachment('INBOX', input.index, input.attachment_index)
      default:
        return { success: false, error: `Unknown action: ${input.action}. For complex queries, use bash with AppleScript.` }
    }
  } catch (error) {
    console.error('[MacOS Mail] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function listAccounts(): Promise<ToolResult> {
  const script = `
tell application "Mail"
  set output to ""
  repeat with acct in accounts
    set output to output & "---" & linefeed
    set output to output & "Name: " & (name of acct) & linefeed
    set output to output & "Email: " & (email addresses of acct as string) & linefeed
    set output to output & "Type: " & (account type of acct as string) & linefeed
    set output to output & "Enabled: " & (enabled of acct) & linefeed
  end repeat
  return output
end tell`
  
  const result = await runAppleScriptMultiline(script)
  
  return {
    success: true,
    data: {
      accounts: result || 'No accounts found',
      note: 'Use the account "Name" when sending emails with the "account" parameter'
    }
  }
}

async function readEmail(mailbox: string, index: number): Promise<ToolResult> {
  // First, get metadata (from, to, subject, date, attachments) - these are safer
  const metadataScript = `
tell application "Mail"
  set targetMailbox to mailbox "${mailbox}" of account 1
  set msg to message ${index} of targetMailbox
  
  set msgFrom to sender of msg
  set msgSubject to subject of msg
  set msgDate to date received of msg as string
  
  -- Get To address safely
  set msgTo to ""
  try
    set msgTo to address of to recipient 1 of msg
  end try
  
  -- Get attachment info
  set attachmentList to mail attachments of msg
  set attachmentCount to count of attachmentList
  set attachmentInfo to ""
  if attachmentCount > 0 then
    set attIndex to 1
    repeat with att in attachmentList
      try
        set attName to name of att
        set attSize to file size of att
        if attSize < 1024 then
          set sizeStr to (attSize as string) & " B"
        else if attSize < 1048576 then
          set sizeStr to (round (attSize / 1024) rounding half up) & " KB"
        else
          set sizeStr to (round (attSize / 1048576 * 10) rounding half up) / 10 & " MB"
        end if
        set attachmentInfo to attachmentInfo & "[" & attIndex & "] " & attName & " (" & sizeStr & ")" & linefeed
      on error
        set attachmentInfo to attachmentInfo & "[" & attIndex & "] (unable to read)" & linefeed
      end try
      set attIndex to attIndex + 1
    end repeat
  end if
  
  -- Return as delimited string (using ASCII 30 as delimiter - record separator)
  return msgFrom & (ASCII character 30) & msgTo & (ASCII character 30) & msgSubject & (ASCII character 30) & msgDate & (ASCII character 30) & attachmentCount & (ASCII character 30) & attachmentInfo
end tell`
  
  // Then get content separately - content may have special characters
  const contentScript = `
tell application "Mail"
  set targetMailbox to mailbox "${mailbox}" of account 1
  set msg to message ${index} of targetMailbox
  return content of msg
end tell`
  
  try {
    const metadataResult = await runAppleScriptMultiline(metadataScript, 30000)
    const parts = metadataResult.split(String.fromCharCode(30))
    
    const [from, to, subject, date, attachmentCountStr, attachmentInfo] = parts
    const attachmentCount = parseInt(attachmentCountStr) || 0
    
    // Try to get content, but don't fail if it errors
    let emailContent = ''
    try {
      emailContent = await runAppleScriptMultiline(contentScript, 30000)
    } catch (contentError) {
      console.log('[MacOS Mail] Could not read email content, may contain special characters:', contentError)
      emailContent = '(Content could not be read - may contain special characters)'
    }
    
    // Build the result string
    let result = `From: ${from}\n`
    result += `To: ${to}\n`
    result += `Subject: ${subject}\n`
    result += `Date: ${date}\n`
    
    if (attachmentCount > 0) {
      result += `\n--- Attachments (${attachmentCount}) ---\n`
      result += attachmentInfo
      result += `\nUse download_attachment action with attachment_index to save attachments.\n`
    }
    
    result += `\n--- Content ---\n`
    result += emailContent
    
    return {
      success: true,
      data: {
        mailbox,
        index,
        content: result
      }
    }
  } catch (error) {
    console.error('[MacOS Mail] Error reading email:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }
  }
}

async function sendEmail(to: string, subject: string, body: string, accountName?: string, attachments?: string[]): Promise<ToolResult> {
  // Escape special characters
  const escapedBody = body.replace(/"/g, '\\"').replace(/\n/g, '\\n')
  const escapedSubject = subject.replace(/"/g, '\\"')
  const escapedAccount = accountName ? accountName.replace(/"/g, '\\"') : ''
  
  // Build account selection part
  const accountSelection = escapedAccount 
    ? `set senderAccount to account "${escapedAccount}"
       set sender of newMessage to (email addresses of senderAccount as string)`
    : ''
  
  // Build attachment commands
  let attachmentCommands = ''
  const attachedFiles: string[] = []
  if (attachments && attachments.length > 0) {
    for (const filePath of attachments) {
      // Expand ~ to home directory and escape for AppleScript
      const expandedPath = filePath.replace(/^~/, process.env.HOME || '')
      const escapedPath = expandedPath.replace(/"/g, '\\"')
      attachmentCommands += `
      try
        make new attachment with properties {file name:POSIX file "${escapedPath}"} at after last paragraph
      on error errMsg
        error "Failed to attach file: ${escapedPath} - " & errMsg
      end try`
      attachedFiles.push(expandedPath)
    }
  }
  
  const script = `
tell application "Mail"
  set newMessage to make new outgoing message with properties {subject:"${escapedSubject}", content:"${escapedBody}", visible:true}
  ${accountSelection}
  tell newMessage
    make new to recipient at end of to recipients with properties {address:"${to}"}
    ${attachmentCommands}
  end tell
  send newMessage
end tell
return "Email sent successfully"`
  
  await runAppleScriptMultiline(script, 60000) // Longer timeout for attachments
  
  return {
    success: true,
    data: {
      to,
      subject,
      account: accountName || 'default',
      attachments: attachedFiles.length > 0 ? attachedFiles : undefined,
      message: attachedFiles.length > 0 
        ? `Email sent successfully with ${attachedFiles.length} attachment(s)`
        : 'Email sent successfully'
    }
  }
}

async function downloadAttachment(mailbox: string, emailIndex: number, attachmentIndex?: number): Promise<ToolResult> {
  // Get app data directory for saving attachments
  const { app } = await import('electron')
  const path = await import('path')
  const fs = await import('fs/promises')
  
  const attachmentsDir = path.join(app.getPath('userData'), 'mail-attachments')
  
  // Ensure directory exists
  try {
    await fs.mkdir(attachmentsDir, { recursive: true })
  } catch {
    // Directory may already exist
  }
  
  // First, get attachment info
  const infoScript = `
tell application "Mail"
  set targetMailbox to mailbox "${mailbox}" of account 1
  set msg to message ${emailIndex} of targetMailbox
  set attachmentList to mail attachments of msg
  set attachmentCount to count of attachmentList
  
  if attachmentCount = 0 then
    return "NO_ATTACHMENTS"
  end if
  
  set output to ""
  repeat with i from 1 to attachmentCount
    set att to item i of attachmentList
    try
      set attName to name of att
      set output to output & i & "|" & attName & return
    on error
      set output to output & i & "|unknown" & return
    end try
  end repeat
  
  return output
end tell`
  
  const infoResult = await runAppleScriptMultiline(infoScript, 30000)
  
  if (infoResult === 'NO_ATTACHMENTS') {
    return { success: false, error: 'This email has no attachments' }
  }
  
  // Parse attachment info
  const attachmentLines = infoResult.trim().split('\n').filter(l => l.length > 0)
  const attachments = attachmentLines.map(line => {
    const [idx, name] = line.split('|')
    return { index: parseInt(idx), name: name || 'unknown' }
  })
  
  // Determine which attachments to download
  const toDownload = attachmentIndex 
    ? attachments.filter(a => a.index === attachmentIndex)
    : attachments
  
  if (toDownload.length === 0) {
    return { 
      success: false, 
      error: `Attachment index ${attachmentIndex} not found. Available attachments: ${attachments.map(a => `[${a.index}] ${a.name}`).join(', ')}`
    }
  }
  
  const savedFiles: string[] = []
  const errors: string[] = []
  
  for (const att of toDownload) {
    // Generate unique filename
    const timestamp = Date.now()
    const safeName = att.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const savePath = path.join(attachmentsDir, `${timestamp}_${safeName}`)
    const posixSavePath = savePath.replace(/\\/g, '/')
    
    const saveScript = `
tell application "Mail"
  set targetMailbox to mailbox "${mailbox}" of account 1
  set msg to message ${emailIndex} of targetMailbox
  set att to item ${att.index} of mail attachments of msg
  
  set saveFile to POSIX file "${posixSavePath}"
  save att in saveFile
  
  return "SAVED"
end tell`
    
    try {
      await runAppleScriptMultiline(saveScript, 60000)
      savedFiles.push(savePath)
    } catch (error) {
      errors.push(`Failed to save ${att.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  if (savedFiles.length === 0) {
    return { 
      success: false, 
      error: `Failed to download attachments: ${errors.join('; ')}`
    }
  }
  
  return {
    success: true,
    data: {
      mailbox,
      emailIndex,
      downloadedFiles: savedFiles,
      totalAttachments: attachments.length,
      downloadedCount: savedFiles.length,
      errors: errors.length > 0 ? errors : undefined,
      note: 'Attachments saved to app data directory'
    }
  }
}

// ============================================================================
// CALENDAR TOOL
// ============================================================================

interface CalendarInput {
  action: 'list_calendars' | 'create_event'
  calendar?: string
  title?: string
  start_date?: string
  end_date?: string
  location?: string
  notes?: string
  all_day?: boolean
}

/**
 * Execute macOS Calendar tool (simplified - for complex queries use bash with AppleScript)
 */
export async function executeMacOSCalendarTool(input: CalendarInput): Promise<ToolResult> {
  try {
    // Ensure Calendar app is running and responsive
    const appStatus = await ensureAppRunning('Calendar')
    if (!appStatus.ready) {
      return { success: false, error: appStatus.error }
    }
    
    switch (input.action) {
      case 'list_calendars':
        return await listCalendars()
      case 'create_event':
        if (!input.title || !input.start_date) {
          return { success: false, error: 'title and start_date are required for create_event action' }
        }
        return await createEvent(input)
      default:
        return { success: false, error: `Unknown action: ${input.action}. For querying events, use bash with AppleScript.` }
    }
  } catch (error) {
    console.error('[MacOS Calendar] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function listCalendars(): Promise<ToolResult> {
  const script = `
tell application "Calendar"
  set calList to {}
  repeat with cal in calendars
    set end of calList to name of cal
  end repeat
  return calList as string
end tell`
  
  const result = await runAppleScriptMultiline(script)
  const calendars = result.split(', ').filter(c => c.length > 0)
  
  return {
    success: true,
    data: {
      calendars,
      count: calendars.length
    }
  }
}

async function createEvent(input: CalendarInput): Promise<ToolResult> {
  const title = input.title!.replace(/"/g, '\\"')
  const startDate = new Date(input.start_date!)
  const endDate = input.end_date ? new Date(input.end_date) : new Date(startDate.getTime() + 60 * 60 * 1000) // Default 1 hour
  
  const formatDate = (d: Date): string => {
    return `date "${d.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })} at ${d.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })}"`
  }
  
  const calendarSelect = input.calendar 
    ? `set targetCal to calendar "${input.calendar}"`
    : `set targetCal to first calendar`
  
  const locationProp = input.location ? `, location:"${input.location.replace(/"/g, '\\"')}"` : ''
  const notesProp = input.notes ? `, description:"${input.notes.replace(/"/g, '\\"')}"` : ''
  const allDayProp = input.all_day ? `, allday event:true` : ''
  
  const script = `
tell application "Calendar"
  ${calendarSelect}
  set startD to ${formatDate(startDate)}
  set endD to ${formatDate(endDate)}
  set newEvent to make new event at end of events of targetCal with properties {summary:"${title}", start date:startD, end date:endD${locationProp}${notesProp}${allDayProp}}
  return "Event created: " & (uid of newEvent)
end tell`
  
  const result = await runAppleScriptMultiline(script)
  
  return {
    success: true,
    data: {
      message: result,
      title: input.title,
      startDate: input.start_date,
      endDate: input.end_date || endDate.toISOString(),
      calendar: input.calendar || 'default'
    }
  }
}

// ============================================================================
// CONTACTS TOOL
// ============================================================================

interface ContactsInput {
  action: 'search_contacts' | 'get_contact'
  query?: string
  contact_id?: string
}

/**
 * Execute macOS Contacts tool (simplified - for listing all contacts use bash with AppleScript)
 */
export async function executeMacOSContactsTool(input: ContactsInput): Promise<ToolResult> {
  try {
    // Ensure Contacts app is running and responsive before any operation
    const appStatus = await ensureAppRunning('Contacts')
    if (!appStatus.ready) {
      return { success: false, error: appStatus.error }
    }
    
    switch (input.action) {
      case 'search_contacts':
        if (!input.query) {
          return { success: false, error: 'query is required for search_contacts action' }
        }
        return await searchContacts(input.query)
      case 'get_contact':
        if (!input.contact_id) {
          return { success: false, error: 'contact_id is required for get_contact action' }
        }
        return await getContact(input.contact_id)
      default:
        return { success: false, error: `Unknown action: ${input.action}. For listing all contacts, use bash with AppleScript.` }
    }
  } catch (error) {
    console.error('[MacOS Contacts] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function searchContacts(query: string): Promise<ToolResult> {
  const maxResults = 10 // Fast, focused search
  const escapedQuery = query.replace(/"/g, '\\"')
  
  // Use 'whose' clause for fast native search on name
  const script = `
tell application "Contacts"
  set output to ""
  set foundCount to 0
  
  set matchedPeople to (people whose name contains "${escapedQuery}")
  
  repeat with p in matchedPeople
    if foundCount >= ${maxResults} then exit repeat
    
    set output to output & "---" & linefeed
    set output to output & "Name: " & (name of p) & linefeed
    set output to output & "ID: " & (id of p) & linefeed
    
    try
      if (count of emails of p) > 0 then
        set output to output & "Email: " & (value of first email of p) & linefeed
      end if
    end try
    
    try
      if (count of phones of p) > 0 then
        set output to output & "Phone: " & (value of first phone of p) & linefeed
      end if
    end try
    
    set foundCount to foundCount + 1
  end repeat
  
  return output
end tell`
  
  const result = await runAppleScriptMultiline(script, 30000) // 30s timeout (faster)
  
  return {
    success: true,
    data: {
      query,
      contacts: result || 'No matching contacts found',
      note: 'Use get_contact with ID for full details, or bash with AppleScript for advanced queries.'
    }
  }
}

async function getContact(contactId: string): Promise<ToolResult> {
  const escapedId = contactId.replace(/"/g, '\\"')
  
  const script = `
tell application "Contacts"
  try
    set p to first person whose id is "${escapedId}"
    set output to ""
    
    set output to output & "Name: " & (name of p) & linefeed
    set output to output & "ID: " & (id of p) & linefeed
    
    try
      if first name of p is not missing value then
        set output to output & "First Name: " & (first name of p) & linefeed
      end if
    end try
    
    try
      if last name of p is not missing value then
        set output to output & "Last Name: " & (last name of p) & linefeed
      end if
    end try
    
    try
      if organization of p is not missing value then
        set output to output & "Organization: " & (organization of p) & linefeed
      end if
    end try
    
    try
      if job title of p is not missing value then
        set output to output & "Job Title: " & (job title of p) & linefeed
      end if
    end try
    
    -- Emails
    try
      if (count of emails of p) > 0 then
        set output to output & linefeed & "Emails:" & linefeed
        repeat with e in emails of p
          set output to output & "  - " & (label of e) & ": " & (value of e) & linefeed
        end repeat
      end if
    end try
    
    -- Phones
    try
      if (count of phones of p) > 0 then
        set output to output & linefeed & "Phones:" & linefeed
        repeat with ph in phones of p
          set output to output & "  - " & (label of ph) & ": " & (value of ph) & linefeed
        end repeat
      end if
    end try
    
    -- Notes
    try
      if note of p is not missing value and note of p is not "" then
        set output to output & linefeed & "Notes: " & (note of p) & linefeed
      end if
    end try
    
    return output
  on error errMsg
    return "ERROR:" & errMsg
  end try
end tell`
  
  const result = await runAppleScriptMultiline(script, 15000) // 15s should be enough for single contact
  
  if (result.startsWith('ERROR:')) {
    return { success: false, error: result.replace('ERROR:', '') }
  }
  
  return {
    success: true,
    data: {
      contact: result
    }
  }
}
