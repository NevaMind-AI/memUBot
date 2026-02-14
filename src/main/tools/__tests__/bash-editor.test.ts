/**
 * Layer 2: Bash and TextEditor tool tests
 * Tests for executeBashTool and executeTextEditorTool from computer/common.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need mockExecAsync accessible to vi.mock, so use a hoisted variable
const mockExecAsync = vi.hoisted(() => vi.fn())
const mockReadFile = vi.hoisted(() => vi.fn())
const mockWriteFile = vi.hoisted(() => vi.fn())
const mockMkdir = vi.hoisted(() => vi.fn())

vi.mock('child_process', () => ({
  exec: vi.fn()
}))
vi.mock('util', async () => {
  const actual = await vi.importActual<typeof import('util')>('util')
  return {
    ...actual,
    promisify: vi.fn(() => mockExecAsync)
  }
})

// Mock fs/promises used by executeTextEditorTool
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  return {
    ...actual,
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    mkdir: mockMkdir
  }
})

// Mock screenshot-desktop (imported at module level)
vi.mock('screenshot-desktop', () => ({
  default: vi.fn()
}))

// Mock auth service
vi.mock('../../services/auth', () => ({
  getAuthService: vi.fn(() => ({
    getAuthState: () => ({ memuApiKey: 'test-key' })
  }))
}))

import { executeBashTool, executeTextEditorTool } from '../computer/common'

describe('executeBashTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should execute command and return stdout', async () => {
    mockExecAsync.mockResolvedValueOnce({
      stdout: Buffer.from('hello world\n'),
      stderr: Buffer.from('')
    })

    const r = await executeBashTool({ command: 'echo hello world' })
    expect(r.success).toBe(true)
    expect(r.data).toContain('hello world')
  })

  it('should include stderr in output when present', async () => {
    mockExecAsync.mockResolvedValueOnce({
      stdout: Buffer.from('output\n'),
      stderr: Buffer.from('warning: something\n')
    })

    const r = await executeBashTool({ command: 'some-command' })
    expect(r.success).toBe(true)
    expect(r.data).toContain('output')
    expect(r.data).toContain('STDERR')
    expect(r.data).toContain('warning: something')
  })

  it('should use default timeout of 30000ms', async () => {
    mockExecAsync.mockResolvedValueOnce({
      stdout: Buffer.from(''),
      stderr: Buffer.from('')
    })

    await executeBashTool({ command: 'ls' })

    expect(mockExecAsync).toHaveBeenCalledWith(
      'ls',
      expect.objectContaining({ timeout: 30000 })
    )
  })

  it('should use custom timeout when provided', async () => {
    mockExecAsync.mockResolvedValueOnce({
      stdout: Buffer.from(''),
      stderr: Buffer.from('')
    })

    await executeBashTool({ command: 'ls', timeout: 5000 })

    expect(mockExecAsync).toHaveBeenCalledWith(
      'ls',
      expect.objectContaining({ timeout: 5000 })
    )
  })

  it('should handle command failure with stderr', async () => {
    const err = new Error('Command failed') as any
    err.stdout = Buffer.from('')
    err.stderr = Buffer.from('bash: unknown-cmd: command not found\n')
    mockExecAsync.mockRejectedValueOnce(err)

    const r = await executeBashTool({ command: 'unknown-cmd' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('command not found')
  })

  it('should handle command failure without stdout/stderr', async () => {
    mockExecAsync.mockRejectedValueOnce(new Error('ETIMEOUT'))

    const r = await executeBashTool({ command: 'sleep 999' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('ETIMEOUT')
  })

  it('should handle string output (non-buffer)', async () => {
    mockExecAsync.mockResolvedValueOnce({
      stdout: 'string output',
      stderr: ''
    })

    const r = await executeBashTool({ command: 'echo test' })
    expect(r.success).toBe(true)
    expect(r.data).toContain('string output')
  })
})

describe('executeTextEditorTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('view command', () => {
    it('should view file with line numbers', async () => {
      mockReadFile.mockResolvedValueOnce('line1\nline2\nline3')

      const r = await executeTextEditorTool({ command: 'view', path: '/test/file.txt' })
      expect(r.success).toBe(true)
      expect(r.data).toContain('1: line1')
      expect(r.data).toContain('2: line2')
      expect(r.data).toContain('3: line3')
    })

    it('should view file with line range', async () => {
      mockReadFile.mockResolvedValueOnce('a\nb\nc\nd\ne')

      const r = await executeTextEditorTool({
        command: 'view',
        path: '/test/file.txt',
        view_range: [2, 4]
      })
      expect(r.success).toBe(true)
      expect(r.data).toContain('2: b')
      expect(r.data).toContain('3: c')
      expect(r.data).toContain('4: d')
      expect(r.data).not.toContain('1: a')
    })

    it('should handle file not found', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT: no such file'))

      const r = await executeTextEditorTool({ command: 'view', path: '/nonexistent' })
      expect(r.success).toBe(false)
      expect(r.error).toContain('ENOENT')
    })
  })

  describe('create command', () => {
    it('should create file with content', async () => {
      mockMkdir.mockResolvedValueOnce(undefined)
      mockWriteFile.mockResolvedValueOnce(undefined)

      const r = await executeTextEditorTool({
        command: 'create',
        path: '/test/new.txt',
        file_text: 'new content'
      })
      expect(r.success).toBe(true)
      expect(r.data).toContain('File created')
    })

    it('should fail without file_text', async () => {
      const r = await executeTextEditorTool({ command: 'create', path: '/test/new.txt' })
      expect(r.success).toBe(false)
      expect(r.error).toContain('file_text is required')
    })
  })

  describe('str_replace command', () => {
    it('should replace string in file', async () => {
      mockReadFile.mockResolvedValueOnce('old text here')
      mockWriteFile.mockResolvedValueOnce(undefined)

      const r = await executeTextEditorTool({
        command: 'str_replace',
        path: '/test/file.txt',
        old_str: 'old text',
        new_str: 'new text'
      })
      expect(r.success).toBe(true)
      expect(r.data).toContain('replaced successfully')
    })

    it('should fail when old_str not found', async () => {
      mockReadFile.mockResolvedValueOnce('some content')

      const r = await executeTextEditorTool({
        command: 'str_replace',
        path: '/test/file.txt',
        old_str: 'nonexistent',
        new_str: 'replacement'
      })
      expect(r.success).toBe(false)
      expect(r.error).toContain('old_str not found')
    })

    it('should fail when old_str or new_str missing', async () => {
      const r = await executeTextEditorTool({
        command: 'str_replace',
        path: '/test/file.txt'
      })
      expect(r.success).toBe(false)
      expect(r.error).toContain('old_str and new_str are required')
    })
  })

  describe('insert command', () => {
    it('should insert text at specified line', async () => {
      mockReadFile.mockResolvedValueOnce('line1\nline2\nline3')
      mockWriteFile.mockResolvedValueOnce(undefined)

      const r = await executeTextEditorTool({
        command: 'insert',
        path: '/test/file.txt',
        insert_line: 2,
        new_str: 'inserted line'
      })
      expect(r.success).toBe(true)
      expect(r.data).toContain('inserted at line 2')

      // Verify the written content
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/file.txt',
        'line1\ninserted line\nline2\nline3',
        'utf-8'
      )
    })

    it('should fail without insert_line', async () => {
      const r = await executeTextEditorTool({
        command: 'insert',
        path: '/test/file.txt',
        new_str: 'text'
      })
      expect(r.success).toBe(false)
      expect(r.error).toContain('insert_line and new_str are required')
    })
  })

  describe('unknown command', () => {
    it('should return error', async () => {
      const r = await executeTextEditorTool({ command: 'delete_lines', path: '/test/file.txt' })
      expect(r.success).toBe(false)
      expect(r.error).toContain('Unknown command')
    })
  })
})
