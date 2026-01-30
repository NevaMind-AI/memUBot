import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Loader2,
  Play,
  Square,
  Trash2,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Check,
  AlertCircle,
  RefreshCw
} from 'lucide-react'

interface ServiceInfo {
  id: string
  name: string
  description: string
  type: 'longRunning' | 'scheduled'
  runtime: 'node' | 'python'
  entryFile: string
  schedule?: string
  createdAt: string
  status: 'stopped' | 'running' | 'error'
  pid?: number
  error?: string
  lastStarted?: string
  context: {
    userRequest: string
    expectation: string
    notifyPlatform?: string
  }
}

export function ServicesSettings(): JSX.Element {
  const { t } = useTranslation()
  const [services, setServices] = useState<ServiceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [expandedService, setExpandedService] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Load services
  const loadServices = useCallback(async () => {
    try {
      setLoading(true)
      const result = await window.services.list()
      if (result.success && result.data) {
        setServices(result.data)
      }
    } catch (error) {
      console.error('Failed to load services:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadServices()

    // Listen for status changes
    const unsubscribeStatus = window.services.onStatusChanged((data) => {
      setServices((prev) =>
        prev.map((s) =>
          s.id === data.serviceId ? { ...s, status: data.status as ServiceInfo['status'] } : s
        )
      )
    })

    // Listen for list changes (create/delete)
    const unsubscribeList = window.services.onListChanged(() => {
      loadServices()
    })

    return () => {
      unsubscribeStatus()
      unsubscribeList()
    }
  }, [loadServices])

  // Start service
  const handleStart = async (serviceId: string) => {
    setActionLoading(serviceId)
    setMessage(null)
    try {
      const result = await window.services.start(serviceId)
      if (result.success) {
        setMessage({ type: 'success', text: t('settings.services.started') })
        await loadServices()
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.services.startFailed') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.services.startFailed') })
    } finally {
      setActionLoading(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // Stop service
  const handleStop = async (serviceId: string) => {
    setActionLoading(serviceId)
    setMessage(null)
    try {
      const result = await window.services.stop(serviceId)
      if (result.success) {
        setMessage({ type: 'success', text: t('settings.services.stopped') })
        await loadServices()
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.services.stopFailed') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.services.stopFailed') })
    } finally {
      setActionLoading(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // Delete service
  const handleDelete = async (service: ServiceInfo) => {
    if (!confirm(t('settings.services.confirmDelete', { name: service.name }))) {
      return
    }
    setActionLoading(service.id)
    setMessage(null)
    try {
      const result = await window.services.delete(service.id)
      if (result.success) {
        setMessage({ type: 'success', text: t('settings.services.deleted', { name: service.name }) })
        await loadServices()
      } else {
        setMessage({ type: 'error', text: result.error || t('settings.services.deleteFailed') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('settings.services.deleteFailed') })
    } finally {
      setActionLoading(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  // Open services directory
  const openDirectory = async () => {
    try {
      await window.services.openDir()
    } catch (error) {
      console.error('Failed to open directory:', error)
    }
  }

  // Toggle expanded view
  const toggleExpanded = (serviceId: string) => {
    setExpandedService(expandedService === serviceId ? null : serviceId)
  }

  // Get runtime display name and icon
  const getRuntimeDisplay = (runtime: string) => {
    return runtime === 'node'
      ? { name: 'Node.js', icon: '🟢' }
      : { name: 'Python', icon: '🐍' }
  }

  // Get type display name
  const getTypeDisplay = (type: string) => {
    return type === 'longRunning'
      ? { name: t('settings.services.typeLongRunning'), icon: '♾️' }
      : { name: t('settings.services.typeScheduled'), icon: '⏰' }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {t('settings.services.title')}
            </h3>
            <button
              onClick={loadServices}
              disabled={loading}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all disabled:opacity-50"
              title={t('common.refresh')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
            {t('settings.services.description')}
          </p>
        </div>
        <button
          onClick={openDirectory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-solid)] transition-all"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>{t('settings.services.openFolder')}</span>
        </button>
      </div>

      {/* Message */}
      {message && (
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
      )}

      {/* Services list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-[var(--primary)] animate-spin" />
        </div>
      ) : services.length === 0 ? (
        <div className="text-center py-12">
          <Play className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-3" />
          <p className="text-[13px] text-[var(--text-muted)]">{t('settings.services.noServices')}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            {t('settings.services.noServicesHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => {
            const runtime = getRuntimeDisplay(service.runtime)
            const type = getTypeDisplay(service.type)
            const isExpanded = expandedService === service.id
            const isLoading = actionLoading === service.id

            return (
              <div
                key={service.id}
                className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {/* Status indicator */}
                      <div
                        className={`w-2 h-2 rounded-full ${
                          service.status === 'running'
                            ? 'bg-emerald-500'
                            : service.status === 'error'
                              ? 'bg-red-500'
                              : 'bg-gray-400'
                        }`}
                      />
                      <h4 className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                        {service.name}
                      </h4>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-input)] text-[var(--text-muted)]"
                        title={runtime.name}
                      >
                        {runtime.icon} {runtime.name}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-input)] text-[var(--text-muted)]"
                        title={type.name}
                      >
                        {type.icon}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1 line-clamp-2">
                      {service.description}
                    </p>

                    {/* Expandable details */}
                    <button
                      onClick={() => toggleExpanded(service.id)}
                      className="flex items-center gap-1 mt-2 text-[11px] text-[var(--primary)]"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3" /> {t('settings.services.hideDetails')}
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" /> {t('settings.services.showDetails')}
                        </>
                      )}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {service.status === 'running' ? (
                      <button
                        onClick={() => handleStop(service.id)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                        {t('common.stop')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStart(service.id)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                        {t('common.start')}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(service)}
                      disabled={isLoading}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                    <div className="space-y-2 text-[11px]">
                      {/* User request */}
                      <div>
                        <span className="text-[var(--text-muted)]">
                          {t('settings.services.userRequest')}:
                        </span>
                        <p className="text-[var(--text-primary)] mt-0.5 italic">
                          "{service.context.userRequest}"
                        </p>
                      </div>

                      {/* Expectation */}
                      <div>
                        <span className="text-[var(--text-muted)]">
                          {t('settings.services.expectation')}:
                        </span>
                        <p className="text-[var(--text-primary)] mt-0.5">
                          {service.context.expectation}
                        </p>
                      </div>

                      {/* Technical details */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border-color)]/50">
                        <span>ID: <span className="text-[var(--text-primary)] font-mono">{service.id}</span></span>
                        <span>{t('settings.services.entry')}: <span className="text-[var(--text-primary)] font-mono">{service.entryFile}</span></span>
                        {service.schedule && (
                          <span>{t('settings.services.schedule')}: <span className="text-[var(--text-primary)] font-mono">{service.schedule}</span></span>
                        )}
                        {service.pid && (
                          <span>PID: <span className="text-[var(--text-primary)] font-mono">{service.pid}</span></span>
                        )}
                        {service.context.notifyPlatform && (
                          <span>{t('settings.services.notifyVia')}: <span className="text-[var(--text-primary)]">{service.context.notifyPlatform}</span></span>
                        )}
                        <span>{t('settings.services.created')}: <span className="text-[var(--text-primary)]">{new Date(service.createdAt).toLocaleString()}</span></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
