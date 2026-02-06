/**
 * App - Yumi Implementation
 * Simplified app with only Yumi and Settings
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../components/Layout'
import { YumiView } from '../components/Yumi'
import { SettingsView } from '../components/Settings'
import { ToastContainer } from '../components/Toast'
import { AgentActivityPanel } from '../components/AgentActivity'
import { useThemeStore, applyTheme } from '../stores/themeStore'
import { appIcon } from '../assets'
import { initEasemobAutoConnect } from '../services/easemob'

type NavItem = 'yumi' | 'settings'

const LAST_APP_TAB_KEY = 'yumi-last-app-tab'

// Get saved tab or default to yumi
function getSavedAppTab(): NavItem {
  const saved = localStorage.getItem(LAST_APP_TAB_KEY)
  if (saved === 'settings') {
    return 'settings'
  }
  return 'yumi'
}

interface StartupStatus {
  stage: 'initializing' | 'mcp' | 'platforms' | 'ready'
  message: string
  progress: number
}

export function YumiApp(): JSX.Element {
  const { t } = useTranslation()
  const [activeNav, setActiveNav] = useState<NavItem>(getSavedAppTab)
  const themeMode = useThemeStore((state) => state.mode)
  const [showActivityPanel, setShowActivityPanel] = useState(false)
  const [isStartupComplete, setIsStartupComplete] = useState(false)
  const [startupStatus, setStartupStatus] = useState<StartupStatus>({
    stage: 'initializing',
    message: '',
    progress: 0
  })

  // Apply theme on mount and when mode changes
  useEffect(() => {
    applyTheme(themeMode)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (themeMode === 'system') {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [themeMode])

  // Initialize global Easemob connection manager
  useEffect(() => {
    initEasemobAutoConnect()
  }, [])

  // Listen to startup status
  useEffect(() => {
    window.startup.getStatus().then((result) => {
      if (result.ready) {
        setIsStartupComplete(true)
        setStartupStatus({ stage: 'ready', message: 'Ready', progress: 100 })
      }
    })

    const unsubscribe = window.startup.onStatusChanged((status: StartupStatus) => {
      setStartupStatus(status)
      if (status.stage === 'ready') {
        setTimeout(() => setIsStartupComplete(true), 300)
      }
    })

    return () => unsubscribe()
  }, [])

  // Handle nav change and save last app tab
  const handleNavChange = (nav: string) => {
    const navItem = nav as NavItem
    setActiveNav(navItem)
    if (navItem !== 'settings') {
      localStorage.setItem(LAST_APP_TAB_KEY, navItem)
    }
  }

  // Show startup screen while initializing
  if (!isStartupComplete) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[var(--bg-base)] via-[var(--bg-secondary)] to-[var(--bg-tertiary)]">
        <div className="mb-8">
          <div className="w-28 h-28 rounded-3xl bg-[var(--icon-bg)] flex items-center justify-center shadow-lg">
            <img src={appIcon} alt="Yumi" className="w-24 h-24 rounded-2xl" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Yumi
        </h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">
          Your Cozy AI Companion
        </p>

        {/* Progress Bar - Warm coral gradient for Yumi */}
        <div className="w-64 mb-4">
          <div className="h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#F4C4B8] to-[#E8A090] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${startupStatus.progress}%` }}
            />
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)] animate-pulse">
          {t(`app.startup.${startupStatus.stage}`, startupStatus.message)}
        </p>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gradient-to-b from-[var(--bg-base)] via-[var(--bg-secondary)] to-[var(--bg-tertiary)]">
      <ToastContainer />

      <AgentActivityPanel
        isOpen={showActivityPanel}
        onClose={() => setShowActivityPanel(false)}
      />

      <Sidebar activeNav={activeNav} onNavChange={handleNavChange} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-hidden flex">
          {activeNav === 'yumi' && <YumiView onShowActivity={() => setShowActivityPanel(true)} />}
          {activeNav === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}
