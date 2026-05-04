import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'

const STORAGE_DIR = 'memorization-data'
const DB_FILE = 'local-controlled-memory.sqlite'
const TIME_DECAY_HALF_LIFE_DAYS = 30

const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void
    prepare(sql: string): {
      run(params?: Record<string, unknown> | unknown[]): { changes?: number; lastInsertRowid?: number | bigint }
      get<T = unknown>(params?: Record<string, unknown> | unknown[]): T | undefined
      all<T = unknown>(params?: Record<string, unknown> | unknown[]): T[]
    }
    close(): void
  }
}

export type MemoryStatus = 'active' | 'archived' | 'deleted'
export type MemoryUserControl = 'auto' | 'remember' | 'dont_remember' | 'modified' | 'deleted' | 'paused'
export type MemorySensitivityLevel = 'normal' | 'work' | 'sensitive'
export type MemoryConflictState = 'none' | 'potential' | 'confirmed'

export interface LocalMemoryItem {
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
  user_control: MemoryUserControl
  why_stored: string | null
  conflict_state: MemoryConflictState
  conflict_notes: string | null
}

export interface MemoryProvenance {
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

export interface MemoryExplanation {
  provenance: MemoryProvenance
}

export interface ExplainedLocalMemoryItem extends LocalMemoryItem {
  explanation: MemoryExplanation
}

export interface MemoryMatchField {
  field: 'content' | 'memory_type' | 'source_platform' | 'source_excerpt' | 'why_stored' | 'status' | 'user_control' | 'sensitivity_level' | 'conflict_notes'
  value_excerpt: string
  matched_terms: string[]
  score_contribution: number
  reason: string
}

export interface MemoryRetrievalExplanation {
  query: string
  matched_fields: MemoryMatchField[]
  source_excerpt: string | null
  created_at: number
  updated_at: number
  retention_until: number | null
  score: number
  score_reasons: string[]
}

export interface MemoryRetrievalResult {
  memory: ExplainedLocalMemoryItem
  retrieval_explanation: MemoryRetrievalExplanation
}

export interface MemorySearchFilters extends LocalMemoryListFilters {
  query?: string
  limit?: number
  include_archived?: boolean
  created_after?: number
  created_before?: number
  updated_after?: number
  updated_before?: number
  min_confidence?: number
  min_importance?: number
  exclude_sensitive?: boolean
}

export interface CreateLocalMemoryInput {
  id?: string
  content: string
  memory_type: string
  source_platform?: string | null
  source_excerpt?: string | null
  confidence?: number
  importance?: number
  sensitivity_level?: MemorySensitivityLevel
  retention_until?: number | null
  status?: MemoryStatus
  user_control?: MemoryUserControl
  why_stored?: string | null
  conflict_state?: MemoryConflictState
  conflict_notes?: string | null
}

export interface UpdateLocalMemoryInput {
  content?: string
  memory_type?: string
  source_platform?: string | null
  source_excerpt?: string | null
  confidence?: number
  importance?: number
  sensitivity_level?: MemorySensitivityLevel
  retention_until?: number | null
  status?: MemoryStatus
  user_control?: MemoryUserControl
  why_stored?: string | null
  conflict_state?: MemoryConflictState
  conflict_notes?: string | null
}

export interface MemoryEventRecord {
  id: number
  memory_id: string
  event_type: string
  actor: string
  previous_status: string | null
  new_status: string | null
  reason: string | null
  payload_json: string | null
  created_at: number
}

export interface CreateMemoryEventInput {
  memory_id: string
  event_type: string
  actor?: string
  previous_status?: string | null
  new_status?: string | null
  reason?: string | null
  payload_json?: string | null
  created_at?: number
}

export interface LocalMemoryListFilters {
  status?: MemoryStatus
  memory_type?: string
  source_platform?: string
  sensitivity_level?: MemorySensitivityLevel
  user_control?: MemoryUserControl
  created_after?: number
  created_before?: number
  updated_after?: number
  updated_before?: number
  min_confidence?: number
  min_importance?: number
  conflict_state?: MemoryConflictState
}

interface ParsedFactSignature {
  subject: string
  relation: string
  value: string
}

function generateMemoryId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function clampScore(value: number | undefined, fallback: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.max(0, Math.min(1, numeric))
}

function hasOwnProperty<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function excerptText(value: string | null | undefined, maxLength = 180): string {
  if (!value) return ''
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
}

function tokenizeQuery(query: string): string[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []
  return Array.from(new Set(normalized.split(/\s+/).map((term) => term.trim()).filter((term) => term.length > 0)))
}

function countMatchedTerms(value: string, terms: string[]): string[] {
  const haystack = value.toLowerCase()
  return terms.filter((term) => haystack.includes(term))
}

function buildValueExcerpt(value: string, matchedTerms: string[]): string {
  if (!value) return ''
  if (matchedTerms.length === 0) return excerptText(value)

  const lower = value.toLowerCase()
  const positions = matchedTerms
    .map((term) => lower.indexOf(term))
    .filter((pos) => pos >= 0)
    .sort((a, b) => a - b)

  if (positions.length === 0) return excerptText(value)

  const start = Math.max(0, positions[0] - 40)
  const end = Math.min(value.length, positions[0] + 140)
  const snippet = value.slice(start, end)

  return `${start > 0 ? '…' : ''}${snippet}${end < value.length ? '…' : ''}`
}

function normalizeComparableText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function tokenizeComparableText(value: string): string[] {
  return normalizeComparableText(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function computeJaccardSimilarity(left: string, right: string): number {
  const leftTokens = new Set(tokenizeComparableText(left))
  const rightTokens = new Set(tokenizeComparableText(right))
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0

  let intersection = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1
  }

  const union = new Set([...leftTokens, ...rightTokens]).size
  return union === 0 ? 0 : intersection / union
}

function parseFactSignature(content: string): ParsedFactSignature | null {
  const normalized = content.trim().replace(/\s+/g, ' ')
  const match = normalized.match(/^(.+?)\s+(is|are|was|were|lives in|located in|works at|prefers|likes|dislikes|email is|phone is)\s+(.+)$/i)
  if (!match) return null

  const [, subjectRaw, relationRaw, valueRaw] = match
  const subject = normalizeComparableText(subjectRaw)
  const relation = normalizeComparableText(relationRaw)
  const value = normalizeComparableText(valueRaw)

  if (!subject || !relation || !value) return null
  return { subject, relation, value }
}

function inferSensitivityLevel(content: string, sourcePlatform: string | null | undefined, explicit?: MemorySensitivityLevel): MemorySensitivityLevel {
  if (explicit) return explicit
  const text = `${sourcePlatform ?? ''} ${content}`.toLowerCase()
  const sensitivePatterns = [
    /password|passcode|otp|verification code|ssn|social security|bank account|routing number|credit card|debit card/,
    /medical|diagnosis|prescription|patient|insurance id|passport|driver'?s license/,
    /private key|secret|token|api key|auth code/
  ]
  if (sensitivePatterns.some((pattern) => pattern.test(text))) return 'sensitive'

  const workPatterns = [/slack|meeting|project|roadmap|deadline|client|customer|jira|notion|github|repo|work/]
  if (workPatterns.some((pattern) => pattern.test(text))) return 'work'

  return 'normal'
}

function defaultRetentionUntil(sensitivity: MemorySensitivityLevel, explicit?: number | null): number | null {
  if (explicit !== undefined) return explicit
  const now = Date.now()
  switch (sensitivity) {
    case 'sensitive':
      return now + 30 * 24 * 60 * 60 * 1000
    case 'work':
      return now + 180 * 24 * 60 * 60 * 1000
    default:
      return null
  }
}

function buildProvenance(memory: LocalMemoryItem): MemoryProvenance {
  return {
    source_platform: memory.source_platform,
    source_excerpt: memory.source_excerpt,
    created_at: memory.created_at,
    updated_at: memory.updated_at,
    retention_until: memory.retention_until,
    why_stored: memory.why_stored,
    sensitivity_level: memory.sensitivity_level,
    conflict_state: memory.conflict_state,
    conflict_notes: memory.conflict_notes,
  }
}

function attachExplanation(memory: LocalMemoryItem): ExplainedLocalMemoryItem {
  return {
    ...memory,
    explanation: {
      provenance: buildProvenance(memory),
    },
  }
}

function computeTimeDecayMultiplier(updatedAt: number, now: number): number {
  const ageMs = Math.max(0, now - updatedAt)
  const ageDays = ageMs / (24 * 60 * 60 * 1000)
  return Math.pow(0.5, ageDays / TIME_DECAY_HALF_LIFE_DAYS)
}

function scoreMemoryMatch(memory: LocalMemoryItem, query: string, now = Date.now()): MemoryRetrievalResult | null {
  const terms = tokenizeQuery(query)
  if (terms.length === 0) return null

  const fieldWeights: Array<{
    field: MemoryMatchField['field']
    value: string
    weight: number
    reason: string
  }> = [
    { field: 'content', value: memory.content, weight: 5, reason: 'Matched memory content' },
    { field: 'source_excerpt', value: memory.source_excerpt ?? '', weight: 4, reason: 'Matched source excerpt' },
    { field: 'why_stored', value: memory.why_stored ?? '', weight: 3, reason: 'Matched why this memory was stored' },
    { field: 'memory_type', value: memory.memory_type, weight: 2, reason: 'Matched memory type' },
    { field: 'source_platform', value: memory.source_platform ?? '', weight: 1.5, reason: 'Matched source platform' },
    { field: 'status', value: memory.status, weight: 1, reason: 'Matched status' },
    { field: 'user_control', value: memory.user_control, weight: 1, reason: 'Matched user control state' },
    { field: 'sensitivity_level', value: memory.sensitivity_level, weight: 1, reason: 'Matched sensitivity level' },
    { field: 'conflict_notes', value: memory.conflict_notes ?? '', weight: 0.75, reason: 'Matched conflict notes' },
  ]

  const matched_fields: MemoryMatchField[] = []
  let rawScore = 0
  const score_reasons: string[] = []

  for (const field of fieldWeights) {
    const matchedTerms = countMatchedTerms(field.value, terms)
    if (matchedTerms.length === 0) continue

    const contribution = matchedTerms.length * field.weight
    rawScore += contribution
    matched_fields.push({
      field: field.field,
      value_excerpt: buildValueExcerpt(field.value, matchedTerms),
      matched_terms: matchedTerms,
      score_contribution: contribution,
      reason: field.reason,
    })
    score_reasons.push(`${field.reason}: ${matchedTerms.join(', ')}`)
  }

  if (matched_fields.length === 0) return null

  const confidenceBonus = Math.round(memory.confidence * 100) / 100
  const importanceBonus = Math.round(memory.importance * 100) / 100
  rawScore += confidenceBonus + importanceBonus
  score_reasons.push(`Confidence bonus: ${confidenceBonus.toFixed(2)}`)
  score_reasons.push(`Importance bonus: ${importanceBonus.toFixed(2)}`)

  const decayMultiplier = computeTimeDecayMultiplier(memory.updated_at, now)
  rawScore *= decayMultiplier
  score_reasons.push(`Time decay multiplier: ${decayMultiplier.toFixed(3)}`)

  if (memory.user_control === 'remember') {
    rawScore += 1
    score_reasons.push('User explicitly marked this to remember')
  }
  if (memory.user_control === 'dont_remember') {
    rawScore -= 3
    score_reasons.push('User explicitly marked this as do not remember')
  }
  if (memory.status === 'archived') {
    rawScore -= 1
    score_reasons.push('Archived memories are de-prioritized')
  }
  if (memory.conflict_state === 'potential') {
    rawScore -= 0.75
    score_reasons.push('Potentially conflicting memory is de-prioritized')
  }
  if (memory.conflict_state === 'confirmed') {
    rawScore -= 1.5
    score_reasons.push('Confirmed conflicting memory is strongly de-prioritized')
  }

  const score = Math.max(0, Number(rawScore.toFixed(3)))

  return {
    memory: attachExplanation(memory),
    retrieval_explanation: {
      query,
      matched_fields,
      source_excerpt: memory.source_excerpt,
      created_at: memory.created_at,
      updated_at: memory.updated_at,
      retention_until: memory.retention_until,
      score,
      score_reasons,
    },
  }
}

export class LocalMemoryStore {
  private dbPath: string
  private db: InstanceType<typeof DatabaseSync> | null = null
  private initialized = false

  constructor() {
    this.dbPath = path.join(app.getPath('userData'), STORAGE_DIR, DB_FILE)
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    await fs.mkdir(path.dirname(this.dbPath), { recursive: true })

    this.db = new DatabaseSync(this.dbPath)
    this.db.exec('PRAGMA journal_mode = WAL;')
    this.db.exec('PRAGMA foreign_keys = ON;')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        memory_type TEXT NOT NULL,
        source_platform TEXT,
        source_excerpt TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        confidence REAL NOT NULL,
        importance REAL NOT NULL,
        sensitivity_level TEXT NOT NULL,
        retention_until INTEGER,
        status TEXT NOT NULL,
        user_control TEXT NOT NULL,
        why_stored TEXT,
        conflict_state TEXT NOT NULL DEFAULT 'none',
        conflict_notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_memories_status ON memories(status);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
      CREATE INDEX IF NOT EXISTS idx_memories_platform ON memories(source_platform);
      CREATE INDEX IF NOT EXISTS idx_memories_updated_at ON memories(updated_at);

      CREATE TABLE IF NOT EXISTS memory_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        actor TEXT NOT NULL,
        previous_status TEXT,
        new_status TEXT,
        reason TEXT,
        payload_json TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (memory_id) REFERENCES memories(id)
      );

      CREATE INDEX IF NOT EXISTS idx_memory_events_memory_id ON memory_events(memory_id);
      CREATE INDEX IF NOT EXISTS idx_memory_events_created_at ON memory_events(created_at);
    `)

    this.ensureColumn('memories', 'conflict_state', `ALTER TABLE memories ADD COLUMN conflict_state TEXT NOT NULL DEFAULT 'none'`)
    this.ensureColumn('memories', 'conflict_notes', 'ALTER TABLE memories ADD COLUMN conflict_notes TEXT')

    this.initialized = true
    console.log('[LocalMemoryStore] Initialized')
  }

  private ensureColumn(tableName: string, columnName: string, alterSql: string): void {
    const db = this.getDatabase()
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
    if (!columns.some((column) => column.name === columnName)) {
      db.exec(alterSql)
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  private getDatabase() {
    if (!this.db) {
      throw new Error('[LocalMemoryStore] Database is not initialized')
    }
    return this.db
  }

  async createMemory(input: CreateLocalMemoryInput): Promise<LocalMemoryItem> {
    await this.ensureInitialized()
    const db = this.getDatabase()
    const now = Date.now()
    const sensitivity = inferSensitivityLevel(input.content, input.source_platform, input.sensitivity_level)

    const record: LocalMemoryItem = {
      id: input.id ?? generateMemoryId(),
      content: input.content,
      memory_type: input.memory_type,
      source_platform: input.source_platform ?? null,
      source_excerpt: input.source_excerpt ?? null,
      created_at: now,
      updated_at: now,
      confidence: clampScore(input.confidence, 0.5),
      importance: clampScore(input.importance, 0.5),
      sensitivity_level: sensitivity,
      retention_until: defaultRetentionUntil(sensitivity, input.retention_until),
      status: input.status ?? 'active',
      user_control: input.user_control ?? 'auto',
      why_stored: input.why_stored ?? null,
      conflict_state: input.conflict_state ?? 'none',
      conflict_notes: input.conflict_notes ?? null,
    }

    db.prepare(`
      INSERT INTO memories (
        id, content, memory_type, source_platform, source_excerpt, created_at, updated_at,
        confidence, importance, sensitivity_level, retention_until, status, user_control, why_stored,
        conflict_state, conflict_notes
      ) VALUES (
        @id, @content, @memory_type, @source_platform, @source_excerpt, @created_at, @updated_at,
        @confidence, @importance, @sensitivity_level, @retention_until, @status, @user_control, @why_stored,
        @conflict_state, @conflict_notes
      )
    `).run(record as unknown as Record<string, unknown>)

    await this.createEvent({
      memory_id: record.id,
      event_type: 'created',
      actor: 'system',
      previous_status: null,
      new_status: record.status,
      reason: 'Local memory record created',
      payload_json: JSON.stringify({
        memory_type: record.memory_type,
        source_platform: record.source_platform,
        user_control: record.user_control,
        sensitivity_level: record.sensitivity_level,
      }),
      created_at: now,
    })

    await this.recalculateConflictsForMemory(record.id)
    return (await this.getMemoryById(record.id)) ?? record
  }

  async getMemoryById(id: string): Promise<LocalMemoryItem | null> {
    await this.ensureInitialized()
    const db = this.getDatabase()
    const row = db.prepare('SELECT * FROM memories WHERE id = ?').get<LocalMemoryItem>([id])
    return row ?? null
  }

  async getExplainedMemoryById(id: string): Promise<ExplainedLocalMemoryItem | null> {
    const memory = await this.getMemoryById(id)
    return memory ? attachExplanation(memory) : null
  }

  async listMemories(filters: LocalMemoryListFilters = {}): Promise<LocalMemoryItem[]> {
    await this.ensureInitialized()
    const db = this.getDatabase()

    const clauses: string[] = ['(retention_until IS NULL OR retention_until >= @now)']
    const params: Record<string, unknown> = { now: Date.now() }

    if (filters.status) {
      clauses.push('status = @status')
      params.status = filters.status
    } else {
      clauses.push('status != "deleted"')
    }
    if (filters.memory_type) {
      clauses.push('memory_type = @memory_type')
      params.memory_type = filters.memory_type
    }
    if (filters.source_platform) {
      clauses.push('source_platform = @source_platform')
      params.source_platform = filters.source_platform
    }
    if (filters.sensitivity_level) {
      clauses.push('sensitivity_level = @sensitivity_level')
      params.sensitivity_level = filters.sensitivity_level
    }
    if (filters.user_control) {
      clauses.push('user_control = @user_control')
      params.user_control = filters.user_control
    }
    if (filters.created_after != null) {
      clauses.push('created_at >= @created_after')
      params.created_after = filters.created_after
    }
    if (filters.created_before != null) {
      clauses.push('created_at <= @created_before')
      params.created_before = filters.created_before
    }
    if (filters.updated_after != null) {
      clauses.push('updated_at >= @updated_after')
      params.updated_after = filters.updated_after
    }
    if (filters.updated_before != null) {
      clauses.push('updated_at <= @updated_before')
      params.updated_before = filters.updated_before
    }
    if (filters.min_confidence != null) {
      clauses.push('confidence >= @min_confidence')
      params.min_confidence = clampScore(filters.min_confidence, 0)
    }
    if (filters.min_importance != null) {
      clauses.push('importance >= @min_importance')
      params.min_importance = clampScore(filters.min_importance, 0)
    }
    if (filters.conflict_state) {
      clauses.push('conflict_state = @conflict_state')
      params.conflict_state = filters.conflict_state
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''

    return db.prepare(`SELECT * FROM memories ${whereClause} ORDER BY updated_at DESC, created_at DESC`).all<LocalMemoryItem>(params)
  }

  async listExplainedMemories(filters: LocalMemoryListFilters = {}): Promise<ExplainedLocalMemoryItem[]> {
    const memories = await this.listMemories(filters)
    return memories.map(attachExplanation)
  }

  async searchMemories(filters: MemorySearchFilters = {}): Promise<MemoryRetrievalResult[]> {
    const { query = '', limit = 20, include_archived = false, exclude_sensitive = false, ...listFilters } = filters
    const baseFilters: LocalMemoryListFilters = { ...listFilters }
    if (!include_archived && !baseFilters.status) {
      baseFilters.status = 'active'
    }

    let memories = await this.listMemories(baseFilters)
    if (exclude_sensitive) {
      memories = memories.filter((memory) => memory.sensitivity_level !== 'sensitive')
    }

    const now = Date.now()
    const scored = memories
      .map((memory) => scoreMemoryMatch(memory, query, now))
      .filter((result): result is MemoryRetrievalResult => result !== null)
      .sort((a, b) => b.retrieval_explanation.score - a.retrieval_explanation.score)

    return scored.slice(0, Math.max(1, limit))
  }

  async updateMemory(id: string, updates: UpdateLocalMemoryInput): Promise<LocalMemoryItem | null> {
    await this.ensureInitialized()
    const db = this.getDatabase()
    const existing = await this.getMemoryById(id)

    if (!existing) {
      return null
    }

    const nextSensitivity = inferSensitivityLevel(
      updates.content ?? existing.content,
      updates.source_platform ?? existing.source_platform,
      updates.sensitivity_level ?? existing.sensitivity_level
    )
    const requestedRetentionUntil = hasOwnProperty(updates, 'retention_until')
      ? updates.retention_until ?? null
      : existing.retention_until
    const next: LocalMemoryItem = {
      ...existing,
      ...updates,
      confidence: updates.confidence != null ? clampScore(updates.confidence, existing.confidence) : existing.confidence,
      importance: updates.importance != null ? clampScore(updates.importance, existing.importance) : existing.importance,
      sensitivity_level: nextSensitivity,
      retention_until: defaultRetentionUntil(nextSensitivity, requestedRetentionUntil),
      conflict_state: updates.conflict_state ?? existing.conflict_state,
      conflict_notes: updates.conflict_notes ?? existing.conflict_notes,
      updated_at: Date.now(),
    }

    db.prepare(`
      UPDATE memories
      SET
        content = @content,
        memory_type = @memory_type,
        source_platform = @source_platform,
        source_excerpt = @source_excerpt,
        updated_at = @updated_at,
        confidence = @confidence,
        importance = @importance,
        sensitivity_level = @sensitivity_level,
        retention_until = @retention_until,
        status = @status,
        user_control = @user_control,
        why_stored = @why_stored,
        conflict_state = @conflict_state,
        conflict_notes = @conflict_notes
      WHERE id = @id
    `).run(next as unknown as Record<string, unknown>)

    await this.createEvent({
      memory_id: id,
      event_type: 'updated',
      actor: 'system',
      previous_status: existing.status,
      new_status: next.status,
      reason: 'Local memory record updated',
      payload_json: JSON.stringify({ updates }),
    })

    await this.recalculateConflictsForMemory(id)
    return (await this.getMemoryById(id)) ?? next
  }

  async deleteMemory(id: string): Promise<boolean> {
    await this.ensureInitialized()
    const existing = await this.getMemoryById(id)

    if (!existing) {
      return false
    }

    const updated = await this.updateMemory(id, {
      status: 'deleted',
      user_control: 'deleted',
      why_stored: existing.why_stored,
    })

    await this.createEvent({
      memory_id: id,
      event_type: 'deleted',
      actor: 'system',
      previous_status: existing.status,
      new_status: 'deleted',
      reason: 'Local memory record soft-deleted',
      payload_json: JSON.stringify({ id }),
    })

    return !!updated
  }

  async deleteMemoriesBySource(sourcePlatform: string): Promise<number> {
    await this.ensureInitialized()
    const db = this.getDatabase()
    const existing = db.prepare(`
      SELECT * FROM memories
      WHERE source_platform = @source_platform AND status != 'deleted'
      ORDER BY updated_at DESC
    `).all({ source_platform: sourcePlatform }) as LocalMemoryItem[]

    for (const memory of existing) {
      await this.updateMemory(memory.id, {
        status: 'deleted',
        user_control: 'deleted',
      })
      await this.createEvent({
        memory_id: memory.id,
        event_type: 'deleted_by_source',
        actor: 'system',
        previous_status: memory.status,
        new_status: 'deleted',
        reason: `Deleted memories by source platform: ${sourcePlatform}`,
        payload_json: JSON.stringify({ source_platform: sourcePlatform, id: memory.id }),
      })
    }

    return existing.length
  }

  async hasSuppressedMatch(content: string, sourcePlatform?: string | null): Promise<boolean> {
    await this.ensureInitialized()
    const normalized = normalizeComparableText(content)
    const candidates = await this.listMemories({ user_control: 'dont_remember' })

    return candidates.some((memory) => {
      if (sourcePlatform && memory.source_platform && memory.source_platform !== sourcePlatform) {
        return false
      }
      const candidate = normalizeComparableText(memory.content)
      return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate)
    })
  }

  private async recalculateConflictsForMemory(targetId: string): Promise<void> {
    const target = await this.getMemoryById(targetId)
    if (!target) return

    const impactedPeerIds = new Set<string>(this.extractConflictPeerIds(target.conflict_notes))
    await this.clearConflictState(target.id)

    if (target.status === 'deleted' || target.user_control === 'dont_remember') {
      for (const peerId of impactedPeerIds) {
        await this.rebuildConflictState(peerId)
      }
      return
    }
    if (target.memory_type === 'conversation_message' || target.memory_type === 'suppression_rule') {
      for (const peerId of impactedPeerIds) {
        await this.rebuildConflictState(peerId)
      }
      return
    }

    const peers = await this.listMemories({ memory_type: target.memory_type })
    const targetFact = parseFactSignature(target.content)

    for (const peer of peers) {
      if (peer.id === target.id || peer.status === 'deleted') continue
      if (peer.source_platform && target.source_platform && peer.source_platform !== target.source_platform) continue

      let isConflict = false
      let note = ''

      const peerFact = parseFactSignature(peer.content)
      if (targetFact && peerFact && targetFact.subject === peerFact.subject && targetFact.relation === peerFact.relation && targetFact.value !== peerFact.value) {
        isConflict = true
        note = `Conflicts with ${peer.id}: same subject and relation, different value`
      } else {
        const similarity = computeJaccardSimilarity(target.content, peer.content)
        const sameNormalized = normalizeComparableText(target.content) === normalizeComparableText(peer.content)
        if (!sameNormalized && similarity >= 0.35 && similarity < 0.95) {
          isConflict = true
          note = `Potentially conflicts with ${peer.id}: overlap similarity ${similarity.toFixed(2)}`
        }
      }

      impactedPeerIds.add(peer.id)
      if (!isConflict) {
        continue
      }

      const targetConflictState: MemoryConflictState = note.startsWith('Conflicts with') ? 'confirmed' : 'potential'
      const targetConfidence = clampScore(target.confidence - (targetConflictState === 'confirmed' ? 0.2 : 0.1), target.confidence)

      await this.applyConflictUpdate(target.id, targetConflictState, note, targetConfidence)
    }

    for (const peerId of impactedPeerIds) {
      await this.rebuildConflictState(peerId)
    }
  }

  private async rebuildConflictState(id: string): Promise<void> {
    const memory = await this.getMemoryById(id)
    if (!memory || memory.status === 'deleted' || memory.user_control === 'dont_remember') return
    if (memory.memory_type === 'conversation_message' || memory.memory_type === 'suppression_rule') return

    await this.clearConflictState(memory.id)

    const peers = await this.listMemories({ memory_type: memory.memory_type })
    for (const peer of peers) {
      if (peer.id === memory.id || peer.status === 'deleted') continue
      if (peer.source_platform && memory.source_platform && peer.source_platform !== memory.source_platform) continue

      let isConflict = false
      let note = ''
      const memoryFact = parseFactSignature(memory.content)
      const peerFact = parseFactSignature(peer.content)
      if (memoryFact && peerFact && memoryFact.subject === peerFact.subject && memoryFact.relation === peerFact.relation && memoryFact.value !== peerFact.value) {
        isConflict = true
        note = `Conflicts with ${peer.id}: same subject and relation, different value`
      } else {
        const similarity = computeJaccardSimilarity(memory.content, peer.content)
        const sameNormalized = normalizeComparableText(memory.content) === normalizeComparableText(peer.content)
        if (!sameNormalized && similarity >= 0.35 && similarity < 0.95) {
          isConflict = true
          note = `Potentially conflicts with ${peer.id}: overlap similarity ${similarity.toFixed(2)}`
        }
      }

      if (!isConflict) continue

      const conflictState: MemoryConflictState = note.startsWith('Conflicts with') ? 'confirmed' : 'potential'
      const nextConfidence = clampScore(memory.confidence - (conflictState === 'confirmed' ? 0.2 : 0.1), memory.confidence)
      await this.applyConflictUpdate(memory.id, conflictState, note, nextConfidence)
    }
  }

  private extractConflictPeerIds(notes?: string | null): string[] {
    if (!notes) return []

    const ids = new Set<string>()
    const patterns = [
      /Conflicts with ([^:\s;]+)/g,
      /Potentially conflicts with ([^:\s;]+)/g,
      /Potential conflict with ([^:\s;]+)/g,
    ]

    for (const pattern of patterns) {
      for (const match of notes.matchAll(pattern)) {
        const peerId = match[1]?.trim()
        if (peerId) {
          ids.add(peerId)
        }
      }
    }

    return Array.from(ids)
  }

  private async clearConflictState(id: string): Promise<void> {
    const memory = await this.getMemoryById(id)
    if (!memory || (memory.conflict_state === 'none' && !memory.conflict_notes)) return

    const db = this.getDatabase()
    db.prepare(`
      UPDATE memories
      SET conflict_state = 'none', conflict_notes = NULL, updated_at = @updated_at
      WHERE id = @id
    `).run({
      id,
      updated_at: Date.now(),
    })
  }

  private async applyConflictUpdate(id: string, conflictState: MemoryConflictState, note: string, confidence: number): Promise<void> {
    const memory = await this.getMemoryById(id)
    if (!memory || memory.status === 'deleted') return
    const existingNotes = memory.conflict_notes
      ? memory.conflict_notes.split(';').map((item) => item.trim()).filter(Boolean)
      : []
    const dedupedNotes = Array.from(new Set([...existingNotes, note.trim()]))
    const nextNotes = dedupedNotes.join('; ')
    const nextState: MemoryConflictState = memory.conflict_state === 'confirmed' || conflictState === 'confirmed'
      ? 'confirmed'
      : conflictState

    const db = this.getDatabase()
    db.prepare(`
      UPDATE memories
      SET conflict_state = @conflict_state, conflict_notes = @conflict_notes, confidence = @confidence, updated_at = @updated_at
      WHERE id = @id
    `).run({
      id,
      conflict_state: nextState,
      conflict_notes: excerptText(nextNotes, 500),
      confidence,
      updated_at: Date.now(),
    })

    await this.createEvent({
      memory_id: id,
      event_type: 'conflict_detected',
      actor: 'system',
      previous_status: memory.status,
      new_status: memory.status,
      reason: note,
      payload_json: JSON.stringify({ conflict_state: nextState, confidence }),
    })
  }

  async createEvent(input: CreateMemoryEventInput): Promise<MemoryEventRecord> {
    await this.ensureInitialized()
    const db = this.getDatabase()
    const now = input.created_at ?? Date.now()

    const result = db.prepare(`
      INSERT INTO memory_events (
        memory_id, event_type, actor, previous_status, new_status, reason, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run([
      input.memory_id,
      input.event_type,
      input.actor ?? 'system',
      input.previous_status ?? null,
      input.new_status ?? null,
      input.reason ?? null,
      input.payload_json ?? null,
      now,
    ])

    return {
      id: Number(result.lastInsertRowid ?? 0),
      memory_id: input.memory_id,
      event_type: input.event_type,
      actor: input.actor ?? 'system',
      previous_status: input.previous_status ?? null,
      new_status: input.new_status ?? null,
      reason: input.reason ?? null,
      payload_json: input.payload_json ?? null,
      created_at: now,
    }
  }

  async listEvents(memoryId: string): Promise<MemoryEventRecord[]> {
    await this.ensureInitialized()
    const db = this.getDatabase()

    return db.prepare('SELECT * FROM memory_events WHERE memory_id = ? ORDER BY created_at DESC, id DESC').all<MemoryEventRecord>([memoryId])
  }

  async getProvenanceById(id: string): Promise<MemoryProvenance | null> {
    const memory = await this.getMemoryById(id)
    return memory ? buildProvenance(memory) : null
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initialized = false
    }
  }
}

export const localMemoryStore = new LocalMemoryStore()
