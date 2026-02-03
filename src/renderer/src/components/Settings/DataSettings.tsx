import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TelegramIcon, DiscordIcon, SlackIcon, FeishuIcon } from '../Icons/AppIcons'
import { MessageDisplay, LoadingSpinner, formatBytes } from './shared'

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

export function DataSettings(): JSX.Element {
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

  if (loading) {
    return <LoadingSpinner />
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
              {formatBytes(storageInfo?.total || 0)}
            </span>
          </div>

          {/* Storage Bar */}
          <div className="w-full h-3 rounded-full bg-[var(--bg-input)] overflow-hidden flex">
            {storageInfo && storageInfo.folders.map((folder, index) => {
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
          {storageInfo && (
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
        <MessageDisplay message={message} />
      </div>
    </div>
  )
}
