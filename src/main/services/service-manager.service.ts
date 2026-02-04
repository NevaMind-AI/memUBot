import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import { appEvents } from '../events'

/**
 * Service Manager Service
 * Manages user-created services (Python/JS) that run alongside the application
 */

/**
 * Service type
 */
export type ServiceType = 'longRunning' | 'scheduled'

/**
 * Service runtime
 */
export type ServiceRuntime = 'node' | 'python'

/**
 * Service status
 */
export type ServiceStatus = 'stopped' | 'running' | 'error'

/**
 * Service metadata stored in service.json
 */
export interface ServiceMetadata {
  id: string
  name: string
  description: string
  type: ServiceType
  runtime: ServiceRuntime
  entryFile: string           // e.g., 'index.js' or 'main.py'
  schedule?: string           // cron expression for scheduled services
  createdAt: string
  enabled?: boolean           // Whether service should auto-start (default: true)
  context: {                  // Original user request context
    userRequest: string
    expectation: string
    notifyPlatform?: string
  }
}

/**
 * Service info with runtime status
 */
export interface ServiceInfo extends ServiceMetadata {
  status: ServiceStatus
  pid?: number
  error?: string
  lastStarted?: string
  lastStopped?: string
}

/**
 * Running service process
 */
interface RunningService {
  process: ChildProcess
  metadata: ServiceMetadata
  startedAt: string
}

/**
 * Service Manager class
 */
class ServiceManagerService {
  private servicesDir: string
  private runningServices: Map<string, RunningService> = new Map()
  private initialized = false

  constructor() {
    this.servicesDir = path.join(app.getPath('userData'), 'workspace', 'services')
  }

  /**
   * Get the services directory path
   */
  getServicesDir(): string {
    return this.servicesDir
  }

  /**
   * Initialize the service manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Ensure services directory exists
    await fs.mkdir(this.servicesDir, { recursive: true })
    this.initialized = true
    console.log('[ServiceManager] Initialized, services dir:', this.servicesDir)

    // Clean up invalid service directories (no service.json)
    await this.cleanupInvalidServices()
  }

  /**
   * Clean up invalid service directories (missing service.json)
   */
  private async cleanupInvalidServices(): Promise<void> {
    try {
      const entries = await fs.readdir(this.servicesDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const serviceDir = path.join(this.servicesDir, entry.name)
        const metadataPath = path.join(serviceDir, 'service.json')

        try {
          await fs.access(metadataPath)
          // service.json exists, valid service
        } catch {
          // service.json doesn't exist, invalid directory - clean up
          console.log(`[ServiceManager] Cleaning up invalid service directory: ${entry.name}`)
          try {
            await fs.rm(serviceDir, { recursive: true, force: true })
            console.log(`[ServiceManager] Removed invalid directory: ${entry.name}`)
          } catch (rmError) {
            console.error(`[ServiceManager] Failed to remove invalid directory ${entry.name}:`, rmError)
          }
        }
      }
    } catch (error) {
      console.error('[ServiceManager] Error during cleanup:', error)
    }
  }

  /**
   * List all services
   */
  async listServices(): Promise<ServiceInfo[]> {
    await this.initialize()

    const services: ServiceInfo[] = []

    try {
      const entries = await fs.readdir(this.servicesDir, { withFileTypes: true })
      console.log(`[ServiceManager] listServices: found ${entries.length} entries in ${this.servicesDir}`)

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const serviceDir = path.join(this.servicesDir, entry.name)
        const metadataPath = path.join(serviceDir, 'service.json')

        try {
          const content = await fs.readFile(metadataPath, 'utf-8')
          const metadata = JSON.parse(content) as ServiceMetadata

          const running = this.runningServices.get(metadata.id)
          const status: ServiceStatus = running ? 'running' : 'stopped'

          const serviceInfo = {
            ...metadata,
            status,
            pid: running?.process.pid,
            lastStarted: running?.startedAt
          }
          console.log(`[ServiceManager] listServices: loaded service "${metadata.name}" (${metadata.id}), status: ${status}`)
          services.push(serviceInfo)
        } catch (readError) {
          console.error(`[ServiceManager] listServices: failed to read ${metadataPath}:`, readError)
          // Invalid service directory, skip
        }
      }
    } catch (error) {
      console.error('[ServiceManager] Failed to list services:', error)
    }

    console.log(`[ServiceManager] listServices: returning ${services.length} services`)
    return services
  }

  /**
   * Get a specific service
   */
  async getService(serviceId: string): Promise<ServiceInfo | null> {
    await this.initialize()

    const serviceDir = path.join(this.servicesDir, serviceId)
    const metadataPath = path.join(serviceDir, 'service.json')

    try {
      const content = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(content) as ServiceMetadata

      const running = this.runningServices.get(serviceId)
      const status: ServiceStatus = running ? 'running' : 'stopped'

      return {
        ...metadata,
        status,
        pid: running?.process.pid,
        lastStarted: running?.startedAt
      }
    } catch {
      return null
    }
  }

  /**
   * Update service enabled state in service.json
   */
  private async updateServiceEnabled(serviceId: string, enabled: boolean): Promise<void> {
    const serviceDir = path.join(this.servicesDir, serviceId)
    const metadataPath = path.join(serviceDir, 'service.json')

    try {
      const content = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(content) as ServiceMetadata
      metadata.enabled = enabled
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
      console.log(`[ServiceManager] Updated service ${serviceId} enabled=${enabled}`)
    } catch (error) {
      console.error(`[ServiceManager] Failed to update enabled state for ${serviceId}:`, error)
    }
  }

  /**
   * Create a new service directory with metadata
   * Returns the service directory path
   */
  async createService(metadata: Omit<ServiceMetadata, 'id' | 'createdAt'>): Promise<{
    success: boolean
    serviceId?: string
    servicePath?: string
    error?: string
  }> {
    await this.initialize()

    // Generate service ID: name_timestamp
    const timestamp = Date.now()
    // Support unicode characters (Chinese, Japanese, etc.) in service names
    // Only remove path-unsafe characters
    const safeName = metadata.name
      .toLowerCase()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove path-unsafe characters
      .replace(/\s+/g, '-')                   // Replace spaces with hyphens
      .replace(/^-+|-+$/g, '')                // Trim leading/trailing hyphens
      || 'service'                            // Fallback if empty
    const serviceId = `${safeName}_${timestamp}`
    const serviceDir = path.join(this.servicesDir, serviceId)

    try {
      // Create service directory
      await fs.mkdir(serviceDir, { recursive: true })

      // Create metadata file
      const fullMetadata: ServiceMetadata = {
        ...metadata,
        id: serviceId,
        createdAt: new Date().toISOString()
      }

      await fs.writeFile(
        path.join(serviceDir, 'service.json'),
        JSON.stringify(fullMetadata, null, 2)
      )

      console.log(`[ServiceManager] Created service: ${serviceId}`)

      // Notify UI that service list changed
      appEvents.emitServiceListChanged()

      return {
        success: true,
        serviceId,
        servicePath: serviceDir
      }
    } catch (error) {
      console.error('[ServiceManager] Failed to create service:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Start a service
   * @param serviceId - The service to start
   * @param options.enableAutoStart - If true, mark service as enabled for auto-start (default: false)
   */
  async startService(
    serviceId: string,
    options?: { enableAutoStart?: boolean }
  ): Promise<{ success: boolean; error?: string }> {
    await this.initialize()

    // Check if already running
    if (this.runningServices.has(serviceId)) {
      return { success: false, error: 'Service is already running' }
    }

    // Get service metadata
    const service = await this.getService(serviceId)
    if (!service) {
      return { success: false, error: `Service '${serviceId}' not found. Use service_list to get correct service IDs.` }
    }

    const serviceDir = path.join(this.servicesDir, serviceId)
    const entryPath = path.join(serviceDir, service.entryFile)

    // Check entry file exists
    try {
      await fs.access(entryPath)
    } catch {
      return { success: false, error: `Entry file not found: ${service.entryFile}` }
    }

    try {
      // All services are started as persistent processes
      // The service code itself handles timing/scheduling logic via setInterval
      const result = await this.startServiceProcess(serviceId, service, serviceDir, entryPath)

      // If user manually started, enable auto-start
      if (result.success && options?.enableAutoStart) {
        await this.updateServiceEnabled(serviceId, true)
      }

      return result
    } catch (error) {
      console.error(`[ServiceManager] Failed to start service ${serviceId}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Start a service process
   * All services run as persistent processes - timing logic is in the service code
   */
  private async startServiceProcess(
    serviceId: string,
    metadata: ServiceMetadata,
    serviceDir: string,
    entryPath: string
  ): Promise<{ success: boolean; error?: string }> {
    const command = metadata.runtime === 'node' ? 'node' : 'python3'

    // Quote the entry path to handle spaces in paths (e.g., "Application Support" on macOS)
    const quotedEntryPath = `"${entryPath}"`

    return new Promise((resolve) => {
      const childProcess = spawn(command, [quotedEntryPath], {
        cwd: serviceDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        shell: true, // Use shell to find command in PATH (especially important on Windows)
        env: {
          ...process.env,
          MEMU_SERVICE_ID: serviceId,
          MEMU_API_URL: 'http://127.0.0.1:31415'
        }
      })

      // Handle spawn error (e.g., command not found)
      childProcess.on('error', (error) => {
        console.error(`[ServiceManager] Failed to start service ${serviceId}:`, error.message)
        this.runningServices.delete(serviceId)
        appEvents.emitServiceStatusChanged(serviceId, 'stopped')
        
        if (error.message.includes('ENOENT')) {
          resolve({
            success: false,
            error: `Runtime '${command}' not found. Please ensure ${metadata.runtime === 'node' ? 'Node.js' : 'Python 3'} is installed and available in your system PATH.`
          })
        } else {
          resolve({ success: false, error: error.message })
        }
      })

      // Store running service
      this.runningServices.set(serviceId, {
        process: childProcess,
        metadata,
        startedAt: new Date().toISOString()
      })

      // Handle process exit
      childProcess.on('exit', async (code, signal) => {
        console.log(`[ServiceManager] Service ${serviceId} exited with code ${code}, signal ${signal}`)
        this.runningServices.delete(serviceId)
        appEvents.emitServiceStatusChanged(serviceId, 'stopped')

        // If service exited on its own (code 0, no signal), it completed its task
        // Mark as disabled to prevent auto-restart on next app launch
        if (code === 0 && !signal) {
          console.log(`[ServiceManager] Service ${serviceId} completed normally, disabling auto-start`)
          await this.updateServiceEnabled(serviceId, false)
        }
        // If killed by signal (SIGTERM/SIGKILL), the caller (stopService) handles enabled state
        // If crashed (code !== 0), keep enabled so it can be manually restarted or debugged
      })

      // Log stdout/stderr
      childProcess.stdout?.on('data', (data) => {
        console.log(`[Service:${serviceId}] ${data.toString().trim()}`)
      })
      childProcess.stderr?.on('data', (data) => {
        console.error(`[Service:${serviceId}] ERROR: ${data.toString().trim()}`)
      })

      // Give the process a moment to potentially error out, then consider it started
      setTimeout(() => {
        if (this.runningServices.has(serviceId)) {
          console.log(`[ServiceManager] Started service: ${serviceId}, PID: ${childProcess.pid}`)
          appEvents.emitServiceStatusChanged(serviceId, 'running')
          resolve({ success: true })
        }
      }, 100)
    })
  }

  /**
   * Stop a service and wait for it to fully exit
   * @param serviceId - The service to stop
   * @param options.disableAutoStart - If true, mark service as disabled to prevent auto-start (default: false)
   */
  async stopService(
    serviceId: string,
    options?: { disableAutoStart?: boolean }
  ): Promise<{ success: boolean; error?: string }> {
    const running = this.runningServices.get(serviceId)
    if (!running) {
      return { success: false, error: `Service '${serviceId}' is not running or does not exist. Use service_list to check current services.` }
    }

    try {
      const process = running.process

      // Create a promise that resolves when the process exits
      const exitPromise = new Promise<void>((resolve) => {
        if (!process.pid || process.exitCode !== null) {
          // Process already exited
          resolve()
          return
        }
        process.once('exit', () => resolve())
      })

      // Send SIGTERM first (graceful shutdown)
      if (process.pid && process.exitCode === null) {
        console.log(`[ServiceManager] Sending SIGTERM to service ${serviceId} (PID: ${process.pid})`)
        process.kill('SIGTERM')
      }

      // Wait for process to exit with timeout
      const timeoutMs = 5000
      const timeoutPromise = new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), timeoutMs)
      )

      const result = await Promise.race([exitPromise, timeoutPromise])

      // If timeout, force kill with SIGKILL
      if (result === 'timeout' && process.pid && process.exitCode === null) {
        console.log(`[ServiceManager] Service ${serviceId} didn't exit gracefully, sending SIGKILL`)
        process.kill('SIGKILL')
        // Wait a bit more for SIGKILL to take effect
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      this.runningServices.delete(serviceId)
      console.log(`[ServiceManager] Stopped service: ${serviceId}`)
      appEvents.emitServiceStatusChanged(serviceId, 'stopped')

      // If user manually stopped, disable auto-start
      if (options?.disableAutoStart) {
        await this.updateServiceEnabled(serviceId, false)
      }

      return { success: true }
    } catch (error) {
      console.error(`[ServiceManager] Failed to stop service ${serviceId}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Delete a service
   */
  async deleteService(serviceId: string): Promise<{ success: boolean; error?: string }> {
    // Stop if running and wait for it to fully exit
    if (this.runningServices.has(serviceId)) {
      const stopResult = await this.stopService(serviceId)
      if (!stopResult.success) {
        console.warn(`[ServiceManager] Failed to stop service before delete: ${stopResult.error}`)
      }
      // Extra wait to ensure file handles are released
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    const serviceDir = path.join(this.servicesDir, serviceId)

    try {
      // Check if directory exists before trying to delete
      await fs.access(serviceDir)
      await fs.rm(serviceDir, { recursive: true, force: true })
      console.log(`[ServiceManager] Deleted service: ${serviceId}`)

      // Notify UI that service list changed
      appEvents.emitServiceListChanged()

      return { success: true }
    } catch (error) {
      // If directory doesn't exist, return error so LLM knows the ID is wrong
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`[ServiceManager] Service not found: ${serviceId}`)
        return {
          success: false,
          error: `Service '${serviceId}' not found. Use service_list to get correct service IDs.`
        }
      }

      console.error(`[ServiceManager] Failed to delete service ${serviceId}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Start all enabled services (called on app startup)
   * Only starts services that have enabled !== false
   */
  async startAllServices(): Promise<void> {
    await this.initialize()

    const services = await this.listServices()
    console.log(`[ServiceManager] Found ${services.length} services`)

    for (const service of services) {
      // Skip disabled services (enabled defaults to true if not set)
      if (service.enabled === false) {
        console.log(`[ServiceManager] Skipping disabled service: ${service.id}`)
        continue
      }

      if (service.status === 'stopped') {
        console.log(`[ServiceManager] Auto-starting service: ${service.id}`)
        await this.startService(service.id)
      }
    }
  }

  /**
   * Stop all services (called on app shutdown)
   */
  async stopAllServices(): Promise<void> {
    console.log(`[ServiceManager] Stopping all services...`)

    const serviceIds = Array.from(this.runningServices.keys())
    for (const serviceId of serviceIds) {
      await this.stopService(serviceId)
    }

    console.log(`[ServiceManager] All services stopped`)
  }

  /**
   * Get running services count
   */
  getRunningCount(): number {
    return this.runningServices.size
  }
}

// Export singleton instance
export const serviceManagerService = new ServiceManagerService()
