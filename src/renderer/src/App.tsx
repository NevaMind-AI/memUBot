import { useState, useEffect } from 'react'
import { Sidebar, Header } from './components/Layout'
import { TelegramView } from './components/Telegram'
import { DiscordView } from './components/Discord'
import { SettingsView } from './components/Settings'
import { ToastContainer } from './components/Toast'
import { useThemeStore, applyTheme } from './stores/themeStore'

type NavItem = 'telegram' | 'discord' | 'settings'

function App(): JSX.Element {
  const [activeNav, setActiveNav] = useState<NavItem>('telegram')
  const themeMode = useThemeStore((state) => state.mode)

  // Apply theme on mount and when mode changes
  useEffect(() => {
    applyTheme(themeMode)

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (themeMode === 'system') {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [themeMode])

  const getHeaderInfo = () => {
    switch (activeNav) {
      case 'telegram':
        return {
          title: 'Telegram',
          subtitle: 'AI Assistant',
          showTelegramStatus: true,
          showDiscordStatus: false
        }
      case 'discord':
        return {
          title: 'Discord',
          subtitle: 'AI Assistant',
          showTelegramStatus: false,
          showDiscordStatus: true
        }
      case 'settings':
        return {
          title: 'Settings',
          showTelegramStatus: false,
          showDiscordStatus: false
        }
      default:
        return { title: 'Local Memu', showTelegramStatus: false, showDiscordStatus: false }
    }
  }

  const headerInfo = getHeaderInfo()

  return (
    <div className="h-screen flex overflow-hidden bg-gradient-to-b from-[var(--bg-base)] via-[var(--bg-secondary)] to-[var(--bg-tertiary)]">
      {/* Toast Container */}
      <ToastContainer />

      {/* Sidebar */}
      <Sidebar activeNav={activeNav} onNavChange={setActiveNav} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header
          title={headerInfo.title}
          subtitle={headerInfo.subtitle}
          showTelegramStatus={headerInfo.showTelegramStatus}
          showDiscordStatus={headerInfo.showDiscordStatus}
        />

        {/* Content */}
        <main className="flex-1 overflow-hidden flex">
          {activeNav === 'telegram' && <TelegramView />}
          {activeNav === 'discord' && <DiscordView />}
          {activeNav === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}

export default App
