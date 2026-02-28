/**
 * Sidebar - Memu Implementation
 * Shows all messaging platforms (Telegram, Discord, Slack, Feishu)
 */
import { Settings, Sun, Moon, Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useThemeStore, type ThemeMode } from '../../../stores/themeStore'
import { appIcon } from '../../../assets'
import { TelegramIcon, DiscordIcon, SlackIcon, FeishuIcon } from '../../Icons/AppIcons'
import type { MemuSidebarProps, MemuNavItem } from './types'

export function MemuSidebar({ activeNav, onNavChange }: MemuSidebarProps): JSX.Element {
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
      {/* App Icon - Static display, no click action */}
      <div className="h-14 flex translate-y-0.5 items-center justify-center">
        <div className="w-11 h-11 rounded-xl bg-[var(--icon-bg)] flex items-center justify-center">
          <img src={appIcon} alt={t('app.name')} className="w-9 h-9 rounded-lg" />
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col items-center pt-4 gap-2">
        {/* Telegram */}
        <button
          onClick={() => onNavChange('telegram')}
          title={t('nav.telegram')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
            activeNav === 'telegram'
              ? 'bg-gradient-to-tl from-[#2AABEE] to-[#0088CC] text-white shadow-lg shadow-[#0088CC]/25'
              : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[#0088CC] hover:bg-[var(--bg-card-solid)] hover:shadow-md'
          }`}
        >
          <TelegramIcon className="w-[18px] h-[18px]" />
        </button>

        {/* Discord */}
        <button
          onClick={() => onNavChange('discord')}
          title={t('nav.discord')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
            activeNav === 'discord'
              ? 'bg-gradient-to-br from-[#5865F2] to-[#7289DA] text-white shadow-lg shadow-[#5865F2]/25'
              : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[#5865F2] hover:bg-[var(--bg-card-solid)] hover:shadow-md'
          }`}
        >
          <DiscordIcon className="w-[18px] h-[18px]" />
        </button>

        {/* Slack */}
        <button
          onClick={() => onNavChange('slack')}
          title={t('nav.slack')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
            activeNav === 'slack'
              ? 'bg-gradient-to-br from-[#4A154B] to-[#611F69] text-white shadow-lg shadow-[#4A154B]/25'
              : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[#4A154B] hover:bg-[var(--bg-card-solid)] hover:shadow-md'
          }`}
        >
          <SlackIcon className="w-[18px] h-[18px]" />
        </button>

        {/* Feishu */}
        <button
          onClick={() => onNavChange('feishu')}
          title={t('nav.feishu')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
            activeNav === 'feishu'
              ? 'bg-gradient-to-br from-white to-[#F5F6F7] dark:from-[#2A2B2E] dark:to-[#1F2023] shadow-md shadow-black/10 dark:shadow-black/10 ring-1 ring-black/5 dark:ring-white/10'
              : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:bg-[var(--bg-card-solid)] hover:shadow-md'
          }`}
        >
          <FeishuIcon className="w-[22px] h-[22px]" />
        </button>
      </nav>

      {/* Bottom Actions: Settings + Theme */}
      <div className="pb-4 flex flex-col items-center gap-2">
        {/* Settings */}
        <button
          onClick={() => onNavChange('settings')}
          title={t('nav.settings')}
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
            isSettingsActive
              ? 'bg-gradient-to-tl from-[#7DCBF7] to-[#2596D1] text-white shadow-lg shadow-[#2596D1]/25'
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
