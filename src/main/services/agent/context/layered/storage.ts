import * as fs from 'fs/promises'
import * as path from 'path'
import type { LayeredContextArchivePayload, LayeredContextIndexDocument } from './types'

const INDEX_DIR = 'layered-context'

function safeKey(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export interface LayeredContextStorage {
  loadIndex(sessionKey: string): Promise<LayeredContextIndexDocument | null>
  saveIndex(doc: LayeredContextIndexDocument): Promise<void>
  writeArchive(sessionKey: string, nodeId: string, payload: LayeredContextArchivePayload): Promise<string>
  readArchive(fullPath: string): Promise<LayeredContextArchivePayload | null>
  cleanupArchives(sessionKey: string, keepNodeIds: Set<string>): Promise<void>
}

export class FileSystemLayeredContextStorage implements LayeredContextStorage {
  constructor(private readonly baseDir: string) {}

  private getRootDir(): string {
    return path.join(this.baseDir, INDEX_DIR)
  }

  private getSessionDir(sessionKey: string): string {
    return path.join(this.getRootDir(), safeKey(sessionKey))
  }

  private getIndexPath(sessionKey: string): string {
    return path.join(this.getSessionDir(sessionKey), 'index.json')
  }

  private getArchiveDir(sessionKey: string): string {
    return path.join(this.getSessionDir(sessionKey), 'archives')
  }

  async loadIndex(sessionKey: string): Promise<LayeredContextIndexDocument | null> {
    try {
      const filePath = this.getIndexPath(sessionKey)
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw) as LayeredContextIndexDocument
      if (parsed.version !== 1) return null
      if (!Array.isArray(parsed.nodes)) return null
      return parsed
    } catch {
      return null
    }
  }

  async saveIndex(doc: LayeredContextIndexDocument): Promise<void> {
    const sessionDir = this.getSessionDir(doc.sessionKey)
    await fs.mkdir(sessionDir, { recursive: true })
    await fs.writeFile(this.getIndexPath(doc.sessionKey), JSON.stringify(doc, null, 2), 'utf-8')
  }

  async writeArchive(
    sessionKey: string,
    nodeId: string,
    payload: LayeredContextArchivePayload
  ): Promise<string> {
    const archiveDir = this.getArchiveDir(sessionKey)
    await fs.mkdir(archiveDir, { recursive: true })
    const filePath = path.join(archiveDir, `${safeKey(nodeId)}.json`)
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    return filePath
  }

  async readArchive(fullPath: string): Promise<LayeredContextArchivePayload | null> {
    try {
      const raw = await fs.readFile(fullPath, 'utf-8')
      return JSON.parse(raw) as LayeredContextArchivePayload
    } catch {
      return null
    }
  }

  async cleanupArchives(sessionKey: string, keepNodeIds: Set<string>): Promise<void> {
    try {
      const archiveDir = this.getArchiveDir(sessionKey)
      const files = await fs.readdir(archiveDir)
      const keepFiles = new Set([...keepNodeIds].map((id) => `${safeKey(id)}.json`))

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        if (keepFiles.has(file)) continue
        await fs.unlink(path.join(archiveDir, file))
      }
    } catch {
      // No-op if archive directory does not exist.
    }
  }
}
