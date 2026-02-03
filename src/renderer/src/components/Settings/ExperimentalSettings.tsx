import { useState, useEffect } from 'react'
import { FlaskConical, Monitor, Loader2, AlertTriangle, MousePointer2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from '../../stores/toastStore'

interface ExperimentalFeatures {
  experimentalVisualMode: boolean
  experimentalComputerUse: boolean
}

export function ExperimentalSettings(): JSX.Element {
  const { t } = useTranslation()
  const [features, setFeatures] = useState<ExperimentalFeatures>({
    experimentalVisualMode: false,
    experimentalComputerUse: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const result = await window.settings.get()
      if (result.success && result.data) {
        setFeatures({
          experimentalVisualMode: result.data.experimentalVisualMode || false,
          experimentalComputerUse: result.data.experimentalComputerUse || false
        })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
    setLoading(false)
  }

  const handleToggle = async (key: keyof ExperimentalFeatures, value: boolean) => {
    setSaving(true)
    try {
      const result = await window.settings.save({ [key]: value })
      if (result.success) {
        setFeatures((prev) => ({ ...prev, [key]: value }))
        toast.success(t('common.saved'))
      } else {
        toast.error(result.error || t('settings.saveError'))
      }
    } catch (error) {
      toast.error(t('settings.saveError'))
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
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          {t('settings.experimental.title')}
        </h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
          {t('settings.experimental.description')}
        </p>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-[12px] text-amber-600 dark:text-amber-400">
          {t('settings.experimental.warning')}
        </p>
      </div>

      <div className="space-y-3">
        {/* Visual Demo Mode */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
                <Monitor className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                  {t('settings.experimental.visualMode.title')}
                </h4>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed">
                  {t('settings.experimental.visualMode.description')}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-2 opacity-70">
                  {t('settings.experimental.visualMode.hint')}
                </p>
              </div>
            </div>
            
            {/* Toggle Switch */}
            <button
              onClick={() => handleToggle('experimentalVisualMode', !features.experimentalVisualMode)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)] disabled:opacity-50 disabled:cursor-not-allowed ${
                features.experimentalVisualMode ? 'bg-purple-500' : 'bg-[var(--bg-input)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  features.experimentalVisualMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Status indicator */}
          {features.experimentalVisualMode && (
            <div className="mt-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                  {t('settings.experimental.visualMode.enabled')}
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                {t('settings.experimental.visualMode.enabledHint')}
              </p>
            </div>
          )}
        </div>

        {/* Computer Use */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <MousePointer2 className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                  {t('settings.experimental.computerUse.title')}
                </h4>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed">
                  {t('settings.experimental.computerUse.description')}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-2 opacity-70">
                  {t('settings.experimental.computerUse.hint')}
                </p>
              </div>
            </div>
            
            {/* Toggle Switch */}
            <button
              onClick={() => handleToggle('experimentalComputerUse', !features.experimentalComputerUse)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)] disabled:opacity-50 disabled:cursor-not-allowed ${
                features.experimentalComputerUse ? 'bg-blue-500' : 'bg-[var(--bg-input)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  features.experimentalComputerUse ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Status indicator */}
          {features.experimentalComputerUse && (
            <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                  {t('settings.experimental.computerUse.enabled')}
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                {t('settings.experimental.computerUse.enabledHint')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
