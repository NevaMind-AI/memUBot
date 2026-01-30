import { useState, useEffect } from 'react'
import { Plus, Trash2, Loader2, Check, AlertCircle, Server, Play, Square, ChevronDown, ChevronUp, RefreshCw, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface McpServer {
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  enabled: boolean
}

interface McpServerConfig {
  [key: string]: {
    command: string
    args?: string[]
    env?: Record<string, string>
    disabled?: boolean
  }
}

interface McpServerStatus {
  name: string
  toolCount: number
  connected: boolean
}

export function McpSettings(): JSX.Element {
  const { t } = useTranslation()
  const [servers, setServers] = useState<McpServer[]>([])
  const [serverStatus, setServerStatus] = useState<McpServerStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [expandedServer, setExpandedServer] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newServer, setNewServer] = useState<McpServer>({
    name: '',
    command: 'npx',
    args: [],
    env: {},
    enabled: true
  })
  const [newArgsInput, setNewArgsInput] = useState('')
  const [newEnvKey, setNewEnvKey] = useState('')
  const [newEnvValue, setNewEnvValue] = useState('')

  useEffect(() => {
    loadMcpConfig()
    loadMcpStatus()
  }, [])

  const loadMcpConfig = async () => {
    setLoading(true)
    try {
      const result = await window.settings.getMcpConfig()
      if (result.success && result.data) {
        const config = result.data as McpServerConfig
        const serverList: McpServer[] = Object.entries(config).map(([name, cfg]) => ({
          name,
          command: cfg.command,
          args: cfg.args || [],
          env: cfg.env || {},
          enabled: !cfg.disabled
        }))
        setServers(serverList)
      }
    } catch (error) {
      console.error('Failed to load MCP config:', error)
    }
    setLoading(false)
  }

  const loadMcpStatus = async () => {
    try {
      const result = await window.settings.getMcpStatus()
      if (result.success && result.data) {
        setServerStatus(result.data as McpServerStatus[])
      }
    } catch (error) {
      console.error('Failed to load MCP status:', error)
    }
  }

  const handleReloadMcp = async () => {
    setReloading(true)
    setMessage(null)
    try {
      const result = await window.settings.reloadMcp()
      if (result.success) {
        await loadMcpStatus()
        setMessage({ type: 'success', text: t('settings.mcp.reloaded') })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.mcp.reloadFailed') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.mcp.reloadFailed') })
    }
    setReloading(false)
  }

  const getServerStatus = (name: string): McpServerStatus | undefined => {
    return serverStatus.find(s => s.name === name)
  }

  const saveMcpConfig = async (serverList: McpServer[]) => {
    setSaving(true)
    setMessage(null)
    try {
      const config: McpServerConfig = {}
      for (const server of serverList) {
        config[server.name] = {
          command: server.command,
          args: server.args.length > 0 ? server.args : undefined,
          env: Object.keys(server.env).length > 0 ? server.env : undefined,
          disabled: !server.enabled ? true : undefined
        }
      }
      const result = await window.settings.saveMcpConfig(config)
      if (result.success) {
        setMessage({ type: 'success', text: t('settings.mcp.saved') })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.mcp.saveFailed') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.mcp.saveFailed') })
    }
    setSaving(false)
  }

  const handleAddServer = () => {
    if (!newServer.name.trim()) {
      setMessage({ type: 'error', text: t('settings.mcp.nameRequired') })
      return
    }
    if (servers.some(s => s.name === newServer.name)) {
      setMessage({ type: 'error', text: t('settings.mcp.nameExists') })
      return
    }
    
    // Auto-add any pending args input before saving (supports space-separated args)
    let finalArgs = [...newServer.args]
    if (newArgsInput.trim()) {
      // Split by space to support multiple args at once
      const pendingArgs = newArgsInput.trim().split(/\s+/).filter(Boolean)
      finalArgs = [...finalArgs, ...pendingArgs]
    }
    
    // Auto-add any pending env input before saving
    let finalEnv = { ...newServer.env }
    if (newEnvKey.trim()) {
      finalEnv = { ...finalEnv, [newEnvKey.trim()]: newEnvValue }
    }
    
    const serverToAdd = {
      ...newServer,
      args: finalArgs,
      env: finalEnv
    }
    
    const updatedServers = [...servers, serverToAdd]
    setServers(updatedServers)
    saveMcpConfig(updatedServers)
    setNewServer({ name: '', command: 'npx', args: [], env: {}, enabled: true })
    setNewArgsInput('')
    setNewEnvKey('')
    setNewEnvValue('')
    setShowAddForm(false)
  }

  const handleRemoveServer = (name: string) => {
    const updatedServers = servers.filter(s => s.name !== name)
    setServers(updatedServers)
    saveMcpConfig(updatedServers)
  }

  const handleToggleServer = (name: string) => {
    const updatedServers = servers.map(s =>
      s.name === name ? { ...s, enabled: !s.enabled } : s
    )
    setServers(updatedServers)
    saveMcpConfig(updatedServers)
  }

  const handleAddArg = () => {
    if (newArgsInput.trim()) {
      setNewServer({
        ...newServer,
        args: [...newServer.args, newArgsInput.trim()]
      })
      setNewArgsInput('')
    }
  }

  const handleRemoveArg = (index: number) => {
    setNewServer({
      ...newServer,
      args: newServer.args.filter((_, i) => i !== index)
    })
  }

  const handleAddEnv = () => {
    if (newEnvKey.trim()) {
      setNewServer({
        ...newServer,
        env: { ...newServer.env, [newEnvKey.trim()]: newEnvValue }
      })
      setNewEnvKey('')
      setNewEnvValue('')
    }
  }

  const handleRemoveEnv = (key: string) => {
    const { [key]: _, ...rest } = newServer.env
    setNewServer({ ...newServer, env: rest })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-[var(--primary)] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('settings.mcp.title')}</h3>
            {servers.length > 0 && (
              <button
                onClick={handleReloadMcp}
                disabled={reloading}
                className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all disabled:opacity-50"
                title={t('settings.mcp.reload')}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reloading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
            {t('settings.mcp.description')}
          </p>
        </div>
      </div>

      {/* Server List */}
      <div className="space-y-3">
        {servers.length === 0 && !showAddForm ? (
          <div className="p-6 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm text-center">
            <Server className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
            <p className="text-[13px] text-[var(--text-muted)]">{t('settings.mcp.noServers')}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              {t('settings.mcp.addHint')}
            </p>
          </div>
        ) : (
          servers.map((server) => (
            <div
              key={server.name}
              className="rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm overflow-hidden"
            >
              {/* Server Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--bg-card)]"
                onClick={() => setExpandedServer(expandedServer === server.name ? null : server.name)}
              >
                <div className="flex items-center gap-3">
                  {(() => {
                    const status = getServerStatus(server.name)
                    const isConnected = status?.connected
                    return (
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        !server.enabled 
                          ? 'bg-[var(--bg-input)] text-[var(--text-muted)]'
                          : isConnected
                            ? 'bg-emerald-500/20 text-emerald-500' 
                            : 'bg-amber-500/20 text-amber-500'
                      }`}>
                        <Server className="w-4 h-4" />
                      </div>
                    )
                  })()}
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                        {server.name}
                      </h4>
                      {(() => {
                        const status = getServerStatus(server.name)
                        if (status?.connected) {
                          return (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-[10px] text-emerald-500">
                              <Zap className="w-3 h-3" />
                              {t('settings.mcp.toolCount', { count: status.toolCount })}
                            </span>
                          )
                        }
                        return null
                      })()}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {server.command} {server.args.join(' ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleServer(server.name)
                    }}
                    className={`p-1.5 rounded-lg transition-all ${
                      server.enabled
                        ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30'
                    }`}
                    title={server.enabled ? t('settings.mcp.stopServer') : t('settings.mcp.startServer')}
                  >
                    {server.enabled ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveServer(server.name)
                    }}
                    className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                    title={t('common.remove')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {expandedServer === server.name ? (
                    <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedServer === server.name && (
                <div className="px-4 pb-4 pt-2 border-t border-[var(--border-color)] space-y-3">
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.mcp.command')}</label>
                    <code className="block px-3 py-2 rounded-lg bg-[var(--bg-input)] text-[12px] text-[var(--text-primary)] font-mono">
                      {server.command}
                    </code>
                  </div>
                  {server.args.length > 0 && (
                    <div>
                      <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.mcp.arguments')}</label>
                      <div className="flex flex-wrap gap-1">
                        {server.args.map((arg, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 rounded-md bg-[var(--bg-input)] text-[11px] text-[var(--text-primary)] font-mono"
                          >
                            {arg}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {Object.keys(server.env).length > 0 && (
                    <div>
                      <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.mcp.envVars')}</label>
                      <div className="space-y-1">
                        {Object.entries(server.env).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-input)]"
                          >
                            <span className="text-[11px] text-[var(--primary)] font-mono">{key}</span>
                            <span className="text-[11px] text-[var(--text-muted)]">=</span>
                            <span className="text-[11px] text-[var(--text-primary)] font-mono truncate">
                              {value ? '••••••••' : '(empty)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {/* Add Server Form */}
        {showAddForm ? (
          <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--primary)]/30 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">{t('settings.mcp.addServer')}</h4>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setNewServer({ name: '', command: 'npx', args: [], env: {}, enabled: true })
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                {t('common.cancel')}
              </button>
            </div>

            {/* Server Name */}
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">{t('settings.mcp.serverName')} *</label>
              <input
                type="text"
                placeholder="e.g., nanobanana"
                value={newServer.name}
                onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
              />
            </div>

            {/* Command */}
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">{t('settings.mcp.command')} *</label>
              <input
                type="text"
                placeholder="e.g., npx"
                value={newServer.command}
                onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
              />
            </div>

            {/* Arguments */}
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">{t('settings.mcp.arguments')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., -y @aeven/nanobanana-mcp@latest"
                  value={newArgsInput}
                  onChange={(e) => setNewArgsInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddArg()}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
                />
                <button
                  onClick={handleAddArg}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {newServer.args.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {newServer.args.map((arg, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--primary)]/10 text-[11px] text-[var(--primary)] font-mono"
                    >
                      {arg}
                      <button
                        onClick={() => handleRemoveArg(i)}
                        className="hover:text-red-500 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Environment Variables */}
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">{t('settings.mcp.envVars')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('settings.mcp.envKey')}
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value)}
                  className="w-1/3 px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
                />
                <input
                  type="password"
                  placeholder={t('settings.mcp.envValue')}
                  value={newEnvValue}
                  onChange={(e) => setNewEnvValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEnv()}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
                />
                <button
                  onClick={handleAddEnv}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {Object.keys(newServer.env).length > 0 && (
                <div className="space-y-1 mt-2">
                  {Object.entries(newServer.env).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--primary)]/10"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-[var(--primary)] font-mono">{key}</span>
                        <span className="text-[11px] text-[var(--text-muted)]">=</span>
                        <span className="text-[11px] text-[var(--text-primary)] font-mono">
                          {value ? '••••••••' : '(empty)'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveEnv(key)}
                        className="text-[var(--text-muted)] hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Button */}
            <button
              onClick={handleAddServer}
              disabled={saving || !newServer.name.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#7DCBF7] to-[#2596D1] text-white text-[13px] font-medium shadow-lg shadow-[#2596D1]/25 hover:shadow-xl hover:shadow-[#2596D1]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('settings.mcp.adding')}</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>{t('settings.mcp.addServer')}</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="text-[13px] font-medium">{t('settings.mcp.addServer')}</span>
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span className="text-[13px]">{message.text}</span>
        </div>
      )}

      {/* Help Text */}
      <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          <strong className="text-[var(--text-primary)]">{t('settings.mcp.noteTitle')}</strong> {t('settings.mcp.noteContent')}
        </p>
      </div>
    </div>
  )
}
