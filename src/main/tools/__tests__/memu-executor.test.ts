/**
 * Layer 2: Memu executor mock integration tests
 * Tests memory retrieval with mocked API calls
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock settings config
vi.mock('../../config/settings.config', () => ({
  loadSettings: vi.fn().mockResolvedValue({
    memuBaseUrl: 'https://api.test.memu.so',
    memuApiKey: 'test-api-key',
    memuUserId: 'test-user-id',
    memuAgentId: 'test-agent-id',
    memuYumiUserId: 'yumi-user-id',
    memuYumiAgentId: 'yumi-agent-id'
  })
}))

// Mock auth service
vi.mock('../../services/auth', () => ({
  getAuthService: vi.fn(() => ({
    getAuthState: () => ({
      memuApiKey: 'yumi-api-key'
    })
  }))
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { executeMemuMemory, executeMemuTool } from '../memu.executor'

describe('Memu executor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('executeMemuMemory', () => {
    it('should call the memory retrieve API with correct parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            memories: [{ text: 'User likes coffee', relevance: 0.95 }]
          })
      })

      const result = await executeMemuMemory('coffee preferences')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.memu.so/api/v3/memory/retrieve',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('"query":"coffee preferences"')
        })
      )
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        memories: [{ text: 'User likes coffee', relevance: 0.95 }]
      })
    })

    it('should include user_id and agent_id in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ memories: [] })
      })

      await executeMemuMemory('test query')

      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.user_id).toBe('test-user-id')
      expect(body.agent_id).toBe('test-agent-id')
      expect(body.query).toBe('test query')
    })

    it('should handle API error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

      const result = await executeMemuMemory('test query')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network timeout')
    })

    it('should handle non-Error exceptions', async () => {
      mockFetch.mockRejectedValueOnce('string error')

      const result = await executeMemuMemory('test query')

      expect(result.success).toBe(false)
      expect(result.error).toBe('string error')
    })
  })

  describe('executeMemuTool', () => {
    it('should route memu_memory correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ memories: [] })
      })

      const result = await executeMemuTool('memu_memory', { query: 'test' })

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should return error for unknown tool name', async () => {
      const result = await executeMemuTool('memu_unknown', { query: 'test' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown Memu tool')
    })
  })
})
