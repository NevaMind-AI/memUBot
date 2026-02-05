import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import fetch from 'node-fetch'

/**
 * Skill metadata from SKILL.md frontmatter
 */
export interface SkillMetadata {
  name: string
  description: string
  shortDescription?: string
}

/**
 * Local skill information
 */
export interface LocalSkill {
  id: string
  name: string
  description: string
  path: string
  enabled: boolean
  source: 'local' | 'github'
  installedAt?: string
}

/**
 * GitHub skill from openai/skills repository
 */
export interface GitHubSkill {
  name: string
  path: string
  description?: string
  readme?: string
  category?: string // e.g., 'curated', 'experimental', 'system'
}

/**
 * Skills configuration
 */
interface SkillsConfig {
  enabledSkills: string[]
  disabledSkills: string[]
  githubToken?: string // Optional GitHub token for higher rate limits
}

/**
 * Cached GitHub skills data
 */
interface GitHubSkillsCache {
  skills: GitHubSkill[]
  timestamp: number
}

// Cache duration: 10 minutes
const CACHE_DURATION_MS = 10 * 60 * 1000

/**
 * Service for managing agent skills
 */
class SkillsService {
  private skillsDir: string
  private configPath: string
  private config: SkillsConfig = { enabledSkills: [], disabledSkills: [] }
  private initialized = false
  private githubSkillsCache: GitHubSkillsCache | null = null
  private userAgent: string = process.env.APP_MODE === 'yumi' ? 'yumi' : 'memu-bot'

  constructor() {
    const userDataPath = app.getPath('userData')
    this.skillsDir = path.join(userDataPath, 'skills')
    this.configPath = path.join(userDataPath, 'skills-config.json')
  }

  /**
   * Initialize the skills service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Ensure skills directory exists
    await fs.mkdir(this.skillsDir, { recursive: true })

    // Load configuration
    await this.loadConfig()

    this.initialized = true
    console.log('[Skills] Service initialized, skills directory:', this.skillsDir)
  }

  /**
   * Load skills configuration
   */
  private async loadConfig(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8')
      this.config = JSON.parse(data)
    } catch {
      // Config doesn't exist, use defaults
      this.config = { enabledSkills: [], disabledSkills: [] }
    }
  }

  /**
   * Save skills configuration
   */
  private async saveConfig(): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2))
  }

  /**
   * Parse SKILL.md frontmatter
   */
  private parseSkillMd(content: string): SkillMetadata | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) return null

    const frontmatter = frontmatterMatch[1]
    const metadata: Partial<SkillMetadata> = {}

    // Parse YAML-like frontmatter
    const lines = frontmatter.split('\n')
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/)
      if (match) {
        const [, key, value] = match
        if (key === 'name') metadata.name = value.trim()
        if (key === 'description') metadata.description = value.trim()
        if (key === 'short-description') metadata.shortDescription = value.trim()
      }
    }

    if (metadata.name && metadata.description) {
      return metadata as SkillMetadata
    }
    return null
  }

  /**
   * Get all installed skills
   */
  async getInstalledSkills(): Promise<LocalSkill[]> {
    await this.initialize()

    const skills: LocalSkill[] = []

    try {
      const entries = await fs.readdir(this.skillsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const skillPath = path.join(this.skillsDir, entry.name)
        const skillMdPath = path.join(skillPath, 'SKILL.md')

        try {
          const content = await fs.readFile(skillMdPath, 'utf-8')
          const metadata = this.parseSkillMd(content)

          if (metadata) {
            const isDisabled = this.config.disabledSkills.includes(entry.name)
            skills.push({
              id: entry.name,
              name: metadata.name,
              description: metadata.description,
              path: skillPath,
              enabled: !isDisabled,
              source: 'local'
            })
          }
        } catch {
          // SKILL.md doesn't exist or can't be read
        }
      }
    } catch (error) {
      console.error('[Skills] Failed to read skills directory:', error)
    }

    return skills
  }

  /**
   * Enable or disable a skill
   */
  async setSkillEnabled(skillId: string, enabled: boolean): Promise<boolean> {
    await this.initialize()

    if (enabled) {
      this.config.disabledSkills = this.config.disabledSkills.filter((id) => id !== skillId)
    } else {
      if (!this.config.disabledSkills.includes(skillId)) {
        this.config.disabledSkills.push(skillId)
      }
    }

    await this.saveConfig()
    return true
  }

  /**
   * Delete a skill
   */
  async deleteSkill(skillId: string): Promise<boolean> {
    await this.initialize()

    const skillPath = path.join(this.skillsDir, skillId)

    try {
      await fs.rm(skillPath, { recursive: true, force: true })
      this.config.disabledSkills = this.config.disabledSkills.filter((id) => id !== skillId)
      await this.saveConfig()
      return true
    } catch (error) {
      console.error('[Skills] Failed to delete skill:', error)
      return false
    }
  }

  /**
   * Validate a skill directory
   * Returns skill metadata if valid, null otherwise
   */
  async validateSkillDirectory(dirPath: string): Promise<SkillMetadata | null> {
    const skillMdPath = path.join(dirPath, 'SKILL.md')

    try {
      const content = await fs.readFile(skillMdPath, 'utf-8')
      const metadata = this.parseSkillMd(content)

      if (!metadata || !metadata.name) {
        console.log('[Skills] Invalid SKILL.md: missing name')
        return null
      }

      return metadata
    } catch (error) {
      console.log('[Skills] No SKILL.md found in directory')
      return null
    }
  }

  /**
   * Import a skill from a local directory
   * Validates the skill format and copies to the skills directory
   */
  async importFromDirectory(sourcePath: string): Promise<LocalSkill | null> {
    await this.initialize()

    // Validate the skill directory
    const metadata = await this.validateSkillDirectory(sourcePath)
    if (!metadata) {
      return null
    }

    // Use folder name as skill ID
    const skillId = path.basename(sourcePath).toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const destPath = path.join(this.skillsDir, skillId)

    // Check if skill already exists
    try {
      await fs.access(destPath)
      console.log('[Skills] Skill already exists:', skillId)
      // Could choose to overwrite or return error
      // For now, let's overwrite
      await fs.rm(destPath, { recursive: true, force: true })
    } catch {
      // Directory doesn't exist, that's fine
    }

    try {
      // Copy the entire directory
      await this.copyDirectory(sourcePath, destPath)

      return {
        id: skillId,
        name: metadata.name,
        description: metadata.description || '',
        path: destPath,
        enabled: true,
        source: 'local',
        installedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('[Skills] Failed to create skill:', error)
      return null
    }
  }

  /**
   * Copy a directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true })
    const entries = await fs.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await fs.copyFile(srcPath, destPath)
      }
    }
  }

  /**
   * Get GitHub API headers with optional token
   */
  private getGitHubHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': this.userAgent
    }
    if (this.config.githubToken) {
      headers['Authorization'] = `Bearer ${this.config.githubToken}`
    }
    return headers
  }

  /**
   * Set GitHub token for higher rate limits
   */
  async setGitHubToken(token: string | undefined): Promise<void> {
    await this.initialize()
    this.config.githubToken = token
    await this.saveConfig()
    // Clear cache when token changes
    this.githubSkillsCache = null
    console.log('[Skills] GitHub token updated')
  }

  /**
   * Get current GitHub token
   */
  async getGitHubToken(): Promise<string | undefined> {
    await this.initialize()
    return this.config.githubToken
  }

  /**
   * Fetch all GitHub skills and cache them
   */
  private async fetchAllGitHubSkills(): Promise<GitHubSkill[]> {
    const skills: GitHubSkill[] = []
    const categories = ['.curated', '.experimental', '.system']

    // Fetch skills from each category
    for (const category of categories) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/openai/skills/contents/skills/${category}`,
          { headers: this.getGitHubHeaders() }
        )

        if (!response.ok) {
          if (response.status === 403) {
            console.log(`[Skills] Rate limited for category ${category}. Consider adding a GitHub token.`)
          } else {
            console.log(`[Skills] Category ${category} not accessible:`, response.status)
          }
          continue
        }

        const contents = (await response.json()) as Array<{
          name: string
          path: string
          type: string
        }>

        // Filter directories (actual skills)
        const skillDirs = contents.filter(
          (item) => item.type === 'dir' && !item.name.startsWith('.')
        )

        // Get skill metadata for each directory
        for (const dir of skillDirs) {
          try {
            const skillMdResponse = await fetch(
              `https://raw.githubusercontent.com/openai/skills/main/${dir.path}/SKILL.md`,
              { headers: { 'User-Agent': this.userAgent } }
            )

            // Extract category name (remove leading dot)
            const categoryName = category.replace(/^\./, '')

            if (skillMdResponse.ok) {
              const content = await skillMdResponse.text()
              const metadata = this.parseSkillMd(content)

              skills.push({
                name: metadata?.name || dir.name,
                path: dir.path,
                description: metadata?.description || `Skill: ${dir.name}`,
                readme: content,
                category: categoryName
              })
            } else {
              // No SKILL.md, add with basic info
              skills.push({
                name: dir.name,
                path: dir.path,
                description: `Skill: ${dir.name}`,
                category: categoryName
              })
            }
          } catch {
            // Skip skills that fail to fetch
          }
        }
      } catch (error) {
        console.error(`[Skills] Failed to fetch category ${category}:`, error)
      }
    }

    return skills
  }

  /**
   * Search skills from openai/skills GitHub repository
   * Repository structure: skills/.system/, skills/.curated/, skills/.experimental/
   * Uses caching to avoid rate limits
   */
  async searchGitHubSkills(query: string): Promise<GitHubSkill[]> {
    await this.initialize()

    // Check if cache is valid
    const now = Date.now()
    if (
      this.githubSkillsCache &&
      now - this.githubSkillsCache.timestamp < CACHE_DURATION_MS
    ) {
      console.log('[Skills] Using cached GitHub skills')
      const cached = this.githubSkillsCache.skills

      // Filter by query
      if (query) {
        return cached
          .filter(
            (skill) =>
              skill.name.toLowerCase().includes(query.toLowerCase()) ||
              skill.description?.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 30)
      }
      return cached.slice(0, 30)
    }

    // Fetch and cache all skills
    console.log('[Skills] Fetching GitHub skills...')
    try {
      const skills = await this.fetchAllGitHubSkills()
      this.githubSkillsCache = { skills, timestamp: now }
      console.log(`[Skills] Cached ${skills.length} GitHub skills`)

      // Filter by query
      if (query) {
        return skills
          .filter(
            (skill) =>
              skill.name.toLowerCase().includes(query.toLowerCase()) ||
              skill.description?.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 30)
      }
      return skills.slice(0, 30)
    } catch (error) {
      console.error('[Skills] Failed to search GitHub skills:', error)
      return []
    }
  }

  /**
   * Install a skill from openai/skills GitHub repository
   */
  async installFromGitHub(skillPath: string): Promise<LocalSkill | null> {
    await this.initialize()

    try {
      // Get all files in the skill directory
      const response = await fetch(
        `https://api.github.com/repos/openai/skills/contents/${skillPath}`,
        { headers: this.getGitHubHeaders() }
      )

      if (!response.ok) {
        console.error('[Skills] Failed to fetch skill contents:', response.status)
        return null
      }

      const contents = (await response.json()) as Array<{
        name: string
        path: string
        type: string
        download_url: string | null
      }>

      // Create local skill directory
      const skillId = path.basename(skillPath)
      const localSkillPath = path.join(this.skillsDir, skillId)
      await fs.mkdir(localSkillPath, { recursive: true })

      // Download all files
      for (const item of contents) {
        if (item.type === 'file' && item.download_url) {
          const fileResponse = await fetch(item.download_url, {
            headers: { 'User-Agent': this.userAgent }
          })
          if (fileResponse.ok) {
            const content = await fileResponse.text()
            await fs.writeFile(path.join(localSkillPath, item.name), content)
          }
        } else if (item.type === 'dir') {
          // Recursively download subdirectories
          await this.downloadGitHubDirectory(item.path, path.join(localSkillPath, item.name))
        }
      }

      // Read SKILL.md to get metadata
      const skillMdPath = path.join(localSkillPath, 'SKILL.md')
      try {
        const content = await fs.readFile(skillMdPath, 'utf-8')
        const metadata = this.parseSkillMd(content)

        if (metadata) {
          return {
            id: skillId,
            name: metadata.name,
            description: metadata.description,
            path: localSkillPath,
            enabled: true,
            source: 'github',
            installedAt: new Date().toISOString()
          }
        }
      } catch {
        // SKILL.md not found
      }

      return {
        id: skillId,
        name: skillId,
        description: `Installed from openai/skills`,
        path: localSkillPath,
        enabled: true,
        source: 'github',
        installedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('[Skills] Failed to install from GitHub:', error)
      return null
    }
  }

  /**
   * Download a GitHub directory recursively
   */
  private async downloadGitHubDirectory(
    githubPath: string,
    localPath: string
  ): Promise<void> {
    await fs.mkdir(localPath, { recursive: true })

    const response = await fetch(
      `https://api.github.com/repos/openai/skills/contents/${githubPath}`,
      { headers: this.getGitHubHeaders() }
    )

    if (!response.ok) return

    const contents = (await response.json()) as Array<{
      name: string
      path: string
      type: string
      download_url: string | null
    }>

    for (const item of contents) {
      if (item.type === 'file' && item.download_url) {
        const fileResponse = await fetch(item.download_url, {
          headers: { 'User-Agent': this.userAgent }
        })
        if (fileResponse.ok) {
          const content = await fileResponse.text()
          await fs.writeFile(path.join(localPath, item.name), content)
        }
      } else if (item.type === 'dir') {
        await this.downloadGitHubDirectory(item.path, path.join(localPath, item.name))
      }
    }
  }

  /**
   * Get skill content for agent context
   */
  async getSkillContent(skillId: string): Promise<string | null> {
    await this.initialize()

    const skillPath = path.join(this.skillsDir, skillId, 'SKILL.md')
    try {
      return await fs.readFile(skillPath, 'utf-8')
    } catch {
      return null
    }
  }

  /**
   * Get all enabled skills content for agent context
   */
  async getEnabledSkillsContent(): Promise<string> {
    const skills = await this.getInstalledSkills()
    const enabledSkills = skills.filter((s) => s.enabled)

    if (enabledSkills.length === 0) return ''

    const contents: string[] = []
    for (const skill of enabledSkills) {
      const content = await this.getSkillContent(skill.id)
      if (content) {
        contents.push(`\n--- SKILL: ${skill.name} ---\n${content}\n`)
      }
    }

    return contents.length > 0
      ? `\n\n## Available Skills\n\nYou have access to the following skills:\n${contents.join('\n')}`
      : ''
  }

  /**
   * Get skills directory path
   */
  getSkillsDir(): string {
    return this.skillsDir
  }
}

export const skillsService = new SkillsService()
