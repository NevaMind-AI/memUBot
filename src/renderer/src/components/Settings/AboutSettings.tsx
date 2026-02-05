import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { appIcon } from '../../assets'

interface LogEntry {
  timestamp: number
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
}

export function AboutSettings(): JSX.Element {
  const { t } = useTranslation()
  const [clickCount, setClickCount] = useState(0)
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [showAgentActivity, setShowAgentActivity] = useState(false)
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const logsContainerRef = useRef<HTMLDivElement | null>(null)

  // Load showAgentActivity setting
  useEffect(() => {
    window.settings.get().then(result => {
      if (result.success && result.data) {
        setShowAgentActivity(result.data.showAgentActivity ?? false)
      }
    })
  }, [])

  const handleVersionClick = async (): Promise<void> => {
    // Reset timeout on each click
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current)
    }

    const newCount = clickCount + 1
    setClickCount(newCount)

    if (newCount >= 3) {
      setClickCount(0)
      // Always show logs viewer
      const result = await window.settings.getLogs()
      if (result.success && result.data) {
        setLogs(result.data.logs)
        setShowLogs(true)
        // Scroll to bottom after logs are shown
        setTimeout(() => {
          if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
          }
        }, 50)
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
        if (logsContainerRef.current) {
          logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
        }
      }, 50)
    }
  }

  const handleToggleAgentActivity = async (): Promise<void> => {
    const newValue = !showAgentActivity
    setShowAgentActivity(newValue)
    await window.settings.save({ showAgentActivity: newValue })
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
          
          {/* Agent Activity Toggle */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#202020] border-b border-[var(--border-color)]">
            <span className="text-[11px] text-[var(--text-muted)]">Show Agent Activity Panel</span>
            <button
              onClick={handleToggleAgentActivity}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                showAgentActivity ? 'bg-emerald-500' : 'bg-[#444]'
              }`}
            >
              <span 
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  showAgentActivity ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          
          <div 
            ref={logsContainerRef}
            className="h-64 overflow-y-auto p-2 font-mono text-[11px]"
          >
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
