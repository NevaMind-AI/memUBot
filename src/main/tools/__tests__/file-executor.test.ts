/**
 * Layer 2: File executor mock integration tests
 * Tests file tool execution with mocked file system service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock file service
vi.mock('../../services/file.service', () => ({
  fileService: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    listDirectory: vi.fn(),
    deleteFile: vi.fn(),
    createDirectory: vi.fn(),
    getFileInfo: vi.fn()
  }
}))

// Mock fs module (used in grep)
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    promises: {
      ...actual.promises,
      stat: vi.fn(),
      readdir: vi.fn()
    },
    createReadStream: vi.fn()
  }
})

import { executeTool } from '../executor'
import { fileService } from '../../services/file.service'

describe('File executor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===== read_file =====
  describe('read_file', () => {
    it('should read file and add line numbers', async () => {
      vi.mocked(fileService.readFile).mockResolvedValue('line1\nline2\nline3')

      const result = await executeTool('read_file', { path: '/test/file.txt' })

      expect(result.success).toBe(true)
      expect(result.data).toContain('1|line1')
      expect(result.data).toContain('2|line2')
      expect(result.data).toContain('3|line3')
    })

    it('should read file with line range', async () => {
      vi.mocked(fileService.readFile).mockResolvedValue('a\nb\nc\nd\ne')

      const result = await executeTool('read_file', {
        path: '/test/file.txt',
        start_line: 2,
        end_line: 4
      })

      expect(result.success).toBe(true)
      expect(result.data).toContain('2|b')
      expect(result.data).toContain('3|c')
      expect(result.data).toContain('4|d')
      expect(result.data).not.toContain('1|a')
      expect(result.data).not.toContain('5|e')
    })

    it('should include header with file info', async () => {
      vi.mocked(fileService.readFile).mockResolvedValue('content')

      const result = await executeTool('read_file', { path: '/test/file.txt' })

      expect(result.success).toBe(true)
      expect(result.data).toContain('[/test/file.txt]')
    })

    it('should include line range in header when specified', async () => {
      vi.mocked(fileService.readFile).mockResolvedValue('a\nb\nc\nd\ne')

      const result = await executeTool('read_file', {
        path: '/test/file.txt',
        start_line: 2,
        end_line: 3
      })

      expect(result.success).toBe(true)
      expect(result.data).toContain('Lines 2-3')
    })

    it('should handle read error gracefully', async () => {
      vi.mocked(fileService.readFile).mockRejectedValue(new Error('ENOENT: no such file'))

      const result = await executeTool('read_file', { path: '/nonexistent' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('ENOENT')
    })

    it('should clamp start_line to minimum 1', async () => {
      vi.mocked(fileService.readFile).mockResolvedValue('a\nb\nc')

      const result = await executeTool('read_file', {
        path: '/test/file.txt',
        start_line: -5,
        end_line: 2
      })

      expect(result.success).toBe(true)
      // start_line is clamped to 1, so line 1 should be included
      expect(result.data).toContain('1|a')
    })
  })

  // ===== write_file =====
  describe('write_file', () => {
    it('should write file successfully', async () => {
      vi.mocked(fileService.writeFile).mockResolvedValue(undefined)

      const result = await executeTool('write_file', {
        path: '/test/out.txt',
        content: 'Hello, world!'
      })

      expect(result.success).toBe(true)
      expect(result.data).toContain('File written successfully')
      expect(fileService.writeFile).toHaveBeenCalledWith('/test/out.txt', 'Hello, world!')
    })

    it('should handle write error', async () => {
      vi.mocked(fileService.writeFile).mockRejectedValue(new Error('Permission denied'))

      const result = await executeTool('write_file', {
        path: '/root/file.txt',
        content: 'test'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Permission denied')
    })
  })

  // ===== list_directory =====
  describe('list_directory', () => {
    it('should list directory contents', async () => {
      vi.mocked(fileService.listDirectory).mockResolvedValue([
        'file1.ts',
        'file2.ts',
        'dir/'
      ] as unknown as string)

      const result = await executeTool('list_directory', { path: '/test' })

      expect(result.success).toBe(true)
      expect(result.data).toContain('file1.ts')
      expect(result.data).toContain('file2.ts')
    })

    it('should handle empty directory', async () => {
      vi.mocked(fileService.listDirectory).mockResolvedValue([] as unknown as string)

      const result = await executeTool('list_directory', { path: '/empty' })

      expect(result.success).toBe(true)
    })
  })

  // ===== delete_file =====
  describe('delete_file', () => {
    it('should delete file successfully', async () => {
      vi.mocked(fileService.deleteFile).mockResolvedValue(undefined)

      const result = await executeTool('delete_file', { path: '/test/old.txt' })

      expect(result.success).toBe(true)
      expect(result.data).toContain('Deleted successfully')
    })
  })

  // ===== create_directory =====
  describe('create_directory', () => {
    it('should create directory successfully', async () => {
      vi.mocked(fileService.createDirectory).mockResolvedValue(undefined)

      const result = await executeTool('create_directory', { path: '/test/new-dir' })

      expect(result.success).toBe(true)
      expect(result.data).toContain('Directory created')
    })
  })

  // ===== get_file_info =====
  describe('get_file_info', () => {
    it('should return file info', async () => {
      const mockInfo = {
        name: 'test.txt',
        size: 1024,
        isDirectory: false,
        modifiedAt: new Date('2026-01-01')
      }
      vi.mocked(fileService.getFileInfo).mockResolvedValue(mockInfo as never)

      const result = await executeTool('get_file_info', { path: '/test/test.txt' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockInfo)
    })
  })

  // ===== unknown tool =====
  describe('unknown tool', () => {
    it('should return error for unknown tool name', async () => {
      const result = await executeTool('nonexistent_tool', {})

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown tool')
    })
  })
})
