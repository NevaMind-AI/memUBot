import { Loader2, Check, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// LLM Provider type
export type LLMProvider = 'claude' | 'minimax' | 'custom'

// Provider options for select
export const PROVIDER_OPTIONS: { value: LLMProvider; label: string }[] = [
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'minimax', label: 'MiniMax' },
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
  // Custom provider settings
  customApiKey: string
  customBaseUrl: string
  customModel: string
  // Shared settings
  maxTokens: number
  temperature: number
  systemPrompt: string
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

// Floating Save Button Component
interface FloatingSaveButtonProps {
  show: boolean
  saving: boolean
  onSave: () => void
}

export function FloatingSaveButton({ show, saving, onSave }: FloatingSaveButtonProps): JSX.Element | null {
  const { t } = useTranslation()
  
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
        show 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-16 pointer-events-none'
      }`}
      style={{ marginLeft: '104px' }} // Offset for sidebar (208px / 2)
    >
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-[#7DCBF7] to-[#2596D1] text-white text-[13px] font-medium shadow-xl shadow-[#2596D1]/30 hover:shadow-2xl hover:shadow-[#2596D1]/40 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{t('common.saving')}</span>
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            <span>{t('common.saveChanges')}</span>
          </>
        )}
      </button>
    </div>
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
