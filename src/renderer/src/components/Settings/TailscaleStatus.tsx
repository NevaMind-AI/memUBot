import { useState, useEffect } from 'react'
import {
  Wifi,
  WifiOff,
  Globe,
  Monitor,
  RefreshCw,
  LogIn,
  LogOut,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import { toast } from '../../stores/toastStore'

interface TailscalePeer {
  id: string
  hostname: string
  ipAddress: string
  online: boolean
  os?: string
  lastSeen?: string
}

interface TailscaleStatus {
  installed: boolean
  running: boolean
  loggedIn: boolean
  ipAddress?: string
  hostname?: string
  tailnetName?: string
  peers?: TailscalePeer[]
  error?: string
}

export function TailscaleStatus(): JSX.Element {
  const [status, setStatus] = useState<TailscaleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadStatus()

    // Subscribe to status changes
    const unsubscribe = window.tailscale.onStatusChanged((newStatus) => {
      setStatus(newStatus as TailscaleStatus)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const loadStatus = async () => {
    setLoading(true)
    try {
      const result = await window.tailscale.getStatus()
      if (result.success && result.data) {
        setStatus(result.data)
      }
    } catch (error) {
      console.error('Failed to load Tailscale status:', error)
    }
    setLoading(false)
  }

  const handleConnect = async () => {
    setActionLoading('connect')
    try {
      const result = await window.tailscale.connect()
      if (result.success) {
        toast.success('Tailscale connected')
        await loadStatus()
      } else {
        toast.error(result.error || 'Failed to connect')
      }
    } catch (error) {
      toast.error('Failed to connect to Tailscale')
    }
    setActionLoading(null)
  }

  const handleDisconnect = async () => {
    setActionLoading('disconnect')
    try {
      const result = await window.tailscale.disconnect()
      if (result.success) {
        toast.success('Tailscale disconnected')
        await loadStatus()
      } else {
        toast.error(result.error || 'Failed to disconnect')
      }
    } catch (error) {
      toast.error('Failed to disconnect from Tailscale')
    }
    setActionLoading(null)
  }

  const handleLogin = async () => {
    setActionLoading('login')
    try {
      const result = await window.tailscale.login()
      if (result.success) {
        toast.info('Opening browser for Tailscale login...')
      } else {
        toast.error(result.error || 'Failed to initiate login')
      }
    } catch (error) {
      toast.error('Failed to initiate Tailscale login')
    }
    setActionLoading(null)
  }

  const handleLogout = async () => {
    setActionLoading('logout')
    try {
      const result = await window.tailscale.logout()
      if (result.success) {
        toast.success('Logged out from Tailscale')
        await loadStatus()
      } else {
        toast.error(result.error || 'Failed to logout')
      }
    } catch (error) {
      toast.error('Failed to logout from Tailscale')
    }
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-[var(--primary)] animate-spin" />
      </div>
    )
  }

  // Status indicators
  const getStatusIcon = () => {
    if (!status?.installed) {
      return <XCircle className="w-3 h-3 text-gray-400" />
    }
    if (!status.running) {
      return <WifiOff className="w-3 h-3 text-amber-500" />
    }
    if (status.loggedIn) {
      return <CheckCircle className="w-3 h-3 text-emerald-500" />
    }
    return <AlertTriangle className="w-3 h-3 text-amber-500" />
  }

  const getStatusText = () => {
    if (!status?.installed) return 'Not Installed'
    if (!status.running) return 'Not Running'
    if (status.loggedIn) return 'Connected'
    return 'Not Logged In'
  }

  const getStatusColor = () => {
    if (!status?.installed) return 'text-gray-500'
    if (!status.running) return 'text-amber-500'
    if (status.loggedIn) return 'text-emerald-500'
    return 'text-amber-500'
  }

  return (
    <div className="space-y-3">
      {/* Status Card */}
      <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7DCBF7]/20 to-[#2596D1]/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">Tailscale VPN</h4>
              <div className={`flex items-center gap-1.5 ${getStatusColor()}`}>
                {getStatusIcon()}
                <span className="text-[12px] font-medium">{getStatusText()}</span>
              </div>
            </div>
          </div>
          <button
            onClick={loadStatus}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Error message */}
        {status?.error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-[12px] text-red-600 dark:text-red-400">{status.error}</p>
          </div>
        )}

        {/* Connection Info */}
        {status?.loggedIn && (
          <div className="space-y-2 mb-4">
            {status.ipAddress && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-input)]">
                <span className="text-[12px] text-[var(--text-muted)]">IP Address</span>
                <span className="text-[12px] text-[var(--text-primary)] font-mono">
                  {status.ipAddress}
                </span>
              </div>
            )}
            {status.hostname && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-input)]">
                <span className="text-[12px] text-[var(--text-muted)]">Hostname</span>
                <span className="text-[12px] text-[var(--text-primary)] font-medium">
                  {status.hostname}
                </span>
              </div>
            )}
            {status.tailnetName && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-input)]">
                <span className="text-[12px] text-[var(--text-muted)]">Tailnet</span>
                <span className="text-[12px] text-[var(--text-primary)] font-medium">
                  {status.tailnetName}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!status?.installed && (
            <a
              href="https://tailscale.com/download"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7DCBF7] to-[#2596D1] text-white text-[13px] font-medium shadow-lg shadow-[#2596D1]/25 hover:shadow-xl hover:shadow-[#2596D1]/30 transition-all"
            >
              Install Tailscale
            </a>
          )}

          {status?.installed && !status.running && (
            <button
              onClick={handleConnect}
              disabled={actionLoading !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7DCBF7] to-[#2596D1] text-white text-[13px] font-medium shadow-lg shadow-[#2596D1]/25 hover:shadow-xl hover:shadow-[#2596D1]/30 transition-all disabled:opacity-50"
            >
              {actionLoading === 'connect' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              <span>Connect</span>
            </button>
          )}

          {status?.running && !status.loggedIn && (
            <button
              onClick={handleLogin}
              disabled={actionLoading !== null}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7DCBF7] to-[#2596D1] text-white text-[13px] font-medium shadow-lg shadow-[#2596D1]/25 hover:shadow-xl hover:shadow-[#2596D1]/30 transition-all disabled:opacity-50"
            >
              {actionLoading === 'login' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>Login</span>
            </button>
          )}

          {status?.loggedIn && (
            <>
              <button
                onClick={handleDisconnect}
                disabled={actionLoading !== null}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] text-[13px] font-medium hover:bg-[var(--bg-card-solid)] transition-all disabled:opacity-50"
              >
                {actionLoading === 'disconnect' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <WifiOff className="w-4 h-4" />
                )}
                <span>Disconnect</span>
              </button>
              <button
                onClick={handleLogout}
                disabled={actionLoading !== null}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-50/80 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[13px] font-medium hover:bg-red-100/80 dark:hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {actionLoading === 'logout' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Peers List */}
      {status?.loggedIn && status.peers && status.peers.length > 0 && (
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <h4 className="text-[13px] font-medium text-[var(--text-primary)] mb-3">
            Network Peers ({status.peers.length})
          </h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {status.peers.map((peer) => (
              <div
                key={peer.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-input)]"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${peer.online ? 'bg-emerald-500' : 'bg-gray-400'}`}
                  />
                  <Monitor className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span className="text-[12px] text-[var(--text-primary)] font-medium">
                    {peer.hostname}
                  </span>
                  {peer.os && (
                    <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--bg-card)]">
                      {peer.os}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  {peer.ipAddress}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
