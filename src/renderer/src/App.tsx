import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar, Header } from './components/Layout'
import { TelegramView } from './components/Telegram'
import { DiscordView } from './components/Discord'
import { WhatsAppView } from './components/WhatsApp'
import { SlackView } from './components/Slack'
import { LineView } from './components/Line'
import { FeishuView } from './components/Feishu'
import { SettingsView } from './components/Settings'
import { ToastContainer } from './components/Toast'
import { useThemeStore, applyTheme } from './stores/themeStore'
import appIcon from './assets/app-icon.png'

type NavItem = 'telegram' | 'discord' | 'whatsapp' | 'slack' | 'line' | 'feishu' | 'settings'
type AppNavItem = Exclude<NavItem, 'settings'>

const LAST_APP_TAB_KEY = 'memu-last-app-tab'

// Get saved tab or default to telegram
function getSavedAppTab(): AppNavItem {
  const saved = localStorage.getItem(LAST_APP_TAB_KEY)
  const validTabs: AppNavItem[] = ['telegram', 'discord', 'whatsapp', 'slack', 'line', 'feishu']
  if (saved && validTabs.includes(saved as AppNavItem)) {
    return saved as AppNavItem
  }
  return 'telegram'
}

interface StartupStatus {
  stage: 'initializing' | 'mcp' | 'platforms' | 'ready'
  message: string
  progress: number
}

function App(): JSX.Element {
  const { t } = useTranslation()
  const [activeNav, setActiveNav] = useState<NavItem>(getSavedAppTab)
  const themeMode = useThemeStore((state) => state.mode)
  const [isStartupComplete, setIsStartupComplete] = useState(false)
  const [startupStatus, setStartupStatus] = useState<StartupStatus>({
    stage: 'initializing',
    message: '',
    progress: 0
  })

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

  // Listen to startup status
  useEffect(() => {
    // Check initial status
    window.startup.getStatus().then((result) => {
      if (result.ready) {
        setIsStartupComplete(true)
        setStartupStatus({ stage: 'ready', message: 'Ready', progress: 100 })
      }
    })

    // Subscribe to status changes
    const unsubscribe = window.startup.onStatusChanged((status: StartupStatus) => {
      setStartupStatus(status)
      if (status.stage === 'ready') {
        // Small delay for smooth transition
        setTimeout(() => setIsStartupComplete(true), 300)
      }
    })

    return () => unsubscribe()
  }, [])

  // Handle nav change and save last app tab
  const handleNavChange = (nav: NavItem) => {
    setActiveNav(nav)
    // Only save app tabs, not settings
    if (nav !== 'settings') {
      localStorage.setItem(LAST_APP_TAB_KEY, nav)
    }
  }

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
          showLineStatus: false,
          showFeishuStatus: false
        }
      case 'discord':
        return {
          title: 'Discord',
          subtitle: 'AI Assistant',
          showTelegramStatus: false,
          showDiscordStatus: true,
          showWhatsAppStatus: false,
          showSlackStatus: false,
          showLineStatus: false,
          showFeishuStatus: false
        }
      case 'whatsapp':
        return {
          title: 'WhatsApp',
          subtitle: 'AI Assistant',
          showTelegramStatus: false,
          showDiscordStatus: false,
          showWhatsAppStatus: true,
          showSlackStatus: false,
          showLineStatus: false,
          showFeishuStatus: false
        }
      case 'slack':
        return {
          title: 'Slack',
          subtitle: 'AI Assistant',
          showTelegramStatus: false,
          showDiscordStatus: false,
          showWhatsAppStatus: false,
          showSlackStatus: true,
          showLineStatus: false,
          showFeishuStatus: false
        }
      case 'line':
        return {
          title: 'Line',
          subtitle: 'AI Assistant',
          showTelegramStatus: false,
          showDiscordStatus: false,
          showWhatsAppStatus: false,
          showSlackStatus: false,
          showLineStatus: true,
          showFeishuStatus: false
        }
      case 'feishu':
        return {
          title: 'Feishu',
          subtitle: 'AI Assistant',
          showTelegramStatus: false,
          showDiscordStatus: false,
          showWhatsAppStatus: false,
          showSlackStatus: false,
          showLineStatus: false,
          showFeishuStatus: true
        }
      case 'settings':
        return {
          title: t('nav.settings'),
          showTelegramStatus: false,
          showDiscordStatus: false,
          showWhatsAppStatus: false,
          showSlackStatus: false,
          showLineStatus: false,
          showFeishuStatus: false
        }
      default:
        return {
          title: 'memU bot',
          showTelegramStatus: false,
          showDiscordStatus: false,
          showWhatsAppStatus: false,
          showSlackStatus: false,
          showLineStatus: false,
          showFeishuStatus: false
        }
    }
  }

  const headerInfo = getHeaderInfo()

  // Show startup screen while initializing
  if (!isStartupComplete) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[var(--bg-base)] via-[var(--bg-secondary)] to-[var(--bg-tertiary)]">
        {/* App Icon */}
        <div className="mb-8">
          <div className="w-28 h-28 rounded-3xl bg-[var(--icon-bg)] flex items-center justify-center shadow-lg">
            <img
              src={appIcon}
              alt="memU"
              className="w-24 h-24 rounded-2xl"
            />
          </div>
        </div>

        {/* App Name */}
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          {t('app.name')}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">
          {t('app.tagline')}
        </p>

        {/* Progress Bar */}
        <div className="w-64 mb-4">
          <div className="h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${startupStatus.progress}%` }}
            />
          </div>
        </div>

        {/* Status Message */}
        <p className="text-xs text-[var(--text-muted)] animate-pulse">
          {t(`app.startup.${startupStatus.stage}`, startupStatus.message)}
        </p>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gradient-to-b from-[var(--bg-base)] via-[var(--bg-secondary)] to-[var(--bg-tertiary)]">
      {/* Toast Container */}
      <ToastContainer />

      {/* Sidebar */}
      <Sidebar activeNav={activeNav} onNavChange={handleNavChange} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header
          title={headerInfo.title}
          subtitle={headerInfo.subtitle}
          showTelegramStatus={headerInfo.showTelegramStatus}
          showDiscordStatus={headerInfo.showDiscordStatus}
          showSlackStatus={headerInfo.showSlackStatus}
          showFeishuStatus={headerInfo.showFeishuStatus}
        />

        {/* Content */}
        <main className="flex-1 overflow-hidden flex">
          {activeNav === 'telegram' && <TelegramView />}
          {activeNav === 'discord' && <DiscordView />}
          {activeNav === 'whatsapp' && <WhatsAppView />}
          {activeNav === 'slack' && <SlackView />}
          {activeNav === 'line' && <LineView />}
          {activeNav === 'feishu' && <FeishuView />}
          {activeNav === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}

export default App
