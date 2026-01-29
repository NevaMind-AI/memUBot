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
 * Ensure an app is running and responsive before executing scripts
 * Returns true if app is ready, false if it failed to start
 */
async function ensureAppRunning(appName: string, maxRetries = 3): Promise<{ ready: boolean; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // First, launch the app if not running
      await execAsync(`osascript -e 'tell application "${appName}" to launch'`, { timeout: 10000 })
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Check if the app is responding with app-specific commands
      let checkScript: string
      switch (appName) {
        case 'Contacts':
          checkScript = `tell application "Contacts" to count of people`
          break
        case 'Calendar':
          checkScript = `tell application "Calendar" to count of calendars`
          break
        case 'Mail':
          checkScript = `tell application "Mail" to count of accounts`
          break
        default:
          checkScript = `tell application "${appName}" to name`
      }
      
      await execAsync(`osascript -e '${checkScript}'`, { timeout: 15000 })
      
      console.log(`[MacOS] ${appName} is ready (attempt ${attempt})`)
      return { ready: true }
    } catch (error) {
      console.log(`[MacOS] ${appName} not ready, attempt ${attempt}/${maxRetries}:`, error instanceof Error ? error.message : error)
      
      if (attempt < maxRetries) {
        // Wait before retry, increasing delay each time
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
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
// MAIL TOOL
// ============================================================================

interface MailInput {
  action: 'list_accounts' | 'list_mailboxes' | 'list_emails' | 'read_email' | 'send_email' | 'search_emails'
  account?: string
  mailbox?: string
  index?: number
  count?: number
  to?: string
  subject?: string
  body?: string
  query?: string
}

/**
 * Execute macOS Mail tool
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
      case 'list_mailboxes':
        return await listMailboxes()
      case 'list_emails':
        return await listEmails(input.mailbox || 'INBOX', input.count || 10)
      case 'read_email':
        if (!input.index) {
          return { success: false, error: 'index is required for read_email action' }
        }
        return await readEmail(input.mailbox || 'INBOX', input.index)
      case 'send_email':
        if (!input.to || !input.subject || !input.body) {
          return { success: false, error: 'to, subject, and body are required for send_email action' }
        }
        return await sendEmail(input.to, input.subject, input.body, input.account)
      case 'search_emails':
        if (!input.query) {
          return { success: false, error: 'query is required for search_emails action' }
        }
        return await searchEmails(input.mailbox || 'INBOX', input.query, input.count || 10)
      default:
        return { success: false, error: `Unknown action: ${input.action}` }
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

async function listMailboxes(): Promise<ToolResult> {
  const script = `
tell application "Mail"
  set mailboxList to {}
  repeat with acct in accounts
    set acctName to name of acct
    repeat with mb in mailboxes of acct
      set end of mailboxList to acctName & "/" & name of mb
    end repeat
  end repeat
  return mailboxList as string
end tell`
  
  const result = await runAppleScriptMultiline(script)
  const mailboxes = result.split(', ').filter(m => m.length > 0)
  
  return {
    success: true,
    data: {
      mailboxes,
      count: mailboxes.length
    }
  }
}

async function listEmails(mailbox: string, count: number): Promise<ToolResult> {
  const safeCount = Math.min(Math.max(count, 1), 50)
  
  const script = `
tell application "Mail"
  set targetMailbox to mailbox "${mailbox}" of account 1
  set msgList to {}
  set msgCount to count of messages of targetMailbox
  set fetchCount to ${safeCount}
  if msgCount < fetchCount then set fetchCount to msgCount
  
  repeat with i from 1 to fetchCount
    set msg to message i of targetMailbox
    set msgInfo to "---" & return
    set msgInfo to msgInfo & "Index: " & i & return
    set msgInfo to msgInfo & "From: " & (sender of msg) & return
    set msgInfo to msgInfo & "Subject: " & (subject of msg) & return
    set msgInfo to msgInfo & "Date: " & (date received of msg as string) & return
    set msgInfo to msgInfo & "Read: " & (read status of msg) & return
    set end of msgList to msgInfo
  end repeat
  
  return msgList as string
end tell`
  
  try {
    const result = await runAppleScriptMultiline(script)
    
    return {
      success: true,
      data: {
        mailbox,
        emails: result,
        note: 'Use read_email action with index to get full content'
      }
    }
  } catch (error) {
    // Try alternative approach for different mailbox structures
    return { 
      success: false, 
      error: `Failed to access mailbox "${mailbox}". Try using list_mailboxes to see available mailboxes.` 
    }
  }
}

async function readEmail(mailbox: string, index: number): Promise<ToolResult> {
  const script = `
tell application "Mail"
  set targetMailbox to mailbox "${mailbox}" of account 1
  set msg to message ${index} of targetMailbox
  
  set msgContent to "From: " & (sender of msg) & return
  set msgContent to msgContent & "To: " & (address of to recipient 1 of msg) & return
  set msgContent to msgContent & "Subject: " & (subject of msg) & return
  set msgContent to msgContent & "Date: " & (date received of msg as string) & return
  set msgContent to msgContent & return & "--- Content ---" & return
  set msgContent to msgContent & (content of msg)
  
  return msgContent
end tell`
  
  const result = await runAppleScriptMultiline(script)
  
  return {
    success: true,
    data: {
      mailbox,
      index,
      content: result
    }
  }
}

async function sendEmail(to: string, subject: string, body: string, accountName?: string): Promise<ToolResult> {
  // Escape special characters
  const escapedBody = body.replace(/"/g, '\\"').replace(/\n/g, '\\n')
  const escapedSubject = subject.replace(/"/g, '\\"')
  const escapedAccount = accountName ? accountName.replace(/"/g, '\\"') : ''
  
  // Build account selection part
  const accountSelection = escapedAccount 
    ? `set senderAccount to account "${escapedAccount}"
       set sender of newMessage to (email addresses of senderAccount as string)`
    : ''
  
  const script = `
tell application "Mail"
  set newMessage to make new outgoing message with properties {subject:"${escapedSubject}", content:"${escapedBody}", visible:true}
  ${accountSelection}
  tell newMessage
    make new to recipient at end of to recipients with properties {address:"${to}"}
  end tell
  send newMessage
end tell
return "Email sent successfully"`
  
  await runAppleScriptMultiline(script, 30000)
  
  return {
    success: true,
    data: {
      to,
      subject,
      account: accountName || 'default',
      message: 'Email sent successfully'
    }
  }
}

async function searchEmails(mailbox: string, query: string, count: number): Promise<ToolResult> {
  const safeCount = Math.min(Math.max(count, 1), 50)
  const escapedQuery = query.replace(/"/g, '\\"').toLowerCase()
  
  const script = `
tell application "Mail"
  set targetMailbox to mailbox "${mailbox}" of account 1
  set matchingMsgs to {}
  set msgCount to count of messages of targetMailbox
  set foundCount to 0
  
  repeat with i from 1 to msgCount
    if foundCount >= ${safeCount} then exit repeat
    set msg to message i of targetMailbox
    set msgSubject to subject of msg as string
    set msgSender to sender of msg as string
    
    if msgSubject contains "${escapedQuery}" or msgSender contains "${escapedQuery}" then
      set msgInfo to "---" & return
      set msgInfo to msgInfo & "Index: " & i & return
      set msgInfo to msgInfo & "From: " & msgSender & return
      set msgInfo to msgInfo & "Subject: " & msgSubject & return
      set msgInfo to msgInfo & "Date: " & (date received of msg as string) & return
      set end of matchingMsgs to msgInfo
      set foundCount to foundCount + 1
    end if
  end repeat
  
  return matchingMsgs as string
end tell`
  
  const result = await runAppleScriptMultiline(script)
  
  return {
    success: true,
    data: {
      mailbox,
      query,
      results: result || 'No matching emails found'
    }
  }
}

// ============================================================================
// CALENDAR TOOL
// ============================================================================

interface CalendarInput {
  action: 'list_calendars' | 'list_events' | 'get_event' | 'create_event' | 'search_events'
  calendar?: string
  days?: number
  event_id?: string
  title?: string
  start_date?: string
  end_date?: string
  location?: string
  notes?: string
  all_day?: boolean
  query?: string
}

/**
 * Execute macOS Calendar tool
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
      case 'list_events':
        return await listEvents(input.calendar, input.days || 7)
      case 'get_event':
        if (!input.event_id) {
          return { success: false, error: 'event_id is required for get_event action' }
        }
        return await getEvent(input.event_id)
      case 'create_event':
        if (!input.title || !input.start_date) {
          return { success: false, error: 'title and start_date are required for create_event action' }
        }
        return await createEvent(input)
      case 'search_events':
        if (!input.query) {
          return { success: false, error: 'query is required for search_events action' }
        }
        return await searchEvents(input.query, input.calendar, input.days || 30)
      default:
        return { success: false, error: `Unknown action: ${input.action}` }
    }
  } catch (error) {
    console.error('[MacOS Calendar] Error:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    
    if (errorMsg.includes('timeout') || errorMsg.includes('SIGTERM')) {
      return { 
        success: false, 
        error: 'Calendar app is not responding. Please try opening Calendar app manually first.'
      }
    }
    
    return { success: false, error: errorMsg }
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

async function listEvents(calendarName: string | undefined, days: number): Promise<ToolResult> {
  const safeDays = Math.min(Math.max(days, 1), 90)
  
  const calendarFilter = calendarName 
    ? `set targetCal to calendar "${calendarName}"
       set eventList to every event of targetCal whose start date >= startDate and start date <= endDate`
    : `set eventList to {}
       repeat with cal in calendars
         set eventList to eventList & (every event of cal whose start date >= startDate and start date <= endDate)
       end repeat`
  
  const script = `
tell application "Calendar"
  set startDate to current date
  set endDate to startDate + (${safeDays} * days)
  
  ${calendarFilter}
  
  set resultList to {}
  repeat with evt in eventList
    set evtInfo to "---" & return
    set evtInfo to evtInfo & "Title: " & (summary of evt) & return
    set evtInfo to evtInfo & "Start: " & (start date of evt as string) & return
    set evtInfo to evtInfo & "End: " & (end date of evt as string) & return
    if location of evt is not missing value then
      set evtInfo to evtInfo & "Location: " & (location of evt) & return
    end if
    set evtInfo to evtInfo & "ID: " & (uid of evt) & return
    set end of resultList to evtInfo
  end repeat
  
  return resultList as string
end tell`
  
  const result = await runAppleScriptMultiline(script)
  
  return {
    success: true,
    data: {
      calendar: calendarName || 'all',
      days: safeDays,
      events: result || 'No events found'
    }
  }
}

async function getEvent(eventId: string): Promise<ToolResult> {
  const script = `
tell application "Calendar"
  repeat with cal in calendars
    try
      set evt to first event of cal whose uid is "${eventId}"
      set evtInfo to "Title: " & (summary of evt) & return
      set evtInfo to evtInfo & "Calendar: " & (name of cal) & return
      set evtInfo to evtInfo & "Start: " & (start date of evt as string) & return
      set evtInfo to evtInfo & "End: " & (end date of evt as string) & return
      set evtInfo to evtInfo & "All Day: " & (allday event of evt) & return
      if location of evt is not missing value then
        set evtInfo to evtInfo & "Location: " & (location of evt) & return
      end if
      if description of evt is not missing value then
        set evtInfo to evtInfo & "Notes: " & (description of evt) & return
      end if
      set evtInfo to evtInfo & "ID: " & (uid of evt)
      return evtInfo
    end try
  end repeat
  return "Event not found"
end tell`
  
  const result = await runAppleScriptMultiline(script)
  
  if (result === 'Event not found') {
    return { success: false, error: 'Event not found' }
  }
  
  return {
    success: true,
    data: {
      event: result
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

async function searchEvents(query: string, calendarName: string | undefined, days: number): Promise<ToolResult> {
  const safeDays = Math.min(Math.max(days, 1), 90)
  const escapedQuery = query.replace(/"/g, '\\"').toLowerCase()
  
  const calendarFilter = calendarName 
    ? `set calList to {calendar "${calendarName}"}`
    : `set calList to calendars`
  
  const script = `
tell application "Calendar"
  set startDate to current date
  set endDate to startDate + (${safeDays} * days)
  
  ${calendarFilter}
  
  set resultList to {}
  repeat with cal in calList
    set eventList to every event of cal whose start date >= startDate and start date <= endDate
    repeat with evt in eventList
      set evtTitle to summary of evt as string
      if evtTitle contains "${escapedQuery}" then
        set evtInfo to "---" & return
        set evtInfo to evtInfo & "Title: " & evtTitle & return
        set evtInfo to evtInfo & "Calendar: " & (name of cal) & return
        set evtInfo to evtInfo & "Start: " & (start date of evt as string) & return
        set evtInfo to evtInfo & "End: " & (end date of evt as string) & return
        set evtInfo to evtInfo & "ID: " & (uid of evt) & return
        set end of resultList to evtInfo
      end if
    end repeat
  end repeat
  
  return resultList as string
end tell`
  
  const result = await runAppleScriptMultiline(script)
  
  return {
    success: true,
    data: {
      query,
      calendar: calendarName || 'all',
      days: safeDays,
      results: result || 'No matching events found'
    }
  }
}

// ============================================================================
// CONTACTS TOOL
// ============================================================================

interface ContactsInput {
  action: 'list_contacts' | 'search_contacts' | 'get_contact'
  query?: string
  contact_id?: string
  limit?: number
}

/**
 * Execute macOS Contacts tool
 */
export async function executeMacOSContactsTool(input: ContactsInput): Promise<ToolResult> {
  try {
    // Ensure Contacts app is running and responsive before any operation
    const appStatus = await ensureAppRunning('Contacts')
    if (!appStatus.ready) {
      return { success: false, error: appStatus.error }
    }
    
    switch (input.action) {
      case 'list_contacts':
        return await listContacts(input.limit || 20)
      case 'search_contacts':
        if (!input.query) {
          return { success: false, error: 'query is required for search_contacts action' }
        }
        return await searchContacts(input.query, input.limit || 20)
      case 'get_contact':
        if (!input.contact_id) {
          return { success: false, error: 'contact_id is required for get_contact action' }
        }
        return await getContact(input.contact_id)
      default:
        return { success: false, error: `Unknown action: ${input.action}` }
    }
  } catch (error) {
    console.error('[MacOS Contacts] Error:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    
    // Provide helpful error message for common issues
    if (errorMsg.includes('timeout') || errorMsg.includes('SIGTERM')) {
      return { 
        success: false, 
        error: 'Contacts app is not responding. Please try: 1) Open Contacts app manually, 2) Check System Settings > Privacy & Security > Contacts to ensure the app has permission.'
      }
    }
    
    return { success: false, error: errorMsg }
  }
}

async function listContacts(limit: number): Promise<ToolResult> {
  const safeLimit = Math.min(Math.max(limit, 1), 50) // Reduced max for performance
  
  // Use a simpler, faster approach - just get names and IDs first
  const script = `
tell application "Contacts"
  set output to ""
  set pplList to people
  set maxCount to ${safeLimit}
  set totalCount to count of pplList
  if totalCount < maxCount then set maxCount to totalCount
  
  repeat with i from 1 to maxCount
    set p to item i of pplList
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
  end repeat
  
  return output
end tell`
  
  const result = await runAppleScriptMultiline(script, 60000) // 60s timeout
  
  return {
    success: true,
    data: {
      contacts: result || 'No contacts found',
      limit: safeLimit,
      note: 'Use search_contacts to find specific people, or get_contact with ID for full details'
    }
  }
}

async function searchContacts(query: string, limit: number): Promise<ToolResult> {
  const safeLimit = Math.min(Math.max(limit, 1), 20) // Lower limit for search
  const escapedQuery = query.replace(/"/g, '\\"')
  
  // Use 'whose' clause for faster native search on name
  const script = `
tell application "Contacts"
  set output to ""
  set foundCount to 0
  
  -- First search by name (fastest)
  set matchedPeople to (people whose name contains "${escapedQuery}")
  
  repeat with p in matchedPeople
    if foundCount >= ${safeLimit} then exit repeat
    
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
  
  const result = await runAppleScriptMultiline(script, 45000) // 45s timeout
  
  return {
    success: true,
    data: {
      query,
      contacts: result || 'No matching contacts found',
      limit: safeLimit,
      note: 'Search matches contact names. Use get_contact with ID for full details.'
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
