import { createPortal } from 'react-dom'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// LLM Provider type
export type LLMProvider = 'claude' | 'minimax' | 'zenmux' | 'openrouter' | 'custom'

// Provider options for select
export const PROVIDER_OPTIONS: { value: LLMProvider; label: string }[] = [
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'zenmux', label: 'Zenmux' },
  { value: 'minimax', label: 'MiniMax' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'custom', label: 'Custom Provider' }
]

// App settings interface
export interface AppSettings {
  // LLM Provider selection
  llmProvider: LLMProvider
  // Claude settings
  claudeApiKey: string
  claudeModel: string
  // MiniMax settings
  minimaxApiKey: string
  minimaxModel: string
  // Zenmux settings
  zenmuxApiKey: string
  zenmuxModel: string
  // OpenRouter settings
  openrouterApiKey: string
  openrouterModel: string
  // Custom provider settings
  customApiKey: string
  customBaseUrl: string
  customModel: string
  // Shared settings
  maxTokens: number
  temperature: number
  systemPrompt: string
  l0TargetTokens: number
  l1TargetTokens: number
  maxPromptTokens: number
  retrievalEscalationThresholds: {
    scoreThresholdHigh: number
    top1Top2Margin: number
    maxItemsForL1: number
    maxItemsForL2: number
  }
  enableSessionCompression: boolean
  maxArchives: number
  maxRecentMessages: number
  archiveChunkSize: number
  memuBaseUrl: string
  memuApiKey: string
  memuUserId: string
  memuAgentId: string
  telegramBotToken: string
  telegramAutoConnect: boolean
  discordBotToken: string
  discordAutoConnect: boolean
  whatsappEnabled: boolean
  slackBotToken: string
  slackAppToken: string
  slackAutoConnect: boolean
  lineChannelAccessToken: string
  lineChannelSecret: string
  feishuAppId: string
  feishuAppSecret: string
  feishuAutoConnect: boolean
  language: string
  tavilyApiKey: string
}

// Portal target ID — used by SettingsView containers
export const SETTINGS_BAR_PORTAL_ID = 'settings-unsaved-bar'

// Unsaved Changes Bar Component — rendered via portal outside the scroll container
interface UnsavedChangesBarProps {
  show: boolean
  saving: boolean
  onSave: () => void
  onDiscard: () => void
}

export function UnsavedChangesBar({ show, saving, onSave, onDiscard }: UnsavedChangesBarProps): JSX.Element | null {
  const { t } = useTranslation()
  const portalTarget = document.getElementById(SETTINGS_BAR_PORTAL_ID)

  if (!portalTarget) return null

  return createPortal(
    <div
      className={`transition-all duration-300 ease-out overflow-hidden ${
        show
          ? 'max-h-40 opacity-100'
          : 'max-h-0 opacity-0 pointer-events-none'
      }`}
    >
      <div className="max-w-lg mx-auto px-5 py-4">
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <span className="text-[12px] text-[var(--text-muted)] min-w-0">
            {t('common.unsavedChanges')}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onDiscard}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-primary)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.discard')}
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--primary-gradient)', boxShadow: 'var(--shadow-primary)' }}
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('common.saving')}</span>
                </>
              ) : (
                <span>{t('common.saveChanges')}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalTarget
  )
}

// Message display component
interface MessageDisplayProps {
  message: { type: 'success' | 'error'; text: string } | null
}

export function MessageDisplay({ message }: MessageDisplayProps): JSX.Element | null {
  if (!message) return null

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
        message.type === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          : 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
      }`}
    >
      {message.type === 'success' ? (
        <Check className="w-4 h-4" />
      ) : (
        <AlertCircle className="w-4 h-4" />
      )}
      <span className="text-[13px]">{message.text}</span>
    </div>
  )
}

// Loading spinner component
export function LoadingSpinner(): JSX.Element {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 text-[var(--primary)] animate-spin" />
    </div>
  )
}

// Format bytes utility
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
