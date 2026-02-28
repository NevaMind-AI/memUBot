import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import type { FileInfo } from '../types'

/**
 * FileService handles all local file system operations
 */
export class FileService {
  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<string> {
    const absolutePath = path.resolve(filePath)
    const content = await fs.readFile(absolutePath, 'utf-8')
    return content
  }

  /**
   * Write content to file
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    const absolutePath = path.resolve(filePath)
    const dir = path.dirname(absolutePath)

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(absolutePath, content, 'utf-8')
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath: string): Promise<FileInfo[]> {
    const absolutePath = path.resolve(dirPath)
    const entries = await fs.readdir(absolutePath, { withFileTypes: true })

    const fileInfos: FileInfo[] = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(absolutePath, entry.name)
        const stats = await fs.stat(entryPath)

        return {
          name: entry.name,
          path: entryPath,
          isDirectory: entry.isDirectory(),
          size: stats.size,
          modifiedAt: stats.mtime,
          createdAt: stats.birthtime
        }
      })
    )

    return fileInfos
  }

  /**
   * Delete file or directory
   */
  async deleteFile(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath)
    const stats = await fs.stat(absolutePath)

    if (stats.isDirectory()) {
      await fs.rm(absolutePath, { recursive: true })
    } else {
      await fs.unlink(absolutePath)
    }
  }

  /**
   * Create directory
   */
  async createDirectory(dirPath: string): Promise<void> {
    const absolutePath = path.resolve(dirPath)
    await fs.mkdir(absolutePath, { recursive: true })
  }

  /**
   * Check if file or directory exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      const absolutePath = path.resolve(filePath)
      await fs.access(absolutePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get file or directory info
   */
  async getFileInfo(filePath: string): Promise<FileInfo> {
    // Expand ~ to home directory
    let expandedPath = filePath
    if (filePath.startsWith('~')) {
      expandedPath = filePath.replace(/^~/, process.env.HOME || '')
    }
    const absolutePath = path.resolve(expandedPath)
    const stats = await fs.stat(absolutePath)

    return {
      name: path.basename(absolutePath),
      path: absolutePath,
      isDirectory: stats.isDirectory(),
      size: stats.size,
      modifiedAt: stats.mtime,
      createdAt: stats.birthtime
    }
  }
}

// Export singleton instance
export const fileService = new FileService()
