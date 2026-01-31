import { User, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface ThemeColors {
  // Primary colors for bot messages
  primary: string
  primaryLight: string
  // Primary colors for dark mode
  primaryDark?: string
  // Secondary colors for user messages
  secondary: string
  secondaryLight?: string
  secondaryDark?: string
}

export interface MessageAttachment {
  id: string
  name: string
  url: string
  contentType?: string
  size: number
  width?: number
  height?: number
}

export interface MessageData {
  id: string
  senderId?: string
  senderName: string
  content: string
  timestamp: Date
  isFromBot: boolean
  attachments?: MessageAttachment[]
}

interface MessageBubbleProps {
  message: MessageData
  botAvatarUrl?: string | null
  userAvatarUrl?: string | null
  colors: ThemeColors
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/**
 * Check if attachment is an image
 */
function isImage(attachment: MessageAttachment): boolean {
  // Check contentType first
  if (attachment.contentType?.startsWith('image/')) return true
  // Fallback: check file extension
  const ext = attachment.name?.toLowerCase().split('.').pop()
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext || '')
}

/**
 * Check if attachment is a video
 */
function isVideo(attachment: MessageAttachment): boolean {
  // Check contentType first
  if (attachment.contentType?.startsWith('video/')) return true
  // Fallback: check file extension
  const ext = attachment.name?.toLowerCase().split('.').pop()
  return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext || '')
}

/**
 * Get displayable URL for attachment (convert local paths to local-file:// protocol)
 */
function getDisplayUrl(url: string): string {
  // If already a URL (http/https/file/local-file), return as is
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://') || url.startsWith('local-file://')) {
    return url
  }
  // If it's an absolute path, convert to local-file:// URL (custom Electron protocol)
  if (url.startsWith('/')) {
    return `local-file://${url}`
  }
  // Otherwise return as is
  return url
}

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Parse local file paths from message content
 * Returns a map of filename -> local path
 */
function parseLocalFilePaths(content: string): Map<string, { path: string; mimeType: string }> {
  const localFiles = new Map<string, { path: string; mimeType: string }>()
  
  // Pattern: "- filename (mimetype): /path/to/file"
  const filePattern = /^- (.+?) \(([^)]+)\): (.+)$/gm
  let match
  
  while ((match = filePattern.exec(content)) !== null) {
    const [, name, mimeType, filePath] = match
    localFiles.set(name, { path: filePath, mimeType })
  }
  
  return localFiles
}

/**
 * Clean message content by removing internal file path hints
 * These are added for Agent processing but shouldn't be shown to users
 */
function cleanMessageContent(content: string): string {
  // Remove "[Attached files - use file_read tool to read content]:" section
  const attachedFilesPattern = /\n*\[Attached files - use file_read tool to read content\]:[\s\S]*$/
  let cleaned = content.replace(attachedFilesPattern, '')
  
  // Also handle the pattern from Discord/Slack: "--- Attachments ---" section
  const attachmentsPattern = /\n*--- Attachments ---[\s\S]*$/
  cleaned = cleaned.replace(attachmentsPattern, '')
  
  return cleaned.trim()
}

/**
 * Merge attachments with local file paths
 * Prioritizes local paths when available
 */
function mergeAttachmentsWithLocalPaths(
  attachments: MessageAttachment[] | undefined,
  localFiles: Map<string, { path: string; mimeType: string }>
): MessageAttachment[] {
  const result: MessageAttachment[] = []
  const usedLocalFiles = new Set<string>()

  // First, process existing attachments and enhance with local paths
  if (attachments) {
    for (const att of attachments) {
      const localFile = localFiles.get(att.name)
      if (localFile) {
        // Use local path for this attachment
        result.push({
          ...att,
          url: localFile.path,
          contentType: localFile.mimeType
        })
        usedLocalFiles.add(att.name)
      } else {
        result.push(att)
      }
    }
  }

  // Then, add any local files that weren't in attachments
  for (const [name, fileInfo] of localFiles) {
    if (!usedLocalFiles.has(name)) {
      result.push({
        id: `local-${name}`,
        name,
        url: fileInfo.path,
        contentType: fileInfo.mimeType,
        size: 0 // Size unknown for local files
      })
    }
  }

  return result
}

/**
 * Shared Message Bubble Component - Discord style
 */
export function MessageBubble({ message, botAvatarUrl, userAvatarUrl, colors }: MessageBubbleProps): JSX.Element {
  const { primary, primaryLight, primaryDark, secondary, secondaryDark } = colors

  // Parse local file paths from message content
  const localFiles = parseLocalFilePaths(message.content)
  
  // Merge attachments with local file paths (local paths take priority)
  const enhancedAttachments = mergeAttachmentsWithLocalPaths(message.attachments, localFiles)

  return (
    <div
      className={`flex gap-3 mb-3 ${message.isFromBot ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      {message.isFromBot ? (
        botAvatarUrl ? (
          <img
            src={botAvatarUrl}
            alt="Bot"
            className="w-8 h-8 rounded-full flex-shrink-0 object-cover border-2"
            style={{ borderColor: primary }}
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
            style={{ background: `linear-gradient(to bottom right, ${primary}, ${primaryLight})` }}
          >
            <Bot className="w-4 h-4 text-white" />
          </div>
        )
      ) : userAvatarUrl ? (
        <img
          src={userAvatarUrl}
          alt={message.senderName}
          className="w-8 h-8 rounded-full flex-shrink-0 object-cover border-2"
          style={{ borderColor: secondary }}
          onError={(e) => {
            // Hide on error, show fallback
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextElementSibling?.classList.remove('hidden')
          }}
        />
      ) : null}
      {/* User fallback icon - shown when no avatar or avatar fails to load */}
      {!message.isFromBot && (
        <div
          className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${userAvatarUrl ? 'hidden' : ''}`}
          style={{ background: `linear-gradient(to bottom right, ${secondary}, ${primary})` }}
        >
          <User className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={`max-w-[70%] overflow-hidden rounded-2xl px-4 py-2 border`}
        style={{
          backgroundColor: message.isFromBot
            ? `color-mix(in srgb, ${primary} 10%, transparent)`
            : `color-mix(in srgb, ${secondary} 10%, transparent)`,
          borderColor: message.isFromBot
            ? `color-mix(in srgb, ${primary} 20%, transparent)`
            : `color-mix(in srgb, ${secondary} 20%, transparent)`
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[12px] font-semibold"
            style={{ color: message.isFromBot ? (primaryDark || primary) : (secondaryDark || secondary) }}
          >
            {message.senderName}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {formatTime(message.timestamp)}
          </span>
        </div>

        {/* Attachments */}
        {enhancedAttachments.length > 0 && (
          <div className="mb-2 space-y-2">
            {enhancedAttachments.map((att) => {
              const displayUrl = getDisplayUrl(att.url)
              return (
                <div key={att.id}>
                  {isImage(att) ? (
                    <a
                      href={displayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={displayUrl}
                        alt={att.name}
                        className="max-w-full max-h-[300px] rounded-lg object-contain"
                        style={{
                          width: att.width ? Math.min(att.width, 400) : 'auto',
                          height: att.height ? Math.min(att.height, 300) : 'auto'
                        }}
                        onError={(e) => {
                          // If image fails to load, show placeholder
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          target.parentElement?.classList.add('hidden')
                        }}
                      />
                    </a>
                  ) : isVideo(att) ? (
                    <video
                      src={displayUrl}
                      controls
                      className="max-w-full max-h-[300px] rounded-lg"
                      style={{ width: att.width ? Math.min(att.width, 400) : 'auto' }}
                    />
                  ) : (
                    <a
                      href={displayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-input)] hover:opacity-80 transition-opacity"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-[var(--text-primary)] truncate">
                          {att.name}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {formatFileSize(att.size)}
                        </p>
                      </div>
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Content */}
        {message.content && cleanMessageContent(message.content) && (
          message.isFromBot ? (
            <div
              className="text-[13px] text-[var(--text-primary)] prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-headings:text-[var(--text-primary)]"
              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: ({ className, children, node, ...props }) => {
                    const isBlock = node?.position && className?.includes('language-')
                    return isBlock ? (
                      <code
                        className={`${className || ''} block p-2 rounded bg-slate-800 dark:bg-slate-900 text-slate-100 text-[12px]`}
                        style={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          overflowWrap: 'anywhere'
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <code
                        className="px-1 py-0.5 rounded bg-[var(--bg-input)] text-[12px]"
                        style={{
                          color: primaryDark || primary,
                          wordBreak: 'break-all',
                          overflowWrap: 'anywhere'
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  },
                  pre: ({ children }) => (
                    <pre
                      className="my-2 rounded-lg overflow-hidden"
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}
                    >
                      {children}
                    </pre>
                  ),
                  // Table styles
                  table: ({ children }) => (
                    <div className="my-2 overflow-x-auto rounded-lg border border-[var(--border-color)]">
                      <table className="w-full text-[12px] border-collapse">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-[var(--bg-input)]">
                      {children}
                    </thead>
                  ),
                  tbody: ({ children }) => (
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {children}
                    </tbody>
                  ),
                  tr: ({ children }) => (
                    <tr className="hover:bg-[var(--bg-input)]/50 transition-colors">
                      {children}
                    </tr>
                  ),
                  th: ({ children }) => (
                    <th
                      className="px-3 py-2 text-left font-semibold text-[var(--text-primary)] border-b border-[var(--border-color)]"
                      style={{ color: primaryDark || primary }}
                    >
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-2 text-[var(--text-primary)]">
                      {children}
                    </td>
                  ),
                  // Horizontal rule (divider) style
                  hr: () => (
                    <div className="my-3 flex items-center gap-2">
                      <div
                        className="flex-1 h-px"
                        style={{
                          background: `linear-gradient(to right, transparent, ${primaryDark || primary}40, transparent)`
                        }}
                      />
                    </div>
                  )
                }}
              >
                {cleanMessageContent(message.content)}
              </ReactMarkdown>
            </div>
          ) : (
            <p
              className="text-[13px] text-[var(--text-primary)]"
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            >
              {cleanMessageContent(message.content)}
            </p>
          )
        )}
      </div>
    </div>
  )
}
