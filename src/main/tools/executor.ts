import { fileService } from '../services/file.service'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { app } from 'electron'
import type {
  ReadFileInput,
  WriteFileInput,
  ListDirectoryInput,
  DeleteFileInput,
  CreateDirectoryInput,
  FileInfoInput,
  GrepFileInput,
  ToolResult
} from '../types'

/**
 * Execute a tool by name with the given input
 */
export async function executeTool(
  toolName: string,
  toolInput: unknown
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'grep_file':
        return await executeGrepFile(toolInput as GrepFileInput)

      case 'read_file':
        return await executeReadFile(toolInput as ReadFileInput)

      case 'write_file':
        return await executeWriteFile(toolInput as WriteFileInput)

      case 'list_directory':
        return await executeListDirectory(toolInput as ListDirectoryInput)

      case 'delete_file':
        return await executeDeleteFile(toolInput as DeleteFileInput)

      case 'create_directory':
        return await executeCreateDirectory(toolInput as CreateDirectoryInput)

      case 'get_file_info':
        return await executeGetFileInfo(toolInput as FileInfoInput)

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`
        }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Search for a pattern in a file or directory
 * Returns matching lines with line numbers
 */
async function executeGrepFile(input: GrepFileInput): Promise<ToolResult> {
  const maxResults = input.max_results || 20
  const results: string[] = []
  
  // Resolve path relative to home directory
  const targetPath = input.path.startsWith('/') 
    ? input.path 
    : path.join(app.getPath('home'), input.path)
  
  try {
    const regex = new RegExp(input.pattern, 'i')
    const stats = await fs.promises.stat(targetPath)
    
    if (stats.isFile()) {
      // Search single file
      const matches = await searchFile(targetPath, regex, maxResults)
      results.push(...matches.map(m => `${targetPath}:${m}`))
    } else if (stats.isDirectory()) {
      // Search directory recursively
      await searchDirectory(targetPath, regex, results, maxResults)
    }
    
    if (results.length === 0) {
      return { success: true, data: 'No matches found' }
    }
    
    return { 
      success: true, 
      data: results.slice(0, maxResults).join('\n')
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Search a single file for pattern matches
 */
async function searchFile(filePath: string, regex: RegExp, maxResults: number): Promise<string[]> {
  const results: string[] = []
  
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' })
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })
  
  let lineNumber = 0
  
  for await (const line of rl) {
    lineNumber++
    if (regex.test(line)) {
      // Format: line_number|content (trimmed)
      results.push(`${lineNumber}|${line}`)
      if (results.length >= maxResults) {
        break
      }
    }
  }
  
  return results
}

/**
 * Recursively search a directory for pattern matches
 */
async function searchDirectory(
  dirPath: string, 
  regex: RegExp, 
  results: string[], 
  maxResults: number
): Promise<void> {
  if (results.length >= maxResults) return
  
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
  
  for (const entry of entries) {
    if (results.length >= maxResults) break
    
    const fullPath = path.join(dirPath, entry.name)
    
    // Skip hidden files/directories and common non-code directories
    if (entry.name.startsWith('.') || 
        entry.name === 'node_modules' || 
        entry.name === 'dist' ||
        entry.name === 'build') {
      continue
    }
    
    if (entry.isDirectory()) {
      await searchDirectory(fullPath, regex, results, maxResults)
    } else if (entry.isFile()) {
      // Only search text-like files
      const ext = path.extname(entry.name).toLowerCase()
      const textExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.py', '.java', '.c', '.cpp', '.h', '.css', '.scss', '.html', '.xml', '.yaml', '.yml', '.toml', '.sh', '.bash', '.zsh']
      
      if (textExtensions.includes(ext) || !ext) {
        const matches = await searchFile(fullPath, regex, maxResults - results.length)
        results.push(...matches.map(m => `${fullPath}:${m}`))
      }
    }
  }
}

/**
 * Read file contents with optional line range
 * Output includes line numbers for easy reference
 */
async function executeReadFile(input: ReadFileInput): Promise<ToolResult> {
  const content = await fileService.readFile(input.path)
  const lines = content.split('\n')
  
  // Determine line range
  const startLine = input.start_line ? Math.max(1, input.start_line) : 1
  const endLine = input.end_line ? Math.min(lines.length, input.end_line) : lines.length
  
  // Extract requested lines (convert to 0-based index)
  const selectedLines = lines.slice(startLine - 1, endLine)
  
  // Add line numbers to output
  const numberedLines = selectedLines.map((line, index) => {
    const lineNum = startLine + index
    // Right-align line numbers for readability (up to 6 digits)
    const paddedNum = String(lineNum).padStart(6, ' ')
    return `${paddedNum}|${line}`
  })
  
  // Add header with file info
  const header = input.start_line || input.end_line
    ? `[${input.path}] Lines ${startLine}-${endLine} of ${lines.length}`
    : `[${input.path}] ${lines.length} lines`
  
  return { 
    success: true, 
    data: `${header}\n${numberedLines.join('\n')}`
  }
}

async function executeWriteFile(input: WriteFileInput): Promise<ToolResult> {
  await fileService.writeFile(input.path, input.content)
  return { success: true, data: `File written successfully: ${input.path}` }
}

async function executeListDirectory(input: ListDirectoryInput): Promise<ToolResult> {
  const files = await fileService.listDirectory(input.path)
  return { success: true, data: files }
}

async function executeDeleteFile(input: DeleteFileInput): Promise<ToolResult> {
  await fileService.deleteFile(input.path)
  return { success: true, data: `Deleted successfully: ${input.path}` }
}

async function executeCreateDirectory(input: CreateDirectoryInput): Promise<ToolResult> {
  await fileService.createDirectory(input.path)
  return { success: true, data: `Directory created: ${input.path}` }
}

async function executeGetFileInfo(input: FileInfoInput): Promise<ToolResult> {
  const info = await fileService.getFileInfo(input.path)
  return { success: true, data: info }
}
