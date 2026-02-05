/**
 * Sidebar - Yumi Implementation
 * Simplified sidebar with only Yumi, Settings, and Theme toggle
 */
import { Settings, Sun, Moon, Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useThemeStore, type ThemeMode } from '../../../stores/themeStore'
import { appIcon } from '../../../assets'
import type { YumiSidebarProps, YumiNavItem } from './types'

export function YumiSidebar({ activeNav, onNavChange }: YumiSidebarProps): JSX.Element {
  const { t } = useTranslation()
  const { mode, setMode } = useThemeStore()

  const themeOptions: { mode: ThemeMode; icon: typeof Sun; labelKey: string }[] = [
    { mode: 'light', icon: Sun, labelKey: 'settings.general.themeLight' },
    { mode: 'dark', icon: Moon, labelKey: 'settings.general.themeDark' },
    { mode: 'system', icon: Monitor, labelKey: 'settings.general.themeSystem' }
  ]

  const cycleTheme = () => {
    const currentIndex = themeOptions.findIndex((t) => t.mode === mode)
    const nextIndex = (currentIndex + 1) % themeOptions.length
    setMode(themeOptions[nextIndex].mode)
  }

  const currentTheme = themeOptions.find((opt) => opt.mode === mode)
  const ThemeIcon = currentTheme?.icon || Monitor

  const isSettingsActive = activeNav === 'settings'

  return (
    <aside className="w-16 flex flex-col bg-[var(--glass-bg)] backdrop-blur-xl border-r border-[var(--glass-border)]">
      {/* App Icon - Clickable to Yumi */}
      <div className="h-14 flex translate-y-0.5 items-center justify-center">
        <button
          onClick={() => onNavChange('yumi')}
          title="Yumi"
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
            activeNav === 'yumi'
              ? 'bg-gradient-to-tl from-[var(--primary-light)] to-[var(--primary)] shadow-lg'
              : 'bg-[var(--icon-bg)] hover:bg-[var(--bg-card-solid)]'
          }`}
        >
          <img src={appIcon} alt={t('app.name')} className="w-9 h-9 rounded-lg" />
        </button>
      </div>

      {/* Main Navigation - Empty for Yumi (only Yumi page via app icon) */}
      <nav className="flex-1 flex flex-col items-center pt-4 gap-2">
        {/* No platform buttons for Yumi */}
      </nav>

      {/* Bottom Actions: Settings + Theme */}
      <div className="pb-4 flex flex-col items-center gap-2">
        {/* Settings */}
        <button
          onClick={() => onNavChange('settings')}
          title={t('nav.settings')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
            isSettingsActive
              ? 'bg-gradient-to-tl from-[var(--primary-light)] to-[var(--primary)] text-white shadow-lg'
              : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-card-solid)] hover:shadow-md'
          }`}
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={cycleTheme}
          title={`${t('settings.general.theme')}: ${currentTheme ? t(currentTheme.labelKey) : ''}`}
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-card-solid)] hover:shadow-md"
        >
          <ThemeIcon className="w-[18px] h-[18px]" />
        </button>
      </div>
    </aside>
  )
}
