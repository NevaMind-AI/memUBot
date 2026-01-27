import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface TailscaleStatus {
  installed: boolean
  running: boolean
  loggedIn: boolean
  ipAddress?: string
  hostname?: string
  tailnetName?: string
  peers?: TailscalePeer[]
  error?: string
}

export interface TailscalePeer {
  id: string
  hostname: string
  ipAddress: string
  online: boolean
  os?: string
  lastSeen?: string
}

class TailscaleService {
  private statusCache: TailscaleStatus | null = null
  private statusListeners: ((status: TailscaleStatus) => void)[] = []

  /**
   * Check if Tailscale CLI is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      await execAsync('which tailscale')
      return true
    } catch {
      return false
    }
  }

  /**
   * Get current Tailscale status
   */
  async getStatus(): Promise<TailscaleStatus> {
    try {
      // Check if installed
      const installed = await this.isInstalled()
      if (!installed) {
        return {
          installed: false,
          running: false,
          loggedIn: false,
          error: 'Tailscale is not installed'
        }
      }

      // Get status JSON
      const { stdout } = await execAsync('tailscale status --json')
      const statusJson = JSON.parse(stdout)

      // Parse status
      const status: TailscaleStatus = {
        installed: true,
        running: statusJson.BackendState === 'Running',
        loggedIn: statusJson.BackendState === 'Running' && !!statusJson.Self,
        ipAddress: statusJson.Self?.TailscaleIPs?.[0],
        hostname: statusJson.Self?.HostName,
        tailnetName: statusJson.CurrentTailnet?.Name,
        peers: []
      }

      // Parse peers
      if (statusJson.Peer) {
        for (const [id, peer] of Object.entries(statusJson.Peer) as [string, any][]) {
          status.peers?.push({
            id,
            hostname: peer.HostName,
            ipAddress: peer.TailscaleIPs?.[0] || '',
            online: peer.Online,
            os: peer.OS,
            lastSeen: peer.LastSeen
          })
        }
      }

      this.statusCache = status
      return status
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Check if it's because Tailscale is not running
      if (errorMessage.includes('not running') || errorMessage.includes('connection refused')) {
        return {
          installed: true,
          running: false,
          loggedIn: false,
          error: 'Tailscale daemon is not running'
        }
      }

      return {
        installed: true,
        running: false,
        loggedIn: false,
        error: errorMessage
      }
    }
  }

  /**
   * Start Tailscale daemon (requires sudo on some systems)
   */
  async start(): Promise<{ success: boolean; error?: string }> {
    try {
      // On macOS, Tailscale is usually started via the app
      // Try to use the CLI to bring up the connection
      await execAsync('tailscale up')
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start Tailscale'
      }
    }
  }

  /**
   * Stop/disconnect Tailscale
   */
  async stop(): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync('tailscale down')
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop Tailscale'
      }
    }
  }

  /**
   * Login to Tailscale (opens browser for authentication)
   */
  async login(): Promise<{ success: boolean; error?: string }> {
    try {
      // This will open a browser for authentication
      const child = spawn('tailscale', ['login'], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate login'
      }
    }
  }

  /**
   * Logout from Tailscale
   */
  async logout(): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync('tailscale logout')
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to logout'
      }
    }
  }

  /**
   * Ping a peer
   */
  async ping(target: string): Promise<{ success: boolean; latency?: number; error?: string }> {
    try {
      const { stdout } = await execAsync(`tailscale ping --c 1 ${target}`)
      // Parse latency from output like "pong from hostname (100.x.x.x) via DERP(tok) in 50ms"
      const match = stdout.match(/in (\d+(?:\.\d+)?)(ms|s)/)
      if (match) {
        let latency = parseFloat(match[1])
        if (match[2] === 's') latency *= 1000
        return { success: true, latency }
      }
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Ping failed'
      }
    }
  }

  /**
   * Get cached status
   */
  getCachedStatus(): TailscaleStatus | null {
    return this.statusCache
  }

  /**
   * Add status change listener
   */
  onStatusChange(listener: (status: TailscaleStatus) => void): () => void {
    this.statusListeners.push(listener)
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener)
    }
  }

  /**
   * Notify status change
   */
  private notifyStatusChange(status: TailscaleStatus): void {
    this.statusListeners.forEach((listener) => listener(status))
  }

  /**
   * Start polling for status changes
   */
  startStatusPolling(intervalMs: number = 10000): () => void {
    const poll = async () => {
      const status = await this.getStatus()
      if (JSON.stringify(status) !== JSON.stringify(this.statusCache)) {
        this.statusCache = status
        this.notifyStatusChange(status)
      }
    }

    // Initial poll
    poll()

    const interval = setInterval(poll, intervalMs)
    return () => clearInterval(interval)
  }
}

export const tailscaleService = new TailscaleService()
