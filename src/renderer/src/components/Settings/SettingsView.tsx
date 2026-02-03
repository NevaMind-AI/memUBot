import { useState, useEffect, useRef } from 'react'
import { Bot, Info, Key, Database, Loader2, Check, AlertCircle, Shield, Server, Sparkles, Play, FlaskConical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SecuritySettings } from './SecuritySettings'
import { McpSettings } from './McpSettings'
import { SkillsSettings } from './SkillsSettings'
import { ServicesSettings } from './ServicesSettings'
import { ExperimentalSettings } from './ExperimentalSettings'
import { Slider } from '../Slider'
import { changeLanguage, languages } from '../../i18n'
import appIcon from '../../assets/app-icon.png'
import logoSvg from '../../assets/logo.svg'
import { TelegramIcon, DiscordIcon, SlackIcon, FeishuIcon } from '../Icons/AppIcons'

type SettingsTab = 'general' | 'security' | 'model' | 'skills' | 'services' | 'mcp' | 'data' | 'experimental' | 'about'

type LLMProvider = 'claude' | 'minimax' | 'custom'

const PROVIDER_OPTIONS: { value: LLMProvider; label: string }[] = [
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'minimax', label: 'MiniMax' },
  { value: 'custom', label: 'Custom Provider' }
]

interface AppSettings {
  // LLM Provider selection
  llmProvider: LLMProvider
  // Claude settings
  claudeApiKey: string
  claudeModel: string
  // MiniMax settings
  minimaxApiKey: string
  minimaxModel: string
  // Custom provider settings
  customApiKey: string
  customBaseUrl: string
  customModel: string
  // Shared settings
  maxTokens: number
  temperature: number
  systemPrompt: string
  memuBaseUrl: string
  memuApiKey: string
  memuUserId: string
  memuAgentId: string
  telegramBotToken: string
  telegramAutoConnect: boolean
  discordBotToken: string
  discordAutoConnect: boolean
  whatsappEnabled: boolean
  slackBotToken: string
  slackAppToken: string
  slackAutoConnect: boolean
  lineChannelAccessToken: string
  lineChannelSecret: string
  feishuAppId: string
  feishuAppSecret: string
  feishuAutoConnect: boolean
  language: string
}

export function SettingsView(): JSX.Element {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  const tabs = [
    { id: 'general' as const, icon: Key, labelKey: 'settings.tabs.general' },
    { id: 'security' as const, icon: Shield, labelKey: 'settings.tabs.security' },
    { id: 'model' as const, icon: Bot, labelKey: 'settings.tabs.model' },
    { id: 'skills' as const, icon: Sparkles, labelKey: 'settings.tabs.skills' },
    { id: 'services' as const, icon: Play, labelKey: 'settings.tabs.services' },
    { id: 'mcp' as const, icon: Server, labelKey: 'settings.tabs.mcp' },
    { id: 'data' as const, icon: Database, labelKey: 'settings.tabs.data' },
    { id: 'experimental' as const, icon: FlaskConical, labelKey: 'settings.tabs.experimental' },
    { id: 'about' as const, icon: Info, labelKey: 'settings.tabs.about' }
  ]

  return (
    <div className="flex-1 flex">
      {/* Settings Sidebar */}
      <div className="w-52 bg-[var(--glass-bg)] backdrop-blur-xl border-r border-[var(--glass-border)] py-4">
        <nav className="px-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            // Check if labelKey is a translation key or plain text
            const label = tab.labelKey.includes('.') ? t(tab.labelKey) : tab.labelKey

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
                <span className="text-[13px] font-medium">{label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="max-w-lg mx-auto py-6 px-5 pb-24">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'model' && <ModelSettings />}
          {activeTab === 'skills' && <SkillsSettings />}
          {activeTab === 'services' && <ServicesSettings />}
          {activeTab === 'mcp' && <McpSettings />}
          {activeTab === 'data' && <DataSettings />}
          {activeTab === 'experimental' && <ExperimentalSettings />}
          {activeTab === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  )
}

// Floating Save Button Component
interface FloatingSaveButtonProps {
  show: boolean
  saving: boolean
  onSave: () => void
}

function FloatingSaveButton({ show, saving, onSave }: FloatingSaveButtonProps): JSX.Element | null {
  const { t } = useTranslation()
  
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
        show 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-16 pointer-events-none'
      }`}
      style={{ marginLeft: '104px' }} // Offset for sidebar (208px / 2)
    >
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-[#7DCBF7] to-[#2596D1] text-white text-[13px] font-medium shadow-xl shadow-[#2596D1]/30 hover:shadow-2xl hover:shadow-[#2596D1]/40 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t('common.saving')}</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            <span>{t('common.saveChanges')}</span>
          </>
        )}
      </button>
    </div>
  )
}

function GeneralSettings(): JSX.Element {
  const { t } = useTranslation()
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
    // LLM Provider settings
    settings.llmProvider !== originalSettings.llmProvider ||
    // Claude settings
    settings.claudeApiKey !== originalSettings.claudeApiKey ||
    settings.claudeModel !== originalSettings.claudeModel ||
    // MiniMax settings
    settings.minimaxApiKey !== originalSettings.minimaxApiKey ||
    settings.minimaxModel !== originalSettings.minimaxModel ||
    // Custom provider settings
    settings.customApiKey !== originalSettings.customApiKey ||
    settings.customBaseUrl !== originalSettings.customBaseUrl ||
    settings.customModel !== originalSettings.customModel ||
    // Other settings
    settings.memuApiKey !== originalSettings.memuApiKey ||
    settings.memuUserId !== originalSettings.memuUserId ||
    settings.memuAgentId !== originalSettings.memuAgentId ||
    settings.telegramBotToken !== originalSettings.telegramBotToken ||
    settings.telegramAutoConnect !== originalSettings.telegramAutoConnect ||
    settings.discordBotToken !== originalSettings.discordBotToken ||
    settings.discordAutoConnect !== originalSettings.discordAutoConnect ||
    settings.slackBotToken !== originalSettings.slackBotToken ||
    settings.slackAppToken !== originalSettings.slackAppToken ||
    settings.slackAutoConnect !== originalSettings.slackAutoConnect ||
    settings.feishuAppId !== originalSettings.feishuAppId ||
    settings.feishuAppSecret !== originalSettings.feishuAppSecret ||
    settings.feishuAutoConnect !== originalSettings.feishuAutoConnect ||
    settings.language !== originalSettings.language

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const result = await window.settings.save({
        // LLM Provider selection
        llmProvider: settings.llmProvider,
        // Claude settings
        claudeApiKey: settings.claudeApiKey,
        claudeModel: settings.claudeModel,
        // MiniMax settings
        minimaxApiKey: settings.minimaxApiKey,
        minimaxModel: settings.minimaxModel,
        // Custom provider settings
        customApiKey: settings.customApiKey,
        customBaseUrl: settings.customBaseUrl,
        customModel: settings.customModel,
        // Other settings
        memuApiKey: settings.memuApiKey,
        telegramBotToken: settings.telegramBotToken,
        telegramAutoConnect: settings.telegramAutoConnect,
        discordBotToken: settings.discordBotToken,
        discordAutoConnect: settings.discordAutoConnect,
        slackBotToken: settings.slackBotToken,
        slackAppToken: settings.slackAppToken,
        slackAutoConnect: settings.slackAutoConnect,
        feishuAppId: settings.feishuAppId,
        feishuAppSecret: settings.feishuAppSecret,
        feishuAutoConnect: settings.feishuAutoConnect,
        language: settings.language
      })
      if (result.success) {
        setOriginalSettings({ ...originalSettings, ...settings })
        setMessage({ type: 'success', text: t('settings.saved') })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.saveError') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.saveError') })
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
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('settings.tabs.general')}</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{t('settings.general.title')}</p>
      </div>

      <div className="space-y-3">
        {/* LLM Provider Selection */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="mb-3">
            <h4 className="text-[13px] font-medium text-[var(--text-primary)]">{t('settings.llm.provider')}</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{t('settings.llm.providerHint')}</p>
          </div>
          
          {/* Provider Selector */}
          <div className="mb-4">
            <select
              value={settings.llmProvider || 'claude'}
              onChange={(e) => setSettings({ ...settings, llmProvider: e.target.value as LLMProvider })}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Claude Settings */}
          {(settings.llmProvider || 'claude') === 'claude' && (
            <div className="space-y-3 p-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)]/50">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.general.apiKey')}</label>
                <input
                  type="password"
                  placeholder="sk-ant-api03-..."
                  value={settings.claudeApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, claudeApiKey: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.llm.model')}</label>
                <input
                  type="text"
                  placeholder="claude-opus-4-5"
                  value={settings.claudeModel || ''}
                  onChange={(e) => setSettings({ ...settings, claudeModel: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
                />
              </div>
            </div>
          )}

          {/* MiniMax Settings */}
          {settings.llmProvider === 'minimax' && (
            <div className="space-y-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.general.apiKey')}</label>
                <input
                  type="password"
                  placeholder="MiniMax API Key"
                  value={settings.minimaxApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, minimaxApiKey: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.llm.model')}</label>
                <input
                  type="text"
                  placeholder="MiniMax-M2.1"
                  value={settings.minimaxModel || ''}
                  onChange={(e) => setSettings({ ...settings, minimaxModel: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all"
                />
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10">
                <p className="text-[11px] text-blue-400">
                  {t('settings.llm.minimaxInfo')}
                </p>
              </div>
            </div>
          )}

          {/* Custom Provider Settings */}
          {settings.llmProvider === 'custom' && (
            <div className="space-y-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.llm.baseUrl')}</label>
                <input
                  type="text"
                  placeholder="https://api.example.com/anthropic"
                  value={settings.customBaseUrl || ''}
                  onChange={(e) => setSettings({ ...settings, customBaseUrl: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.general.apiKey')}</label>
                <input
                  type="password"
                  placeholder="API Key"
                  value={settings.customApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, customApiKey: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.llm.model')}</label>
                <input
                  type="text"
                  placeholder="model-name"
                  value={settings.customModel || ''}
                  onChange={(e) => setSettings({ ...settings, customModel: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 transition-all"
                />
              </div>
            </div>
          )}
        </div>

        {/* Memu Settings */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[#2596D1]/30 shadow-sm">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md flex items-center justify-center p-0.5">
                <img src={logoSvg} alt="memU" className="w-full h-full" />
              </div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                {t('settings.memu.title')}
              </h4>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">{t('settings.memu.hint')}</p>
          </div>
          <div className="space-y-3">
            {/* API Key */}
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.memu.apiKey')}</label>
              <input
                type="password"
                placeholder="mu_..."
                value={settings.memuApiKey || ''}
                onChange={(e) => setSettings({ ...settings, memuApiKey: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[#2596D1]/50 focus:ring-2 focus:ring-[#2596D1]/10 transition-all"
              />
            </div>
            {/* User ID */}
            {/* <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.memu.userId')}</label>
              <input
                type="text"
                placeholder="user_..."
                value={settings.memuUserId || ''}
                onChange={(e) => setSettings({ ...settings, memuUserId: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[#2596D1]/50 focus:ring-2 focus:ring-[#2596D1]/10 transition-all"
              />
            </div> */}
            {/* Agent ID */}
            {/* <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.memu.agentId')}</label>
              <input
                type="text"
                placeholder="agent_..."
                value={settings.memuAgentId || ''}
                onChange={(e) => setSettings({ ...settings, memuAgentId: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[#2596D1]/50 focus:ring-2 focus:ring-[#2596D1]/10 transition-all"
              />
            </div> */}
          </div>
        </div>

        {/* Telegram Token */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[#0088cc]/30 shadow-sm">
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tl from-[#2AABEE] to-[#0088CC] flex items-center justify-center">
                  <TelegramIcon className="w-3 h-3 text-white" />
                </div>
                <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                  Telegram
                </h4>
              </div>
              {/* Auto Connect Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-muted)]">{t('settings.platforms.autoConnect')}</span>
                <button
                  onClick={() => setSettings({ ...settings, telegramAutoConnect: !settings.telegramAutoConnect })}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.telegramAutoConnect ? 'bg-[#0088cc]' : 'bg-[var(--bg-input)]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.telegramAutoConnect ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">{t('settings.platforms.telegram.botTokenHint')}</p>
          </div>
          <input
            type="password"
            placeholder="123456789:ABCdef..."
            value={settings.telegramBotToken || ''}
            onChange={(e) => setSettings({ ...settings, telegramBotToken: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[#0088cc]/50 focus:ring-2 focus:ring-[#0088cc]/10 transition-all"
          />
        </div>

        {/* Discord Token */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[#5865F2]/30 shadow-sm">
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#5865F2] to-[#7289DA] flex items-center justify-center">
                  <DiscordIcon className="w-3 h-3 text-white" />
                </div>
                <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                  Discord
                </h4>
              </div>
              {/* Auto Connect Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-muted)]">{t('settings.platforms.autoConnect')}</span>
                <button
                  onClick={() => setSettings({ ...settings, discordAutoConnect: !settings.discordAutoConnect })}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.discordAutoConnect ? 'bg-[#5865F2]' : 'bg-[var(--bg-input)]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.discordAutoConnect ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">{t('settings.platforms.discord.botTokenHint')}</p>
          </div>
          <input
            type="password"
            placeholder="MTIz..."
            value={settings.discordBotToken || ''}
            onChange={(e) => setSettings({ ...settings, discordBotToken: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[#5865F2]/50 focus:ring-2 focus:ring-[#5865F2]/10 transition-all"
          />
        </div>

        {/* WhatsApp - QR Code Auth - Temporarily disabled */}
        {/* <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[#25D366]/30 shadow-sm">
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
        </div> */}

        {/* Slack Tokens */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[#611F69]/40 dark:border-[#E0B3E6]/30 shadow-sm">
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#4A154B] to-[#611F69] flex items-center justify-center">
                  <SlackIcon className="w-3 h-3 text-white" />
                </div>
                <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                  Slack
                </h4>
              </div>
              {/* Auto Connect Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-muted)]">{t('settings.platforms.autoConnect')}</span>
                <button
                  onClick={() => setSettings({ ...settings, slackAutoConnect: !settings.slackAutoConnect })}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.slackAutoConnect ? 'bg-[#4A154B]' : 'bg-[var(--bg-input)]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.slackAutoConnect ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              {t('settings.platforms.slack.tokensHint')}
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">{t('settings.platforms.slack.botToken')}</label>
              <input
                type="password"
                placeholder="xoxb-..."
                value={settings.slackBotToken || ''}
                onChange={(e) => setSettings({ ...settings, slackBotToken: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[#4A154B]/50 focus:ring-2 focus:ring-[#4A154B]/10 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">{t('settings.platforms.slack.appToken')}</label>
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

        {/* Line Tokens - Temporarily disabled */}
        {/* <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[#00B900]/30 shadow-sm">
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
        </div> */}

        {/* Feishu Tokens */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[#3370FF]/30">
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-white to-[#F5F6F7] dark:from-[#2A2B2E] dark:to-[#1F2023] ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center">
                  <FeishuIcon className="w-3 h-3" />
                </div>
                <h4 className="text-[13px] font-medium text-[var(--text-primary)]">{t('settings.platforms.feishu.title')}</h4>
              </div>
              {/* Auto Connect Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-muted)]">{t('settings.platforms.autoConnect')}</span>
                <button
                  onClick={() => setSettings({ ...settings, feishuAutoConnect: !settings.feishuAutoConnect })}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.feishuAutoConnect ? 'bg-[#3370FF]' : 'bg-[var(--bg-input)]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      settings.feishuAutoConnect ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">{t('settings.platforms.feishu.appId')}</label>
              <input
                type="text"
                placeholder={t('settings.platforms.feishu.appIdPlaceholder')}
                value={settings.feishuAppId || ''}
                onChange={(e) => setSettings({ ...settings, feishuAppId: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[#3370FF]/50 focus:ring-2 focus:ring-[#3370FF]/10 transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-muted)] mb-1.5 block">{t('settings.platforms.feishu.appSecret')}</label>
              <input
                type="password"
                placeholder={t('settings.platforms.feishu.appSecretPlaceholder')}
                value={settings.feishuAppSecret || ''}
                onChange={(e) => setSettings({ ...settings, feishuAppSecret: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[#3370FF]/50 focus:ring-2 focus:ring-[#3370FF]/10 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Language */}
        <LanguageSelector />
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

      {/* Floating Save Button */}
      <FloatingSaveButton show={hasChanges} saving={saving} onSave={handleSave} />
    </div>
  )
}

function ModelSettings(): JSX.Element {
  const { t } = useTranslation()
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
    settings.maxTokens !== originalSettings.maxTokens ||
    settings.temperature !== originalSettings.temperature ||
    settings.systemPrompt !== originalSettings.systemPrompt

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const result = await window.settings.save({
        maxTokens: settings.maxTokens,
        temperature: settings.temperature,
        systemPrompt: settings.systemPrompt
      })
      if (result.success) {
        setOriginalSettings({ ...originalSettings, ...settings })
        setMessage({ type: 'success', text: t('settings.saved') })
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.saveError') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.saveError') })
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
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('settings.model.title')}</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
          {t('settings.model.description')}
        </p>
      </div>

      <div className="space-y-3">
        {/* Max Tokens */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">{t('settings.model.maxTokens')}</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{t('settings.model.maxTokensHint')}</p>
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
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">{t('settings.model.temperature')}</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{t('settings.model.temperatureHint')}</p>
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
            <h4 className="text-[13px] font-medium text-[var(--text-primary)]">{t('settings.model.systemPrompt')}</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {t('settings.model.systemPromptHint')}
            </p>
          </div>
          <textarea
            rows={4}
            placeholder={t('settings.model.systemPromptPlaceholder')}
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

      {/* Floating Save Button */}
      <FloatingSaveButton show={hasChanges} saving={saving} onSave={handleSave} />
    </div>
  )
}

interface StorageFolder {
  name: string
  key: string
  size: number
  color: string
}

interface StorageInfo {
  total: number
  folders: StorageFolder[]
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function DataSettings(): JSX.Element {
  const { t } = useTranslation()
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadStorageInfo = async () => {
    setLoading(true)
    try {
      const result = await window.settings.getStorageInfo()
      if (result.success && result.data) {
        setStorageInfo(result.data)
      }
    } catch (error) {
      console.error('Failed to load storage info:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadStorageInfo()
  }, [])

  const handleOpenMessagesFolder = async (platform?: string) => {
    try {
      await window.settings.openMessagesFolder(platform)
    } catch (error) {
      console.error('Failed to open messages folder:', error)
    }
  }

  const handleClearCache = async () => {
    setClearing(true)
    setMessage(null)
    try {
      const result = await window.settings.clearCache()
      if (result.success) {
        const clearedSize = result.data || 0
        setMessage({
          type: 'success',
          text: t('settings.data.cacheCleared', { size: formatBytes(clearedSize) })
        })
        // Reload storage info
        await loadStorageInfo()
        setTimeout(() => setMessage(null), 3000)
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.data.clearFailed') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.data.clearFailed') })
    }
    setClearing(false)
  }

  // Translate folder names
  const getFolderName = (key: string): string => {
    const nameMap: Record<string, string> = {
      telegram: t('settings.data.folders.telegram'),
      discord: t('settings.data.folders.discord'),
      slack: t('settings.data.folders.slack'),
      feishu: t('settings.data.folders.feishu'),
      mcpOutput: t('settings.data.folders.mcpOutput'),
      agentOutput: t('settings.data.folders.agentOutput'),
      skills: t('settings.data.folders.skills'),
      cache: t('settings.data.folders.cache'),
      other: t('settings.data.folders.other')
    }
    return nameMap[key] || key
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('settings.data.title')}</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
          {t('settings.data.description')}
        </p>
      </div>

      <div className="space-y-3">
        {/* Storage Info */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">{t('settings.data.storageUsed')}</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{t('settings.data.storageHint')}</p>
            </div>
            <span className="text-[13px] text-[var(--text-primary)] font-medium tabular-nums">
              {loading ? '--' : formatBytes(storageInfo?.total || 0)}
            </span>
          </div>

          {/* Storage Bar */}
          <div className="w-full h-3 rounded-full bg-[var(--bg-input)] overflow-hidden flex">
            {!loading && storageInfo && storageInfo.folders.map((folder, index) => {
              const percentage = storageInfo.total > 0 ? (folder.size / storageInfo.total) * 100 : 0
              if (percentage < 0.5) return null // Skip very small segments
              return (
                <div
                  key={folder.key}
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: folder.color,
                    borderRadius: index === 0 ? '9999px 0 0 9999px' : index === storageInfo.folders.length - 1 ? '0 9999px 9999px 0' : '0'
                  }}
                  title={`${getFolderName(folder.key)}: ${formatBytes(folder.size)}`}
                />
              )
            })}
          </div>

          {/* Legend */}
          {!loading && storageInfo && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {storageInfo.folders.map((folder) => (
                <div key={folder.key} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: folder.color }}
                  />
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {getFolderName(folder.key)}
                  </span>
                  <span className="text-[11px] text-[var(--text-primary)] font-medium tabular-nums">
                    {formatBytes(folder.size)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages Folders */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="mb-3">
            <h4 className="text-[13px] font-medium text-[var(--text-primary)]">{t('settings.data.messagesFolder')}</h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              {t('settings.data.messagesFolderHint')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Telegram */}
            <button
              onClick={() => handleOpenMessagesFolder('telegram')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0088cc]/10 border border-[#0088cc]/20 text-[12px] text-[#0088cc] font-medium hover:bg-[#0088cc]/20 transition-all"
            >
              <TelegramIcon className="w-4 h-4" />
              Telegram
            </button>
            {/* Discord */}
            <button
              onClick={() => handleOpenMessagesFolder('discord')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/20 text-[12px] text-[#5865F2] font-medium hover:bg-[#5865F2]/20 transition-all"
            >
              <DiscordIcon className="w-4 h-4" />
              Discord
            </button>
            {/* Slack */}
            <button
              onClick={() => handleOpenMessagesFolder('slack')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#611F69]/10 border border-[#611F69]/20 text-[12px] text-[#611F69] dark:text-[#E0B3E6] font-medium hover:bg-[#611F69]/20 transition-all"
            >
              <SlackIcon className="w-4 h-4" />
              Slack
            </button>
            {/* Feishu */}
            <button
              onClick={() => handleOpenMessagesFolder('feishu')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#3370FF]/10 border border-[#3370FF]/20 text-[12px] text-[#3370FF] font-medium hover:bg-[#3370FF]/20 transition-all"
            >
              <FeishuIcon className="w-4 h-4" />
              Feishu
            </button>
          </div>
        </div>

        {/* Clear Cache */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">{t('settings.data.clearCache')}</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {t('settings.data.clearCacheHint')}
              </p>
            </div>
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[13px] text-amber-600 dark:text-amber-400 font-medium hover:bg-amber-500/20 transition-all disabled:opacity-50"
            >
              {clearing ? t('common.clearing') : t('common.clear')}
            </button>
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
      </div>
    </div>
  )
}

interface LogEntry {
  timestamp: number
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
}

function AboutSection(): JSX.Element {
  const { t } = useTranslation()
  const [clickCount, setClickCount] = useState(0)
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const logsEndRef = useRef<HTMLDivElement | null>(null)

  const handleVersionClick = async (): Promise<void> => {
    // Reset timeout on each click
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
    }

    const newCount = clickCount + 1
    setClickCount(newCount)

    if (newCount >= 3) {
      setClickCount(0)
      // Check if production - show logs viewer, otherwise open DevTools
      const result = await window.settings.getLogs()
      if (result.success && result.data) {
        if (result.data.isProduction) {
          setLogs(result.data.logs)
          setShowLogs(true)
        } else {
          // Dev mode - open DevTools
          window.settings.openDevTools()
        }
      }
    } else {
      // Reset count after 1 second of no clicks
      clickTimeoutRef.current = setTimeout(() => {
        setClickCount(0)
      }, 1000)
    }
  }

  const refreshLogs = async (): Promise<void> => {
    const result = await window.settings.getLogs()
    if (result.success && result.data) {
      setLogs(result.data.logs)
      // Scroll to bottom after update
      setTimeout(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    }
  }

  const clearLogs = async (): Promise<void> => {
    await window.settings.clearLogs()
    setLogs([])
  }

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getLevelColor = (level: LogEntry['level']): string => {
    switch (level) {
      case 'error': return 'text-red-500'
      case 'warn': return 'text-amber-500'
      case 'info': return 'text-blue-500'
      default: return 'text-[var(--text-muted)]'
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('settings.about.title')}</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{t('settings.about.description')}</p>
      </div>

      {/* Log Viewer Panel (only shown when activated in production) */}
      {showLogs && (
        <div className="rounded-2xl bg-[#1a1a1a] border border-[var(--border-color)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-[#252525] border-b border-[var(--border-color)]">
            <span className="text-[12px] font-medium text-[var(--text-primary)]">Console Logs</span>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshLogs}
                className="px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={clearLogs}
                className="px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setShowLogs(false)}
                className="px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
          <div className="h-64 overflow-y-auto p-2 font-mono text-[11px]">
            {logs.length === 0 ? (
              <div className="text-[var(--text-muted)] text-center py-8">No logs yet</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="flex gap-2 py-0.5 hover:bg-[#252525]">
                  <span className="text-[#666] shrink-0">{formatTime(log.timestamp)}</span>
                  <span className={`shrink-0 w-12 ${getLevelColor(log.level)}`}>[{log.level}]</span>
                  <span className="text-[#ccc] whitespace-pre-wrap break-all">{log.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      <div className="p-6 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[var(--icon-bg)] flex items-center justify-center shadow-lg">
          <img src={appIcon} alt="memU" className="w-16 h-16 rounded-xl" />
        </div>
        <h4 className="text-lg font-semibold text-[var(--text-primary)]">memU bot</h4>
        <p 
          className="text-[12px] text-[var(--text-muted)] mt-0.5 cursor-pointer select-none"
          onClick={handleVersionClick}
        >
          {t('settings.about.version')} 1.0.0
        </p>
        <div className="mt-4 pt-4 border-t border-[var(--border-color)] text-left space-y-2">
          <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
            {t('settings.about.tagline')}
          </p>
          <ul className="text-[12px] text-[var(--text-muted)] leading-relaxed space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-[var(--primary)]">•</span>
              <span>{t('settings.about.feature1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--primary)]">•</span>
              <span>{t('settings.about.feature2')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--primary)]">•</span>
              <span>{t('settings.about.feature3')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--primary)]">•</span>
              <span>{t('settings.about.feature4')}</span>
            </li>
          </ul>
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

/**
 * Language Selector Component
 */
function LanguageSelector(): JSX.Element {
  const { t, i18n } = useTranslation()
  const currentLang = i18n.language

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value
    changeLanguage(newLang)
  }

  return (
    <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
            {t('settings.general.language')}
          </h4>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {t('settings.general.languageHint')}
          </p>
        </div>
        <select
          value={currentLang}
          onChange={handleLanguageChange}
          className="w-auto min-w-[120px] px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--primary)]/50"
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.nativeName}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
