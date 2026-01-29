import { app } from 'electron'

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: number
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
}

/**
 * Logger Service - Captures console output for in-app viewing
 * Only active in production (packaged) builds
 */
class LoggerService {
  private logs: LogEntry[] = []
  private maxLogs = 1000 // Keep last 1000 entries
  private originalConsole: {
    log: typeof console.log
    info: typeof console.info
    warn: typeof console.warn
    error: typeof console.error
  }
  private initialized = false

  constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console)
    }
  }

  /**
   * Initialize logger - only intercepts in production
   */
  initialize(): void {
    if (this.initialized) return
    this.initialized = true

    // Only intercept in production
    if (app.isPackaged) {
      this.interceptConsole()
      this.originalConsole.log('[Logger] Initialized in production mode')
    }
  }

  /**
   * Intercept console methods
   */
  private interceptConsole(): void {
    console.log = (...args: unknown[]) => {
      this.addLog('log', args)
      this.originalConsole.log(...args)
    }

    console.info = (...args: unknown[]) => {
      this.addLog('info', args)
      this.originalConsole.info(...args)
    }

    console.warn = (...args: unknown[]) => {
      this.addLog('warn', args)
      this.originalConsole.warn(...args)
    }

    console.error = (...args: unknown[]) => {
      this.addLog('error', args)
      this.originalConsole.error(...args)
    }
  }

  /**
   * Add a log entry
   */
  private addLog(level: LogEntry['level'], args: unknown[]): void {
    const message = args
      .map(arg => {
        if (typeof arg === 'string') return arg
        try {
          return JSON.stringify(arg, null, 2)
        } catch {
          return String(arg)
        }
      })
      .join(' ')

    this.logs.push({
      timestamp: Date.now(),
      level,
      message
    })

    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = []
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return app.isPackaged
  }
}

export const loggerService = new LoggerService()
