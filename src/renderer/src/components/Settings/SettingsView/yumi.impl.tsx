import { useState } from 'react'
import { Bot, Info, Database, Server, Sparkles, Play, FlaskConical, User, BatteryCharging } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SETTINGS_BAR_PORTAL_ID } from '../shared'
import { AccountSettings } from '../AccountSettings'
import { ModelSettings } from '../ModelSettings'
import { McpSettings } from '../McpSettings'
import { SkillsSettings } from '../SkillsSettings'
import { ServicesSettings } from '../ServicesSettings'
import { DataSettings } from '../DataSettings'
import { ExperimentalSettings } from '../ExperimentalSettings'
import { PowerSettings } from '../PowerSettings'
import { AboutSettings } from '../AboutSettings'

type SettingsTab = 'account' | 'model' | 'skills' | 'services' | 'mcp' | 'data' | 'power' | 'experimental' | 'about'

export function YumiSettingsView(): JSX.Element {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<SettingsTab>('account')

  const tabs = [
    { id: 'account' as const, icon: User, labelKey: 'settings.tabs.account' },
    { id: 'model' as const, icon: Bot, labelKey: 'settings.tabs.model' },
    { id: 'skills' as const, icon: Sparkles, labelKey: 'settings.tabs.skills' },
    { id: 'services' as const, icon: Play, labelKey: 'settings.tabs.services' },
    { id: 'mcp' as const, icon: Server, labelKey: 'settings.tabs.mcp' },
    { id: 'data' as const, icon: Database, labelKey: 'settings.tabs.data' },
    { id: 'power' as const, icon: BatteryCharging, labelKey: 'settings.tabs.power' },
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
      <div className="flex-1 flex flex-col">
        {/* Portal target for UnsavedChangesBar — sits above the scroll area */}
        <div id={SETTINGS_BAR_PORTAL_ID} />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto py-6 px-5 pb-24">
            {activeTab === 'account' && <AccountSettings />}
            {activeTab === 'model' && <ModelSettings />}
            {activeTab === 'skills' && <SkillsSettings />}
            {activeTab === 'services' && <ServicesSettings />}
            {activeTab === 'mcp' && <McpSettings />}
            {activeTab === 'data' && <DataSettings />}
            {activeTab === 'power' && <PowerSettings />}
            {activeTab === 'experimental' && <ExperimentalSettings />}
            {activeTab === 'about' && <AboutSettings />}
          </div>
        </div>
      </div>
    </div>
  )
}
