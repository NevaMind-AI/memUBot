/**
 * Service Logger
 *
 * Provides persistent per-service logging to disk.
 * Each service gets a `service.log` file in its directory with automatic rotation.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { MAX_LOG_FILE_SIZE, SERVICE_LOG_FILE } from './constants'

/**
 * Append a log line to a service's log file.
 * Creates the file if it doesn't exist. Rotates if size exceeds limit.
 */
export async function appendLog(
  serviceDir: string,
  level: 'info' | 'error',
  message: string
): Promise<void> {
  const logPath = path.join(serviceDir, SERVICE_LOG_FILE)
  const timestamp = new Date().toISOString()
  const prefix = level === 'error' ? 'ERROR' : 'INFO'
  const line = `[${timestamp}] [${prefix}] ${message}\n`

  try {
    // Check file size and rotate if needed
    await rotateIfNeeded(logPath)

    // Append to log file
    await fs.appendFile(logPath, line, 'utf-8')
  } catch {
    // Silently ignore log write failures (don't crash the service for logging)
  }
}

/**
 * Read recent log lines from a service.
 * @param serviceDir The service directory
 * @param maxLines Maximum number of lines to return (from the end)
 */
export async function readLogs(serviceDir: string, maxLines = 100): Promise<string> {
  const logPath = path.join(serviceDir, SERVICE_LOG_FILE)

  try {
    const content = await fs.readFile(logPath, 'utf-8')
    const lines = content.split('\n').filter(Boolean)

    if (lines.length <= maxLines) {
      return lines.join('\n')
    }

    return lines.slice(-maxLines).join('\n')
  } catch {
    return ''
  }
}

/**
 * Clear a service's log file.
 */
export async function clearLogs(serviceDir: string): Promise<void> {
  const logPath = path.join(serviceDir, SERVICE_LOG_FILE)
  try {
    await fs.writeFile(logPath, '', 'utf-8')
  } catch {
    // Ignore
  }
}

/**
 * Rotate log file if it exceeds the max size.
 * Keeps the last half of the file to avoid losing all recent context.
 */
async function rotateIfNeeded(logPath: string): Promise<void> {
  try {
    const stats = await fs.stat(logPath)
    if (stats.size <= MAX_LOG_FILE_SIZE) return

    const content = await fs.readFile(logPath, 'utf-8')
    const lines = content.split('\n')

    // Keep the last half of lines
    const keepFrom = Math.floor(lines.length / 2)
    const truncated =
      `[--- Log rotated at ${new Date().toISOString()}, older entries removed ---]\n` +
      lines.slice(keepFrom).join('\n')

    await fs.writeFile(logPath, truncated, 'utf-8')
  } catch {
    // File doesn't exist yet, or other error — ignore
  }
}
