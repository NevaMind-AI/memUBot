import { Send, Settings, Sun, Moon, Monitor, Gamepad2 } from 'lucide-react'
import { useThemeStore, type ThemeMode } from '../../stores/themeStore'
import logoSvg from '../../assets/logo.svg'

type NavItem = 'telegram' | 'discord' | 'settings'

interface SidebarProps {
  activeNav: NavItem
  onNavChange: (nav: NavItem) => void
}

export function Sidebar({ activeNav, onNavChange }: SidebarProps): JSX.Element {
  const { mode, setMode } = useThemeStore()

  const themeOptions: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
    { mode: 'light', icon: Sun, label: 'Light' },
    { mode: 'dark', icon: Moon, label: 'Dark' },
    { mode: 'system', icon: Monitor, label: 'System' }
  ]

  const cycleTheme = () => {
    const currentIndex = themeOptions.findIndex((t) => t.mode === mode)
    const nextIndex = (currentIndex + 1) % themeOptions.length
    setMode(themeOptions[nextIndex].mode)
  }

  const currentTheme = themeOptions.find((t) => t.mode === mode)
  const ThemeIcon = currentTheme?.icon || Monitor

  const isSettingsActive = activeNav === 'settings'

  return (
    <aside className="w-16 flex flex-col bg-[var(--glass-bg)] backdrop-blur-xl">
      {/* Logo - Same height as header */}
      <div className="h-14 flex translate-y-0.5 items-center justify-center">
        <img src={logoSvg} alt="Memu Logo" className="w-10 h-10" />
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col items-center pt-4 gap-2">
        {/* Telegram */}
        <button
          onClick={() => onNavChange('telegram')}
          title="Telegram"
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
            activeNav === 'telegram'
              ? 'bg-gradient-to-br from-[#7DCBF7] to-[#2596D1] text-white shadow-lg shadow-[#2596D1]/25'
              : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-card-solid)] hover:shadow-md'
          }`}
        >
          <Send className="w-[18px] h-[18px]" />
        </button>

        {/* Discord */}
        <button
          onClick={() => onNavChange('discord')}
          title="Discord"
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
            activeNav === 'discord'
              ? 'bg-gradient-to-br from-[#5865F2] to-[#7289DA] text-white shadow-lg shadow-[#5865F2]/25'
              : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[#5865F2] hover:bg-[var(--bg-card-solid)] hover:shadow-md'
          }`}
        >
          <Gamepad2 className="w-[18px] h-[18px]" />
        </button>
      </nav>

      {/* Bottom Actions: Settings + Theme */}
      <div className="pb-4 flex flex-col items-center gap-2">
        {/* Settings */}
        <button
          onClick={() => onNavChange('settings')}
          title="Settings"
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
            isSettingsActive
              ? 'bg-gradient-to-br from-[#7DCBF7] to-[#2596D1] text-white shadow-lg shadow-[#2596D1]/25'
              : 'bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-card-solid)] hover:shadow-md'
          }`}
        >
          <Settings className="w-[18px] h-[18px]" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={cycleTheme}
          title={`Theme: ${currentTheme?.label}`}
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-card-solid)] hover:shadow-md"
        >
          <ThemeIcon className="w-[18px] h-[18px]" />
        </button>
      </div>
    </aside>
  )
}
