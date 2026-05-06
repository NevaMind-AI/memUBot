import { beforeEach, describe, expect, it, vi } from 'vitest'

const { loadSettingsMock } = vi.hoisted(() => ({
  loadSettingsMock: vi.fn()
}))

vi.mock('../../config/settings.config', () => ({
  loadSettings: loadSettingsMock
}))

import { executeMemuMemory } from '../memu.executor'

describe('executeMemuMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns an error when remote memU config is incomplete', async () => {
    loadSettingsMock.mockResolvedValue({
      memuBaseUrl: '',
      memuApiKey: 'token-only',
      memuUserId: '',
      memuAgentId: ''
    })

    const result = await executeMemuMemory('trip plans')

    expect(result).toEqual({
      success: false,
      error: 'memU is not fully configured'
    })
  })

  it('returns the remote error when retrieve returns a non-OK response', async () => {
    loadSettingsMock.mockResolvedValue({
      memuBaseUrl: 'https://memu.example',
      memuApiKey: 'token',
      memuUserId: 'user-1',
      memuAgentId: 'agent-1'
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ message: 'service unavailable' })
    }))

    const result = await executeMemuMemory('roadmap')

    expect(result).toEqual({
      success: false,
      error: 'service unavailable'
    })
  })
})
