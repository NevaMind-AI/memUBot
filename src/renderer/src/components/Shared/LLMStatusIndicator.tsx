import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, Wrench, CheckCircle, XCircle, Square } from 'lucide-react'
import { toast } from '../Toast'

interface LLMStatusInfo {
  status: 'idle' | 'thinking' | 'tool_executing' | 'complete' | 'aborted'
  currentTool?: string
  iteration?: number
}

interface LLMStatusIndicatorProps {
  onShowActivity?: () => void
}

/**
 * Shared LLM/Agent status indicator with abort button.
 * Subscribes to window.llm status changes internally.
 */
export function LLMStatusIndicator({ onShowActivity }: LLMStatusIndicatorProps): JSX.Element | null {
  const { t } = useTranslation()
  const [llmStatus, setLLMStatus] = useState<LLMStatusInfo>({ status: 'idle' })

  useEffect(() => {
    const unsubscribe = window.llm.onStatusChanged((newStatus: LLMStatusInfo) => {
      setLLMStatus(newStatus)
    })
    window.llm.getStatus().then(setLLMStatus)
    return () => unsubscribe()
  }, [])

  const handleAbort = async (): Promise<void> => {
    try {
      await window.llm.abort()
      toast.info(t('common.stop'))
    } catch (error) {
      console.error('Failed to abort LLM:', error)
    }
  }

  const handleShowActivity = async (): Promise<void> => {
    const result = await window.settings.get()
    if (result.success && result.data?.showAgentActivity) {
      onShowActivity?.()
    }
  }

  const isProcessing = llmStatus.status === 'thinking' || llmStatus.status === 'tool_executing'
  const isFinished = llmStatus.status === 'complete' || llmStatus.status === 'aborted'
  const showStatus = isProcessing || isFinished

  if (!showStatus) return null

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button
        onClick={handleShowActivity}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full backdrop-blur-sm border whitespace-nowrap transition-all cursor-pointer ${
          isProcessing
            ? 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/30 hover:bg-amber-500/20'
            : llmStatus.status === 'complete'
              ? 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-orange-500/10 dark:bg-orange-500/20 border-orange-500/30 hover:bg-orange-500/20'
        }`}
        title={t('messages.viewActivity') || 'View Activity'}
      >
        {llmStatus.status === 'thinking' ? (
          <Brain className="w-3 h-3 text-amber-500 animate-pulse flex-shrink-0" />
        ) : llmStatus.status === 'tool_executing' ? (
          <Wrench className="w-3 h-3 text-amber-500 animate-pulse flex-shrink-0" />
        ) : llmStatus.status === 'complete' ? (
          <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
        ) : (
          <XCircle className="w-3 h-3 text-orange-500 flex-shrink-0" />
        )}
        <span
          className={`text-[11px] font-medium ${
            isProcessing
              ? 'text-amber-600 dark:text-amber-400'
              : llmStatus.status === 'complete'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-orange-600 dark:text-orange-400'
          }`}
        >
          {llmStatus.status === 'thinking'
            ? `${t('messages.thinking')}${llmStatus.iteration ? ` (${llmStatus.iteration})` : ''}`
            : llmStatus.status === 'tool_executing'
              ? llmStatus.currentTool || t('messages.generating')
              : llmStatus.status === 'complete'
                ? t('messages.complete')
                : t('messages.aborted')}
        </span>
      </button>

      {/* Stop Button - only show when processing */}
      {isProcessing && (
        <button
          onClick={handleAbort}
          className="p-1 rounded-md bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all flex-shrink-0"
          title={t('common.stop')}
        >
          <Square className="w-3 h-3 fill-current" />
        </button>
      )}
    </div>
  )
}
