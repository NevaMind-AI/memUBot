import { useState, useEffect } from 'react'
import { BatteryCharging, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from '../../stores/toastStore'

interface PowerFeatures {
  preventSleep: boolean
}

export function PowerSettings(): JSX.Element {
  const { t } = useTranslation()
  const [features, setFeatures] = useState<PowerFeatures>({
    preventSleep: true
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
          preventSleep: result.data.preventSleep ?? true
        })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
    setLoading(false)
  }

  const handleToggle = async (key: keyof PowerFeatures, value: boolean) => {
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
          {t('settings.power.title')}
        </h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
          {t('settings.power.description')}
        </p>
      </div>

      <div className="space-y-3">
        {/* Prevent Sleep */}
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <BatteryCharging className="w-5 h-5 text-green-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                  {t('settings.power.preventSleep.title')}
                </h4>
                <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed">
                  {t('settings.power.preventSleep.description')}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-2 opacity-70">
                  {t('settings.power.preventSleep.hint')}
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <button
              onClick={() => handleToggle('preventSleep', !features.preventSleep)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 focus:ring-offset-[var(--bg-card-solid)] disabled:opacity-50 disabled:cursor-not-allowed ${
                features.preventSleep ? 'bg-green-500' : 'bg-[var(--bg-input)]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  features.preventSleep ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Status indicator */}
          {features.preventSleep && (
            <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                  {t('settings.power.preventSleep.enabled')}
                </span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                {t('settings.power.preventSleep.enabledHint')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
