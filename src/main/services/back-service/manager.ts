/**
 * Service Manager
 *
 * Orchestrates service lifecycle: create, list, get, delete, start, stop, dry-run.
 * Delegates process management to runner.ts and logging to logger.ts.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import { appEvents } from '../../events'
import * as runner from './runner'
import * as serviceLogger from './logger'
import { generateInvokeLib } from './invoke-lib'
import type { ServiceMetadata, ServiceInfo, ServiceStatus } from './types'

// ============================================
// Service Manager
// ============================================

class ServiceManager {
  private servicesDir: string
  private initialized = false

  constructor() {
    this.servicesDir = path.join(app.getPath('userData'), 'workspace', 'services')

    // Wire up the "completed" callback so runner can update enabled state
    runner.setOnServiceCompleted(async (serviceId) => {
      await this.updateServiceEnabled(serviceId, false)
    })
  }

  /** Get the services directory path */
  getServicesDir(): string {
    return this.servicesDir
  }

  /** Initialize the service manager */
  async initialize(): Promise<void> {
    if (this.initialized) return
    await fs.mkdir(this.servicesDir, { recursive: true })
    this.initialized = true
    console.log('[ServiceManager] Initialized, services dir:', this.servicesDir)
    await this.cleanupInvalidServices()
  }

  // ============================================
  // CRUD Operations
  // ============================================

  /** List all services with runtime status */
  async listServices(): Promise<ServiceInfo[]> {
    await this.initialize()
    const services: ServiceInfo[] = []

    try {
      const entries = await fs.readdir(this.servicesDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const serviceDir = path.join(this.servicesDir, entry.name)
        const metadataPath = path.join(serviceDir, 'service.json')

        try {
          const content = await fs.readFile(metadataPath, 'utf-8')
          const metadata = JSON.parse(content) as ServiceMetadata
          const running = runner.getRunning(metadata.id)
          const status: ServiceStatus = running ? 'running' : 'stopped'

          services.push({
            ...metadata,
            status,
            pid: running?.process.pid,
            lastStarted: running?.startedAt,
            health: running?.health
          })
        } catch {
          // Invalid directory, skip
        }
      }
    } catch (error) {
      console.error('[ServiceManager] Failed to list services:', error)
    }

    return services
  }

  /** Get a specific service by ID */
  async getService(serviceId: string): Promise<ServiceInfo | null> {
    await this.initialize()
    const metadataPath = path.join(this.servicesDir, serviceId, 'service.json')

    try {
      const content = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(content) as ServiceMetadata
      const running = runner.getRunning(serviceId)
      const status: ServiceStatus = running ? 'running' : 'stopped'

      return {
        ...metadata,
        status,
        pid: running?.process.pid,
        lastStarted: running?.startedAt,
        health: running?.health
      }
    } catch {
      return null
    }
  }

  /** Create a new service directory with metadata and invoke helper */
  async createService(
    metadata: Omit<ServiceMetadata, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; serviceId?: string; servicePath?: string; error?: string }> {
    await this.initialize()

    const timestamp = Date.now()
    const safeName =
      metadata.name
        .toLowerCase()
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '') || 'service'
    const serviceId = `${safeName}_${timestamp}`
    const serviceDir = path.join(this.servicesDir, serviceId)

    try {
      await fs.mkdir(serviceDir, { recursive: true })

      const fullMetadata: ServiceMetadata = {
        ...metadata,
        id: serviceId,
        createdAt: new Date().toISOString()
      }

      await fs.writeFile(path.join(serviceDir, 'service.json'), JSON.stringify(fullMetadata, null, 2))

      // Generate invoke helper library (#11)
      await generateInvokeLib(serviceDir, metadata.runtime)

      console.log(`[ServiceManager] Created service: ${serviceId}`)
      appEvents.emitServiceListChanged()

      return { success: true, serviceId, servicePath: serviceDir }
    } catch (error) {
      console.error('[ServiceManager] Failed to create service:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** Delete a service (stops it first if running) */
  async deleteService(serviceId: string): Promise<{ success: boolean; error?: string }> {
    // Stop if running
    if (runner.isRunning(serviceId)) {
      const stopResult = await runner.stopProcess(serviceId)
      if (!stopResult.success) {
        console.warn(`[ServiceManager] Failed to stop before delete: ${stopResult.error}`)
      }
      await new Promise((r) => setTimeout(r, 500))
    }

    const serviceDir = path.join(this.servicesDir, serviceId)

    try {
      await fs.access(serviceDir)
      await fs.rm(serviceDir, { recursive: true, force: true })
      console.log(`[ServiceManager] Deleted service: ${serviceId}`)
      appEvents.emitServiceListChanged()
      return { success: true }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { success: false, error: `Service '${serviceId}' not found.` }
      }
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // ============================================
  // Lifecycle Operations
  // ============================================

  /** Start a service */
  async startService(
    serviceId: string,
    options?: { enableAutoStart?: boolean }
  ): Promise<{ success: boolean; error?: string }> {
    await this.initialize()

    const service = await this.getService(serviceId)
    if (!service) {
      return { success: false, error: `Service '${serviceId}' not found.` }
    }

    // Check entry file exists
    const entryPath = path.join(this.servicesDir, serviceId, service.entryFile)
    try {
      await fs.access(entryPath)
    } catch {
      return { success: false, error: `Entry file not found: ${service.entryFile}` }
    }

    const result = await runner.startProcess(serviceId, service, this.servicesDir)

    if (result.success && options?.enableAutoStart) {
      await this.updateServiceEnabled(serviceId, true)
    }

    return result
  }

  /** Stop a service */
  async stopService(
    serviceId: string,
    options?: { disableAutoStart?: boolean }
  ): Promise<{ success: boolean; error?: string }> {
    const result = await runner.stopProcess(serviceId)

    if (result.success && options?.disableAutoStart) {
      await this.updateServiceEnabled(serviceId, false)
    }

    return result
  }

  /** Dry-run a service */
  async dryRunService(serviceId: string, timeoutMs?: number): Promise<{
    success: boolean
    stdout: string
    stderr: string
    exitCode: number | null
    timedOut: boolean
    error?: string
  }> {
    await this.initialize()

    const service = await this.getService(serviceId)
    if (!service) {
      return {
        success: false, stdout: '', stderr: '', exitCode: null, timedOut: false,
        error: `Service '${serviceId}' not found.`
      }
    }

    const entryPath = path.join(this.servicesDir, serviceId, service.entryFile)
    try {
      await fs.access(entryPath)
    } catch {
      return {
        success: false, stdout: '', stderr: '', exitCode: null, timedOut: false,
        error: `Entry file not found: ${service.entryFile}`
      }
    }

    return runner.dryRun(serviceId, service, this.servicesDir, timeoutMs)
  }

  /** Start all enabled services (app startup) */
  async startAllServices(): Promise<void> {
    await this.initialize()
    const services = await this.listServices()
    console.log(`[ServiceManager] Found ${services.length} services`)

    for (const service of services) {
      if (service.enabled === false) {
        console.log(`[ServiceManager] Skipping disabled: ${service.id}`)
        continue
      }
      if (service.status === 'stopped') {
        console.log(`[ServiceManager] Auto-starting: ${service.id}`)
        await this.startService(service.id)
      }
    }
  }

  /** Stop all services (app shutdown) */
  async stopAllServices(): Promise<void> {
    await runner.stopAll()
  }

  /** Get running services count */
  getRunningCount(): number {
    return runner.getRunningCount()
  }

  /** Get service logs */
  async getServiceLogs(serviceId: string, maxLines = 100): Promise<string> {
    const serviceDir = path.join(this.servicesDir, serviceId)
    return serviceLogger.readLogs(serviceDir, maxLines)
  }

  // ============================================
  // Internal Helpers
  // ============================================

  /** Update service enabled state in service.json */
  async updateServiceEnabled(serviceId: string, enabled: boolean): Promise<void> {
    const metadataPath = path.join(this.servicesDir, serviceId, 'service.json')
    try {
      const content = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(content) as ServiceMetadata
      metadata.enabled = enabled
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
    } catch (error) {
      console.error(`[ServiceManager] Failed to update enabled for ${serviceId}:`, error)
    }
  }

  /** Clean up directories without service.json */
  private async cleanupInvalidServices(): Promise<void> {
    try {
      const entries = await fs.readdir(this.servicesDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const serviceDir = path.join(this.servicesDir, entry.name)
        const metadataPath = path.join(serviceDir, 'service.json')
        try {
          await fs.access(metadataPath)
        } catch {
          console.log(`[ServiceManager] Cleaning up invalid directory: ${entry.name}`)
          try {
            await fs.rm(serviceDir, { recursive: true, force: true })
          } catch (rmErr) {
            console.error(`[ServiceManager] Failed to remove ${entry.name}:`, rmErr)
          }
        }
      }
    } catch (error) {
      console.error('[ServiceManager] Cleanup error:', error)
    }
  }
}

/** Singleton instance */
export const serviceManager = new ServiceManager()
