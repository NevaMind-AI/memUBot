/**
 * Service Process Runner
 *
 * Handles process spawning, crash recovery with exponential backoff,
 * startup health checks, and health metric tracking.
 */

import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import { appEvents } from '../../events'
import * as serviceLogger from './logger'
import {
  MAX_RESTART_ATTEMPTS,
  RESTART_WINDOW_MS,
  RESTART_BACKOFF_MS,
  STARTUP_HEALTH_CHECK_MS,
  GRACEFUL_SHUTDOWN_MS,
  DRY_RUN_TIMEOUT_MS
} from './constants'
import type {
  ServiceMetadata,
  ServiceStatus,
  ServiceHealthMetrics,
  DryRunResult
} from './types'

// ============================================
// Running Service State
// ============================================

export interface RunningService {
  process: ChildProcess
  metadata: ServiceMetadata
  startedAt: string
  serviceDir: string
  health: ServiceHealthMetrics
  /** Crash recovery tracking */
  crashHistory: number[] // timestamps of recent crashes
}

/** Map of serviceId -> running service */
const runningServices = new Map<string, RunningService>()

// Callback for updating enabled state (injected by manager)
let onServiceCompleted: ((serviceId: string) => Promise<void>) | null = null

export function setOnServiceCompleted(cb: (serviceId: string) => Promise<void>): void {
  onServiceCompleted = cb
}

// ============================================
// Public API
// ============================================

export function isRunning(serviceId: string): boolean {
  return runningServices.has(serviceId)
}

export function getRunning(serviceId: string): RunningService | undefined {
  return runningServices.get(serviceId)
}

export function getRunningCount(): number {
  return runningServices.size
}

export function getAllRunningIds(): string[] {
  return Array.from(runningServices.keys())
}

/**
 * Start a service process with startup health check.
 *
 * Waits for the process to either:
 * - Produce first stdout output (healthy start)
 * - Survive for STARTUP_HEALTH_CHECK_MS without crashing
 * - Crash immediately (returns error)
 */
export async function startProcess(
  serviceId: string,
  metadata: ServiceMetadata,
  servicesDir: string
): Promise<{ success: boolean; error?: string }> {
  if (runningServices.has(serviceId)) {
    return { success: false, error: 'Service is already running' }
  }

  const serviceDir = path.join(servicesDir, serviceId)
  const entryPath = path.join(serviceDir, metadata.entryFile)
  const command = metadata.runtime === 'node' ? 'node' : 'python3'
  const quotedEntryPath = `"${entryPath}"`

  return new Promise((resolve) => {
    let resolved = false
    let gotOutput = false

    const childProcess = spawn(command, [quotedEntryPath], {
      cwd: serviceDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      shell: true,
      env: {
        ...process.env,
        MEMU_SERVICE_ID: serviceId,
        MEMU_API_URL: 'http://127.0.0.1:31415'
      }
    })

    const health: ServiceHealthMetrics = {
      lastActivityAt: null,
      lastInvokeAt: null,
      errorCount: 0,
      restartCount: 0,
      startupHealthy: false
    }

    const running: RunningService = {
      process: childProcess,
      metadata,
      startedAt: new Date().toISOString(),
      serviceDir,
      health,
      crashHistory: []
    }

    // Store immediately so exit handler can find it
    runningServices.set(serviceId, running)

    // Handle spawn error
    childProcess.on('error', (error) => {
      console.error(`[Runner] Failed to start ${serviceId}:`, error.message)
      runningServices.delete(serviceId)
      appEvents.emitServiceStatusChanged(serviceId, 'stopped')

      if (!resolved) {
        resolved = true
        const msg = error.message.includes('ENOENT')
          ? `Runtime '${command}' not found. Please ensure ${metadata.runtime === 'node' ? 'Node.js' : 'Python 3'} is installed.`
          : error.message
        resolve({ success: false, error: msg })
      }
    })

    // Handle process exit
    childProcess.on('exit', async (code, signal) => {
      console.log(`[Runner] Service ${serviceId} exited: code=${code}, signal=${signal}`)
      runningServices.delete(serviceId)

      // Log to persistent file
      await serviceLogger.appendLog(
        serviceDir,
        code === 0 ? 'info' : 'error',
        `Process exited: code=${code}, signal=${signal}`
      )

      // If we haven't resolved the start promise yet, this is a startup crash
      if (!resolved) {
        resolved = true
        appEvents.emitServiceStatusChanged(serviceId, 'stopped')
        resolve({
          success: false,
          error: `Service crashed during startup (exit code: ${code}). Check service logs.`
        })
        return
      }

      // Normal completion (code 0, no signal) for longRunning = task done
      if (code === 0 && !signal) {
        console.log(`[Runner] Service ${serviceId} completed normally`)
        appEvents.emitServiceStatusChanged(serviceId, 'stopped')
        if (onServiceCompleted) {
          await onServiceCompleted(serviceId)
        }
        return
      }

      // User-initiated stop (SIGTERM/SIGKILL) — don't auto-restart
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        appEvents.emitServiceStatusChanged(serviceId, 'stopped')
        return
      }

      // Crash! Attempt auto-restart for longRunning services
      if (metadata.type === 'longRunning' && code !== 0) {
        await handleCrashRestart(serviceId, metadata, servicesDir, serviceDir)
      } else {
        appEvents.emitServiceStatusChanged(serviceId, 'stopped')
      }
    })

    // Capture stdout — update health metrics and persist to log
    childProcess.stdout?.on('data', (data) => {
      const text = data.toString().trim()
      console.log(`[Service:${serviceId}] ${text}`)
      serviceLogger.appendLog(serviceDir, 'info', text)

      // Update health
      running.health.lastActivityAt = new Date().toISOString()

      // Track invoke calls
      if (text.includes('/api/v1/invoke') || text.includes('Invoke result')) {
        running.health.lastInvokeAt = new Date().toISOString()
      }

      // Mark first output as healthy startup
      if (!gotOutput) {
        gotOutput = true
        running.health.startupHealthy = true

        if (!resolved) {
          resolved = true
          console.log(`[Runner] Service ${serviceId} started (PID: ${childProcess.pid}, healthy: first output received)`)
          appEvents.emitServiceStatusChanged(serviceId, 'running')
          resolve({ success: true })
        }
      }
    })

    // Capture stderr
    childProcess.stderr?.on('data', (data) => {
      const text = data.toString().trim()
      console.error(`[Service:${serviceId}] ERROR: ${text}`)
      serviceLogger.appendLog(serviceDir, 'error', text)
      running.health.errorCount++
    })

    // Fallback: if no output after STARTUP_HEALTH_CHECK_MS but process is still alive, consider started
    setTimeout(() => {
      if (!resolved && runningServices.has(serviceId)) {
        resolved = true
        running.health.startupHealthy = !gotOutput ? false : true
        console.log(`[Runner] Service ${serviceId} started (PID: ${childProcess.pid}, healthy: ${running.health.startupHealthy})`)
        appEvents.emitServiceStatusChanged(serviceId, 'running')
        resolve({ success: true })
      }
    }, STARTUP_HEALTH_CHECK_MS)
  })
}

/**
 * Stop a running service process. Sends SIGTERM, then SIGKILL after timeout.
 */
export async function stopProcess(serviceId: string): Promise<{ success: boolean; error?: string }> {
  const running = runningServices.get(serviceId)
  if (!running) {
    return { success: false, error: `Service '${serviceId}' is not running.` }
  }

  try {
    const proc = running.process

    const exitPromise = new Promise<void>((resolve) => {
      if (!proc.pid || proc.exitCode !== null) {
        resolve()
        return
      }
      proc.once('exit', () => resolve())
    })

    // Send SIGTERM
    if (proc.pid && proc.exitCode === null) {
      console.log(`[Runner] Sending SIGTERM to ${serviceId} (PID: ${proc.pid})`)
      proc.kill('SIGTERM')
    }

    // Wait with timeout
    const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), GRACEFUL_SHUTDOWN_MS))
    const result = await Promise.race([exitPromise, timeout])

    // Force kill if needed
    if (result === 'timeout' && proc.pid && proc.exitCode === null) {
      console.log(`[Runner] Force killing ${serviceId}`)
      proc.kill('SIGKILL')
      await new Promise((r) => setTimeout(r, 1000))
    }

    runningServices.delete(serviceId)
    appEvents.emitServiceStatusChanged(serviceId, 'stopped')

    await serviceLogger.appendLog(running.serviceDir, 'info', 'Service stopped by user')

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Stop all running services.
 */
export async function stopAll(): Promise<void> {
  console.log('[Runner] Stopping all services...')
  const ids = Array.from(runningServices.keys())
  for (const id of ids) {
    await stopProcess(id)
  }
  console.log('[Runner] All services stopped')
}

/**
 * Dry-run a service: execute once with MEMU_DRY_RUN=true and capture output.
 */
export async function dryRun(
  serviceId: string,
  metadata: ServiceMetadata,
  servicesDir: string,
  timeoutMs = DRY_RUN_TIMEOUT_MS
): Promise<DryRunResult> {
  const serviceDir = path.join(servicesDir, serviceId)
  const entryPath = path.join(serviceDir, metadata.entryFile)
  const command = metadata.runtime === 'node' ? 'node' : 'python3'
  const quotedEntryPath = `"${entryPath}"`

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let resolved = false

    const childProcess = spawn(command, [quotedEntryPath], {
      cwd: serviceDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      shell: true,
      env: {
        ...process.env,
        MEMU_SERVICE_ID: serviceId,
        MEMU_API_URL: 'http://127.0.0.1:31415',
        MEMU_DRY_RUN: 'true'
      }
    })

    childProcess.stdout?.on('data', (data) => {
      stdout += data.toString()
    })
    childProcess.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    childProcess.on('error', (error) => {
      if (!resolved) {
        resolved = true
        resolve({ success: false, stdout, stderr, exitCode: null, timedOut: false, error: error.message })
      }
    })

    childProcess.on('exit', (code) => {
      if (!resolved) {
        resolved = true
        resolve({ success: code === 0, stdout, stderr, exitCode: code, timedOut })
      }
    })

    setTimeout(() => {
      if (!resolved) {
        timedOut = true
        try { childProcess.kill('SIGKILL') } catch { /* */ }
      }
    }, timeoutMs)
  })
}

// ============================================
// Crash Recovery (internal)
// ============================================

async function handleCrashRestart(
  serviceId: string,
  metadata: ServiceMetadata,
  servicesDir: string,
  serviceDir: string
): Promise<void> {
  const now = Date.now()
  const windowStart = now - RESTART_WINDOW_MS

  // Get or rebuild crash history (service was already removed from runningServices)
  // We store crash history in a module-level map since the RunningService is gone
  if (!crashHistoryMap.has(serviceId)) {
    crashHistoryMap.set(serviceId, [])
  }

  const history = crashHistoryMap.get(serviceId)!
  // Remove old entries outside the window
  const recent = history.filter((ts) => ts > windowStart)
  recent.push(now)
  crashHistoryMap.set(serviceId, recent)

  const attemptIndex = recent.length - 1

  if (recent.length > MAX_RESTART_ATTEMPTS) {
    console.error(`[Runner] Service ${serviceId} exceeded max restart attempts (${MAX_RESTART_ATTEMPTS}). Marking as error.`)
    appEvents.emitServiceStatusChanged(serviceId, 'error')
    await serviceLogger.appendLog(
      serviceDir,
      'error',
      `Exceeded max restart attempts (${MAX_RESTART_ATTEMPTS} in ${RESTART_WINDOW_MS / 1000}s). Service stopped.`
    )
    return
  }

  const delay = RESTART_BACKOFF_MS[Math.min(attemptIndex, RESTART_BACKOFF_MS.length - 1)]
  console.log(`[Runner] Service ${serviceId} crashed. Restarting in ${delay / 1000}s (attempt ${recent.length}/${MAX_RESTART_ATTEMPTS})`)

  await serviceLogger.appendLog(
    serviceDir,
    'info',
    `Auto-restarting in ${delay / 1000}s (attempt ${recent.length}/${MAX_RESTART_ATTEMPTS})`
  )

  setTimeout(async () => {
    // Double-check it hasn't been manually started or deleted
    if (runningServices.has(serviceId)) return

    console.log(`[Runner] Auto-restarting service ${serviceId}...`)
    const result = await startProcess(serviceId, metadata, servicesDir)

    if (result.success) {
      // Update restart count in health
      const running = runningServices.get(serviceId)
      if (running) {
        running.health.restartCount = recent.length
      }
    } else {
      console.error(`[Runner] Failed to auto-restart ${serviceId}: ${result.error}`)
      await serviceLogger.appendLog(serviceDir, 'error', `Auto-restart failed: ${result.error}`)
      appEvents.emitServiceStatusChanged(serviceId, 'error')
    }
  }, delay)
}

/** Module-level crash history (survives across start/stop cycles) */
const crashHistoryMap = new Map<string, number[]>()
