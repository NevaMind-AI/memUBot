import { useState } from 'react'
import { Bot, Info, Key, Database, Shield, Server, Sparkles, Play, FlaskConical, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GeneralSettings } from '../GeneralSettings'
import { PlatformSettings } from '../PlatformSettings'
import { SecuritySettings } from '../SecuritySettings'
import { ModelSettings } from '../ModelSettings'
import { McpSettings } from '../McpSettings'
import { SkillsSettings } from '../SkillsSettings'
import { ServicesSettings } from '../ServicesSettings'
import { DataSettings } from '../DataSettings'
import { ExperimentalSettings } from '../ExperimentalSettings'
import { AboutSettings } from '../AboutSettings'

type SettingsTab = 'general' | 'platforms' | 'security' | 'model' | 'skills' | 'services' | 'mcp' | 'data' | 'experimental' | 'about'

export function MemuSettingsView(): JSX.Element {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  const tabs = [
    { id: 'general' as const, icon: Key, labelKey: 'settings.tabs.general' },
    { id: 'platforms' as const, icon: MessageSquare, labelKey: 'settings.tabs.platforms' },
    { id: 'security' as const, icon: Shield, labelKey: 'settings.tabs.security' },
    { id: 'model' as const, icon: Bot, labelKey: 'settings.tabs.model' },
    { id: 'skills' as const, icon: Sparkles, labelKey: 'settings.tabs.skills' },
    { id: 'services' as const, icon: Play, labelKey: 'settings.tabs.services' },
    { id: 'mcp' as const, icon: Server, labelKey: 'settings.tabs.mcp' },
    { id: 'data' as const, icon: Database, labelKey: 'settings.tabs.data' },
    { id: 'experimental' as const, icon: FlaskConical, labelKey: 'settings.tabs.experimental' },
    { id: 'about' as const, icon: Info, labelKey: 'settings.tabs.about' }
  ]

  return (
    <div className="flex-1 flex">
      {/* Settings Sidebar */}
      <div className="w-52 bg-[var(--glass-bg)] backdrop-blur-xl border-r border-[var(--glass-border)] py-4">
        <nav className="px-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            // Check if labelKey is a translation key or plain text
            const label = tab.labelKey.includes('.') ? t(tab.labelKey) : tab.labelKey

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-[var(--primary-bg)] text-[var(--primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[13px] font-medium">{label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="max-w-lg mx-auto py-6 px-5 pb-24">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'platforms' && <PlatformSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'model' && <ModelSettings />}
          {activeTab === 'skills' && <SkillsSettings />}
          {activeTab === 'services' && <ServicesSettings />}
          {activeTab === 'mcp' && <McpSettings />}
          {activeTab === 'data' && <DataSettings />}
          {activeTab === 'experimental' && <ExperimentalSettings />}
          {activeTab === 'about' && <AboutSettings />}
        </div>
      </div>
    </div>
  )
}
