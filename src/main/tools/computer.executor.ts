import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'
import { app, screen } from 'electron'
import screenshot from 'screenshot-desktop'

const execAsync = promisify(exec)

/**
 * Execute computer tool actions using macOS native commands
 */
export async function executeComputerTool(input: {
  action: string
  coordinate?: [number, number]
  text?: string
  scroll_direction?: 'up' | 'down'
  scroll_amount?: number
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (input.action) {
      case 'screenshot':
        return await takeScreenshot()

      case 'mouse_move':
        if (!input.coordinate) {
          return { success: false, error: 'coordinate is required for mouse_move' }
        }
        await moveMouse(input.coordinate[0], input.coordinate[1])
        return { success: true, data: `Mouse moved to (${input.coordinate[0]}, ${input.coordinate[1]})` }

      case 'left_click':
        if (input.coordinate) {
          await moveMouse(input.coordinate[0], input.coordinate[1])
        }
        await click('left')
        return { success: true, data: 'Left click performed' }

      case 'right_click':
        if (input.coordinate) {
          await moveMouse(input.coordinate[0], input.coordinate[1])
        }
        await click('right')
        return { success: true, data: 'Right click performed' }

      case 'double_click':
        if (input.coordinate) {
          await moveMouse(input.coordinate[0], input.coordinate[1])
        }
        await doubleClick()
        return { success: true, data: 'Double click performed' }

      case 'type':
        if (!input.text) {
          return { success: false, error: 'text is required for type action' }
        }
        await typeText(input.text)
        return { success: true, data: `Typed: ${input.text}` }

      case 'key':
        if (!input.text) {
          return { success: false, error: 'text is required for key action' }
        }
        await pressKey(input.text)
        return { success: true, data: `Key pressed: ${input.text}` }

      case 'scroll':
        const amount = input.scroll_amount || 5
        const direction = input.scroll_direction || 'down'
        await scroll(direction, amount)
        return { success: true, data: `Scrolled ${direction} by ${amount}` }

      default:
        return { success: false, error: `Unknown action: ${input.action}` }
    }
  } catch (error) {
    console.error('[Computer] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Take a screenshot and return as base64
 */
async function takeScreenshot(): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    // Get primary display info
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size

    // Take screenshot
    const imgBuffer = await screenshot({ format: 'png' })

    // Convert to base64
    const base64 = Buffer.from(imgBuffer).toString('base64')

    console.log('[Computer] Screenshot taken:', width, 'x', height)

    return {
      success: true,
      data: {
        type: 'base64',
        media_type: 'image/png',
        data: base64,
        width,
        height
      }
    }
  } catch (error) {
    console.error('[Computer] Screenshot error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Move mouse to coordinates using cliclick (brew install cliclick) or AppleScript
 */
async function moveMouse(x: number, y: number): Promise<void> {
  // Try cliclick first (faster and more reliable)
  try {
    await execAsync(`cliclick m:${Math.round(x)},${Math.round(y)}`)
    return
  } catch {
    // Fall back to AppleScript via Python (CoreGraphics)
  }

  // Use Python with Quartz (CoreGraphics) - built into macOS
  const script = `
import Quartz
Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, (${x}, ${y}), Quartz.kCGMouseButtonLeft))
`
  await execAsync(`python3 -c "${script}"`)
}

/**
 * Click using cliclick or Python/Quartz
 */
async function click(button: 'left' | 'right'): Promise<void> {
  try {
    const cmd = button === 'left' ? 'c:.' : 'rc:.'
    await execAsync(`cliclick ${cmd}`)
    return
  } catch {
    // Fall back to Python
  }

  const buttonType = button === 'left' ? 'kCGMouseButtonLeft' : 'kCGMouseButtonRight'
  const downEvent = button === 'left' ? 'kCGEventLeftMouseDown' : 'kCGEventRightMouseDown'
  const upEvent = button === 'left' ? 'kCGEventLeftMouseUp' : 'kCGEventRightMouseUp'

  const script = `
import Quartz
import time
loc = Quartz.CGEventGetLocation(Quartz.CGEventCreate(None))
Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.${downEvent}, loc, Quartz.${buttonType}))
time.sleep(0.05)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.${upEvent}, loc, Quartz.${buttonType}))
`
  await execAsync(`python3 -c "${script}"`)
}

/**
 * Double click
 */
async function doubleClick(): Promise<void> {
  try {
    await execAsync('cliclick dc:.')
    return
  } catch {
    // Fall back to Python
  }

  const script = `
import Quartz
import time
loc = Quartz.CGEventGetLocation(Quartz.CGEventCreate(None))
for _ in range(2):
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, loc, Quartz.kCGMouseButtonLeft))
    time.sleep(0.02)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, loc, Quartz.kCGMouseButtonLeft))
    time.sleep(0.02)
`
  await execAsync(`python3 -c "${script}"`)
}

/**
 * Type text using cliclick or AppleScript
 */
async function typeText(text: string): Promise<void> {
  // Escape special characters for shell
  const escaped = text.replace(/"/g, '\\"').replace(/'/g, "'\\''")

  try {
    // cliclick t: for typing
    await execAsync(`cliclick t:"${escaped}"`)
    return
  } catch {
    // Fall back to AppleScript
  }

  // AppleScript for typing
  const script = `osascript -e 'tell application "System Events" to keystroke "${escaped}"'`
  await execAsync(script)
}

/**
 * Press a key or key combination using AppleScript
 */
async function pressKey(keyStr: string): Promise<void> {
  // Map common key names to AppleScript key codes
  const keyCodeMap: Record<string, number> = {
    enter: 36,
    return: 36,
    tab: 48,
    space: 49,
    delete: 51,
    backspace: 51,
    escape: 53,
    esc: 53,
    up: 126,
    down: 125,
    left: 123,
    right: 124,
    home: 115,
    end: 119,
    pageup: 116,
    pagedown: 121,
    f1: 122,
    f2: 120,
    f3: 99,
    f4: 118,
    f5: 96,
    f6: 97,
    f7: 98,
    f8: 100,
    f9: 101,
    f10: 109,
    f11: 103,
    f12: 111
  }

  // Handle key combinations (e.g., "ctrl+c", "cmd+v")
  const parts = keyStr.toLowerCase().split('+').map((s) => s.trim())
  const modifiers: string[] = []
  let mainKey = ''

  for (const part of parts) {
    if (['ctrl', 'control'].includes(part)) {
      modifiers.push('control down')
    } else if (['cmd', 'command'].includes(part)) {
      modifiers.push('command down')
    } else if (['alt', 'option'].includes(part)) {
      modifiers.push('option down')
    } else if (['shift'].includes(part)) {
      modifiers.push('shift down')
    } else {
      mainKey = part
    }
  }

  const modifierStr = modifiers.length > 0 ? ` using {${modifiers.join(', ')}}` : ''

  // Check if it's a special key with key code
  if (keyCodeMap[mainKey] !== undefined) {
    const script = `osascript -e 'tell application "System Events" to key code ${keyCodeMap[mainKey]}${modifierStr}'`
    await execAsync(script)
  } else if (mainKey.length === 1) {
    // Single character
    const script = `osascript -e 'tell application "System Events" to keystroke "${mainKey}"${modifierStr}'`
    await execAsync(script)
  } else {
    throw new Error(`Unknown key: ${mainKey}`)
  }
}

/**
 * Scroll using cliclick or AppleScript
 */
async function scroll(direction: 'up' | 'down', amount: number): Promise<void> {
  const scrollAmount = direction === 'up' ? amount : -amount

  try {
    // cliclick scroll
    await execAsync(`cliclick "w:${scrollAmount}"`)
    return
  } catch {
    // Fall back to AppleScript
  }

  // Use AppleScript to scroll
  const scrollDirection = direction === 'up' ? -amount : amount
  const script = `osascript -e 'tell application "System Events" to scroll ${scrollDirection}'`

  try {
    await execAsync(script)
  } catch {
    // If AppleScript scroll fails, try Python
    const pyScript = `
import Quartz
Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateScrollWheelEvent(None, Quartz.kCGScrollEventUnitLine, 1, ${scrollAmount}))
`
    await execAsync(`python3 -c "${pyScript}"`)
  }
}

/**
 * Execute bash command
 */
export async function executeBashTool(input: {
  command: string
  timeout?: number
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const timeout = input.timeout || 30000

    console.log('[Bash] Executing:', input.command)

    const { stdout, stderr } = await execAsync(input.command, {
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      cwd: app.getPath('home')
    })

    const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '')
    console.log('[Bash] Output:', output.substring(0, 200) + '...')

    return { success: true, data: output }
  } catch (error) {
    console.error('[Bash] Error:', error)
    // @ts-expect-error - exec error has stdout/stderr
    const output = error.stdout || error.stderr || error.message
    return { success: false, error: output }
  }
}

/**
 * Execute text editor command
 */
export async function executeTextEditorTool(input: {
  command: string
  path: string
  file_text?: string
  old_str?: string
  new_str?: string
  insert_line?: number
  view_range?: [number, number]
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const filePath = input.path

    switch (input.command) {
      case 'view': {
        const content = await fs.readFile(filePath, 'utf-8')
        const lines = content.split('\n')

        if (input.view_range) {
          const [start, end] = input.view_range
          const selectedLines = lines.slice(start - 1, end)
          const numberedLines = selectedLines.map((line, i) => `${start + i}: ${line}`)
          return { success: true, data: numberedLines.join('\n') }
        }

        const numberedLines = lines.map((line, i) => `${i + 1}: ${line}`)
        return { success: true, data: numberedLines.join('\n') }
      }

      case 'create': {
        if (!input.file_text) {
          return { success: false, error: 'file_text is required for create command' }
        }
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, input.file_text, 'utf-8')
        return { success: true, data: `File created: ${filePath}` }
      }

      case 'str_replace': {
        if (!input.old_str || input.new_str === undefined) {
          return { success: false, error: 'old_str and new_str are required for str_replace' }
        }
        const content = await fs.readFile(filePath, 'utf-8')
        if (!content.includes(input.old_str)) {
          return {
            success: false,
            error: `old_str not found in file: "${input.old_str.substring(0, 50)}..."`
          }
        }
        const newContent = content.replace(input.old_str, input.new_str)
        await fs.writeFile(filePath, newContent, 'utf-8')
        return { success: true, data: 'String replaced successfully' }
      }

      case 'insert': {
        if (!input.insert_line || input.new_str === undefined) {
          return { success: false, error: 'insert_line and new_str are required for insert' }
        }
        const content = await fs.readFile(filePath, 'utf-8')
        const lines = content.split('\n')
        lines.splice(input.insert_line - 1, 0, input.new_str)
        await fs.writeFile(filePath, lines.join('\n'), 'utf-8')
        return { success: true, data: `Text inserted at line ${input.insert_line}` }
      }

      default:
        return { success: false, error: `Unknown command: ${input.command}` }
    }
  } catch (error) {
    console.error('[TextEditor] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Get default output directory for downloaded files
 */
function getDefaultOutputDir(): string {
  return path.join(app.getPath('userData'), 'agent-output', 'downloads')
}

/**
 * Extract filename from URL or Content-Disposition header
 */
function extractFilename(url: string, contentDisposition?: string): string {
  // Try Content-Disposition header first
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
    if (match && match[1]) {
      return match[1].replace(/['"]/g, '')
    }
  }

  // Extract from URL
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = path.basename(pathname)
    if (filename && filename.includes('.')) {
      return filename
    }
  } catch {
    // Ignore URL parsing errors
  }

  // Generate default filename with timestamp
  const timestamp = Date.now()
  return `download_${timestamp}`
}

/**
 * Download a file from URL
 */
export async function executeDownloadFileTool(input: {
  url: string
  filename?: string
  output_dir?: string
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const url = input.url
    console.log('[Download] Downloading from:', url)

    // Determine output directory
    const outputDir = input.output_dir || getDefaultOutputDir()
    await fs.mkdir(outputDir, { recursive: true })

    // Download the file
    const result = await downloadFile(url)
    if (!result.success || !result.buffer) {
      return { success: false, error: result.error || 'Download failed' }
    }

    // Determine filename
    const filename = input.filename || extractFilename(url, result.contentDisposition)
    const filePath = path.join(outputDir, filename)

    // Write to file
    await fs.writeFile(filePath, result.buffer)
    
    const fileSize = result.buffer.length
    const fileSizeStr = fileSize > 1024 * 1024 
      ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
      : `${(fileSize / 1024).toFixed(2)} KB`

    console.log('[Download] Saved to:', filePath, `(${fileSizeStr})`)

    return {
      success: true,
      data: {
        path: filePath,
        filename,
        size: fileSize,
        sizeFormatted: fileSizeStr,
        contentType: result.contentType
      }
    }
  } catch (error) {
    console.error('[Download] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Download file from URL and return buffer
 */
function downloadFile(url: string, maxRedirects = 5): Promise<{
  success: boolean
  buffer?: Buffer
  contentType?: string
  contentDisposition?: string
  error?: string
}> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http

    const request = protocol.get(url, { 
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        if (maxRedirects <= 0) {
          resolve({ success: false, error: 'Too many redirects' })
          return
        }
        const redirectUrl = response.headers.location.startsWith('http') 
          ? response.headers.location 
          : new URL(response.headers.location, url).href
        console.log('[Download] Redirecting to:', redirectUrl)
        downloadFile(redirectUrl, maxRedirects - 1).then(resolve)
        return
      }

      // Check for successful response
      if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
        resolve({ success: false, error: `HTTP ${response.statusCode}` })
        return
      }

      const chunks: Buffer[] = []
      
      response.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      response.on('end', () => {
        const buffer = Buffer.concat(chunks)
        resolve({
          success: true,
          buffer,
          contentType: response.headers['content-type'],
          contentDisposition: response.headers['content-disposition']
        })
      })

      response.on('error', (error) => {
        resolve({ success: false, error: error.message })
      })
    })

    request.on('error', (error) => {
      resolve({ success: false, error: error.message })
    })

    request.on('timeout', () => {
      request.destroy()
      resolve({ success: false, error: 'Request timeout' })
    })
  })
}

/**
 * Search result structure
 */
interface SearchResult {
  title: string
  url: string
  snippet: string
}

/**
 * Execute web search using DuckDuckGo
 */
export async function executeWebSearchTool(input: {
  query: string
  max_results?: number
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const query = input.query
    const maxResults = Math.min(input.max_results || 5, 10)
    
    console.log('[WebSearch] Searching for:', query)

    const results = await searchDuckDuckGo(query, maxResults)
    
    if (results.length === 0) {
      return {
        success: true,
        data: {
          query,
          results: [],
          message: 'No results found'
        }
      }
    }

    console.log(`[WebSearch] Found ${results.length} results`)

    return {
      success: true,
      data: {
        query,
        results,
        resultCount: results.length
      }
    }
  } catch (error) {
    console.error('[WebSearch] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Search DuckDuckGo and parse results
 */
function searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    const encodedQuery = encodeURIComponent(query)
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`

    const request = https.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Follow redirect
        const redirectUrl = response.headers.location
        https.get(redirectUrl, {
          timeout: 15000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        }, (redirectResponse) => {
          handleResponse(redirectResponse, maxResults, resolve, reject)
        }).on('error', reject)
        return
      }

      handleResponse(response, maxResults, resolve, reject)
    })

    request.on('error', reject)
    request.on('timeout', () => {
      request.destroy()
      reject(new Error('Search request timeout'))
    })
  })
}

/**
 * Handle HTTP response and parse search results
 */
function handleResponse(
  response: http.IncomingMessage,
  maxResults: number,
  resolve: (results: SearchResult[]) => void,
  reject: (error: Error) => void
): void {
  const chunks: Buffer[] = []
  
  response.on('data', (chunk: Buffer) => {
    chunks.push(chunk)
  })

  response.on('end', () => {
    try {
      const html = Buffer.concat(chunks).toString('utf-8')
      const results = parseDuckDuckGoResults(html, maxResults)
      resolve(results)
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })

  response.on('error', reject)
}

/**
 * Parse DuckDuckGo HTML results
 */
function parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = []
  
  // Match result blocks - DuckDuckGo uses class="result" for each result
  // Each result has: a.result__a (title/link), a.result__snippet (snippet)
  
  // Simple regex-based parsing (no external dependencies)
  // Match result links
  const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi
  
  // Alternative: match the full result block
  const blockRegex = /<div[^>]*class="[^"]*result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi
  
  let match
  const links: { url: string; title: string }[] = []
  const snippets: string[] = []
  
  // Extract links and titles
  while ((match = resultRegex.exec(html)) !== null && links.length < maxResults) {
    let url = match[1]
    const title = decodeHtmlEntities(match[2].trim())
    
    // DuckDuckGo uses redirect URLs, extract actual URL
    if (url.includes('uddg=')) {
      const urlMatch = url.match(/uddg=([^&]+)/)
      if (urlMatch) {
        url = decodeURIComponent(urlMatch[1])
      }
    }
    
    if (title && url && url.startsWith('http')) {
      links.push({ url, title })
    }
  }
  
  // Extract snippets
  while ((match = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
    const snippet = decodeHtmlEntities(match[1].replace(/<[^>]*>/g, '').trim())
    if (snippet) {
      snippets.push(snippet)
    }
  }
  
  // Combine results
  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || ''
    })
  }
  
  return results
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#32;': ' '
  }
  
  return text.replace(/&[^;]+;/g, (match) => entities[match] || match)
}
