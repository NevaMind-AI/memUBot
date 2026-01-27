import { useState } from 'react'
import { Sidebar, Header } from './components/Layout'
import { TelegramView } from './components/Telegram'
import { SettingsView } from './components/Settings'
import { ToastContainer } from './components/Toast'

type NavItem = 'telegram' | 'settings'

function App(): JSX.Element {
  const [activeNav, setActiveNav] = useState<NavItem>('telegram')

  const getHeaderInfo = () => {
    switch (activeNav) {
      case 'telegram':
        return {
          title: 'Telegram',
          subtitle: 'AI Assistant',
          showTelegramStatus: true
        }
      case 'settings':
        return {
          title: 'Settings',
          showTelegramStatus: false
        }
      default:
        return { title: 'Local Memu', showTelegramStatus: false }
    }
  }

  const headerInfo = getHeaderInfo()

  return (
    <div className="h-screen flex bg-gradient-to-b from-[#f0f9ff] via-[#e0f2fe] to-[#f8fafc] overflow-hidden">
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
        />

        {/* Content */}
        <main className="flex-1 overflow-hidden flex">
          {activeNav === 'telegram' && <TelegramView />}
          {activeNav === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  )
}

export default App
