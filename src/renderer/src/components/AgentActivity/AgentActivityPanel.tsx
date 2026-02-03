import { useState, useEffect, useRef } from 'react'
import { X, Brain, Wrench, CheckCircle, XCircle, MessageSquare, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface AgentActivityItem {
  id: string
  type: 'thinking' | 'tool_call' | 'tool_result' | 'response'
  timestamp: number
  iteration?: number
  content?: string
  toolName?: string
  toolInput?: Record<string, unknown>
  toolUseId?: string
  success?: boolean
  result?: string
  error?: string
  message?: string
}

interface LLMStatusInfo {
  status: 'idle' | 'thinking' | 'tool_executing' | 'complete' | 'aborted'
  currentTool?: string
  iteration?: number
}

interface AgentActivityPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function AgentActivityPanel({ isOpen, onClose }: AgentActivityPanelProps): JSX.Element {
  const { t } = useTranslation()
  const [activities, setActivities] = useState<AgentActivityItem[]>([])
  const [llmStatus, setLLMStatus] = useState<LLMStatusInfo>({ status: 'idle' })
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Handle open/close animation
  useEffect(() => {
    // Clear any pending close timer when isOpen changes
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }

    if (isOpen) {
      setShouldRender(true)
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true)
        })
      })
    } else {
      setIsVisible(false)
      // Wait for animation to complete before unmounting
      closeTimerRef.current = setTimeout(() => {
        setShouldRender(false)
        closeTimerRef.current = null
      }, 200)
    }

    // Cleanup on unmount
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [isOpen])

  // Load initial activity log and status
  useEffect(() => {
    if (isOpen) {
      window.llm.getActivityLog().then(setActivities)
      window.llm.getStatus().then(setLLMStatus)
    }
  }, [isOpen])

  // Subscribe to activity changes
  useEffect(() => {
    const unsubscribeActivity = window.llm.onActivityChanged((activity: AgentActivityItem) => {
      setActivities(prev => [...prev, activity])
    })

    const unsubscribeStatus = window.llm.onStatusChanged((status: LLMStatusInfo) => {
      setLLMStatus(status)
    })

    return () => {
      unsubscribeActivity()
      unsubscribeStatus()
    }
  }, [])

  // Auto-scroll to bottom when new activities are added
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activities, autoScroll])

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
      // If user is near the bottom (within 50px), enable auto-scroll
      setAutoScroll(scrollHeight - scrollTop - clientHeight < 50)
    }
  }

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatToolInput = (input: Record<string, unknown>) => {
    try {
      return JSON.stringify(input, null, 2)
    } catch {
      return String(input)
    }
  }

  const renderActivityIcon = (activity: AgentActivityItem) => {
    switch (activity.type) {
      case 'thinking':
        return <Brain className="w-4 h-4 text-amber-500" />
      case 'tool_call':
        return <Wrench className="w-4 h-4 text-blue-500" />
      case 'tool_result':
        return activity.success 
          ? <CheckCircle className="w-4 h-4 text-emerald-500" />
          : <XCircle className="w-4 h-4 text-red-500" />
      case 'response':
        return <MessageSquare className="w-4 h-4 text-purple-500" />
      default:
        return null
    }
  }

  const renderActivityContent = (activity: AgentActivityItem) => {
    const isExpanded = expandedItems.has(activity.id)

    switch (activity.type) {
      case 'thinking':
        return (
          <div className="text-sm text-[var(--text-secondary)]">
            {activity.content || t('activity.iteration', { count: activity.iteration })}
          </div>
        )

      case 'tool_call':
        return (
          <div>
            <div 
              className="flex items-center gap-1 cursor-pointer hover:bg-[var(--bg-card)] rounded px-1 -mx-1"
              onClick={() => toggleExpanded(activity.id)}
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {activity.toolName}
              </span>
            </div>
            {isExpanded && activity.toolInput && (
              <pre className="mt-2 p-2 bg-[var(--bg-secondary)] rounded text-xs overflow-x-auto max-h-48 overflow-y-auto">
                {formatToolInput(activity.toolInput)}
              </pre>
            )}
          </div>
        )

      case 'tool_result':
        return (
          <div>
            <div 
              className="flex items-center gap-1 cursor-pointer hover:bg-[var(--bg-card)] rounded px-1 -mx-1"
              onClick={() => toggleExpanded(activity.id)}
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span className={`text-sm font-medium ${activity.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {activity.toolName} {activity.success ? t('activity.completed') : t('activity.failed')}
              </span>
            </div>
            {isExpanded && (
              <pre className="mt-2 p-2 bg-[var(--bg-secondary)] rounded text-xs overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
                {activity.success ? activity.result : activity.error}
              </pre>
            )}
          </div>
        )

      case 'response':
        return (
          <div>
            <div 
              className="flex items-center gap-1 cursor-pointer hover:bg-[var(--bg-card)] rounded px-1 -mx-1"
              onClick={() => toggleExpanded(activity.id)}
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                {t('activity.finalResponse')}
              </span>
            </div>
            {isExpanded && activity.message && (
              <div className="mt-2 p-2 bg-[var(--bg-secondary)] rounded text-sm max-h-48 overflow-y-auto whitespace-pre-wrap">
                {activity.message}
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  if (!shouldRender) return <></>

  const isProcessing = llmStatus.status !== 'idle'

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-start justify-center pt-20 transition-opacity duration-200 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div 
        className={`relative w-[480px] max-h-[70vh] bg-[var(--bg-card-solid)] rounded-xl shadow-2xl border border-[var(--border-color)] flex flex-col overflow-hidden transition-all duration-200 ${
          isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {t('activity.title')}
            </h2>
            {isProcessing && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  {llmStatus.status === 'thinking' ? t('activity.thinking') : llmStatus.currentTool || t('activity.processing')}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Activity List */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-3"
        >
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
              <Brain className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">{t('activity.noActivity')}</p>
              <p className="text-xs mt-1">{t('activity.noActivityHint')}</p>
            </div>
          ) : (
            activities.map((activity) => (
              <div 
                key={activity.id}
                className="flex gap-3 p-3 bg-black/5 dark:bg-white/5 rounded-lg border border-[var(--border-color)]"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {renderActivityIcon(activity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
                      {activity.type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {formatTime(activity.timestamp)}
                    </span>
                  </div>
                  {renderActivityContent(activity)}
                </div>
              </div>
            ))
          )}
          
          {/* Processing indicator at bottom */}
          {isProcessing && (
            <div className="flex items-center justify-center py-2">
              <div className="flex items-center gap-2 text-amber-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">
                  {llmStatus.status === 'thinking' 
                    ? `${t('activity.thinking')}${llmStatus.iteration ? ` (${llmStatus.iteration})` : ''}...` 
                    : `${t('activity.executing')} ${llmStatus.currentTool}...`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-muted)]">
              {t('activity.count', { count: activities.length })}
            </span>
            {!autoScroll && (
              <button
                onClick={() => {
                  setAutoScroll(true)
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
                  }
                }}
                className="text-[11px] text-blue-500 hover:text-blue-600"
              >
                {t('activity.scrollToBottom')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
