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
  senderName: string
  content: string
  timestamp: Date
  isFromBot: boolean
  attachments?: MessageAttachment[]
}

interface MessageBubbleProps {
  message: MessageData
  botAvatarUrl?: string | null
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
  return attachment.contentType?.startsWith('image/') ?? false
}

/**
 * Check if attachment is a video
 */
function isVideo(attachment: MessageAttachment): boolean {
  return attachment.contentType?.startsWith('video/') ?? false
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
 * Shared Message Bubble Component - Discord style
 */
export function MessageBubble({ message, botAvatarUrl, colors }: MessageBubbleProps): JSX.Element {
  const { primary, primaryLight, primaryDark, secondary, secondaryDark } = colors

  // Generate CSS class for bot/user colors
  const botColorClass = `bg-[${primary}]/10 dark:bg-[${primary}]/20 border-[${primary}]/20 dark:border-[${primaryDark || primaryLight}]/30`
  const userColorClass = `bg-[${secondary}]/10 dark:bg-[${secondary}]/20 border-[${secondary}]/20 dark:border-[${secondaryDark || secondary}]/30`

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
      ) : (
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
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
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2 space-y-2">
            {message.attachments.map((att) => (
              <div key={att.id}>
                {isImage(att) ? (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={att.url}
                      alt={att.name}
                      className="max-w-full max-h-[300px] rounded-lg object-contain"
                      style={{
                        width: att.width ? Math.min(att.width, 400) : 'auto',
                        height: att.height ? Math.min(att.height, 300) : 'auto'
                      }}
                    />
                  </a>
                ) : isVideo(att) ? (
                  <video
                    src={att.url}
                    controls
                    className="max-w-full max-h-[300px] rounded-lg"
                    style={{ width: att.width ? Math.min(att.width, 400) : 'auto' }}
                  />
                ) : (
                  <a
                    href={att.url}
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
            ))}
          </div>
        )}

        {/* Content */}
        {message.content && (
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
                  )
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p
              className="text-[13px] text-[var(--text-primary)]"
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            >
              {message.content}
            </p>
          )
        )}
      </div>
    </div>
  )
}
