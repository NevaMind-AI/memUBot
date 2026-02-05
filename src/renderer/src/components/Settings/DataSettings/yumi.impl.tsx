import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Database } from 'lucide-react'
import { MessageDisplay, LoadingSpinner, formatBytes } from '../shared'

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

// Filter out platform-specific folders for Yumi
const YUMI_FOLDER_KEYS = ['mcpOutput', 'agentOutput', 'skills', 'cache', 'other']

export function YumiDataSettings(): JSX.Element {
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
        // Filter out platform-specific folders
        const filteredFolders = result.data.folders.filter(
          folder => YUMI_FOLDER_KEYS.includes(folder.key)
        )
        const filteredTotal = filteredFolders.reduce((sum, f) => sum + f.size, 0)
        setStorageInfo({
          total: filteredTotal,
          folders: filteredFolders
        })
      }
    } catch (error) {
      console.error('Failed to load storage info:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadStorageInfo()
  }, [])

  const handleOpenDataFolder = async () => {
    try {
      // Open the userData directory
      await window.settings.openMessagesFolder()
    } catch (error) {
      console.error('Failed to open data folder:', error)
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
        {/* Storage Info with Open Button */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--primary-bg)] flex items-center justify-center">
                <Database className="w-5 h-5 text-[var(--primary)]" />
              </div>
              <div>
                <h4 className="text-[13px] font-medium text-[var(--text-primary)]">{t('settings.data.storageUsed')}</h4>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{t('settings.data.storageHint')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-[var(--text-primary)] font-medium tabular-nums">
                {formatBytes(storageInfo?.total || 0)}
              </span>
              <button
                onClick={handleOpenDataFolder}
                className="p-2 rounded-lg bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-card-solid)] transition-all"
                title={t('settings.data.openFolder')}
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
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
          {storageInfo && storageInfo.folders.length > 0 && (
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
