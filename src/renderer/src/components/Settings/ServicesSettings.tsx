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
  RefreshCw,
  Infinity,
  Clock
} from 'lucide-react'

// Simple Node.js logo component
const NodeJsLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 256 289" className={className}>
    <path
      fill="#539E43"
      d="M128 288.464c-3.975 0-7.685-1.06-11.13-2.915l-35.247-20.936c-5.3-2.915-2.65-3.975-1.06-4.505 7.155-2.385 8.48-2.915 15.9-7.156.796-.53 1.856-.265 2.65.265l27.032 16.166c1.06.53 2.385.53 3.18 0l105.74-61.217c1.06-.53 1.59-1.59 1.59-2.915V83.08c0-1.325-.53-2.385-1.59-2.915l-105.74-60.953c-1.06-.53-2.385-.53-3.18 0L20.705 80.166c-1.06.53-1.59 1.855-1.59 2.915v122.17c0 1.06.53 2.385 1.59 2.915l28.887 16.695c15.636 7.95 25.44-1.325 25.44-10.6V93.68c0-1.59 1.326-3.18 3.181-3.18h13.516c1.59 0 3.18 1.325 3.18 3.18v120.58c0 20.936-11.396 33.126-31.272 33.126-6.095 0-10.865 0-24.38-6.625l-27.827-15.9C4.24 220.356 0 212.67 0 204.456V82.286c0-8.215 4.24-15.9 11.13-19.876L116.87 1.193c6.625-3.71 15.635-3.71 22.26 0L244.87 62.41c6.89 3.975 11.13 11.66 11.13 19.876v122.17c0 8.214-4.24 15.9-11.13 19.875l-105.74 61.217c-3.18 1.856-6.89 2.916-11.13 2.916"
    />
    <path
      fill="#539E43"
      d="M159.903 204.19c-45.498 0-55.037-20.936-55.037-38.427 0-1.59 1.325-3.18 3.18-3.18h13.78c1.59 0 2.916 1.06 2.916 2.65 2.12 14.045 8.215 20.936 36.042 20.936 22.26 0 31.537-5.035 31.537-16.96 0-6.89-2.65-11.926-37.102-15.372-28.622-2.915-46.378-9.276-46.378-32.33 0-21.467 18.02-34.187 48.233-34.187 33.92 0 50.616 11.66 52.736 37.102 0 .795-.265 1.59-.795 2.385-.53.53-1.325 1.06-2.12 1.06h-13.78c-1.326 0-2.65-1.06-2.916-2.385-3.18-14.575-11.395-19.345-33.125-19.345-24.38 0-27.296 8.48-27.296 14.84 0 7.686 3.445 10.07 36.042 14.31 32.33 4.24 47.437 10.336 47.437 33.126-.265 23.175-19.345 36.306-52.736 36.306"
    />
  </svg>
)

// Simple Python logo component
const PythonLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 256 255" className={className}>
    <defs>
      <linearGradient id="pythonLogoA" x1="12.959%" x2="79.639%" y1="12.039%" y2="78.201%">
        <stop offset="0%" stopColor="#387EB8" />
        <stop offset="100%" stopColor="#366994" />
      </linearGradient>
      <linearGradient id="pythonLogoB" x1="19.128%" x2="90.742%" y1="20.579%" y2="88.429%">
        <stop offset="0%" stopColor="#FFE052" />
        <stop offset="100%" stopColor="#FFC331" />
      </linearGradient>
    </defs>
    <path
      fill="url(#pythonLogoA)"
      d="M126.916.072c-64.832 0-60.784 28.115-60.784 28.115l.072 29.128h61.868v8.745H41.631S.145 61.355.145 126.77c0 65.417 36.21 63.097 36.21 63.097h21.61v-30.356s-1.165-36.21 35.632-36.21h61.362s34.475.557 34.475-33.319V33.97S194.67.072 126.916.072M92.802 19.66a11.12 11.12 0 0 1 11.13 11.13 11.12 11.12 0 0 1-11.13 11.13 11.12 11.12 0 0 1-11.13-11.13 11.12 11.12 0 0 1 11.13-11.13"
    />
    <path
      fill="url(#pythonLogoB)"
      d="M128.757 254.126c64.832 0 60.784-28.115 60.784-28.115l-.072-29.127H127.6v-8.745h86.441s41.486 4.705 41.486-60.712c0-65.416-36.21-63.096-36.21-63.096h-21.61v30.355s1.165 36.21-35.632 36.21h-61.362s-34.475-.557-34.475 33.32v56.013s-5.235 33.897 62.518 33.897m34.114-19.586a11.12 11.12 0 0 1-11.13-11.13 11.12 11.12 0 0 1 11.13-11.131 11.12 11.12 0 0 1 11.13 11.13 11.12 11.12 0 0 1-11.13 11.13"
    />
  </svg>
)

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

  // Get runtime info
  const getRuntimeInfo = (runtime: string) => {
    return runtime === 'node'
      ? { name: 'Node.js', Logo: NodeJsLogo }
      : { name: 'Python', Logo: PythonLogo }
  }

  // Get type info
  const getTypeInfo = (type: string) => {
    return type === 'longRunning'
      ? { name: t('settings.services.typeLongRunning'), Icon: Infinity }
      : { name: t('settings.services.typeScheduled'), Icon: Clock }
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
            const runtime = getRuntimeInfo(service.runtime)
            const type = getTypeInfo(service.type)
            const isExpanded = expandedService === service.id
            const isLoading = actionLoading === service.id

            return (
              <div
                key={service.id}
                className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm overflow-hidden"
              >
                <div className="flex items-start gap-3">
                  {/* Content - shrinks first */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2">
                      {/* Status indicator */}
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          service.status === 'running'
                            ? 'bg-emerald-500'
                            : service.status === 'error'
                              ? 'bg-red-500'
                              : 'bg-gray-400'
                        }`}
                      />
                      {/* Title - truncates when space is tight */}
                      <h4 className="text-[13px] font-medium text-[var(--text-primary)] truncate min-w-0">
                        {service.name}
                      </h4>
                      {/* Tags - don't shrink */}
                      <span
                        className="flex items-center px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-input)] text-[var(--text-muted)] shrink-0"
                        title={runtime.name}
                      >
                        <runtime.Logo className="w-3 h-3" />
                      </span>
                      <span
                        className="flex items-center px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-input)] text-[var(--text-muted)] shrink-0"
                        title={type.name}
                      >
                        <type.Icon className="w-3 h-3" />
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

                  {/* Actions - don't shrink */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {service.status === 'running' ? (
                      <button
                        onClick={() => handleStop(service.id)}
                        disabled={isLoading}
                        className="p-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                        title={t('common.stop')}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStart(service.id)}
                        disabled={isLoading}
                        className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                        title={t('common.start')}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(service)}
                      disabled={isLoading}
                      className="p-1 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
                      title={t('common.delete')}
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
