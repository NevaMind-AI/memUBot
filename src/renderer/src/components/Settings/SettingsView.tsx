import { useState, useEffect } from 'react'
import { Globe, Bot, Info, Key, Database, Loader2, Check, AlertCircle, Shield } from 'lucide-react'
import { ProxySettings } from './ProxySettings'
import { TailscaleStatus } from './TailscaleStatus'
import { SecuritySettings } from './SecuritySettings'
import { Slider } from '../Slider'

type SettingsTab = 'general' | 'network' | 'security' | 'model' | 'data' | 'about'

interface AppSettings {
  claudeApiKey: string
  claudeModel: string
  maxTokens: number
  temperature: number
  systemPrompt: string
  telegramBotToken: string
  discordBotToken: string
  whatsappEnabled: boolean
  slackBotToken: string
  slackAppToken: string
  lineChannelAccessToken: string
  lineChannelSecret: string
  language: string
}

export function SettingsView(): JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  const tabs = [
    { id: 'general' as const, icon: Key, label: 'General' },
    { id: 'network' as const, icon: Globe, label: 'Network' },
    { id: 'security' as const, icon: Shield, label: 'Security' },
    { id: 'model' as const, icon: Bot, label: 'AI Model' },
    { id: 'data' as const, icon: Database, label: 'Data' },
    { id: 'about' as const, icon: Info, label: 'About' }
  ]

  return (
    <div className="flex-1 flex">
      {/* Settings Sidebar */}
      <div className="w-52 bg-[var(--glass-bg)] backdrop-blur-xl border-r border-[var(--glass-border)] py-4">
        <nav className="px-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#7DCBF7]/20 to-[#2596D1]/20 text-[var(--primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[13px] font-medium">{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto py-6 px-5">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'network' && <NetworkSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'model' && <ModelSettings />}
          {activeTab === 'data' && <DataSettings />}
          {activeTab === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  )
}

function GeneralSettings(): JSX.Element {
  const [settings, setSettings] = useState<Partial<AppSettings>>({})
  const [originalSettings, setOriginalSettings] = useState<Partial<AppSettings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const result = await window.settings.get()
      if (result.success && result.data) {
        setSettings(result.data)
        setOriginalSettings(result.data)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
    setLoading(false)
  }

  const hasChanges =
    settings.claudeApiKey !== originalSettings.claudeApiKey ||
    settings.telegramBotToken !== originalSettings.telegramBotToken ||
    settings.discordBotToken !== originalSettings.discordBotToken ||
    settings.slackBotToken !== originalSettings.slackBotToken ||
    settings.slackAppToken !== originalSettings.slackAppToken ||
    settings.lineChannelAccessToken !== originalSettings.lineChannelAccessToken ||
    settings.lineChannelSecret !== originalSettings.lineChannelSecret ||
    settings.language !== originalSettings.language

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const result = await window.settings.save({
        claudeApiKey: settings.claudeApiKey,
        telegramBotToken: settings.telegramBotToken,
        discordBotToken: settings.discordBotToken,
        slackBotToken: settings.slackBotToken,
        slackAppToken: settings.slackAppToken,
        lineChannelAccessToken: settings.lineChannelAccessToken,
        lineChannelSecret: settings.lineChannelSecret,
        language: settings.language
      })
      if (result.success) {
        setOriginalSettings({ ...originalSettings, ...settings })
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
        <Loader2 className="w-5 h-5 text-[var(--primary)] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">General</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Basic application settings</p>
      </div>

      <div className="space-y-3">
        {/* API Key */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="mb-3">
            <h4 className="text-[13px] font-medium text-[var(--text-primary)]">Claude API Key</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Your Anthropic API key</p>
          </div>
          <input
            type="password"
            placeholder="sk-ant-api03-..."
            value={settings.claudeApiKey || ''}
            onChange={(e) => setSettings({ ...settings, claudeApiKey: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
          />
        </div>

        {/* Telegram Token */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="mb-3">
            <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
              Telegram Bot Token
            </h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Token from @BotFather</p>
          </div>
          <input
            type="password"
            placeholder="123456789:ABCdef..."
            value={settings.telegramBotToken || ''}
            onChange={(e) => setSettings({ ...settings, telegramBotToken: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
          />
        </div>

        {/* Discord Token */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="mb-3">
            <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
              Discord Bot Token
            </h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Token from Discord Developer Portal</p>
          </div>
          <input
            type="password"
            placeholder="MTIz..."
            value={settings.discordBotToken || ''}
            onChange={(e) => setSettings({ ...settings, discordBotToken: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[#5865F2]/50 focus:ring-2 focus:ring-[#5865F2]/10 transition-all"
          />
        </div>

        {/* WhatsApp - QR Code Auth */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[#25D366]/30 shadow-sm">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">W</span>
              </div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                WhatsApp
              </h4>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Connect via QR code scan (like WhatsApp Web)
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-center">
            <div className="w-32 h-32 mx-auto mb-3 rounded-lg bg-white flex items-center justify-center border border-gray-200">
              <span className="text-[11px] text-gray-400">QR Code</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Scan with WhatsApp to connect
            </p>
            <button className="mt-3 px-4 py-2 rounded-lg bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-[12px] font-medium hover:shadow-lg hover:shadow-[#25D366]/25 transition-all">
              Generate QR Code
            </button>
          </div>
        </div>

        {/* Slack Tokens */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[#4A154B]/30 shadow-sm">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#4A154B] to-[#611F69] flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">S</span>
              </div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                Slack
              </h4>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Tokens from Slack API Dashboard
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">Bot Token</label>
              <input
                type="password"
                placeholder="xoxb-..."
                value={settings.slackBotToken || ''}
                onChange={(e) => setSettings({ ...settings, slackBotToken: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[#4A154B]/50 focus:ring-2 focus:ring-[#4A154B]/10 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">App Token (Socket Mode)</label>
              <input
                type="password"
                placeholder="xapp-..."
                value={settings.slackAppToken || ''}
                onChange={(e) => setSettings({ ...settings, slackAppToken: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[#4A154B]/50 focus:ring-2 focus:ring-[#4A154B]/10 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Line Tokens */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[#00B900]/30 shadow-sm">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#00B900] to-[#00C300] flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">L</span>
              </div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                Line
              </h4>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Credentials from LINE Developers Console
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">Channel Access Token</label>
              <input
                type="password"
                placeholder="Token from Messaging API"
                value={settings.lineChannelAccessToken || ''}
                onChange={(e) => setSettings({ ...settings, lineChannelAccessToken: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[#00B900]/50 focus:ring-2 focus:ring-[#00B900]/10 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">Channel Secret</label>
              <input
                type="password"
                placeholder="Secret from Basic Settings"
                value={settings.lineChannelSecret || ''}
                onChange={(e) => setSettings({ ...settings, lineChannelSecret: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[#00B900]/50 focus:ring-2 focus:ring-[#00B900]/10 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Language */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">Language</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Display language</p>
            </div>
            <select
              value={settings.language || 'en'}
              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
              className="w-auto min-w-[100px] px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50"
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </div>
        </div>
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

function NetworkSettings(): JSX.Element {
  return (
    <div className="space-y-6">
      {/* Proxy Section */}
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Proxy Settings</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5 mb-4">
          Configure proxy for external connections
        </p>
        <ProxySettings />
      </div>

      {/* Tailscale Section */}
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Tailscale VPN</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5 mb-4">
          Secure mesh network for private connectivity
        </p>
        <TailscaleStatus />
      </div>
    </div>
  )
}

function ModelSettings(): JSX.Element {
  const [settings, setSettings] = useState<Partial<AppSettings>>({})
  const [originalSettings, setOriginalSettings] = useState<Partial<AppSettings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const result = await window.settings.get()
      if (result.success && result.data) {
        setSettings(result.data)
        setOriginalSettings(result.data)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
    setLoading(false)
  }

  const hasChanges =
    settings.claudeModel !== originalSettings.claudeModel ||
    settings.maxTokens !== originalSettings.maxTokens ||
    settings.temperature !== originalSettings.temperature ||
    settings.systemPrompt !== originalSettings.systemPrompt

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const result = await window.settings.save({
        claudeModel: settings.claudeModel,
        maxTokens: settings.maxTokens,
        temperature: settings.temperature,
        systemPrompt: settings.systemPrompt
      })
      if (result.success) {
        setOriginalSettings({ ...originalSettings, ...settings })
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
        <Loader2 className="w-5 h-5 text-[var(--primary)] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">AI Model</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
          Configure AI model parameters
        </p>
      </div>

      <div className="space-y-3">
        {/* Model Selection */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">Model</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Claude model version</p>
            </div>
            <select
              value={settings.claudeModel || 'claude-sonnet-4-5'}
              onChange={(e) => setSettings({ ...settings, claudeModel: e.target.value })}
              className="w-auto min-w-[180px] px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50"
            >
              <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
              <option value="claude-opus-4-5">Claude Opus 4.5</option>
              <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
            </select>
          </div>
        </div>

        {/* Max Tokens */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">Max Tokens</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Maximum response length</p>
            </div>
            <span className="text-[13px] text-[var(--primary)] font-medium tabular-nums">
              {settings.maxTokens || 8192}
            </span>
          </div>
          <Slider
            min={1024}
            max={16384}
            step={1024}
            value={settings.maxTokens || 8192}
            onChange={(value) => setSettings({ ...settings, maxTokens: value })}
          />
        </div>

        {/* Temperature */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">Temperature</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Creativity level (0-1)</p>
            </div>
            <span className="text-[13px] text-[var(--primary)] font-medium tabular-nums">
              {(settings.temperature || 0.7).toFixed(1)}
            </span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.1}
            value={settings.temperature || 0.7}
            onChange={(value) => setSettings({ ...settings, temperature: value })}
          />
        </div>

        {/* System Prompt */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="mb-3">
            <h4 className="text-[13px] font-medium text-[var(--text-primary)]">System Prompt</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Custom instructions (leave empty for default)
            </p>
          </div>
          <textarea
            rows={4}
            placeholder="You are a helpful assistant..."
            value={settings.systemPrompt || ''}
            onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all resize-none"
          />
        </div>
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

function DataSettings(): JSX.Element {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Data</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
          Manage your data and storage
        </p>
      </div>

      <div className="space-y-3">
        {/* Storage Info */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">Storage Used</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Local message storage</p>
            </div>
            <span className="text-[13px] text-[var(--text-primary)] font-medium tabular-nums">
              --
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--bg-input)]">
            <div className="w-0 h-full rounded-full bg-gradient-to-r from-[#7DCBF7] to-[#2596D1]" />
          </div>
        </div>

        {/* Export Data */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">Export Data</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Download all messages as JSON
              </p>
            </div>
            <button className="px-4 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] font-medium hover:bg-[var(--bg-card-solid)] hover:shadow-md transition-all">
              Export
            </button>
          </div>
        </div>

        {/* Clear Data */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">Clear All Data</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Delete all stored messages
              </p>
            </div>
            <button className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[13px] text-red-600 dark:text-red-400 font-medium hover:bg-red-500/20 transition-all">
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AboutSection(): JSX.Element {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">About</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Application information</p>
      </div>

      <div className="p-6 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#7DCBF7] to-[#2596D1] flex items-center justify-center shadow-lg shadow-[#2596D1]/25">
          <span className="text-white text-2xl font-bold">M</span>
        </div>
        <h4 className="text-lg font-semibold text-[var(--text-primary)]">Local Memu</h4>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Version 1.0.0</p>
        <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
          <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
            A local AI assistant with Computer Use.
            <br />
            Powered by Claude AI.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="p-3.5 rounded-xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--text-muted)]">Electron</span>
            <span className="text-[12px] text-[var(--text-primary)] font-medium tabular-nums">
              28.0.0
            </span>
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--text-muted)]">Node.js</span>
            <span className="text-[12px] text-[var(--text-primary)] font-medium tabular-nums">
              20.x
            </span>
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[var(--text-muted)]">Chrome</span>
            <span className="text-[12px] text-[var(--text-primary)] font-medium tabular-nums">
              120.x
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
