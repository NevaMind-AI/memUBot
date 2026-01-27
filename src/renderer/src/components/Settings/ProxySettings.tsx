import { useState, useEffect } from 'react'
import { Check, AlertCircle, Loader2 } from 'lucide-react'

interface ProxyConfig {
  enabled: boolean
  type: 'socks5' | 'http'
  host: string
  port: number
  username?: string
  password?: string
}

export function ProxySettings(): JSX.Element {
  const [config, setConfig] = useState<ProxyConfig>({
    enabled: false,
    type: 'socks5',
    host: '127.0.0.1',
    port: 1080
  })
  const [originalConfig, setOriginalConfig] = useState<ProxyConfig>({
    enabled: false,
    type: 'socks5',
    host: '127.0.0.1',
    port: 1080
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const result = await window.proxy.getConfig()
      if (result.success && result.data) {
        setConfig(result.data)
        setOriginalConfig(result.data)
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    }
    setLoading(false)
  }

  const hasChanges =
    config.enabled !== originalConfig.enabled ||
    config.type !== originalConfig.type ||
    config.host !== originalConfig.host ||
    config.port !== originalConfig.port ||
    config.username !== originalConfig.username ||
    config.password !== originalConfig.password

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const result = await window.proxy.saveConfig(config)
      if (result.success) {
        setOriginalConfig({ ...config })
        setMessage({ type: 'success', text: 'Settings saved' })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-[#2596D1] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-800">Network</h3>
        <p className="text-[12px] text-slate-500 mt-0.5">Configure proxy for API connections</p>
      </div>

      <div className="space-y-3">
        {/* Enable Toggle */}
        <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[13px] font-medium text-slate-700">Enable Proxy</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Route through proxy server</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              className={`relative w-12 h-7 rounded-full transition-all duration-200 ${
                config.enabled
                  ? 'bg-gradient-to-r from-[#7DCBF7] to-[#2596D1]'
                  : 'bg-slate-200'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
                  config.enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Proxy Type */}
        <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[13px] font-medium text-slate-700">Proxy Type</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Protocol type</p>
            </div>
            <div className="flex gap-2">
              {(['socks5', 'http'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setConfig({ ...config, type })}
                  disabled={!config.enabled}
                  className={`px-4 py-2 rounded-xl text-[12px] font-medium transition-all duration-200 ${
                    config.type === type
                      ? 'bg-gradient-to-r from-[#7DCBF7]/20 to-[#2596D1]/20 text-[#2596D1] shadow-sm'
                      : 'bg-slate-50/80 text-slate-500 hover:text-slate-700 hover:bg-white/80'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Host & Port */}
        <div className="p-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-sm space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-medium text-slate-500 mb-2">Host</label>
              <input
                type="text"
                value={config.host}
                onChange={(e) => setConfig({ ...config, host: e.target.value })}
                disabled={!config.enabled}
                placeholder="127.0.0.1"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200/50 text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#2596D1]/50 focus:ring-2 focus:ring-[#2596D1]/10 transition-all disabled:opacity-40"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-2">Port</label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 0 })}
                disabled={!config.enabled}
                placeholder="1080"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200/50 text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#2596D1]/50 focus:ring-2 focus:ring-[#2596D1]/10 transition-all disabled:opacity-40"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-2">
                Username <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={config.username || ''}
                onChange={(e) => setConfig({ ...config, username: e.target.value || undefined })}
                disabled={!config.enabled}
                placeholder="username"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200/50 text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#2596D1]/50 focus:ring-2 focus:ring-[#2596D1]/10 transition-all disabled:opacity-40"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-2">
                Password <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="password"
                value={config.password || ''}
                onChange={(e) => setConfig({ ...config, password: e.target.value || undefined })}
                disabled={!config.enabled}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200/50 text-[13px] text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#2596D1]/50 focus:ring-2 focus:ring-[#2596D1]/10 transition-all disabled:opacity-40"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
            message.type === 'success'
              ? 'bg-emerald-50/80 border-emerald-200/50 text-emerald-700'
              : 'bg-red-50/80 border-red-200/50 text-red-700'
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

      {/* Save Button */}
      {hasChanges && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-[#7DCBF7] to-[#2596D1] text-white text-[13px] font-medium shadow-lg shadow-[#2596D1]/25 hover:shadow-xl hover:shadow-[#2596D1]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>Save Settings</span>
          )}
        </button>
      )}
    </div>
  )
}
