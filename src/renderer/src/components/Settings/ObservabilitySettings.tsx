import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Download, Trash2, Terminal, FileText, Activity, BarChart3, ChevronDown, ChevronRight, Clock, Zap, AlertCircle, CheckCircle2 } from 'lucide-react'

interface LogEntry {
  timestamp: number
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
}

interface AuditLogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  event: string
  traceId?: string
  durationMs?: number
  data?: Record<string, unknown>
  error?: string
}

interface TokenUsage {
  input: number
  output: number
  total: number
}

interface TraceSpan {
  spanId: string
  parentSpanId?: string
  name: string
  startTime: number
  endTime?: number
  durationMs?: number
  status: 'ok' | 'error'
  attributes: Record<string, unknown>
  error?: string
  tokenUsage?: TokenUsage
}

interface TraceEntry {
  traceId: string
  platform: string
  userId?: string
  startTime: number
  endTime?: number
  durationMs?: number
  success?: boolean
  spans: TraceSpan[]
}

interface ToolMetrics {
  callCount: number
  errorCount: number
  totalDurationMs: number
  avgDurationMs: number
}

interface MetricsSummary {
  window: string
  messageCount: number
  successCount: number
  errorCount: number
  avgDurationMs: number
  p95DurationMs: number
  llm: {
    callCount: number
    errorCount: number
    totalInputTokens: number
    totalOutputTokens: number
    avgDurationMs: number
    p95DurationMs: number
  }
  tools: Record<string, ToolMetrics>
  platforms: Record<string, { received: number; processed: number; errors: number }>
}

type TabId = 'console' | 'traces' | 'metrics' | 'audit'

export function ObservabilitySettings(): JSX.Element {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabId>('console')
  const [traces, setTraces] = useState<TraceEntry[]>([])
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set())
  const [metricsSummary, setMetricsSummary] = useState<MetricsSummary | null>(null)
  const [showAgentActivity, setShowAgentActivity] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const logsEndRef = useRef<HTMLDivElement | null>(null)

  const TAB_CONFIG: { id: TabId; icon: typeof Terminal; labelKey: string }[] = [
    { id: 'console', icon: Terminal, labelKey: 'settings.observability.tabs.console' },
    { id: 'traces', icon: Activity, labelKey: 'settings.observability.tabs.traces' },
    { id: 'metrics', icon: BarChart3, labelKey: 'settings.observability.tabs.metrics' },
    { id: 'audit', icon: FileText, labelKey: 'settings.observability.tabs.audit' }
  ]

  useEffect(() => {
    window.settings.get().then(result => {
      if (result.success && result.data) {
        setShowAgentActivity(result.data.showAgentActivity ?? false)
      }
    })
    loadAllData()
  }, [])

  const loadAllData = useCallback(async (): Promise<void> => {
    const logsResult = await window.settings.getLogs()
    if (logsResult.success && logsResult.data) {
      setLogs(logsResult.data.logs)
    }
    await loadAuditLogs()
    await loadTraces()
    await loadMetrics()
  }, [])

  const loadTraces = async (date?: string): Promise<void> => {
    const result = await window.settings.getTraces(date)
    if (result.success && result.data) {
      setTraces((result.data as { traces: TraceEntry[] }).traces)
    }
  }

  const loadMetrics = async (): Promise<void> => {
    const result = await window.settings.getMetricsSummary()
    if (result.success && result.data) {
      setMetricsSummary(result.data as MetricsSummary)
    }
  }

  const loadAuditLogs = async (date?: string): Promise<void> => {
    const result = await window.settings.getAuditLogs(date)
    if (result.success && result.data) {
      setAuditLogs(result.data.entries as AuditLogEntry[])
      setAvailableDates(result.data.availableDates as string[])
      if (!selectedDate && result.data.availableDates?.length > 0) {
        setSelectedDate((result.data.availableDates as string[])[0])
      }
    }
  }

  const handleRefresh = async (): Promise<void> => {
    setRefreshing(true)
    await loadAllData()
    if (activeTab === 'audit') await loadAuditLogs(selectedDate)
    if (activeTab === 'traces') await loadTraces(selectedDate)
    setRefreshing(false)
    if (activeTab === 'console') {
      setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  const handleDateChange = async (date: string): Promise<void> => {
    setSelectedDate(date)
    await loadAuditLogs(date)
    await loadTraces(date)
  }

  const handleExportLogs = async (): Promise<void> => {
    const result = await window.settings.exportLogs(selectedDate || undefined)
    if (result.success && result.data) {
      const blob = new Blob([result.data as string], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `memubot-logs-${selectedDate || 'today'}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const handleToggleAgentActivity = async (): Promise<void> => {
    const newValue = !showAgentActivity
    setShowAgentActivity(newValue)
    await window.settings.save({ showAgentActivity: newValue })
  }

  const clearLogs = async (): Promise<void> => {
    await window.settings.clearLogs()
    setLogs([])
  }

  const toggleTrace = (traceId: string): void => {
    setExpandedTraces(prev => {
      const next = new Set(prev)
      if (next.has(traceId)) next.delete(traceId)
      else next.add(traceId)
      return next
    })
  }

  const formatTime = (timestamp: number): string =>
    new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
    })

  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'error': return 'text-red-500'
      case 'warn': return 'text-amber-500'
      case 'info': return 'text-blue-400'
      default: return 'text-[var(--text-muted)]'
    }
  }

  const getLevelBg = (level: string): string => {
    switch (level) {
      case 'error': return 'bg-red-500/10'
      case 'warn': return 'bg-amber-500/10'
      case 'info': return 'bg-blue-500/10'
      default: return ''
    }
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('settings.observability.title')}</h3>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
          {t('settings.observability.description')}
        </p>
      </div>

      {/* Agent Activity Toggle */}
      <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0">
              <Activity className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <h4 className="text-[13px] font-medium text-[var(--text-primary)]">{t('settings.observability.agentActivity')}</h4>
              <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-relaxed">
                {t('settings.observability.agentActivityDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleAgentActivity}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              showAgentActivity ? 'bg-emerald-500' : 'bg-[var(--bg-input)]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                showAgentActivity ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tab Bar + Actions */}
      <div className="rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--glass-border)]">
          {/* Tabs */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--bg-input)]">
            {TAB_CONFIG.map(({ id, icon: Icon, labelKey }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  activeTab === id
                    ? 'bg-[var(--glass-bg)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t(labelKey)}</span>
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {(activeTab === 'audit' || activeTab === 'traces') && availableDates.length > 0 && (
              <select
                value={selectedDate}
                onChange={e => handleDateChange(e.target.value)}
                className="px-2 py-1 text-[11px] bg-[var(--bg-input)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[var(--primary)]/50"
              >
                {availableDates.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all disabled:opacity-50"
              title={t('settings.observability.actions.refresh')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {activeTab === 'console' && (
              <button
                onClick={clearLogs}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all"
                title={t('settings.observability.actions.clear')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleExportLogs}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all"
              title={t('settings.observability.actions.export')}
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Console Tab */}
        {activeTab === 'console' && (
          <div className="h-[360px] overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
            {logs.length === 0 ? (
              <EmptyState icon={Terminal} message={t('settings.observability.console.empty')} hint={t('settings.observability.console.emptyHint')} />
            ) : (
              <>
                {logs.map((log, idx) => (
                  <div key={idx} className={`flex gap-2 py-[3px] px-1.5 rounded ${getLevelBg(log.level)} hover:bg-[var(--bg-card)]`}>
                    <span className="text-[var(--text-muted)] opacity-50 shrink-0 tabular-nums">{formatTime(log.timestamp)}</span>
                    <span className={`shrink-0 w-[42px] font-semibold ${getLevelColor(log.level)}`}>{log.level}</span>
                    <span className="text-[var(--text-primary)] whitespace-pre-wrap break-all opacity-90">{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </>
            )}
          </div>
        )}

        {/* Traces Tab */}
        {activeTab === 'traces' && (
          <div className="h-[360px] overflow-y-auto p-3">
            {traces.length === 0 ? (
              <EmptyState icon={Activity} message={t('settings.observability.traces.empty')} hint={t('settings.observability.traces.emptyHint')} />
            ) : (
              <div className="space-y-1">
                {traces.map((trace) => (
                  <TraceRow
                    key={trace.traceId}
                    trace={trace}
                    expanded={expandedTraces.has(trace.traceId)}
                    onToggle={() => toggleTrace(trace.traceId)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="h-[360px] overflow-y-auto p-3">
            {!metricsSummary ? (
              <EmptyState icon={BarChart3} message={t('settings.observability.metrics.empty')} hint={t('settings.observability.metrics.emptyHint')} />
            ) : (
              <MetricsDashboard metrics={metricsSummary} />
            )}
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div className="h-[360px] overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
            {auditLogs.length === 0 ? (
              <EmptyState icon={FileText} message={t('settings.observability.audit.empty')} hint={t('settings.observability.audit.emptyHint')} />
            ) : (
              auditLogs.map((entry, idx) => (
                <div key={idx} className={`flex gap-2 py-[3px] px-1.5 rounded ${getLevelBg(entry.level)} hover:bg-[var(--bg-card)]`}>
                  <span className="text-[var(--text-muted)] opacity-50 shrink-0 tabular-nums">
                    {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </span>
                  <span className={`shrink-0 w-[42px] font-semibold ${getLevelColor(entry.level)}`}>{entry.level}</span>
                  <span className="text-[var(--text-primary)] opacity-90 shrink-0">{entry.event}</span>
                  {entry.traceId && (
                    <span className="text-[var(--text-muted)] opacity-40 shrink-0">#{entry.traceId.slice(0, 8)}</span>
                  )}
                  {entry.error && (
                    <span className="text-red-400 whitespace-pre-wrap break-all">{entry.error}</span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, message, hint }: { icon: typeof Terminal; message: string; hint: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12">
      <div className="w-12 h-12 rounded-2xl bg-[var(--bg-card)] flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-[var(--text-muted)] opacity-40" />
      </div>
      <p className="text-[13px] font-medium text-[var(--text-muted)]">{message}</p>
      <p className="text-[11px] text-[var(--text-muted)] opacity-60 mt-1 max-w-[240px]">{hint}</p>
    </div>
  )
}

function TraceRow({ trace, expanded, onToggle }: { trace: TraceEntry; expanded: boolean; onToggle: () => void }): JSX.Element {
  const { t } = useTranslation()
  const StatusIcon = trace.success ? CheckCircle2 : AlertCircle
  const statusColor = trace.success ? 'text-emerald-500' : 'text-red-500'

  return (
    <div className={`rounded-xl border transition-colors ${expanded ? 'border-[var(--border-color)] bg-[var(--bg-card)]' : 'border-transparent hover:bg-[var(--bg-card)]'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <StatusIcon className={`w-4 h-4 shrink-0 ${statusColor}`} />
        <span className="text-[12px] font-medium text-[var(--text-primary)] w-16 shrink-0 capitalize">{trace.platform}</span>
        <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] shrink-0">
          <Clock className="w-3 h-3" />
          <span className="tabular-nums">{trace.durationMs ?? '-'}ms</span>
        </div>
        {trace.spans[0]?.tokenUsage && (
          <div className="flex items-center gap-1 text-[11px] text-amber-500 shrink-0">
            <Zap className="w-3 h-3" />
            <span className="tabular-nums">{trace.spans[0].tokenUsage.total.toLocaleString()}</span>
          </div>
        )}
        <span className="text-[10px] text-[var(--text-muted)] opacity-50 ml-auto tabular-nums shrink-0">
          {new Date(trace.startTime).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
        )}
      </button>

      {expanded && trace.spans.length > 1 && (
        <div className="px-3 pb-3 ml-4 border-l-2 border-[var(--border-color)] space-y-1">
          {trace.spans.slice(1).map((span) => (
            <div key={span.spanId} className="flex items-center gap-2 py-1 pl-3 text-[11px]">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${span.status === 'error' ? 'bg-red-500' : 'bg-emerald-500/60'}`} />
              <span className={`font-medium ${span.status === 'error' ? 'text-red-400' : 'text-[var(--text-primary)] opacity-80'}`}>
                {span.name}
              </span>
              <span className="text-[var(--text-muted)] opacity-50 tabular-nums">{span.durationMs}ms</span>
              {span.tokenUsage && <span className="text-amber-400 tabular-nums">{span.tokenUsage.total}t</span>}
              {span.error && <span className="text-red-400 truncate text-[10px]">{span.error}</span>}
            </div>
          ))}
          {trace.spans[0]?.tokenUsage && (
            <div className="flex items-center gap-2 pl-3 pt-1 text-[10px] text-amber-500/80 border-t border-[var(--border-color)]">
              <Zap className="w-3 h-3" />
              <span>{t('settings.observability.traces.totalTokens', { count: trace.spans[0].tokenUsage.total })}</span>
              <span className="text-[var(--text-muted)] opacity-50">
                ({t('settings.observability.traces.tokenBreakdown', { input: trace.spans[0].tokenUsage.input.toLocaleString(), output: trace.spans[0].tokenUsage.output.toLocaleString() })})
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricsDashboard({ metrics }: { metrics: MetricsSummary }): JSX.Element {
  const { t } = useTranslation()
  const successRate = metrics.messageCount > 0
    ? Math.round((metrics.successCount / metrics.messageCount) * 100)
    : 0

  return (
    <div className="space-y-3">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard
          label={t('settings.observability.metrics.messages')}
          value={metrics.messageCount.toString()}
          sub={t('settings.observability.metrics.successRate', { rate: successRate })}
          color={successRate >= 90 ? 'emerald' : successRate >= 70 ? 'amber' : 'red'}
        />
        <MetricCard
          label={t('settings.observability.metrics.avgLatency')}
          value={`${metrics.avgDurationMs}ms`}
          sub={t('settings.observability.metrics.p95', { value: metrics.p95DurationMs })}
          color="blue"
        />
        <MetricCard
          label={t('settings.observability.metrics.llmCalls')}
          value={metrics.llm.callCount.toString()}
          sub={t('settings.observability.metrics.tokens', { count: metrics.llm.totalInputTokens + metrics.llm.totalOutputTokens })}
          color="amber"
        />
      </div>

      {/* LLM Details */}
      <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
        <h5 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('settings.observability.metrics.llmPerformance')}</h5>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">{t('settings.observability.metrics.inputTokens')}</span>
            <span className="text-[var(--text-primary)] font-medium tabular-nums">{metrics.llm.totalInputTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">{t('settings.observability.metrics.outputTokens')}</span>
            <span className="text-[var(--text-primary)] font-medium tabular-nums">{metrics.llm.totalOutputTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">{t('settings.observability.metrics.avgDuration')}</span>
            <span className="text-[var(--text-primary)] font-medium tabular-nums">{metrics.llm.avgDurationMs}ms</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">{t('settings.observability.metrics.p95Duration')}</span>
            <span className="text-[var(--text-primary)] font-medium tabular-nums">{metrics.llm.p95DurationMs}ms</span>
          </div>
          {metrics.llm.errorCount > 0 && (
            <div className="flex justify-between col-span-2">
              <span className="text-red-400">{t('settings.observability.metrics.errors')}</span>
              <span className="text-red-400 font-medium tabular-nums">{metrics.llm.errorCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Platform Breakdown */}
      {Object.keys(metrics.platforms).length > 0 && (
        <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
          <h5 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('settings.observability.metrics.platforms')}</h5>
          <div className="space-y-1.5">
            {Object.entries(metrics.platforms).map(([name, p]) => (
              <div key={name} className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--text-primary)] font-medium capitalize">{name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--text-muted)] tabular-nums">{t('settings.observability.metrics.received', { count: p.received })}</span>
                  <span className="text-emerald-500 tabular-nums">{t('settings.observability.metrics.processed', { count: p.processed })}</span>
                  {p.errors > 0 && <span className="text-red-400 tabular-nums">{t('settings.observability.metrics.errorCount', { count: p.errors })}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool Usage */}
      {Object.keys(metrics.tools).length > 0 && (
        <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
          <h5 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('settings.observability.metrics.toolUsage')}</h5>
          <div className="space-y-1.5">
            {Object.entries(metrics.tools).map(([name, tm]) => (
              <div key={name} className="flex items-center justify-between text-[12px]">
                <span className="text-[var(--text-primary)] font-medium font-mono text-[11px]">{name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--text-muted)] tabular-nums">{tm.callCount}x</span>
                  <span className="text-[var(--text-muted)] tabular-nums">{tm.avgDurationMs}ms avg</span>
                  {tm.errorCount > 0 && <span className="text-red-400 tabular-nums">{tm.errorCount} err</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }): JSX.Element {
  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20',
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
    red: 'from-red-500/10 to-red-500/5 border-red-500/20'
  }
  const textColorMap: Record<string, string> = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    blue: 'text-blue-500',
    red: 'text-red-500'
  }

  return (
    <div className={`p-3 rounded-xl bg-gradient-to-b ${colorMap[color]} border`}>
      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${textColorMap[color]}`}>{value}</p>
      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</p>
    </div>
  )
}
