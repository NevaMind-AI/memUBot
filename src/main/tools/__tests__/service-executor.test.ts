/**
 * Layer 2: Service executor mock tests
 * Tests for service management tools (create, list, start, stop, delete, info, dry-run)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock child_process (used for runtime check)
vi.mock('child_process', () => ({
  exec: vi.fn()
}))

vi.mock('util', async () => {
  const actual = await vi.importActual<typeof import('util')>('util')
  return {
    ...actual,
    promisify: vi.fn(() =>
      vi.fn().mockResolvedValue({ stdout: 'v20.18.2\n', stderr: '' })
    )
  }
})

// Mock service manager
vi.mock('../../services/back-service', () => ({
  serviceManager: {
    createService: vi.fn().mockResolvedValue({
      success: true,
      serviceId: 'svc-001',
      servicePath: '/mock/services/svc-001'
    }),
    listServices: vi.fn().mockResolvedValue([
      { id: 'svc-001', name: 'Stock Monitor', type: 'longRunning', runtime: 'node', status: 'running', description: 'Monitors stocks' },
      { id: 'svc-002', name: 'Weather Alert', type: 'scheduled', runtime: 'python', status: 'stopped', description: 'Weather checks' }
    ]),
    startService: vi.fn().mockResolvedValue({ success: true }),
    stopService: vi.fn().mockResolvedValue({ success: true }),
    deleteService: vi.fn().mockResolvedValue({ success: true }),
    getService: vi.fn().mockResolvedValue({
      id: 'svc-001',
      name: 'Stock Monitor',
      type: 'longRunning',
      runtime: 'node',
      status: 'running'
    }),
    dryRunService: vi.fn().mockResolvedValue({
      success: true,
      stdout: '[DRY_RUN_RESULT] All good',
      stderr: '',
      exitCode: 0,
      timedOut: false
    })
  }
}))

import { executeServiceTool } from '../service.executor'
import { serviceManager } from '../../services/back-service'

describe('Service executor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('service_list', () => {
    it('should list all services', async () => {
      const r = await executeServiceTool('service_list', {})
      expect(r.success).toBe(true)
      const data = r.data as { count: number; services: unknown[] }
      expect(data.count).toBe(2)
      expect(data.services).toHaveLength(2)
    })
  })

  describe('service_start', () => {
    it('should start a service with auto-start enabled', async () => {
      const r = await executeServiceTool('service_start', { serviceId: 'svc-001' })
      expect(r.success).toBe(true)
      expect(serviceManager.startService).toHaveBeenCalledWith('svc-001', { enableAutoStart: true })
    })

    it('should propagate start failure', async () => {
      vi.mocked(serviceManager.startService).mockResolvedValueOnce({
        success: false,
        error: 'Service not found'
      })
      const r = await executeServiceTool('service_start', { serviceId: 'bad-id' })
      expect(r.success).toBe(false)
      expect(r.error).toContain('Service not found')
    })
  })

  describe('service_stop', () => {
    it('should stop a service with auto-start disabled', async () => {
      const r = await executeServiceTool('service_stop', { serviceId: 'svc-001' })
      expect(r.success).toBe(true)
      expect(serviceManager.stopService).toHaveBeenCalledWith('svc-001', { disableAutoStart: true })
    })
  })

  describe('service_delete', () => {
    it('should delete a service', async () => {
      const r = await executeServiceTool('service_delete', { serviceId: 'svc-001' })
      expect(r.success).toBe(true)
      expect(serviceManager.deleteService).toHaveBeenCalledWith('svc-001')
    })
  })

  describe('service_get_info', () => {
    it('should return service info', async () => {
      const r = await executeServiceTool('service_get_info', { serviceId: 'svc-001' })
      expect(r.success).toBe(true)
      expect((r.data as any).name).toBe('Stock Monitor')
    })

    it('should return error when service not found', async () => {
      vi.mocked(serviceManager.getService).mockResolvedValueOnce(null)
      const r = await executeServiceTool('service_get_info', { serviceId: 'nonexistent' })
      expect(r.success).toBe(false)
      expect(r.error).toContain('Service not found')
    })
  })

  describe('service_dry_run', () => {
    it('should return structured report on success', async () => {
      const r = await executeServiceTool('service_dry_run', { serviceId: 'svc-001' })
      expect(r.success).toBe(true)
      const data = r.data as { exitCode: number; diagnosis: string }
      expect(data.exitCode).toBe(0)
      expect(data.diagnosis).toContain('OK')
    })

    it('should report timeout', async () => {
      vi.mocked(serviceManager.dryRunService).mockResolvedValueOnce({
        success: false,
        stdout: '',
        stderr: '',
        exitCode: null,
        timedOut: true
      })
      const r = await executeServiceTool('service_dry_run', { serviceId: 'svc-001' })
      expect(r.success).toBe(false)
      const data = r.data as { diagnosis: string }
      expect(data.diagnosis).toContain('TIMEOUT')
    })

    it('should report crash', async () => {
      vi.mocked(serviceManager.dryRunService).mockResolvedValueOnce({
        success: false,
        stdout: '',
        stderr: 'Error: connection refused',
        exitCode: 1,
        timedOut: false
      })
      const r = await executeServiceTool('service_dry_run', { serviceId: 'svc-001' })
      expect(r.success).toBe(false)
      const data = r.data as { diagnosis: string }
      expect(data.diagnosis).toContain('CRASH')
    })

    it('should report no output', async () => {
      vi.mocked(serviceManager.dryRunService).mockResolvedValueOnce({
        success: true,
        stdout: '   ',
        stderr: '',
        exitCode: 0,
        timedOut: false
      })
      const r = await executeServiceTool('service_dry_run', { serviceId: 'svc-001' })
      expect(r.success).toBe(true)
      const data = r.data as { diagnosis: string }
      expect(data.diagnosis).toContain('NO_OUTPUT')
    })
  })

  describe('unknown tool', () => {
    it('should return error for unknown service tool', async () => {
      const r = await executeServiceTool('service_restart', {})
      expect(r.success).toBe(false)
      expect(r.error).toContain('Unknown service tool')
    })
  })
})
