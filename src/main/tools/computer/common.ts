/**
 * Common/shared functionality for computer tools
 * Platform-independent implementations for screenshot, bash, text editor, etc.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as https from 'https'
import * as http from 'http'
import { app, screen, nativeImage } from 'electron'
import screenshot from 'screenshot-desktop'
import { getAuthService } from '../../services/auth'

const execAsync = promisify(exec)

/**
 * Check if running on Windows
 */
export const isWindows = process.platform === 'win32'

/**
 * Maximum output length to prevent context overflow (in characters)
 */
const MAX_OUTPUT_LENGTH = 30000

/**
 * Anthropic API image constraints
 * - Max 1568 pixels on longest edge
 * - Max ~1.15 megapixels total
 */
const ANTHROPIC_MAX_LONG_EDGE = 1568
const ANTHROPIC_MAX_PIXELS = 1_150_000

/**
 * Current screenshot scale factor (for coordinate transformation)
 * This is updated each time a screenshot is taken
 */
let currentScaleFactor = 1.0

/**
 * Get the current scale factor for coordinate transformation
 * Claude returns coordinates in scaled image space, we need to transform
 * them back to actual screen coordinates
 */
export function getScaleFactor(): number {
  return currentScaleFactor
}

/**
 * Calculate the scale factor needed to meet Anthropic API constraints
 * @param width Original width in pixels
 * @param height Original height in pixels
 * @returns Scale factor (1.0 means no scaling needed)
 */
function calculateScaleFactor(width: number, height: number): number {
  const longEdge = Math.max(width, height)
  const totalPixels = width * height

  // Calculate scale factor for long edge constraint
  const longEdgeScale = longEdge > ANTHROPIC_MAX_LONG_EDGE
    ? ANTHROPIC_MAX_LONG_EDGE / longEdge
    : 1.0

  // Calculate scale factor for total pixels constraint
  const pixelsScale = totalPixels > ANTHROPIC_MAX_PIXELS
    ? Math.sqrt(ANTHROPIC_MAX_PIXELS / totalPixels)
    : 1.0

  // Use the smaller scale factor (more aggressive scaling)
  return Math.min(1.0, longEdgeScale, pixelsScale)
}

/**
 * Flag to track if Windows screenshot files have been initialized
 */
let windowsScreenshotInitialized = false

/**
 * Initialize screenshot-desktop on Windows by copying batch files to temp directory.
 * This fixes the path resolution issue in packaged Electron apps.
 */
function initWindowsScreenshot(): void {
  if (!isWindows || windowsScreenshotInitialized) {
    return
  }

  try {
    const tmpDir = path.join(os.tmpdir(), 'screenCapture')
    const tmpBat = path.join(tmpDir, 'screenCapture_1.3.2.bat')
    const tmpManifest = path.join(tmpDir, 'app.manifest')

    // If files already exist in temp, we're good
    if (fsSync.existsSync(tmpBat) && fsSync.existsSync(tmpManifest)) {
      windowsScreenshotInitialized = true
      console.log('[Computer] Windows screenshot files already initialized in temp')
      return
    }

    // Create temp directory if it doesn't exist
    if (!fsSync.existsSync(tmpDir)) {
      fsSync.mkdirSync(tmpDir, { recursive: true })
    }

    // Find the correct source path for the batch files
    const appPath = app.getAppPath()
    const possiblePaths = [
      path.join(appPath.replace('app.asar', 'app.asar.unpacked'), 'node_modules', 'screenshot-desktop', 'lib', 'win32'),
      path.join(appPath, 'node_modules', 'screenshot-desktop', 'lib', 'win32'),
      path.join(path.dirname(appPath), 'node_modules', 'screenshot-desktop', 'lib', 'win32'),
    ]

    let sourcePath: string | null = null
    for (const p of possiblePaths) {
      const batPath = path.join(p, 'screenCapture_1.3.2.bat')
      if (fsSync.existsSync(batPath)) {
        sourcePath = p
        console.log('[Computer] Found screenshot-desktop files at:', p)
        break
      }
    }

    if (!sourcePath) {
      console.error('[Computer] Could not find screenshot-desktop batch files. Tried paths:', possiblePaths)
      return
    }

    // Copy files to temp directory
    const sourceBat = path.join(sourcePath, 'screenCapture_1.3.2.bat')
    const sourceManifest = path.join(sourcePath, 'app.manifest')

    if (fsSync.existsSync(sourceBat)) {
      fsSync.copyFileSync(sourceBat, tmpBat)
      console.log('[Computer] Copied screenCapture_1.3.2.bat to temp')
    }

    if (fsSync.existsSync(sourceManifest)) {
      fsSync.copyFileSync(sourceManifest, tmpManifest)
      console.log('[Computer] Copied app.manifest to temp')
    }

    windowsScreenshotInitialized = true
    console.log('[Computer] Windows screenshot files initialized successfully')
  } catch (error) {
    console.error('[Computer] Failed to initialize Windows screenshot files:', error)
  }
}

/**
 * Truncate output to prevent context overflow
 */
export function truncateOutput(output: string, maxLength: number = MAX_OUTPUT_LENGTH): string {
  if (output.length <= maxLength) {
    return output
  }

  const truncationNotice = '\n\n... [OUTPUT TRUNCATED - Too long for context] ...\n\n'
  const availableLength = maxLength - truncationNotice.length
  const headLength = Math.floor(availableLength * 0.7)
  const tailLength = availableLength - headLength

  const head = output.substring(0, headLength)
  const tail = output.substring(output.length - tailLength)

  const originalLines = output.split('\n').length
  const truncatedChars = output.length - headLength - tailLength

  const detailedNotice = `\n\n... [OUTPUT TRUNCATED: ${truncatedChars.toLocaleString()} characters (~${originalLines.toLocaleString()} total lines) removed to fit context. Consider using more specific commands like: head, tail, grep, find with -maxdepth, or wc -l to count] ...\n\n`

  return head + detailedNotice + tail
}

/**
 * Decode buffer with proper encoding for the platform
 */
function decodeOutput(buffer: Buffer | string): string {
  if (typeof buffer === 'string') {
    return buffer
  }

  if (isWindows) {
    try {
      const decoder = new TextDecoder('gbk')
      return decoder.decode(buffer)
    } catch {
      return buffer.toString('utf-8')
    }
  }

  return buffer.toString('utf-8')
}

/**
 * Take a screenshot and return as base64
 * Automatically scales the image to meet Anthropic API constraints
 * Updates currentScaleFactor for coordinate transformation
 */
export async function takeScreenshot(): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    // Initialize Windows screenshot files if needed
    initWindowsScreenshot()

    // Get primary display info
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: logicalWidth, height: logicalHeight } = primaryDisplay.size
    const dpiScale = primaryDisplay.scaleFactor || 1 // DPI scale (e.g., 2 for Retina)

    // Take screenshot - this captures at physical pixel resolution
    const imgBuffer = await screenshot({ format: 'png' })

    // Create nativeImage from buffer to get actual image dimensions
    const image = nativeImage.createFromBuffer(imgBuffer)
    const actualSize = image.getSize()
    const actualWidth = actualSize.width
    const actualHeight = actualSize.height

    console.log(
      '[Computer] Screenshot captured:',
      actualWidth,
      'x',
      actualHeight,
      '(logical:',
      logicalWidth,
      'x',
      logicalHeight,
      ', DPI scale:',
      dpiScale,
      ')'
    )

    // Calculate scale factor needed for Anthropic API constraints
    const apiScaleFactor = calculateScaleFactor(actualWidth, actualHeight)

    let finalImage = image
    let finalWidth = actualWidth
    let finalHeight = actualHeight

    if (apiScaleFactor < 1.0) {
      // Need to scale down the image
      finalWidth = Math.round(actualWidth * apiScaleFactor)
      finalHeight = Math.round(actualHeight * apiScaleFactor)

      // Resize the image using Electron's nativeImage
      finalImage = image.resize({
        width: finalWidth,
        height: finalHeight,
        quality: 'better'
      })

      console.log(
        '[Computer] Screenshot scaled:',
        actualWidth,
        'x',
        actualHeight,
        '->',
        finalWidth,
        'x',
        finalHeight,
        '(factor:',
        apiScaleFactor.toFixed(3),
        ')'
      )
    }

    // Calculate the total scale factor from Claude's coordinates to screen coordinates
    // Claude sees finalWidth x finalHeight, but we need to click at logicalWidth x logicalHeight
    // totalScaleFactor = logicalWidth / finalWidth
    currentScaleFactor = logicalWidth / finalWidth

    console.log(
      '[Computer] Coordinate scale factor:',
      currentScaleFactor.toFixed(3),
      '(Claude coords * factor = screen coords)'
    )

    // Convert to base64
    const finalBuffer = finalImage.toPNG()
    const base64 = finalBuffer.toString('base64')

    return {
      success: true,
      data: {
        type: 'base64',
        media_type: 'image/png',
        data: base64,
        width: finalWidth,
        height: finalHeight
      }
    }
  } catch (error) {
    console.error('[Computer] Screenshot error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Execute bash/shell command
 */
export async function executeBashTool(input: {
  command: string
  timeout?: number
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const timeout = input.timeout || 30000

    console.log('[Bash] Executing:', input.command)

    const { stdout, stderr } = (await execAsync(input.command, {
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      cwd: app.getPath('home'),
      encoding: 'buffer'
    })) as unknown as { stdout: Buffer; stderr: Buffer }

    const stdoutStr = decodeOutput(stdout)
    const stderrStr = decodeOutput(stderr)
    let output = stdoutStr + (stderrStr ? `\nSTDERR:\n${stderrStr}` : '')

    const originalLength = output.length
    output = truncateOutput(output)
    if (output.length < originalLength) {
      console.log(`[Bash] Output truncated from ${originalLength} to ${output.length} chars`)
    }
    console.log('[Bash] Output:', output.substring(0, 200) + '...')

    return { success: true, data: output }
  } catch (error) {
    console.error('[Bash] Error:', error)
    const execError = error as {
      stdout?: Buffer | string
      stderr?: Buffer | string
      message?: string
    }
    let output: string
    if (execError.stdout || execError.stderr) {
      const stdoutStr = execError.stdout ? decodeOutput(execError.stdout as Buffer) : ''
      const stderrStr = execError.stderr ? decodeOutput(execError.stderr as Buffer) : ''
      output = stdoutStr || stderrStr || execError.message || String(error)
    } else {
      output = execError.message || String(error)
    }
    output = truncateOutput(output)
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

        let output: string
        if (input.view_range) {
          const [start, end] = input.view_range
          const selectedLines = lines.slice(start - 1, end)
          const numberedLines = selectedLines.map((line, i) => `${start + i}: ${line}`)
          output = numberedLines.join('\n')
        } else {
          const numberedLines = lines.map((line, i) => `${i + 1}: ${line}`)
          output = numberedLines.join('\n')
        }

        output = truncateOutput(output)
        return { success: true, data: output }
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
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
    if (match && match[1]) {
      return match[1].replace(/['"]/g, '')
    }
  }

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

  const timestamp = Date.now()
  return `download_${timestamp}`
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

    const outputDir = input.output_dir || getDefaultOutputDir()
    await fs.mkdir(outputDir, { recursive: true })

    const result = await downloadFile(url)
    if (!result.success || !result.buffer) {
      return { success: false, error: result.error || 'Download failed' }
    }

    const filename = input.filename || extractFilename(url, result.contentDisposition)
    const filePath = path.join(outputDir, filename)

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
 * Search result interface
 */
interface SearchResult {
  title: string
  url: string
  content: string
  score?: number
}

/**
 * Search using Tavily API - main entry point
 */
export function searchTavily(apiKey: string, query: string, maxResults: number): Promise<SearchResult[]> {
  const mode = (import.meta.env.MAIN_VITE_APP_MODE as 'memu' | 'yumi') || 'memu'
  
  if (mode === 'yumi') {
    return searchTavilyYumi(apiKey, query, maxResults)
  } else {
    return searchTavilyMemu(apiKey, query, maxResults)
  }
}

/**
 * Search using Tavily API via Yumi proxy (simple fetch, no streaming)
 */
async function searchTavilyYumi(apiKey: string, query: string, maxResults: number): Promise<SearchResult[]> {
  const requestBody = {
    query: query,
    search_depth: 'basic',
    max_results: maxResults,
    include_answer: false,
    include_raw_content: false
  }

  const response = await fetch('https://api.memu.so/api/v3/yumi/tavily-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error)
  }

  return (data.results || []).map((r: { title: string; url: string; content: string; score?: number }) => ({
    title: r.title || '',
    url: r.url || '',
    content: r.content || '',
    score: r.score
  }))
}

/**
 * Search using Tavily API directly (streaming via https)
 */
function searchTavilyMemu(apiKey: string, query: string, maxResults: number): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      api_key: apiKey,
      query: query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false
    })

    const options = {
      hostname: 'api.tavily.com',
      port: 443,
      path: '/search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      },
      timeout: 30000
    }

    const request = https.request(options, (response) => {
      const chunks: Buffer[] = []

      response.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      response.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8')
          const data = JSON.parse(body)

          if (data.error) {
            reject(new Error(data.error))
            return
          }

          const results: SearchResult[] = (data.results || []).map((r: { title: string; url: string; content: string; score?: number }) => ({
            title: r.title || '',
            url: r.url || '',
            content: r.content || '',
            score: r.score
          }))

          resolve(results)
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      })

      response.on('error', reject)
    })

    request.on('error', reject)
    request.on('timeout', () => {
      request.destroy()
      reject(new Error('Tavily search request timeout'))
    })

    request.write(requestBody)
    request.end()
  })
}

/**
 * Execute web search using Tavily API
 */
export async function executeWebSearchTool(input: {
  query: string
  max_results?: number
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const { loadSettings } = await import('../../config/settings.config')
  const settings = await loadSettings()
  const mode = (import.meta.env.MAIN_VITE_APP_MODE as 'memu' | 'yumi') || 'memu'
  let apiKey: string | null = null

  if (mode === 'yumi') {
    apiKey = getAuthService().getAuthState().memuApiKey
  } else {
    apiKey = settings.tavilyApiKey
  }

  if (!apiKey) {
    return {
      success: false,
      error: 'Tavily API key not configured. Please add your Tavily API key in Settings to enable web search.'
    }
  }

  try {
    const query = input.query
    const maxResults = Math.min(input.max_results || 5, 10)

    console.log('[WebSearch] Searching with Tavily:', query)

    const results = await searchTavily(apiKey, query, maxResults)

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

    console.log(`[WebSearch] Found ${results.length} results from Tavily`)

    return {
      success: true,
      data: {
        query,
        results,
        resultCount: results.length
      }
    }
  } catch (error) {
    console.error('[WebSearch] Tavily error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
