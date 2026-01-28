import { useState, useEffect } from 'react'
import { Sidebar, Header } from './components/Layout'
import { TelegramView } from './components/Telegram'
import { DiscordView } from './components/Discord'
import { WhatsAppView } from './components/WhatsApp'
import { SlackView } from './components/Slack'
import { LineView } from './components/Line'
import { SettingsView } from './components/Settings'
import { ToastContainer } from './components/Toast'
import { useThemeStore, applyTheme } from './stores/themeStore'

type NavItem = 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line' | 'settings'

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
          showDiscordStatus: false,
          showWhatsAppStatus: false,
          showSlackStatus: false,
          showLineStatus: false
        }
      case 'discord':
        return {
          title: 'Discord',
          subtitle: 'AI Assistant',
          showTelegramStatus: false,
          showDiscordStatus: true,
          showWhatsAppStatus: false,
          showSlackStatus: false,
          showLineStatus: false
        }
      case 'whatsapp':
        return {
          title: 'WhatsApp',
          subtitle: 'AI Assistant',
          showTelegramStatus: false,
          showDiscordStatus: false,
          showWhatsAppStatus: true,
          showSlackStatus: false,
          showLineStatus: false
        }
      case 'slack':
        return {
          title: 'Slack',
          subtitle: 'AI Assistant',
          showTelegramStatus: false,
          showDiscordStatus: false,
          showWhatsAppStatus: false,
          showSlackStatus: true,
          showLineStatus: false
        }
      case 'line':
        return {
          title: 'Line',
          subtitle: 'AI Assistant',
          showTelegramStatus: false,
          showDiscordStatus: false,
          showWhatsAppStatus: false,
          showSlackStatus: false,
          showLineStatus: true
        }
      case 'settings':
        return {
          title: 'Settings',
          showTelegramStatus: false,
          showDiscordStatus: false,
          showWhatsAppStatus: false,
          showSlackStatus: false,
          showLineStatus: false
        }
      default:
        return {
          title: 'Local Memu',
          showTelegramStatus: false,
          showDiscordStatus: false,
          showWhatsAppStatus: false,
          showSlackStatus: false,
          showLineStatus: false
        }
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
          showSlackStatus={headerInfo.showSlackStatus}
        />

        {/* Content */}
        <main className="flex-1 overflow-hidden flex">
          {activeNav === 'telegram' && <TelegramView />}
          {activeNav === 'discord' && <DiscordView />}
          {activeNav === 'whatsapp' && <WhatsAppView />}
          {activeNav === 'slack' && <SlackView />}
          {activeNav === 'line' && <LineView />}
          {activeNav === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}

export default App
