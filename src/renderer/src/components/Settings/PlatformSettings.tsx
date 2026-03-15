import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TelegramIcon, DiscordIcon, SlackIcon, FeishuIcon, WhatsAppIcon } from '../Icons/AppIcons'
import {
  AppSettings,
  UnsavedChangesBar,
  MessageDisplay,
  LoadingSpinner
} from './shared'

export function PlatformSettings(): JSX.Element {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<Partial<AppSettings>>({})
  const [originalSettings, setOriginalSettings] = useState<Partial<AppSettings>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [whatsappStatus, setWhatsappStatus] = useState<{ isConnected: boolean; qrCode?: string }>({ isConnected: false })
  const [whatsappConnecting, setWhatsappConnecting] = useState(false)

  useEffect(() => {
    loadSettings()
    loadWhatsAppStatus()
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

  const loadWhatsAppStatus = async () => {
    try {
      const result = await window.whatsapp.status()
      if (result.success && result.data) {
        setWhatsappStatus({
          isConnected: result.data.isConnected,
          qrCode: result.data.qrCode
        })
      }
    } catch (error) {
      console.error('Failed to load WhatsApp status:', error)
    }
  }

  const handleWhatsAppConnect = async () => {
    setWhatsappConnecting(true)
    try {
      const result = await window.whatsapp.connect()
      if (result.success) {
        // Poll for QR code and connection status
        const pollInterval = setInterval(async () => {
          const [statusResult, qrResult] = await Promise.all([
            window.whatsapp.status(),
            window.whatsapp.getQr()
          ])
          if (statusResult.success && statusResult.data) {
            const qrCode = statusResult.data.qrCode || (qrResult.success ? qrResult.data : undefined)
            setWhatsappStatus({
              isConnected: statusResult.data.isConnected,
              qrCode
            })
            if (statusResult.data.isConnected) {
              clearInterval(pollInterval)
              setWhatsappConnecting(false)
            }
          }
        }, 1000)
        
        // Stop polling after 60 seconds
        setTimeout(() => {
          clearInterval(pollInterval)
          setWhatsappConnecting(false)
        }, 60000)
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to connect to WhatsApp' })
        setWhatsappConnecting(false)
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to connect to WhatsApp' })
      setWhatsappConnecting(false)
    }
  }

  const handleWhatsAppDisconnect = async () => {
    try {
      const result = await window.whatsapp.disconnect()
      if (result.success) {
        setWhatsappStatus({ isConnected: false })
        setMessage({ type: 'success', text: 'WhatsApp disconnected' })
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to disconnect' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to disconnect' })
    }
  }

  const hasChanges =
    settings.telegramBotToken !== originalSettings.telegramBotToken ||
    settings.telegramAutoConnect !== originalSettings.telegramAutoConnect ||
    settings.discordBotToken !== originalSettings.discordBotToken ||
    settings.discordAutoConnect !== originalSettings.discordAutoConnect ||
    settings.slackBotToken !== originalSettings.slackBotToken ||
    settings.slackAppToken !== originalSettings.slackAppToken ||
    settings.slackAutoConnect !== originalSettings.slackAutoConnect ||
    settings.feishuAppId !== originalSettings.feishuAppId ||
    settings.feishuAppSecret !== originalSettings.feishuAppSecret ||
    settings.feishuAutoConnect !== originalSettings.feishuAutoConnect

  const handleDiscard = () => {
    setSettings({ ...originalSettings })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const result = await window.settings.save({
        telegramBotToken: settings.telegramBotToken,
        telegramAutoConnect: settings.telegramAutoConnect,
        discordBotToken: settings.discordBotToken,
        discordAutoConnect: settings.discordAutoConnect,
        slackBotToken: settings.slackBotToken,
        slackAppToken: settings.slackAppToken,
        slackAutoConnect: settings.slackAutoConnect,
        feishuAppId: settings.feishuAppId,
        feishuAppSecret: settings.feishuAppSecret,
        feishuAutoConnect: settings.feishuAutoConnect
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
    return <LoadingSpinner />
  }

  return (
    <div className="space-y-5">
      <UnsavedChangesBar show={hasChanges} saving={saving} onSave={handleSave} onDiscard={handleDiscard} />
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('settings.tabs.platforms')}</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{t('settings.platforms.description')}</p>
      </div>

      <div className="space-y-3">
        {/* WhatsApp Authentication */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[#25D366]/30 shadow-sm">
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center">
                  <WhatsAppIcon className="w-3 h-3 text-white" />
                </div>
                <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                  WhatsApp
                </h4>
              </div>
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                {whatsappStatus.isConnected ? (
                  <>
                    <span className="text-[10px] text-green-500">{t('settings.platforms.connected')}</span>
                    <button
                      onClick={handleWhatsAppDisconnect}
                      className="px-3 py-1.5 text-[11px] rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                    >
                      {t('settings.platforms.disconnect')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleWhatsAppConnect}
                    disabled={whatsappConnecting}
                    className="px-3 py-1.5 text-[11px] rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors disabled:opacity-50"
                  >
                    {whatsappConnecting ? t('settings.platforms.connecting') : t('settings.platforms.connect')}
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              {whatsappStatus.isConnected 
                ? t('settings.platforms.whatsapp.connectedHint')
                : t('settings.platforms.whatsapp.qrHint')}
            </p>
          </div>
          {/* QR Code Display */}
          {whatsappStatus.qrCode && !whatsappStatus.isConnected && (
            <div className="mt-3 p-4 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
              <div className="text-center">
                <p className="text-[11px] text-[var(--text-muted)] mb-2">
                  {t('settings.platforms.whatsapp.scanQR')}
                </p>
                <div className="inline-block p-3 bg-white rounded-lg">
                  <code className="text-[10px] text-gray-800 break-all max-w-[200px]">
                    {whatsappStatus.qrCode.substring(0, 50)}...
                  </code>
                </div>
              </div>
            </div>
          )}
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
      </div>

      {/* Message */}
      <MessageDisplay message={message} />
    </div>
  )
}
