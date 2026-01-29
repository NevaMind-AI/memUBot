import { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  Plus,
  Search,
  Download,
  Trash2,
  FolderOpen,
  Check,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Key
} from 'lucide-react'

interface LocalSkill {
  id: string
  name: string
  description: string
  path: string
  enabled: boolean
  source: 'local' | 'github'
  installedAt?: string
}

interface GitHubSkill {
  name: string
  path: string
  description?: string
  readme?: string
  category?: string
}

type TabType = 'installed' | 'github'

export function SkillsSettings(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabType>('installed')
  const [installedSkills, setInstalledSkills] = useState<LocalSkill[]>([])
  const [githubSkills, setGithubSkills] = useState<GitHubSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [installing, setInstalling] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [tokenSaved, setTokenSaved] = useState(false)

  // Load installed skills and GitHub token
  const loadInstalledSkills = useCallback(async () => {
    try {
      const result = await window.skills.getInstalled()
      if (result.success && result.data) {
        setInstalledSkills(result.data)
      }
    } catch (error) {
      console.error('Failed to load skills:', error)
    }
    setLoading(false)
  }, [])

  // Load GitHub token
  const loadGitHubToken = useCallback(async () => {
    try {
      const result = await window.skills.getGitHubToken()
      if (result.success && result.data) {
        setGithubToken(result.data)
      }
    } catch (error) {
      console.error('Failed to load GitHub token:', error)
    }
  }, [])

  useEffect(() => {
    loadInstalledSkills()
    loadGitHubToken()
  }, [loadInstalledSkills, loadGitHubToken])

  // Save GitHub token
  const saveGitHubToken = async () => {
    try {
      const result = await window.skills.setGitHubToken(githubToken || undefined)
      if (result.success) {
        setTokenSaved(true)
        setTimeout(() => setTokenSaved(false), 2000)
      }
    } catch (error) {
      console.error('Failed to save GitHub token:', error)
    }
  }

  // Search GitHub skills
  const searchGitHub = async () => {
    setSearchLoading(true)
    try {
      const result = await window.skills.searchGitHub(searchQuery)
      if (result.success && result.data) {
        setGithubSkills(result.data)
      }
    } catch (error) {
      console.error('Failed to search GitHub:', error)
      setMessage({ type: 'error', text: 'Failed to search GitHub' })
    }
    setSearchLoading(false)
  }

  // Install from GitHub
  const installFromGitHub = async (skill: GitHubSkill) => {
    setInstalling(skill.path)
    setMessage(null)
    try {
      const result = await window.skills.installFromGitHub(skill.path)
      if (result.success) {
        setMessage({ type: 'success', text: `Installed "${skill.name}" successfully` })
        await loadInstalledSkills()
        // Remove from GitHub list
        setGithubSkills((prev) => prev.filter((s) => s.path !== skill.path))
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to install' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to install skill' })
    }
    setInstalling(null)
  }

  // Import skill from local directory
  const importFromDirectory = async () => {
    setImporting(true)
    setMessage(null)
    try {
      const result = await window.skills.importFromDirectory()
      if (result.success && result.data) {
        setMessage({ type: 'success', text: `Imported "${result.data.name}" successfully` })
        await loadInstalledSkills()
      } else if (result.error && result.error !== 'No directory selected') {
        setMessage({ type: 'error', text: result.error })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to import skill' })
    }
    setImporting(false)
  }

  // Toggle skill enabled
  const toggleSkillEnabled = async (skill: LocalSkill) => {
    try {
      await window.skills.setEnabled(skill.id, !skill.enabled)
      setInstalledSkills((prev) =>
        prev.map((s) => (s.id === skill.id ? { ...s, enabled: !s.enabled } : s))
      )
    } catch (error) {
      console.error('Failed to toggle skill:', error)
    }
  }

  // Delete skill
  const deleteSkill = async (skill: LocalSkill) => {
    if (!confirm(`Delete skill "${skill.name}"?`)) return

    try {
      const result = await window.skills.delete(skill.id)
      if (result.success) {
        setInstalledSkills((prev) => prev.filter((s) => s.id !== skill.id))
        setMessage({ type: 'success', text: `Deleted "${skill.name}"` })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete skill' })
    }
  }

  // Open skills directory
  const openDirectory = async () => {
    await window.skills.openDirectory()
  }

  // Check if skill is already installed
  const isInstalled = (githubPath: string) => {
    const skillId = githubPath.split('/').pop()
    return installedSkills.some((s) => s.id === skillId)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Skills</h3>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
            Extend agent capabilities with skills
          </p>
        </div>
        <button
          onClick={openDirectory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-solid)] transition-all"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Open Folder</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)]">
        <button
          onClick={() => setActiveTab('installed')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
            activeTab === 'installed'
              ? 'bg-[var(--bg-card-solid)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Installed ({installedSkills.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('github')
            if (githubSkills.length === 0) searchGitHub()
          }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
            activeTab === 'github'
              ? 'bg-[var(--bg-card-solid)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Download className="w-4 h-4" />
          GitHub
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

      {/* Installed Skills Tab */}
      {activeTab === 'installed' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-[var(--primary)] animate-spin" />
            </div>
          ) : installedSkills.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-3" />
              <p className="text-[13px] text-[var(--text-muted)]">No skills installed</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Add skills manually or install from GitHub
              </p>
            </div>
          ) : (
            installedSkills.map((skill) => (
              <div
                key={skill.id}
                className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                        {skill.name}
                      </h4>
                      {skill.source === 'github' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-input)] text-[var(--text-muted)]">
                          GitHub
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1 line-clamp-2">
                      {skill.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleSkillEnabled(skill)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        skill.enabled ? 'bg-emerald-500' : 'bg-[var(--bg-input)]'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          skill.enabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => deleteSkill(skill)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Import Skill Button */}
          <button
            onClick={importFromDirectory}
            disabled={importing}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)]/50 transition-all disabled:opacity-50"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4" />
            )}
            <span className="text-[13px] font-medium">Import Skill from Folder</span>
          </button>
        </div>
      )}

      {/* GitHub Tab */}
      {activeTab === 'github' && (
        <div className="space-y-3">
          {/* GitHub Token Setting */}
          <div className="p-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-color)]">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span className="text-[12px] text-[var(--text-muted)]">
                GitHub Token (optional, for higher rate limits)
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="ghp_xxxx..."
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[12px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 transition-all"
              />
              <button
                onClick={saveGitHubToken}
                className="px-3 py-2 rounded-lg bg-[var(--bg-card-solid)] border border-[var(--border-color)] text-[12px] text-[var(--text-primary)] hover:border-[var(--primary)]/50 transition-all flex items-center gap-1"
              >
                {tokenSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    Saved
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search openai/skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchGitHub()}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
              />
            </div>
            <button
              onClick={searchGitHub}
              disabled={searchLoading}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7DCBF7] to-[#2596D1] text-white text-[13px] font-medium shadow-lg shadow-[#2596D1]/25 hover:shadow-xl hover:shadow-[#2596D1]/30 transition-all disabled:opacity-50"
            >
              {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </div>

          {/* Results */}
          {searchLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-[var(--primary)] animate-spin" />
            </div>
          ) : githubSkills.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-3" />
              <p className="text-[13px] text-[var(--text-muted)]">Search for skills</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Browse skills from openai/skills repository
              </p>
            </div>
          ) : (
            githubSkills.map((skill) => {
              const installed = isInstalled(skill.path)
              const isExpanded = expandedSkill === skill.path

              return (
                <div
                  key={skill.path}
                  className="p-4 rounded-2xl bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[13px] font-medium text-[var(--text-primary)]">
                          {skill.name}
                        </h4>
                        {skill.category && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            skill.category === 'curated' 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : skill.category === 'system'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}>
                            {skill.category}
                          </span>
                        )}
                        <a
                          href={`https://github.com/openai/skills/tree/main/${skill.path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--text-muted)] hover:text-[var(--primary)]"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] mt-1 line-clamp-2">
                        {skill.description}
                      </p>

                      {/* Expandable readme */}
                      {skill.readme && (
                        <button
                          onClick={() => setExpandedSkill(isExpanded ? null : skill.path)}
                          className="flex items-center gap-1 mt-2 text-[11px] text-[var(--primary)]"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3 h-3" /> Hide details
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" /> Show details
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Install button */}
                    <button
                      onClick={() => installFromGitHub(skill)}
                      disabled={installed || installing === skill.path}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                        installed
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20'
                      } disabled:opacity-50`}
                    >
                      {installing === skill.path ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : installed ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Installed
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" /> Install
                        </>
                      )}
                    </button>
                  </div>

                  {/* Expanded readme */}
                  {isExpanded && skill.readme && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                      <pre className="text-[11px] text-[var(--text-muted)] whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                        {skill.readme.slice(0, 2000)}
                        {skill.readme.length > 2000 && '...'}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
