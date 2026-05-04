import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Brain,
  Clock3,
  Eye,
  EyeOff,
  FileClock,
  Filter,
  PauseCircle,
  Pencil,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldEllipsis,
  Trash2,
  PlayCircle,
  History,
  Ban,
  Database,
} from 'lucide-react'
import { MessageDisplay } from '../shared'

type MessageState = { type: 'success' | 'error'; text: string } | null
type MemoryStatus = 'active' | 'archived' | 'deleted'
type MemorySensitivityLevel = 'normal' | 'work' | 'sensitive'
type MemoryConflictState = 'none' | 'potential' | 'confirmed'

interface MemoryProvenance {
  source_platform: string | null
  source_excerpt: string | null
  created_at: number
  updated_at: number
  retention_until: number | null
  why_stored: string | null
  sensitivity_level: MemorySensitivityLevel
  conflict_state: MemoryConflictState
  conflict_notes: string | null
}

interface MemoryExplanation {
  provenance: MemoryProvenance
}

interface ExplainedLocalMemoryItem {
  id: string
  content: string
  memory_type: string
  source_platform: string | null
  source_excerpt: string | null
  created_at: number
  updated_at: number
  confidence: number
  importance: number
  sensitivity_level: MemorySensitivityLevel
  retention_until: number | null
  status: MemoryStatus
  user_control: 'auto' | 'remember' | 'dont_remember' | 'modified' | 'deleted' | 'paused'
  why_stored: string | null
  conflict_state: MemoryConflictState
  conflict_notes: string | null
  explanation: MemoryExplanation
}

interface MemoryMatchField {
  field: 'content' | 'memory_type' | 'source_platform' | 'source_excerpt' | 'why_stored' | 'status' | 'user_control' | 'sensitivity_level' | 'conflict_notes'
  value_excerpt: string
  matched_terms: string[]
  score_contribution: number
  reason: string
}

interface MemoryRetrievalResult {
  memory: ExplainedLocalMemoryItem
  retrieval_explanation: {
    query: string
    matched_fields: MemoryMatchField[]
    source_excerpt: string | null
    created_at: number
    updated_at: number
    retention_until: number | null
    score: number
    score_reasons: string[]
  }
}

interface MemoryEventRecord {
  id: number
  memory_id: string
  event_type: string
  actor: string
  previous_status: MemoryStatus | null
  new_status: MemoryStatus | null
  reason: string | null
  payload_json: string | null
  created_at: number
}

type MemoryFiltersState = {
  query: string
  memoryType: string
  sourcePlatform: string
  sensitivityLevel: '' | MemorySensitivityLevel
  conflictState: '' | MemoryConflictState
  minConfidence: string
  includeArchived: boolean
  excludeSensitive: boolean
}

type RememberFormState = {
  content: string
  memoryType: string
  sourcePlatform: string
  sourceExcerpt: string
  sensitivityLevel: MemorySensitivityLevel
  confidence: string
  importance: string
  retentionDays: string
  whyStored: string
}

type SuppressFormState = {
  content: string
  sourcePlatform: string
  sourceExcerpt: string
  sensitivityLevel: MemorySensitivityLevel
  reason: string
}

type EditDraftState = {
  content: string
  memory_type: string
  source_platform: string
  source_excerpt: string
  confidence: string
  importance: string
  sensitivity_level: MemorySensitivityLevel
  retention_until: string
  status: MemoryStatus
  why_stored: string
  conflict_state: MemoryConflictState
  conflict_notes: string
}

const DEFAULT_FILTERS: MemoryFiltersState = {
  query: '',
  memoryType: '',
  sourcePlatform: '',
  sensitivityLevel: '',
  conflictState: '',
  minConfidence: '',
  includeArchived: true,
  excludeSensitive: false,
}

const DEFAULT_REMEMBER_FORM: RememberFormState = {
  content: '',
  memoryType: 'manual_note',
  sourcePlatform: '',
  sourceExcerpt: '',
  sensitivityLevel: 'normal',
  confidence: '0.8',
  importance: '0.6',
  retentionDays: '',
  whyStored: 'User explicitly chose to remember this',
}

const DEFAULT_SUPPRESS_FORM: SuppressFormState = {
  content: '',
  sourcePlatform: '',
  sourceExcerpt: '',
  sensitivityLevel: 'normal',
  reason: 'User explicitly chose not to remember this',
}

function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return 'Not set'
  return new Date(timestamp).toLocaleString()
}

function formatRetention(timestamp: number | null): string {
  if (!timestamp) return 'No expiration'
  const delta = timestamp - Date.now()
  if (delta <= 0) return `Expired on ${formatDateTime(timestamp)}`

  const days = Math.ceil(delta / (24 * 60 * 60 * 1000))
  return `${days} day${days === 1 ? '' : 's'} left`
}

function parseNumericInput(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return parsed
}

function toRetentionTimestamp(days: string): number | null | undefined {
  if (!days.trim()) return undefined
  const parsed = Number(days)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  if (parsed === 0) return null
  return Date.now() + parsed * 24 * 60 * 60 * 1000
}

function toDatetimeLocalValue(timestamp: number | null): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

function fromDatetimeLocalValue(value: string): number | null | undefined {
  if (!value.trim()) return undefined
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function sensitivityBadgeClass(level: MemorySensitivityLevel): string {
  switch (level) {
    case 'sensitive':
      return 'bg-red-500/10 text-red-600 dark:text-red-300 border border-red-500/20'
    case 'work':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20'
    default:
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20'
  }
}

function conflictBadgeClass(state: MemoryConflictState): string {
  switch (state) {
    case 'confirmed':
      return 'bg-red-500/10 text-red-600 dark:text-red-300 border border-red-500/20'
    case 'potential':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20'
    default:
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20'
  }
}

function buildEditDraft(memory: ExplainedLocalMemoryItem): EditDraftState {
  return {
    content: memory.content,
    memory_type: memory.memory_type,
    source_platform: memory.source_platform ?? '',
    source_excerpt: memory.source_excerpt ?? '',
    confidence: String(memory.confidence),
    importance: String(memory.importance),
    sensitivity_level: memory.sensitivity_level,
    retention_until: toDatetimeLocalValue(memory.retention_until),
    status: memory.status,
    why_stored: memory.why_stored ?? '',
    conflict_state: memory.conflict_state,
    conflict_notes: memory.conflict_notes ?? '',
  }
}

export function LocalMemorySettings(): JSX.Element {
  const [message, setMessage] = useState<MessageState>(null)
  const [capturePaused, setCapturePaused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submittingRemember, setSubmittingRemember] = useState(false)
  const [submittingSuppress, setSubmittingSuppress] = useState(false)
  const [bulkDeletingSource, setBulkDeletingSource] = useState(false)
  const [filters, setFilters] = useState<MemoryFiltersState>(DEFAULT_FILTERS)
  const [rememberForm, setRememberForm] = useState<RememberFormState>(DEFAULT_REMEMBER_FORM)
  const [suppressForm, setSuppressForm] = useState<SuppressFormState>(DEFAULT_SUPPRESS_FORM)
  const [memories, setMemories] = useState<ExplainedLocalMemoryItem[]>([])
  const [searchResults, setSearchResults] = useState<MemoryRetrievalResult[] | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraftState | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [eventMemoryId, setEventMemoryId] = useState<string | null>(null)
  const [events, setEvents] = useState<Record<string, MemoryEventRecord[]>>({})
  const [loadingEventsId, setLoadingEventsId] = useState<string | null>(null)

  const activeMemories = useMemo(
    () => searchResults?.map((result) => result.memory) ?? memories,
    [memories, searchResults]
  )

  const runLoad = useCallback(async (nextFilters: MemoryFiltersState) => {
    const normalizedQuery = nextFilters.query.trim()
    const minConfidence = parseNumericInput(nextFilters.minConfidence)

    if (normalizedQuery) {
      const result = await window.memory.search({
        query: normalizedQuery,
        memory_type: nextFilters.memoryType || undefined,
        source_platform: nextFilters.sourcePlatform || undefined,
        sensitivity_level: nextFilters.sensitivityLevel || undefined,
        conflict_state: nextFilters.conflictState || undefined,
        min_confidence: minConfidence,
        include_archived: nextFilters.includeArchived,
        exclude_sensitive: nextFilters.excludeSensitive,
        limit: 50,
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to search memories')
      }

      setSearchResults(result.data ?? [])
      setMemories([])
      return
    }

    const result = await window.memory.listExplained({
      status: nextFilters.includeArchived ? undefined : 'active',
      memory_type: nextFilters.memoryType || undefined,
      source_platform: nextFilters.sourcePlatform || undefined,
      sensitivity_level: nextFilters.sensitivityLevel || undefined,
      conflict_state: nextFilters.conflictState || undefined,
      min_confidence: minConfidence,
    })

    if (!result.success) {
      throw new Error(result.error || 'Failed to load memories')
    }

    let nextMemories = result.data ?? []
    if (nextFilters.excludeSensitive) {
      nextMemories = nextMemories.filter((memory) => memory.sensitivity_level !== 'sensitive')
    }

    setMemories(nextMemories)
    setSearchResults(null)
  }, [])

  const refreshAll = useCallback(async (nextFilters = filters, showBusy = false) => {
    if (showBusy) setRefreshing(true)
    try {
      const [status] = await Promise.all([
        window.memory.getStatus(),
        runLoad(nextFilters),
      ])

      if (status.success && status.data) {
        setCapturePaused(status.data.paused)
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to refresh memory controls',
      })
    } finally {
      setLoading(false)
      if (showBusy) setRefreshing(false)
    }
  }, [filters, runLoad])

  useEffect(() => {
    void refreshAll(filters)
  }, [filters, refreshAll])

  const updateMessage = (nextMessage: MessageState) => {
    setMessage(nextMessage)
    if (nextMessage) {
      window.setTimeout(() => setMessage(null), 4000)
    }
  }

  const handleRememberSubmit = async (): Promise<void> => {
    if (!rememberForm.content.trim()) {
      updateMessage({ type: 'error', text: 'Please enter the memory content to store.' })
      return
    }

    setSubmittingRemember(true)
    try {
      const result = await window.memory.rememberThis({
        content: rememberForm.content.trim(),
        memory_type: rememberForm.memoryType.trim() || 'manual_note',
        source_platform: rememberForm.sourcePlatform.trim() || null,
        source_excerpt: rememberForm.sourceExcerpt.trim() || null,
        confidence: parseNumericInput(rememberForm.confidence),
        importance: parseNumericInput(rememberForm.importance),
        sensitivity_level: rememberForm.sensitivityLevel,
        retention_until: toRetentionTimestamp(rememberForm.retentionDays),
        why_stored: rememberForm.whyStored.trim() || 'User explicitly chose to remember this',
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to store memory')
      }

      setRememberForm(DEFAULT_REMEMBER_FORM)
      updateMessage({ type: 'success', text: 'Memory saved locally.' })
      await refreshAll(filters, true)
    } catch (error) {
      updateMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save memory' })
    } finally {
      setSubmittingRemember(false)
    }
  }

  const handleSuppressSubmit = async (): Promise<void> => {
    if (!suppressForm.content.trim()) {
      updateMessage({ type: 'error', text: 'Please enter the content you want memU bot to stop remembering.' })
      return
    }

    setSubmittingSuppress(true)
    try {
      const result = await window.memory.doNotRememberThis({
        content: suppressForm.content.trim(),
        source_platform: suppressForm.sourcePlatform.trim() || null,
        source_excerpt: suppressForm.sourceExcerpt.trim() || null,
        sensitivity_level: suppressForm.sensitivityLevel,
        reason: suppressForm.reason.trim() || 'User explicitly chose not to remember this',
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to create suppression rule')
      }

      setSuppressForm(DEFAULT_SUPPRESS_FORM)
      updateMessage({ type: 'success', text: 'Suppression rule saved locally.' })
      await refreshAll(filters, true)
    } catch (error) {
      updateMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save suppression rule' })
    } finally {
      setSubmittingSuppress(false)
    }
  }

  const handleToggleCapture = async (): Promise<void> => {
    try {
      const result = capturePaused
        ? await window.memory.resumeCapture('Resumed from local memory controls')
        : await window.memory.pauseCapture('Paused from local memory controls')

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to update capture state')
      }

      setCapturePaused(result.data.paused)
      updateMessage({
        type: 'success',
        text: result.data.paused ? 'Local memory capture paused.' : 'Local memory capture resumed.',
      })
      await refreshAll(filters, true)
    } catch (error) {
      updateMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update capture state' })
    }
  }

  const handleDeleteMemory = async (id: string): Promise<void> => {
    try {
      const result = await window.memory.delete(id)
      if (!result.success || !result.data?.deleted) {
        throw new Error(result.error || 'Failed to delete memory')
      }
      if (editingId === id) {
        setEditingId(null)
        setEditDraft(null)
      }
      updateMessage({ type: 'success', text: 'Memory deleted.' })
      await refreshAll(filters, true)
    } catch (error) {
      updateMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete memory' })
    }
  }

  const handleDeleteBySource = async (): Promise<void> => {
    if (!filters.sourcePlatform.trim()) {
      updateMessage({ type: 'error', text: 'Choose or type a source platform first to bulk delete by source.' })
      return
    }

    setBulkDeletingSource(true)
    try {
      const result = await window.memory.deleteBySource(filters.sourcePlatform.trim())
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to delete memories by source')
      }
      updateMessage({
        type: 'success',
        text: `Deleted ${result.data.deletedCount} memories from source "${filters.sourcePlatform.trim()}".`,
      })
      await refreshAll(filters, true)
    } catch (error) {
      updateMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to delete by source' })
    } finally {
      setBulkDeletingSource(false)
    }
  }

  const startEditing = (memory: ExplainedLocalMemoryItem) => {
    setEditingId(memory.id)
    setEditDraft(buildEditDraft(memory))
  }

  const handleSaveEdit = async (): Promise<void> => {
    if (!editingId || !editDraft) return

    setSavingId(editingId)
    try {
      const result = await window.memory.update(editingId, {
        content: editDraft.content.trim(),
        memory_type: editDraft.memory_type.trim(),
        source_platform: editDraft.source_platform.trim() || null,
        source_excerpt: editDraft.source_excerpt.trim() || null,
        confidence: parseNumericInput(editDraft.confidence),
        importance: parseNumericInput(editDraft.importance),
        sensitivity_level: editDraft.sensitivity_level,
        retention_until: fromDatetimeLocalValue(editDraft.retention_until),
        status: editDraft.status,
        why_stored: editDraft.why_stored.trim() || null,
        conflict_state: editDraft.conflict_state,
        conflict_notes: editDraft.conflict_notes.trim() || null,
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to update memory')
      }

      updateMessage({ type: 'success', text: 'Memory updated.' })
      setEditingId(null)
      setEditDraft(null)
      await refreshAll(filters, true)
    } catch (error) {
      updateMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to update memory' })
    } finally {
      setSavingId(null)
    }
  }

  const handleLoadEvents = async (memoryId: string): Promise<void> => {
    if (eventMemoryId === memoryId) {
      setEventMemoryId(null)
      return
    }

    setLoadingEventsId(memoryId)
    try {
      if (!events[memoryId]) {
        const result = await window.memory.listEvents(memoryId)
        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to load memory history')
        }
        setEvents((current) => ({ ...current, [memoryId]: result.data ?? [] }))
      }
      setEventMemoryId(memoryId)
    } catch (error) {
      updateMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to load memory history' })
    } finally {
      setLoadingEventsId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
        <div className="flex items-center justify-center py-10 text-[var(--text-muted)]">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Loading local memory controls...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-[var(--primary)]" />
              <h4 className="text-[14px] font-semibold text-[var(--text-primary)]">Local Memory Controls</h4>
            </div>
            <p className="text-[12px] text-[var(--text-muted)] mt-1 leading-relaxed">
              Control what memU bot stores locally, inspect why an item was retrieved, and clean up stale or sensitive memory without relying on cloud memory services.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${capturePaused ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'}`}>
              {capturePaused ? 'Capture paused' : 'Capture active'}
            </span>
            <button
              onClick={handleToggleCapture}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] hover:border-[var(--primary)] transition-all"
            >
              {capturePaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
              {capturePaused ? 'Resume memory' : 'Pause memory'}
            </button>
            <button
              onClick={() => void refreshAll(filters, true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] hover:border-[var(--primary)] transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <h5 className="text-[13px] font-medium text-[var(--text-primary)]">Remember this</h5>
          </div>
          <textarea
            value={rememberForm.content}
            onChange={(event) => setRememberForm((current) => ({ ...current, content: event.target.value }))}
            rows={4}
            placeholder="Store a local memory note, preference, fact, or project detail..."
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={rememberForm.memoryType}
              onChange={(event) => setRememberForm((current) => ({ ...current, memoryType: event.target.value }))}
              placeholder="Type (manual_note, preference, fact...)"
              className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            />
            <input
              value={rememberForm.sourcePlatform}
              onChange={(event) => setRememberForm((current) => ({ ...current, sourcePlatform: event.target.value }))}
              placeholder="Source platform (local, slack, telegram...)"
              className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            />
            <select
              value={rememberForm.sensitivityLevel}
              onChange={(event) => setRememberForm((current) => ({ ...current, sensitivityLevel: event.target.value as MemorySensitivityLevel }))}
              className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            >
              <option value="normal">Normal</option>
              <option value="work">Work</option>
              <option value="sensitive">Sensitive</option>
            </select>
            <input
              value={rememberForm.retentionDays}
              onChange={(event) => setRememberForm((current) => ({ ...current, retentionDays: event.target.value }))}
              placeholder="Retention days (blank = default)"
              className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            />
            <input
              value={rememberForm.confidence}
              onChange={(event) => setRememberForm((current) => ({ ...current, confidence: event.target.value }))}
              placeholder="Confidence 0-1"
              className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            />
            <input
              value={rememberForm.importance}
              onChange={(event) => setRememberForm((current) => ({ ...current, importance: event.target.value }))}
              placeholder="Importance 0-1"
              className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            />
          </div>
          <input
            value={rememberForm.sourceExcerpt}
            onChange={(event) => setRememberForm((current) => ({ ...current, sourceExcerpt: event.target.value }))}
            placeholder="Source excerpt (optional)"
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          />
          <input
            value={rememberForm.whyStored}
            onChange={(event) => setRememberForm((current) => ({ ...current, whyStored: event.target.value }))}
            placeholder="Why should this memory be kept?"
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          />
          <button
            onClick={() => void handleRememberSubmit()}
            disabled={submittingRemember}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-white transition-all disabled:opacity-50"
            style={{ background: 'var(--primary-gradient)', boxShadow: 'var(--shadow-primary)' }}
          >
            <Save className="w-4 h-4" />
            {submittingRemember ? 'Saving...' : 'Save local memory'}
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-amber-500" />
            <h5 className="text-[13px] font-medium text-[var(--text-primary)]">Do not remember this</h5>
          </div>
          <textarea
            value={suppressForm.content}
            onChange={(event) => setSuppressForm((current) => ({ ...current, content: event.target.value }))}
            rows={4}
            placeholder="Enter content that should be suppressed from local memory..."
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={suppressForm.sourcePlatform}
              onChange={(event) => setSuppressForm((current) => ({ ...current, sourcePlatform: event.target.value }))}
              placeholder="Source platform"
              className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            />
            <select
              value={suppressForm.sensitivityLevel}
              onChange={(event) => setSuppressForm((current) => ({ ...current, sensitivityLevel: event.target.value as MemorySensitivityLevel }))}
              className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
            >
              <option value="normal">Normal</option>
              <option value="work">Work</option>
              <option value="sensitive">Sensitive</option>
            </select>
          </div>
          <input
            value={suppressForm.sourceExcerpt}
            onChange={(event) => setSuppressForm((current) => ({ ...current, sourceExcerpt: event.target.value }))}
            placeholder="Source excerpt (optional)"
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          />
          <input
            value={suppressForm.reason}
            onChange={(event) => setSuppressForm((current) => ({ ...current, reason: event.target.value }))}
            placeholder="Reason for suppression"
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          />
          <button
            onClick={() => void handleSuppressSubmit()}
            disabled={submittingSuppress}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[13px] text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 transition-all disabled:opacity-50"
          >
            <ShieldAlert className="w-4 h-4" />
            {submittingSuppress ? 'Saving...' : 'Create suppression rule'}
          </button>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--primary)]" />
          <h5 className="text-[13px] font-medium text-[var(--text-primary)]">Search and govern local memory</h5>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={filters.query}
                onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                placeholder="Search content, source, reason, or memory type"
                className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] pl-9 pr-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>
          <input
            value={filters.memoryType}
            onChange={(event) => setFilters((current) => ({ ...current, memoryType: event.target.value }))}
            placeholder="Filter by type"
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          />
          <input
            value={filters.sourcePlatform}
            onChange={(event) => setFilters((current) => ({ ...current, sourcePlatform: event.target.value }))}
            placeholder="Filter by source"
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          />
          <select
            value={filters.sensitivityLevel}
            onChange={(event) => setFilters((current) => ({ ...current, sensitivityLevel: event.target.value as '' | MemorySensitivityLevel }))}
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          >
            <option value="">All sensitivity levels</option>
            <option value="normal">Normal</option>
            <option value="work">Work</option>
            <option value="sensitive">Sensitive</option>
          </select>
          <select
            value={filters.conflictState}
            onChange={(event) => setFilters((current) => ({ ...current, conflictState: event.target.value as '' | MemoryConflictState }))}
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          >
            <option value="">All conflict states</option>
            <option value="none">No conflict</option>
            <option value="potential">Potential conflict</option>
            <option value="confirmed">Confirmed conflict</option>
          </select>
          <input
            value={filters.minConfidence}
            onChange={(event) => setFilters((current) => ({ ...current, minConfidence: event.target.value }))}
            placeholder="Min confidence"
            className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
          />
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2">
            <label className="inline-flex items-center gap-2 text-[12px] text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={filters.includeArchived}
                onChange={(event) => setFilters((current) => ({ ...current, includeArchived: event.target.checked }))}
              />
              Include archived
            </label>
            <label className="inline-flex items-center gap-2 text-[12px] text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={filters.excludeSensitive}
                onChange={(event) => setFilters((current) => ({ ...current, excludeSensitive: event.target.checked }))}
              />
              Exclude sensitive
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDeleteBySource}
            disabled={bulkDeletingSource}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[13px] text-red-600 dark:text-red-300 hover:bg-red-500/20 transition-all disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {bulkDeletingSource ? 'Deleting...' : 'Delete all from current source filter'}
          </button>
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] hover:border-[var(--primary)] transition-all"
          >
            <Database className="w-4 h-4" />
            Reset filters
          </button>
        </div>

        <div className="text-[12px] text-[var(--text-muted)]">
          Showing {activeMemories.length} local memor{activeMemories.length === 1 ? 'y' : 'ies'}
          {filters.query.trim() ? ' ranked by retrieval score and explanation' : ' with provenance, retention, and conflict details'}.
        </div>

        <div className="space-y-3">
          {activeMemories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-color)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">
              No local memories matched the current filters.
            </div>
          ) : (
            activeMemories.map((memory) => {
              const searchMeta = searchResults?.find((entry) => entry.memory.id === memory.id)
              const isEditing = editingId === memory.id && !!editDraft
              const isEventsOpen = eventMemoryId === memory.id
              const memoryEvents = events[memory.id] ?? []

              return (
                <div
                  key={memory.id}
                  className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-card)]/70 px-4 py-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{memory.memory_type}</span>
                        <span className={`px-2 py-1 rounded-full text-[11px] ${sensitivityBadgeClass(memory.sensitivity_level)}`}>
                          {memory.sensitivity_level}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-[11px] ${conflictBadgeClass(memory.conflict_state)}`}>
                          {memory.conflict_state} conflict
                        </span>
                        <span className="px-2 py-1 rounded-full text-[11px] bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20">
                          {memory.status}
                        </span>
                        <span className="px-2 py-1 rounded-full text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20">
                          {memory.user_control}
                        </span>
                      </div>
                      <p className="text-[14px] text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{memory.content}</p>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 text-[12px] text-[var(--text-muted)]">
                        <div>Source: <span className="text-[var(--text-primary)]">{memory.source_platform ?? 'unknown'}</span></div>
                        <div>Confidence: <span className="text-[var(--text-primary)]">{memory.confidence.toFixed(2)}</span></div>
                        <div>Importance: <span className="text-[var(--text-primary)]">{memory.importance.toFixed(2)}</span></div>
                        <div>Retention: <span className="text-[var(--text-primary)]">{formatRetention(memory.retention_until)}</span></div>
                      </div>
                      <div className="text-[12px] text-[var(--text-muted)]">
                        Why stored: <span className="text-[var(--text-primary)]">{memory.explanation.provenance.why_stored ?? 'No reason recorded'}</span>
                      </div>
                      {memory.explanation.provenance.source_excerpt && (
                        <div className="text-[12px] text-[var(--text-muted)]">
                          Source excerpt: <span className="text-[var(--text-primary)]">{memory.explanation.provenance.source_excerpt}</span>
                        </div>
                      )}
                      {memory.conflict_notes && (
                        <div className="text-[12px] text-amber-600 dark:text-amber-300">
                          Conflict notes: {memory.conflict_notes}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => startEditing(memory)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[12px] text-[var(--text-primary)] hover:border-[var(--primary)] transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => void handleLoadEvents(memory.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[12px] text-[var(--text-primary)] hover:border-[var(--primary)] transition-all"
                      >
                        <History className="w-4 h-4" />
                        {loadingEventsId === memory.id ? 'Loading...' : 'History'}
                      </button>
                      <button
                        onClick={() => {
                          setSuppressForm((current) => ({
                            ...current,
                            content: memory.content,
                            sourcePlatform: memory.source_platform ?? '',
                            sourceExcerpt: memory.source_excerpt ?? '',
                            sensitivityLevel: memory.sensitivity_level,
                          }))
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 transition-all"
                      >
                        <Ban className="w-4 h-4" />
                        Don’t remember
                      </button>
                      <button
                        onClick={() => void handleDeleteMemory(memory.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-600 dark:text-red-300 hover:bg-red-500/20 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {searchMeta && (
                    <div className="mt-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] p-3">
                      <div className="flex items-center gap-2 text-[12px] text-[var(--text-primary)] font-medium">
                        <Eye className="w-4 h-4 text-[var(--primary)]" />
                        Why this memory was retrieved
                      </div>
                      <div className="mt-2 text-[12px] text-[var(--text-muted)]">
                        Score: <span className="text-[var(--text-primary)] font-medium">{searchMeta.retrieval_explanation.score.toFixed(3)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {searchMeta.retrieval_explanation.matched_fields.map((field: MemoryMatchField, index: number) => (
                          <span
                            key={`${memory.id}-${field.field}-${index}`}
                            className="px-2 py-1 rounded-full bg-[var(--bg-input)] border border-[var(--border-color)] text-[11px] text-[var(--text-primary)]"
                            title={field.value_excerpt}
                          >
                            {field.field}: {field.matched_terms.join(', ')}
                          </span>
                        ))}
                      </div>
                      <ul className="mt-2 space-y-1 text-[12px] text-[var(--text-muted)]">
                        {searchMeta.retrieval_explanation.score_reasons.map((reason: string, index: number) => (
                          <li key={`${memory.id}-reason-${index}`}>• {reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {isEditing && editDraft && (
                    <div className="mt-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4 space-y-3">
                      <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
                        <Pencil className="w-4 h-4 text-[var(--primary)]" />
                        Edit memory
                      </div>
                      <textarea
                        value={editDraft.content}
                        onChange={(event) => setEditDraft((current) => current ? { ...current, content: event.target.value } : current)}
                        rows={3}
                        className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                      />
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <input value={editDraft.memory_type} onChange={(event) => setEditDraft((current) => current ? { ...current, memory_type: event.target.value } : current)} className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
                        <input value={editDraft.source_platform} onChange={(event) => setEditDraft((current) => current ? { ...current, source_platform: event.target.value } : current)} className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
                        <select value={editDraft.sensitivity_level} onChange={(event) => setEditDraft((current) => current ? { ...current, sensitivity_level: event.target.value as MemorySensitivityLevel } : current)} className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]">
                          <option value="normal">Normal</option>
                          <option value="work">Work</option>
                          <option value="sensitive">Sensitive</option>
                        </select>
                        <input value={editDraft.confidence} onChange={(event) => setEditDraft((current) => current ? { ...current, confidence: event.target.value } : current)} placeholder="Confidence" className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
                        <input value={editDraft.importance} onChange={(event) => setEditDraft((current) => current ? { ...current, importance: event.target.value } : current)} placeholder="Importance" className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
                        <select value={editDraft.status} onChange={(event) => setEditDraft((current) => current ? { ...current, status: event.target.value as MemoryStatus } : current)} className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]">
                          <option value="active">active</option>
                          <option value="archived">archived</option>
                          <option value="deleted">deleted</option>
                        </select>
                        <select value={editDraft.conflict_state} onChange={(event) => setEditDraft((current) => current ? { ...current, conflict_state: event.target.value as MemoryConflictState } : current)} className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]">
                          <option value="none">none</option>
                          <option value="potential">potential</option>
                          <option value="confirmed">confirmed</option>
                        </select>
                        <input value={editDraft.retention_until} onChange={(event) => setEditDraft((current) => current ? { ...current, retention_until: event.target.value } : current)} type="datetime-local" className="w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
                        <input value={editDraft.source_excerpt} onChange={(event) => setEditDraft((current) => current ? { ...current, source_excerpt: event.target.value } : current)} placeholder="Source excerpt" className="md:col-span-2 xl:col-span-3 w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
                        <input value={editDraft.why_stored} onChange={(event) => setEditDraft((current) => current ? { ...current, why_stored: event.target.value } : current)} placeholder="Why stored" className="md:col-span-2 xl:col-span-3 w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
                        <textarea value={editDraft.conflict_notes} onChange={(event) => setEditDraft((current) => current ? { ...current, conflict_notes: event.target.value } : current)} rows={2} placeholder="Conflict notes" className="md:col-span-2 xl:col-span-3 w-full rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--primary)]" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => void handleSaveEdit()}
                          disabled={savingId === memory.id}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-white transition-all disabled:opacity-50"
                          style={{ background: 'var(--primary-gradient)', boxShadow: 'var(--shadow-primary)' }}
                        >
                          <Save className="w-4 h-4" />
                          {savingId === memory.id ? 'Saving...' : 'Save changes'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null)
                            setEditDraft(null)
                          }}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {isEventsOpen && (
                    <div className="mt-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] p-4">
                      <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
                        <FileClock className="w-4 h-4 text-[var(--primary)]" />
                        Memory history
                      </div>
                      {memoryEvents.length === 0 ? (
                        <div className="mt-2 text-[12px] text-[var(--text-muted)]">
                          No history events recorded for this memory yet.
                        </div>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {memoryEvents.map((event) => (
                            <div key={event.id} className="rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                                <span className="font-medium text-[var(--text-primary)]">{event.event_type}</span>
                                <span className="text-[var(--text-muted)]">by {event.actor}</span>
                                <span className="text-[var(--text-muted)]">{formatDateTime(event.created_at)}</span>
                              </div>
                              {event.reason && (
                                <div className="mt-1 text-[12px] text-[var(--text-primary)]">{event.reason}</div>
                              )}
                              {event.payload_json && (
                                <pre className="mt-2 whitespace-pre-wrap break-all text-[11px] text-[var(--text-muted)]">{event.payload_json}</pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
            <ShieldEllipsis className="w-4 h-4 text-[var(--primary)]" />
            Privacy model
          </div>
          <p className="mt-2 text-[12px] text-[var(--text-muted)] leading-relaxed">
            Sensitive items get shorter default retention, can be excluded from search, and can be bulk-deleted by source.
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
            <Clock3 className="w-4 h-4 text-[var(--primary)]" />
            Quality controls
          </div>
          <p className="mt-2 text-[12px] text-[var(--text-muted)] leading-relaxed">
            Retrieval explanations surface confidence, importance, time decay, and conflict penalties so low-quality memory is easier to spot.
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-primary)]">
            {filters.excludeSensitive ? <EyeOff className="w-4 h-4 text-[var(--primary)]" /> : <Eye className="w-4 h-4 text-[var(--primary)]" />}
            Retrieval controls
          </div>
          <p className="mt-2 text-[12px] text-[var(--text-muted)] leading-relaxed">
            Use type, source, sensitivity, archived-state, and confidence filters to control not just what gets stored, but what the assistant is allowed to use.
          </p>
        </div>
      </div>

      <MessageDisplay message={message} />
    </div>
  )
}
