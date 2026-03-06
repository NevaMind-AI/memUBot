import { useState, useEffect } from 'react'
import { Search, Loader2, Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { changeLanguage, languages } from '../../i18n'
import logoSvg from '../../assets/logo.svg'
import { 
  AppSettings, 
  LLMProvider, 
  PROVIDER_OPTIONS, 
  UnsavedChangesBar, 
  MessageDisplay, 
  LoadingSpinner 
} from './shared'

export function GeneralSettings(): JSX.Element {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<Partial<AppSettings>>({})
  const [originalSettings, setOriginalSettings] = useState<Partial<AppSettings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
    // Zenmux settings
    settings.zenmuxApiKey !== originalSettings.zenmuxApiKey ||
    settings.zenmuxModel !== originalSettings.zenmuxModel ||
    // Custom provider settings
    settings.customApiKey !== originalSettings.customApiKey ||
    settings.customBaseUrl !== originalSettings.customBaseUrl ||
    settings.customModel !== originalSettings.customModel ||
    // Ollama settings
    settings.ollamaApiKey !== originalSettings.ollamaApiKey ||
    settings.ollamaBaseUrl !== originalSettings.ollamaBaseUrl ||
    settings.ollamaModel !== originalSettings.ollamaModel ||
    // OpenAI settings
    settings.openaiApiKey !== originalSettings.openaiApiKey ||
    settings.openaiBaseUrl !== originalSettings.openaiBaseUrl ||
    settings.openaiModel !== originalSettings.openaiModel ||
    // Gemini settings
    settings.geminiApiKey !== originalSettings.geminiApiKey ||
    settings.geminiModel !== originalSettings.geminiModel ||
    // Other settings
    settings.memuApiKey !== originalSettings.memuApiKey ||
    settings.memuUserId !== originalSettings.memuUserId ||
    settings.memuAgentId !== originalSettings.memuAgentId ||
    settings.language !== originalSettings.language ||
    settings.tavilyApiKey !== originalSettings.tavilyApiKey

  // Clear test result when settings change
  useEffect(() => {
    setTestResult(null)
  }, [settings.llmProvider, settings.claudeApiKey, settings.claudeModel, settings.zenmuxApiKey, settings.zenmuxModel, settings.minimaxApiKey, settings.minimaxModel, settings.ollamaBaseUrl, settings.ollamaModel, settings.openaiApiKey, settings.openaiBaseUrl, settings.openaiModel, settings.geminiApiKey, settings.geminiModel, settings.customApiKey, settings.customBaseUrl, settings.customModel])

  const handleDiscard = () => {
    setSettings({ ...originalSettings })
  }

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
        // Zenmux settings
        zenmuxApiKey: settings.zenmuxApiKey,
        zenmuxModel: settings.zenmuxModel,
        // Ollama settings
        ollamaApiKey: settings.ollamaApiKey,
        ollamaBaseUrl: settings.ollamaBaseUrl,
        ollamaModel: settings.ollamaModel,
        // OpenAI settings
        openaiApiKey: settings.openaiApiKey,
        openaiBaseUrl: settings.openaiBaseUrl,
        openaiModel: settings.openaiModel,
        // Gemini settings
        geminiApiKey: settings.geminiApiKey,
        geminiModel: settings.geminiModel,
        // Custom provider settings
        customApiKey: settings.customApiKey,
        customBaseUrl: settings.customBaseUrl,
        customModel: settings.customModel,
        // Other settings
        memuApiKey: settings.memuApiKey,
        language: settings.language,
        tavilyApiKey: settings.tavilyApiKey
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

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const provider = settings.llmProvider || 'claude'
      let config: { apiKey: string; baseUrl?: string; model: string }

      switch (provider) {
        case 'claude':
          config = { apiKey: settings.claudeApiKey || '', model: settings.claudeModel || 'claude-opus-4-5' }
          break
        case 'minimax':
          config = { apiKey: settings.minimaxApiKey || '', baseUrl: 'https://api.minimaxi.com/anthropic', model: settings.minimaxModel || 'MiniMax-M2.1' }
          break
        case 'zenmux':
          config = { apiKey: settings.zenmuxApiKey || '', baseUrl: 'https://zenmux.ai/api/anthropic', model: settings.zenmuxModel || '' }
          break
        case 'ollama':
          config = { apiKey: 'ollama', baseUrl: settings.ollamaBaseUrl || 'http://localhost:11434/v1', model: settings.ollamaModel || 'llama3' }
          break
        case 'openai':
          config = { apiKey: settings.openaiApiKey || '', baseUrl: settings.openaiBaseUrl || 'https://api.openai.com/v1', model: settings.openaiModel || 'gpt-4o' }
          break
        case 'gemini':
          config = { apiKey: settings.geminiApiKey || '', model: settings.geminiModel || 'gemini-2.5-pro' }
          break
        case 'custom':
          config = { apiKey: settings.customApiKey || '', baseUrl: settings.customBaseUrl || undefined, model: settings.customModel || '' }
          break
        default:
          config = { apiKey: settings.claudeApiKey || '', model: settings.claudeModel || 'claude-opus-4-5' }
      }

      const result = await window.settings.testConnection(provider, config)
      if (result.success) {
        setTestResult({ type: 'success', text: t('settings.llm.testSuccess') })
      } else {
        setTestResult({ type: 'error', text: result.error || t('settings.llm.testFailed') })
      }
    } catch (error) {
      setTestResult({ type: 'error', text: String(error) })
    }
    setTesting(false)
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-5">
      <UnsavedChangesBar show={hasChanges} saving={saving} onSave={handleSave} onDiscard={handleDiscard} />
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

          {/* Zenmux Settings */}
          {settings.llmProvider === 'zenmux' && (
            <div className="space-y-3 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.general.apiKey')}</label>
                <input
                  type="password"
                  placeholder="Zenmux API Key"
                  value={settings.zenmuxApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, zenmuxApiKey: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">{t('settings.llm.model')}</label>
                <input
                  type="text"
                  placeholder="anthropic/claude-opus-4.5"
                  value={settings.zenmuxModel || ''}
                  onChange={(e) => setSettings({ ...settings, zenmuxModel: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10 transition-all"
                />
              </div>
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <p className="text-[11px] text-cyan-400">
                  {t('settings.llm.zenmuxInfo')}{' '}
                  <a
                    href="https://zenmux.ai/invite/QGJDYM"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-cyan-300"
                  >
                    zenmux.ai →
                  </a>
                </p>
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
                  {t('settings.llm.minimaxInfo')}{' '}
                  <a
                    href="https://platform.minimaxi.com/subscribe/coding-plan?code=G81r84oX6N&source=link"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-blue-300"
                  >
                    platform.minimaxi.com →
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* Ollama Settings */}
          {settings.llmProvider === 'ollama' && (
            <div className="space-y-3 p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">Ollama Base URL</label>
                <input
                  type="text"
                  placeholder="http://localhost:11434/v1"
                  value={settings.ollamaBaseUrl || ''}
                  onChange={(e) => setSettings({ ...settings, ollamaBaseUrl: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/10 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">Model Name</label>
                <input
                  type="text"
                  placeholder="llama3"
                  value={settings.ollamaModel || ''}
                  onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/10 transition-all"
                />
              </div>
            </div>
          )}

          {/* OpenAI Settings */}
          {settings.llmProvider === 'openai' && (
            <div className="space-y-3 p-3 rounded-xl bg-green-500/5 border border-green-500/20">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">API Key</label>
                <input
                  type="password"
                  placeholder="sk-proj-..."
                  value={settings.openaiApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/10 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">Model Name</label>
                <input
                  type="text"
                  placeholder="gpt-4o"
                  value={settings.openaiModel || ''}
                  onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/10 transition-all"
                />
              </div>
            </div>
          )}

          {/* Gemini Settings */}
          {settings.llmProvider === 'gemini' && (
            <div className="space-y-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">API Key</label>
                <input
                  type="password"
                  placeholder="AIza..."
                  value={settings.geminiApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">Model Name</label>
                <input
                  type="text"
                  placeholder="gemini-2.5-pro"
                  value={settings.geminiModel || ''}
                  onChange={(e) => setSettings({ ...settings, geminiModel: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all"
                />
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
                  placeholder="https://api.example.com/v1"
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

          {/* Test Connection Button */}
          <div className="mt-3">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5"
            >
              {testing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('settings.llm.testing')}</span>
                </>
              ) : (
                <span>{t('settings.llm.testConnection')}</span>
              )}
            </button>
            {testResult && (
              <div className={`flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg text-[11px] ${
                testResult.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-red-500/10 text-red-500'
              }`}>
                {testResult.type === 'success' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                <span className="break-all">{testResult.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* Memu Settings */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--primary)]/30 shadow-sm">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md flex items-center justify-center p-0.5">
                <img src={logoSvg} alt="memU" className="w-full h-full" />
              </div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                {t('settings.memu.title')}
              </h4>
            </div>
            <a 
              href="https://app.memu.so/api-key" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[11px] text-[var(--primary)] hover:underline mt-1 inline-block"
            >
              {t('settings.memu.hint')} →
            </a>
          </div>
          <div className="space-y-3">
            {/* API Key */}
            <div>
              <input
                type="password"
                placeholder="mu_..."
                value={settings.memuApiKey || ''}
                onChange={(e) => setSettings({ ...settings, memuApiKey: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Tavily Search API */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-emerald-500/30 shadow-sm">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Search className="w-3 h-3 text-white" />
              </div>
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                {t('settings.tavily.title')}
              </h4>
            </div>
            <a 
              href="https://tavily.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[11px] text-emerald-500 hover:underline mt-1 inline-block"
            >
              {t('settings.tavily.hint')} →
            </a>
          </div>
          <input
            type="password"
            placeholder="tvly-..."
            value={settings.tavilyApiKey || ''}
            onChange={(e) => setSettings({ ...settings, tavilyApiKey: e.target.value })}
            className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 transition-all"
          />
        </div>

        {/* Language */}
        <LanguageSelector />
      </div>

      {/* Message */}
      <MessageDisplay message={message} />
    </div>
  )
}

/**
 * Language Selector Component
 */
function LanguageSelector(): JSX.Element {
  const { t, i18n } = useTranslation()
  const currentLang = i18n.language

  // Sync renderer language to main process settings on mount (one-time migration)
  useEffect(() => {
    window.settings.get().then(result => {
      if (result.success && result.data && result.data.language !== currentLang) {
        window.settings.save({ language: currentLang })
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value
    changeLanguage(newLang)
    // Sync to main process settings so main-side i18n stays in sync
    window.settings.save({ language: newLang })
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
